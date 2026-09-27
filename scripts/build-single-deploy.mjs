import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const sourceDir = path.join(root, 'dist-single-build')
const outputDir = path.join(root, 'dist-single')

await rm(outputDir, { recursive: true, force: true })
await mkdir(outputDir, { recursive: true })

let html = await readFile(path.join(sourceDir, 'index.html'), 'utf8')
const scriptMatch = html.match(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/i)
const styleMatch = html.match(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/i)

if (!scriptMatch || !styleMatch) {
  throw new Error('Built index.html does not contain the expected script and stylesheet tags.')
}

const assetPath = (url) => path.join(sourceDir, url.replace(/^\//, ''))
const css = await readFile(assetPath(styleMatch[1]), 'utf8')
const js = await readFile(assetPath(scriptMatch[1]), 'utf8')

html = html
  .replace(
    styleMatch[0],
    () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`,
  )
  .replace(
    scriptMatch[0],
    () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`,
  )

await writeFile(path.join(outputDir, 'index.html'), html)

for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
  if (entry.name === 'index.html' || entry.name === 'assets') continue
  await cp(path.join(sourceDir, entry.name), path.join(outputDir, entry.name), {
    recursive: true,
  })
}

console.log(`Single-file deploy created at ${outputDir}`)
