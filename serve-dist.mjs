import http from 'http'
import fs from 'fs'
import path from 'path'

const root = path.resolve('dist')
const port = 4188
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
}

http
  .createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0])
    if (p === '/') p = '/index.html'
    const fp = path.join(root, p)
    fs.readFile(fp, (e, d) => {
      if (e) {
        res.writeHead(404)
        res.end('404')
        return
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(fp)] || 'application/octet-stream' })
      res.end(d)
    })
  })
  .listen(port, () => console.log('dist serving on ' + port))
