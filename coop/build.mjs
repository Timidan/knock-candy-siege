import { build } from '../app/node_modules/vite/dist/node/index.js'
import { cp, mkdir, readFile, writeFile, readdir, symlink, lstat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const coop = dirname(fileURLToPath(import.meta.url)), project = resolve(coop, '..')
const cache = join(homedir(), '.cache/knock-coop'), snapshot = join(cache, 'snapshot')
await mkdir(join(snapshot, 'app'), { recursive: true }); await mkdir(join(snapshot, 'coop'), { recursive: true })
// Freeze a read-only input copy so concurrent game edits cannot change a running test.
for (const part of ['src', 'public']) await cp(join(project, 'app', part), join(snapshot, 'app', part), { recursive: true })
for (const name of ['single-hero.ts', 'harness.ts', 'harness.html']) await cp(join(coop, name), join(snapshot, 'coop', name))
try { await lstat(join(snapshot, 'node_modules')) } catch { await symlink(join(project, 'app/node_modules'), join(snapshot, 'node_modules'), 'dir') }
const manifest = {}
async function inventory(directory, prefix = '') {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = `${prefix}${entry.name}`, path = join(directory, entry.name)
    if (entry.isDirectory()) await inventory(path, `${name}/`)
    else manifest[name] = createHash('sha256').update(await readFile(path)).digest('hex')
  }
}
await inventory(join(snapshot, 'app/src'), 'src/'); await inventory(join(snapshot, 'app/public'), 'public/')
const fingerprint = createHash('sha256').update(JSON.stringify(manifest)).digest('hex')
const buildId = `phase1-${fingerprint.slice(0, 24)}`
await mkdir(join(cache, 'evidence'), { recursive: true })
await writeFile(join(cache, 'evidence/source-manifest.json'), JSON.stringify({ buildId, fingerprint, files: manifest }, null, 2))
await build({ configFile: false, root: join(snapshot, 'app'), cacheDir: join(cache, 'vite-cache'), publicDir: join(snapshot, 'app/public'),
  define: { __COOP_BUILD__: JSON.stringify(buildId) },
  build: { outDir: join(cache, 'site'), emptyOutDir: true, copyPublicDir: false,
    rollupOptions: { input: join(snapshot, 'coop/harness.ts'), output: { entryFileNames: 'assets/harness.js' } } },
})
await cp(join(coop, 'harness.html'), join(cache, 'site/index.html'))
console.log(`Frozen build ${buildId} in ${cache}/site`)
