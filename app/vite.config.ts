import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Peers must agree on both gameplay code and data, including rig release timings.
const root = dirname(fileURLToPath(import.meta.url)), hash = createHash('sha256')
for (const folder of ['src/siege', 'public/siege']) {
  for (const name of readdirSync(join(root, folder), { recursive: true }).filter(name => /\.(ts|tsx|json)$/.test(String(name))).map(String).sort()) {
    hash.update(`${folder}/${name}`); hash.update(readFileSync(join(root, folder, name)))
  }
}
hash.update(readFileSync(join(root, 'public/chogs.json')))

export default defineConfig({
  plugins: [react()],
  define: { __COOP_BUILD__: JSON.stringify(`party-${hash.digest('hex').slice(0, 32)}`) },
})
