<div align="center">
  <img src="/icons/icon.png" width=250 height=250></img>
  <h1>animation-upload-server</h1>

  <p>The open source backend server for the ROBLOX Studio Bulk Animation Upload plugin</p>
</div>
<br />
<h1>🔨 Installation</h1>
<p>Head over to the <a href="https://github.com/iiPotatoFlamesii/animation-upload-server/releases">releases page</a> and download the latest version.

After downloading, extract it to wherever you'd like, and run the executable inside.

Want to run it from the source? Head over to the <a href="#running-locally">running locally</a> section!</p>

<h1>💻 Usage</h1>
<h3>General Usage</h3>
Once started, the server will show up as a tray item. On Windows, this will be located on the taskbar, typically in the bottom right, and on MacOS, this will show up in the top bar. Clicking this tray item will cause the Server menu to show up.<br /><br />

The server will, by default, attempt to host on <strong>port 25037</strong>. In the case that this isn't available, it will use another open port. This port can be viewed at the top of the Server menu, under <strong>Hosted Port: xxxxx</strong>. You can click this button to copy the hosted port, which you can then paste into the plugin in order to connect. Below this, you'll see a status label that shows the current status of the server. A status of <strong>Unverified</strong> indicates that the server is ready, but is not yet connected to the Studio plugin. After connecting, the status label should instead show the <strong>Ready</strong> status.

<h3>Settings</h3>
Currently, there are a few QoL settings in the server. First, and most useful, is the <strong>Run at Startup</strong> setting. This makes it so that everytime you start your computer, the server silently opens in the background, ready for any connections. When paired with the Studio plugin's Auto Connect feature, it makes the plugin usable right from the get-go, ready to import any and all animations.<br /><br />

The other setting available at the moment is the <strong>Save instances locally</strong> setting. This setting will save all RBXM binaries that are uploaded to ROBLOX locally, which allows you to organize and keep a copy of each animation for easy re-importing. Once enabled, you are able to set it to any location (given that the location is writeable), and the server will do the rest. If you forgot where it is, there's also an option to open the location in the settings menu as well.

<h3>Running Locally</h3>
<p>Interested in running the server from the source directly? Make sure you have at least <code>NodeJS v22.10.0 (LTS)</code> installed. Clone this repository and run <code>npm install</code> to install all packages. Finally, run <code>npm run start</code> to start the server! Do note that running from the source like this removes the <strong>Run at Startup</strong> feature due to the way Electron works.

Make some changes, and want to build the executable yourself? Run <code>npm run make</code>, which will output the final executable into the <code>out</code> directory.</p>

<h1>🐛 Reporting Issues</h1>
Run into an issue with the server? Report it at the <a href="https://github.com/iiPotatoFlamesii/animation-upload-server/issues">issues page</a>! If you received an Electron error, please take a screenshot of the error window. Please also upload a copy of your server logs, which can be accessed by pressing the <strong>Open Logs</strong> button on the server menu. This will help with solving any issues!

<h1>❓ FAQ</h1>
<p><strong>Q: Why does the server need my <code>.ROBLOSECURITY</code> token? What is it used for?</strong></p>
<p><strong>A:</strong> The server uses your <code>.ROBLOSECURITY</code> token for two things:
  <ol>
    <li>Uploading animations to ROBLOX</li>
    <li>Getting which groups the user is able to upload assets to</li>
  </ol>
That's it! The reason why this server is open source is to show that this token is used only for these two purposes, and nothing else.
</p>

<p><strong>Q: (MACOS) Why is the server asking for access to my Documents/Library?</strong></p>
<p><strong>A:</strong> On MacOS, you might be asked to allow the server access to your Documents and/or Library. This is to get your <code>.ROBLOSECURITY</code> token, which is needed to upload animations.</p>

<p><strong>Q: Which account is used to upload animations?</strong></p>
<p><strong>A:</strong> The account that is <strong>currently logged into Studio</strong> is the account that will upload animations. Even if you are logged into a different account on the ROBLOX homepage, the account that is used is the one logged into Studio.</p>

<p><strong>Q: Why does the server use my clipboard?</strong></p>
<p><strong>A:</strong> The server uses your clipboard for integration with the ROBLOX Blender animation plugin. The blender animation plugin writes the encoded animation data to your clipboard, and when you import it in Studio, the server will grab the clipboard contents and attempt to decode it.</p>

<p><strong>Q: I'm receiving an "Unable to authorize with cookie" error in the output. What do I do?</strong></p>
<p><strong>A:</strong> If you are receiving this error, there are two solutions that are currently available to you. This guide shows both methods on how to fix this: <a href="https://github.com/iiPotatoFlamesii/animation-upload-server/issues/1">[GUIDE] Receiving "unable to authorize with cookie" error.</a></p>