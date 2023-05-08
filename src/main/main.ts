/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

import SignalHistoryClient from '../services/SignalHistoryClient';
import { IpcMainParticipant } from '../services/IpcParticipant';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

const ipcParticipant = new IpcMainParticipant(ipcMain)

// ipcParticipant.emit("GET_ALL_CONVERSATIONS", { err, conversations })

ipcParticipant.respond("GET_DASHBOARD_DATA", async () => {

  const signalHistoryClient = new SignalHistoryClient();

  // const [conversationsErr, conversations] = await signalHistoryClient.getAllConversations()

  const { items } = await signalHistoryClient.getDatabaseInfo()

  // @ts-ignore
  const itemsObj = items[1].reduce((obj, i) => ({...obj, [i.id]: i}), {})

  const deviceName = JSON.parse(itemsObj.device_name?.json ?? "null")?.value
  const phoneNr = JSON.parse(itemsObj.number_id?.json ?? "null")?.value
  const userId = JSON.parse(itemsObj.uuid_id?.json ?? "null")?.value
  const avatarUrl = JSON.parse(itemsObj.avatarUrl?.json ?? "null")?.value

  const clientInfo = {
    deviceName,
    phoneNr,
    userId,
    avatarUrl,
  }
  const [conversationsErr, conversations] = await signalHistoryClient.getAllConversationsWithMessages()

  // @ts-ignore
  conversations.sort((a, b) => b.numMessages - a.numMessages)

  const onlyValidConversations = conversations
    .filter(i => i.name != null)
    // @ts-ignore
    .filter(i => i.numMessages > 0)

  // TODO: this literally takes a full second
  // for (const conversation of conversations) {

  //   const [messagesErr, messages] = await signalHistoryClient.getAllMessages("63ef615b-0062-45b8-8b69-f505e0d79fd5")

  //   allMessages.concat(messages ?? [])
  // }

  return { 
    err: null,
    conversations: onlyValidConversations,
    clientInfo,
   }
})

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
