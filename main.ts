import { app, BrowserWindow } from 'electron'
import { resolve } from 'path'

function createWindow() {
  let win = new BrowserWindow({
    // width: 800,
    // height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: resolve('dist/preload.js'),
    },
  })
  win.loadFile('index.html')
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length == 0) {
    createWindow()
  }
})
