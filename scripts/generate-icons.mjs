#!/usr/bin/env node
/** Regenerate PNG icons from internal/ui/static/icons/favicon.svg */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const svg = fs.readFileSync(path.join(root, 'internal/ui/static/icons/favicon.svg'))

async function writeIcon(file, size) {
  await sharp(svg).resize(size, size).png().toFile(file)
}

await writeIcon(path.join(root, 'mobile/assets/icon.png'), 1024)
await writeIcon(path.join(root, 'mobile/assets/splash-icon.png'), 512)
await writeIcon(path.join(root, 'mobile/assets/android-icon-foreground.png'), 432)
await writeIcon(path.join(root, 'mobile/assets/android-icon-monochrome.png'), 432)
await writeIcon(path.join(root, 'mobile/assets/favicon.png'), 48)
await writeIcon(path.join(root, 'internal/ui/static/icons/favicon-16.png'), 16)
await writeIcon(path.join(root, 'internal/ui/static/icons/favicon-32.png'), 32)
await writeIcon(path.join(root, 'internal/ui/static/icons/apple-touch-icon.png'), 180)
await writeIcon(path.join(root, 'internal/ui/static/icons/icon-512.png'), 512)
await sharp({
  create: { width: 432, height: 432, channels: 4, background: '#F6F2E8' },
})
  .png()
  .toFile(path.join(root, 'mobile/assets/android-icon-background.png'))

console.log('icons generated')
