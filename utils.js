const chalk = require("chalk");
const fs = require("node:fs");
const { appendFile: promiseAppend } = require("node:fs/promises");
const { app: electronApp, BrowserWindow: electronWindow, ipcMain } = require("electron");
const { randomBytes, createHash } = require("node:crypto");
const { findPassword } = require("keytar");
const { join: joinPath } = require("node:path");

const hashSalt = randomBytes(8);

const appSettings = {
    saveLocally: false,
    runAtStartup: true,
    localFilesLocation: ""
}

const electronUserDataPath = electronApp.getPath("userData");
const electronLogFileName = (new Date().toISOString()).replace(/[/\\?%*:|"<>]/g, "-") + ".log";
const electronLogFilePath = joinPath(electronUserDataPath, "logs", electronLogFileName);

if(!fs.existsSync(joinPath(electronUserDataPath, "logs"))) {
    fs.mkdirSync(joinPath(electronUserDataPath, "logs"));
}

const token_warning = "_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_";

const endpoints = {
    "getAllGroups": (userId) => `https://groups.roblox.com/v1/users/${userId}/groups/roles`,
    "getGroupPermissions": (groupId, roleId) => `https://groups.roblox.com/v1/groups/${groupId}/roles/${roleId}/permissions`,
    "authentication": "https://users.roblox.com/v1/users/authenticated",
    "logout": "https://auth.roblox.com/v2/logout",
    "uploadAnimation": (title, description, groupId) => "https://www.roblox.com/ide/publish/uploadnewanimation?assetTypeName=Animation" +
    `&name=${encodeURIComponent(title)}` +
    `&description=${encodeURIComponent(description)}` +
    "&AllID=1&ispublic=False&allowComments=True&isGamesAsset=False" +
    (groupId != null ? `&groupId=${groupId}` : ""),
};

const warning = (...a) => {writeToLogFile("[WARNING]: " + a.join(" ")); return chalk.bgYellow.black(a)};
const info = (...a) => {writeToLogFile("[INFO]: " + a.join(" ")); return chalk.blue(a)};
const error = (...a) => {writeToLogFile("[ERROR]: " + a.join(" ")); return chalk.bold.bgBlack.red(a)};

function writeToLogFile(message) {
    const date = new Date(); // theres gotta be a better way to record timestamps
    return promiseAppend(electronLogFilePath, `[${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}] ${message}\n`);
}

function getCookie() {
    return new Promise(async (resolve) => {
        let override_cookie = appSettings["RBX_COOKIE_OVERRIDE"];
        if(override_cookie) {
            resolve(override_cookie);
            return;
        }

        var cookie;

        // thanks to evaera/roblox-animation-transfer for this code
        if (process.platform === "darwin") {
            const homePath = electronApp.getPath("home");
            const binaryCookiePath = joinPath(homePath, "Library/HTTPStorages/com.Roblox.RobloxStudio.binarycookies");

            if(fs.existsSync(binaryCookiePath)) {
                const binaryCookieData = fs.readFileSync(binaryCookiePath, { encoding: "utf-8" });
        
                const matchGroups = binaryCookieData.match(/_\|WARNING:-DO-NOT-SHARE-THIS\.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items\.\|_[A-F\d]+/)
        
                if(matchGroups !== null && matchGroups.length > 0) {
                    cookie = matchGroups[0];
                }
            }
        } else {
            cookie = await findPassword("https://www.roblox.com:RobloxStudioAuth.ROBLOSECURITY");
        }

        if(cookie !== null) return resolve(cookie);

        let hasResolved = false;

        var promptWindow = new electronWindow({
            width: 500,
            height: 200,
            frame: false,
            title: "Animation Upload Server",

            webPreferences: {
                preload: joinPath(__dirname, "prompt", "preload.js")
            },

            alwaysOnTop: true,
            maximizable: false,
            resizable: false
        })

        promptWindow.loadFile(joinPath(__dirname, "prompt", "index.html"));

        promptWindow.once("close", () => {
            if(hasResolved == false) resolve(null);

            ipcMain.removeAllListeners("submitCookie");
        })

        ipcMain.once("submitCookie", (event, cookie) => {
            hasResolved = true;

            promptWindow.close();

            if(typeof cookie !== "string") return resolve(null);

            if(cookie.substring(0, token_warning.length) != token_warning) return resolve(null);

            resolve(cookie);
        })
    })
};

function generateSessionToken(userId) {
    const timeGeneration = Date.now();
    timeGeneration.valueOf();

    userId = String(userId);
    let bufferSize = userId.length + 14
    let content = Buffer.alloc(bufferSize);
    content.write(userId);
    hashSalt.copy(content, bufferSize - 12);
    content.writeUIntLE(timeGeneration.valueOf(), bufferSize - 8, 6);

    return createHash("md5").update(content).digest("hex");
}

function secureCompare(str1, str2) {
    if(typeof str1 != "string" || typeof str2 != "string") return false;

    if (str1.length !== str2.length) {
      return false;
    }
  
    let result = 0;
    for (let i = 0; i < str1.length; i++) {
      result |= str1.charCodeAt(i) ^ str2.charCodeAt(i);
    }
  
    return result === 0;
}

function isRequestCSRFVerified(req, args) {
    return secureCompare(req.get("bau-x-csrf-token"), args.sessionToken);
}

function closeSession(args) {
    if(args.verified) console.log(info("Closed Session"));
    if(args.timeoutId) {
        clearTimeout(args.timeoutId);
    }

    args.verified = false;
    args.csrf = null;
    args.sessionToken = null;
    args.token = null;
    args.userId = null;
    args.timeoutId = null;
    args.animationQueue = null;
}

function getSetting(setting) {
    return appSettings[setting];
}

function setSetting(setting, value) {
    appSettings[setting] = value;
}

function toggleSetting(setting) {
    appSettings[setting] = !appSettings[setting];
}

function getSettings() {
    return Object.freeze({ ...appSettings });
}

exports.closeSession = closeSession;
exports.isRequestCSRFVerified = isRequestCSRFVerified;
exports.generateSessionToken = generateSessionToken;
exports.getCookie = getCookie;

exports.getSetting = getSetting;
exports.setSetting = setSetting;
exports.toggleSetting = toggleSetting;
exports.getSettings = getSettings;

exports.logFilePath = electronLogFilePath;

exports.endpoints = endpoints;

exports.warning = warning;
exports.info = info;
exports.error = error;