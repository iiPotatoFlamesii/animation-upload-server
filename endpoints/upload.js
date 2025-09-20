const { warning, info, error, endpoints, isRequestCSRFVerified, getSetting } = require("../utils");
const { existsSync: pathExists } = require("node:fs");
const { writeFile } = require("node:fs/promises");
const { join: joinPath } = require("node:path");

const BinaryHeader = Buffer.from([0x3c, 0x72, 0x6f, 0x62, 0x6c, 0x6f, 0x78, 0x21, 0x89, 0xff, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const BinaryEnd = Buffer.from([0x45, 0x4e, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x09, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x3c, 0x2f, 0x72, 0x6f, 0x62, 0x6c, 0x6f, 0x78, 0x3e]);

async function upload(req, res, args) {
    const isVerified = args.verified;
    const RBX_Cookie = args.token;
    const currentTimestamp = Date.now().valueOf();
    var csrfToken = args.csrf;

    if(!isVerified) {
        res.status(401)
            .send("Not verified");
        console.log(error("E8: Attempted to upload while unverified!\nServer Response: 401"));
        return;
    }

    if(!isRequestCSRFVerified(req, args)) {
        res.status(401)
            .send("Unable to verify CSRF token");
        console.log(error("E12: BAU-CSRF Token is invalid!\nServer Response: 401"));
        return;
    }

    if(!csrfToken || (currentTimestamp - args.csrfTimestamp > 1_200_000)) {
        try {
            const csrfRequest = await fetch(endpoints.logout, {
                method: "POST",
                headers: {
                    cookie: `.ROBLOSECURITY=${RBX_Cookie}`
                }
            });

            csrfToken = csrfRequest.headers.get("x-csrf-token");
        } catch(e) {
            console.log(error(`E26: X-CSRF-TOKEN request failed: ${e.name} (${e.message})`))
        }

        if(!csrfToken) {
            res.status(500)
                .send("Unable to retrieve X-CSRF-Token");
            console.log(error("E9: Unable to retrieve X-CSRF-TOKEN!\nServer Response: 500"));
            return;
        }

        args.csrf = csrfToken
        args.csrfTimestamp = currentTimestamp;
    }

    console.log(info("Received animation upload request..."));

    const shouldSaveLocally = getSetting("saveLocally");
    const pathToSave = getSetting("localFilesLocation");

    let canSaveLocally = shouldSaveLocally == true && pathExists(pathToSave);

    const animationBuffer = args.animationQueue;
    if(animationBuffer == null || !Buffer.isBuffer(animationBuffer)) {
        res.status(400)
            .send("Missing Animation Buffer");
        console.log(error("E7: Passed Animation Buffer does not exist!\nServer Response: 400"));
        return;
    }

    args.animationQueue = null; // gc the animation buffer

    let uploadParameters = {
        groupId: null,
        title: null,
        description: ""
    }

    let byteOffset = 0;

    let numOfAnimations = animationBuffer.readUintLE(byteOffset, 1);
    byteOffset++;

    const uploadedAnimations = [];

    for(var x = 0; x < numOfAnimations; x++) {
        const i = x;
        let isGroupUpload = animationBuffer.readUintLE(byteOffset, 1);
        byteOffset++;

        if(isGroupUpload == 1) {
            let groupId = animationBuffer.readBigUint64LE(byteOffset);
            byteOffset += 8;

            uploadParameters.groupId = groupId;
        }

        let nameLength = animationBuffer.readUintLE(byteOffset, 1);
        byteOffset++;

        const name = animationBuffer.toString("utf8", byteOffset, byteOffset + nameLength);
        byteOffset += nameLength;

        uploadParameters.title = name;

        let animationDataLength = animationBuffer.readUint32LE(byteOffset);
        byteOffset += 4;

        console.log(info(`Uploading animation #${i + 1}: ${name}`));

        const uploadURL = endpoints.uploadAnimation(uploadParameters.title, uploadParameters.description, uploadParameters.groupId);
        const animationData = animationBuffer.subarray(byteOffset, byteOffset + animationDataLength);

        byteOffset += animationDataLength;

        if(!animationData.subarray(0, 16).equals(BinaryHeader)) {
            // res.status(400)
            //     .send("Binary data malformed");
            console.log(warning("E14: Animation Data does not contain the proper file header!"));
            continue;
        }

        if(!animationData.subarray(animationData.length - 25).equals(BinaryEnd)) {
            // res.status(400)
            //     .send("Binary data malformed");
            console.log(warning("E15: Animation Data does not contain the proper file ending!"));
            continue;
        }

        let uploadRequest;
        
        try {
            uploadRequest = await fetch(uploadURL, {
                method: "POST",
                headers: {
                    cookie: `.ROBLOSECURITY=${RBX_Cookie}`,
                    "User-Agent": "RobloxStudio/WinInet",
                    "Content-Type": "application/octet-stream",
                    "X-CSRF-Token": csrfToken
                },
                body: animationData,
                signal: AbortSignal.timeout(5000)
            });
        } catch(e) {
            console.log(error(`E25: Animation #${i + 1} failed to upload due to ${e.name} (${e.message})`));
            continue;
        }

        if(uploadRequest.status !== 200) {
            let serverError = await uploadRequest.text();
            // res.status(500)
            //     .send(`RAPI ERROR: ${serverError}`);
            console.log(warning(`Animation #${i + 1} RAPI ERROR: ${serverError}`));
            continue;
        }

        const id = await uploadRequest.text();

        console.log(info(`Successfully uploaded ${name} @ https://create.roblox.com/store/asset/${id} !`));

        if(canSaveLocally) {
            let savePath = joinPath(pathToSave, `${name}_${id}.rbxm`);

            writeFile(savePath, animationData);
        }

        uploadedAnimations[i] = {name: name, id: id};
    }

    res.status(200)
        .json(uploadedAnimations);
}

exports.handler = upload;

exports.info = {
    endpoints: ["/upload"],
    methods: ["POST"],
    parser: "raw",
}