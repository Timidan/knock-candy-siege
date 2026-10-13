import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, resolve, extname, sep } from 'node:path'
import { homedir } from 'node:os'

const cache = join(homedir(), '.cache/knock-coop')
const roots = [join(cache, 'site'), join(cache, 'snapshot/app/public')]
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.css': 'text/css', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' }
const server = createServer(async (request, response) => {
  let name
  try { name = decodeURIComponent(new URL(request.url, 'http://localhost:5200').pathname) } catch { response.writeHead(400).end(); return }
  if (name === '/') name = '/index.html'
  for (const root of roots) {
    const file = resolve(root, `.${name}`)
    if (!file.startsWith(root + sep)) continue
    try {
      if (!(await stat(file)).isFile()) continue
      response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(await readFile(file)); return
    } catch { /* Try the frozen public asset directory. */ }
  }
  response.writeHead(404).end('Not found')
})
server.listen(5200, 'localhost', () => console.log('Co-op harness: http://localhost:5200'))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)))
