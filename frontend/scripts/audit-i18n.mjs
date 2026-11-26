import fs from 'fs'
import path from 'path'
import en from '../src/i18n/translations/en.js'
import hi from '../src/i18n/translations/hi.js'
import gu from '../src/i18n/translations/gu.js'

const flatten = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, p ? `${p}.${k}` : k) : [p ? `${p}.${k}` : k]
  )

const ek = new Set(flatten(en))
const hk = new Set(flatten(hi))
const gk = new Set(flatten(gu))

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory()
      ? walk(path.join(dir, d.name))
      : d.name.endsWith('.jsx') || d.name.endsWith('.js')
      ? [path.join(dir, d.name)]
      : []
  )

const files = walk(path.resolve('./src'))
const missing = []
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8')
  const re = /\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g
  let m
  while ((m = re.exec(content)) !== null) {
    const k = m[1]
    if (!ek.has(k) || !hk.has(k) || !gk.has(k)) {
      missing.push({
        file: path.relative(process.cwd(), f),
        key: k,
        en: ek.has(k),
        hi: hk.has(k),
        gu: gk.has(k),
      })
    }
  }
}

console.log(`EN=${ek.size} HI=${hk.size} GU=${gk.size}`)
console.log(`Total missing/raw t() keys: ${missing.length}`)
for (const x of missing) {
  console.log(`  ${x.file} -> ${x.key} (en:${x.en}, hi:${x.hi}, gu:${x.gu})`)
}
