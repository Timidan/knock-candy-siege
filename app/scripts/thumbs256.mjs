import { readdir, mkdir, stat } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const source = new URL('../public/chogs/', import.meta.url)
const destination = new URL('../public/chogs-256/', import.meta.url)
await mkdir(destination, { recursive: true })
const files = (await readdir(source)).filter(name => /^\d+\.webp$/.test(name))
let written = 0
// Four workers keep ImageMagick from swamping a laptop while processing the collection.
await Promise.all(Array.from({ length: 4 }, async () => {
  for (;;) {
    const file = files.pop()
    if (!file) return
    const input = new URL(file, source), output = new URL(file, destination)
    const existing = await stat(output).catch(() => null)
    if (existing && existing.mtimeMs >= (await stat(input)).mtimeMs) continue
    await run('magick', [input.pathname, '-resize', '256x256', '-quality', '82', output.pathname])
    if (!(await stat(output)).size) throw Error(`Empty thumbnail: ${file}`)
    written++
  }
}))
console.log(`Wrote ${written} portraits at 256px to public/chogs-256/`)
