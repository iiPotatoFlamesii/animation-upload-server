const express = require("express");
const fs = require("node:fs");
const http = require("http");
const { app: electronApp, clipboard, dialog, shell, Menu, Tray, nativeImage } = require("electron");
const { info, warning, getSetting, setSetting, toggleSetting, getSettings, logFilePath } = require("./utils");
const { join: joinPath, resolve: resolvePath } = require("node:path");
const { raw, text } = require("body-parser");

const expressApp = express();
const httpServer = http.createServer(expressApp);
const defaultPort = 25037;

const electronUserDataPath = electronApp.getPath("userData");
const settingsPath = joinPath(electronUserDataPath, "settings.json");
const platform = process.platform;

const endpointPath = joinPath(__dirname, "endpoints");

const endpointData = {
    "raw": [],
    "text": []
};

const endpointModules = [];

const sessionData = {
    "csrf": null,
    "verified": false,
    "token": null,
    "userId": null,
    "sessionToken": null,
    "timeoutId": null,
    "animationQueue": null, // replaced with a buffer when queued
    "compressionQueue": null, // same as above
};

const files = fs.readdirSync(endpointPath);

let trayImagePath;

if(platform === "darwin") {
    let path = joinPath(electronApp.getPath("documents"), "Roblox");

    trayImagePath = joinPath(__dirname, "icons", "iconTemplate.png");
    
    if(!fs.existsSync(path)) throw new Error("Failed to find platform DARWIN path. Please report on GitHub.");

    setSetting("pluginData", path);
} else {
    let path = resolvePath(process.env.LOCALAPPDATA, "Roblox");

    trayImagePath = joinPath(__dirname, "icons", "icon.png");

    if(!fs.existsSync(path)) throw new Error("Failed to find platform WIN32 path. Please report on GitHub.");

    setSetting("pluginData", path);
}

files.forEach((fileName) => {
    if(fileName.split(".").pop() !== "js") return;

    const endpointModule = require(joinPath(endpointPath, fileName));
    const endpointInfo = endpointModule.info;

    endpointData[endpointInfo.parser].push(...endpointInfo.endpoints);
    endpointModules.push(endpointModule);
});

expressApp.use(endpointData.raw, raw({
    type: "text/plain",
    limit: "2mb"
}));

expressApp.use(endpointData.text, text({
    type: "text/plain",
}));

endpointModules.forEach((endpointModule) => {
    const endpointInfo = endpointModule.info;

    expressApp.all(endpointInfo.endpoints, (req, res) => {
        if(!endpointInfo.methods.includes(req.method)) {
            res.status(404)
                .send(`Cannot ${req.method} ${req.path}`);
            return;
        }

        endpointModule.handler(req, res, sessionData);
    })
})

let hostedPort = defaultPort;

function listenToPort(port) {
    const listener = httpServer
        .listen(port, () => {
            hostedPort = listener.address().port;
            console.log(info(`Listening on port ${hostedPort}`));
        })
        .on("error", (err) => {
            if(err.code === "EADDRINUSE") {
                console.log(warning(`Port ${port} is unavailable, defaulting to unused port`));
                httpServer.listen();
            }
        });
};

listenToPort(defaultPort);

function electronSaveSettings() {
    const settings = getSettings();
    const loginItemSettings = {
        openAtLogin: settings.runAtStartup,
    }

    electronApp.setLoginItemSettings(loginItemSettings);
    fs.writeFileSync(settingsPath, JSON.stringify(settings));
}

electronApp.on("window-all-closed", () => {}); // prevent window-close from quitting app

electronApp.whenReady().then(() => {
    if(!fs.existsSync(settingsPath)) {
        electronSaveSettings();
    }

    const previousSettings = JSON.parse(fs.readFileSync(settingsPath));

    if(previousSettings) {
        for(var [key, value] of Object.entries(previousSettings)) {
            setSetting(key, value);
        }
    }

    let loginSettings = electronApp.getLoginItemSettings();
    if(loginSettings) {
        setSetting("runAtStartup", loginSettings.openAtLogin);
    }

    const settingsMenu = Menu.buildFromTemplate([
        { label: "Run at startup", checked: true, type: "checkbox", id: "startup", click: () => {toggleSetting("runAtStartup"); electronSaveSettings()} },
        { type: "separator" },
        { label: "Save instances locally", checked: false, type: "checkbox", id: "saveInstances", click: () => {toggleSetting("saveLocally"); electronSaveSettings()} },
        { label: "Set file location", enabled: false, id: "setLocation", click: () => {
            const directoryPath = dialog.showOpenDialogSync({
                properties: ["openDirectory"]
            });

            if(!directoryPath) return;
            setSetting("localFilesLocation", resolvePath(...directoryPath));
        } },
        { label: "Open instance folder", enabled: false, id: "openLocation", click: () => {
            let instancesLocation = getSetting("localFilesLocation");
            if(!instancesLocation || instancesLocation.length <= 0) return; 

            shell.openPath(instancesLocation);
        }}
    ])

    function updateSettingsMenu() {
        let runAtStartup = getSetting("runAtStartup");
        let saveInstancesLocally = getSetting("saveLocally");

        let startupButton = settingsMenu.getMenuItemById("startup");
        let saveInstancesButton = settingsMenu.getMenuItemById("saveInstances");
        let setLocationButton = settingsMenu.getMenuItemById("setLocation");
        let openLocationButton = settingsMenu.getMenuItemById("openLocation");

        startupButton.checked = runAtStartup;
        saveInstancesButton.checked = saveInstancesLocally;
        setLocationButton.enabled = saveInstancesLocally;
        openLocationButton.enabled = saveInstancesLocally;
    }

    const tray =  new Tray(nativeImage.createFromPath(trayImagePath));
    const contextMenu = [
        { label: `Hosted Port: ${hostedPort}`, type: "normal", click: () => clipboard.writeText(String(hostedPort)) },
        { label: "Status: Unverified", enabled: false },
        { type: "separator" },
        { label: "Open Logs", type: "normal", click: () => shell.openPath(logFilePath) },
        { type: "separator" },
        { label: "Settings", type: "submenu", submenu: settingsMenu },
        { type: "separator" },
        { label: "Quit", type: "normal", role: "quit" }
    ];

    function showContextMenu() {
        updateSettingsMenu();

        contextMenu[1].label = `Status: ${sessionData.verified == true ? "Ready" : "Unverified"}`

        let menu = Menu.buildFromTemplate(contextMenu);
        
        tray.setContextMenu(menu);
        tray.popUpContextMenu();
    }

    tray.setToolTip("Animation Server");
    
    tray.on("click", showContextMenu);
    tray.on("right-click", showContextMenu)
});