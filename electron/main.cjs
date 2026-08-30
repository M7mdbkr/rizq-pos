const { app, BrowserWindow, Menu } = require('electron')
const path = require('path')
const http = require('http')
const fs = require('fs')

const DIST_DIR = path.join(__dirname, '..', 'dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
}

/** Tiny static file server so absolute-path assets (e.g. /sql-wasm.wasm) resolve
 * the same way they do under `vite preview` — file:// would break those paths. */
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = decodeURIComponent((req.url || '/').split('?')[0])
      if (reqPath === '/') reqPath = '/index.html'
      const filePath = path.join(DIST_DIR, reqPath)
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404)
          res.end('Not found')
          return
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' })
        res.end(data)
      })
    })
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

let server

async function createWindow() {
  server = await startServer()
  const { port } = server.address()

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'رزق — نظام الكاشير',
    icon: path.join(DIST_DIR, 'favicon.svg'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  Menu.setApplicationMenu(null)
  win.loadURL(`http://127.0.0.1:${port}`)
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (server) server.close()
  if (process.platform !== 'darwin') app.quit()
})
