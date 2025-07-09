const fs = require("node:fs");
const { warning, info, error, getCookie, endpoints, generateSessionToken, closeSession, getSetting } = require("../utils");
const { join: joinPath } = require("node:path");

const PluginId = 134443954464349;

const AcceptedVersion = "3"; // version control in case there are any breaking API changes.
// 2 corresponds lasts up to v1.0.3
// 3 corresponds corresponds to most current version; fixed API name change

async function verify(req, res, args) {
    if(args.verified) {
        res.status(418)
            .send("Session is already running, close previous session.");
        console.log(error("Verification request received despite ongoing session\nServer Response: 418"));
        return;
    }

    closeSession(args);

    console.log(info("Received verification request..."));

    const ClientVersion = req.get("bau-plugin-version");
    if(ClientVersion !== AcceptedVersion) {
        res.status(500)
            .send(`Outdated version. Animation Server Version: ${AcceptedVersion}. Plugin Version: ${ClientVersion}.`);
        console.log(error("Plugin request does not match the given version of Animation Server.\nServer Response: 500"));
        return;
    }

    const body = req.body;
    if(body == null || body.length == 0) {
        res.status(400)
            .send("No UserId specified");
        console.log(error("E3: No UserId passed!\nServer Response: 400"));
        return;
    }

    const clientUserId = Number(body);
    if(clientUserId != clientUserId) {
        res.status(400)
            .send("UserId unable to be parsed");
        console.log(error("E4: Cannot parse '%s'!\nServer Response: 400"), body);
        return;
    }

    const pluginDataPath = joinPath(getSetting("pluginData"), String(clientUserId), "InstalledPlugins", String(PluginId));
    const rawPluginSettingsPath = joinPath(pluginDataPath, "settings.json");

    if(!fs.existsSync(pluginDataPath) || !fs.existsSync(rawPluginSettingsPath)) {
        res.status(400)
            .send("UserId specified does not own the plugin");
        console.log(error("E20: User does not own the plugin.\nServer Response: 400"));
        return;
    }

    const userToken = req.get("bau-x-request-token");
    const rawPluginSettings = fs.readFileSync(rawPluginSettingsPath);
    const pluginSettings = JSON.parse(rawPluginSettings);

    if(pluginSettings.BulkAnimationUpload_RequestToken !== userToken) {
        res.status(400)
            .send("Malicious plugin request");
        console.log(error("E21: Plugin request token does not match given request token. Assumed to be a malicious plugin result."));
        console.log(warning("Possible malicious plugin attempt received!"));
        return;
    }

    if(!args.token) {
        let cookie = await getCookie();
        if(!cookie) {
            res.status(500)
                .send("Unable to get ROBLOSECURITY");
            console.log(error("E0: Couldn't get ROBLOSECURITY!\nServer Response: 500"));
            return;
        }

        args.token = cookie;
    }

    let authenticatedRequest;

    try {
        authenticatedRequest = await fetch(endpoints.authentication, {
            headers: {
                cookie: `.ROBLOSECURITY=${args.token}`
            }
        });
    } catch(e) {
        res.status(500)
            .send("Unable to authorize with cookie");
        console.log(error(`E27: Unable to send account authorization request! ${e.name} (${e.message})`));
        return;
    }

    if(authenticatedRequest.status !== 200) {
        res.status(500)
            .send("Unable to authorize with cookie");
        console.log(error("E5: Unable to authorize account with ROBLOSECURITY\nServer Response: 500"));
        return;
    }

    const verificationData = await authenticatedRequest.json();
    if(verificationData.id != clientUserId) {
        res.status(401)
            .send("Received Client UserId does not match ROBLOSECURITY");
        console.log(error("E6: Client UserId does not match authenticated account!\nServer Response: 401"));
        return;
    }

    console.log(info(`Successfully verified user: ${verificationData.name} (${verificationData.displayName} - ${verificationData.id})`));

    const newSessionToken = generateSessionToken(clientUserId);

    args.sessionToken = newSessionToken;
    args.userId = clientUserId;
    args.verified = true;

    args.timeoutId = setTimeout(closeSession, 60000, args);

    res.set("bau-x-csrf-token", newSessionToken);
    res.status(200)
        .send("Verified!");
}

exports.handler = verify;

exports.info = {
    endpoints: ["/verify"],
    methods: ["POST"],
    parser: "text",
}