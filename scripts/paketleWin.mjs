/**
 * Toygun GCS — Windows paketleme scripti
 * electron-packager kullanır (winCodeSign gerektirmez)
 * Çıktı: release/Toygun_GCS_win64.zip
 */

import { execSync } from 'child_process'
import { existsSync, mkdirSync, copyFileSync, rmSync } from 'fs'
import { resolve, join } from 'path'
import { readFileSync } from 'fs'

const kok = resolve(import.meta.dirname, '..')
const paket = JSON.parse(readFileSync(join(kok, 'package.json'), 'utf8'))
const surum = paket.version
const urunAdi = paket.build?.productName ?? 'Toygun GCS'
const ciktiKlasoru = join(kok, 'release')
const paketKlasoru = join(ciktiKlasoru, `${urunAdi}-win32-x64`)
const zipAdi = `Toygun_GCS_v${surum}_win64.zip`
const zipYolu = join(ciktiKlasoru, zipAdi)

console.log(`\n📦  ${urunAdi} v${surum} paketleniyor...\n`)

// Release klasörünü oluştur
if (!existsSync(ciktiKlasoru)) mkdirSync(ciktiKlasoru, { recursive: true })

// Önceki paketi temizle
if (existsSync(paketKlasoru)) {
  console.log('  Önceki paket temizleniyor...')
  rmSync(paketKlasoru, { recursive: true, force: true })
}

// electron-packager ile paketle
console.log('  electron-packager çalıştırılıyor...')
execSync(
  `npx electron-packager . "${urunAdi}" ` +
  `--platform=win32 --arch=x64 ` +
  `--out="${ciktiKlasoru}" ` +
  `--overwrite ` +
  // asar paketi + native modüller (.node) dışarıda — asar içinden yüklenemezler.
  // (--asar ile --asar.unpack birlikte verilirse unpack yok sayılır)
  `--asar.unpack="**/*.node" ` +
  `--icon="public/toygun-logo.ico" ` +
  `--app-version="${surum}" ` +
  `--electron-version="${paket.devDependencies.electron.replace('^', '')}" ` +
  // node_modules artık dışlanmıyor: serialport (native) çalışma zamanında gerekli.
  // electron-packager devDependencies'i kendisi budar (prune).
  // Kalıplar köke sabitlendi — aksi halde node_modules içindeki "src"/"scripts" klasörleri de silinir.
  `--ignore="^/release($|/)" ` +
  `--ignore="^/src($|/)" ` +
  `--ignore="^/\\.git($|/)" ` +
  `--ignore="^/\\.claude($|/)" ` +
  `--ignore="^/scripts($|/)"`,
  { cwd: kok, stdio: 'inherit' }
)

// Masaüstüne_Ekle.bat dosyasını paketin içine kopyala
const batKaynagi = join(kok, 'resources', 'Masaüstüne_Ekle.bat')
const batHedef = join(paketKlasoru, 'Masaüstüne_Ekle.bat')
if (existsSync(batKaynagi)) {
  copyFileSync(batKaynagi, batHedef)
  console.log('  Masaüstüne_Ekle.bat kopyalandı.')
}

// PowerShell ile zip oluştur
console.log(`  ZIP oluşturuluyor: ${zipAdi}`)
execSync(
  `powershell -Command "Compress-Archive -Path '${paketKlasoru}\\*' -DestinationPath '${zipYolu}' -Force"`,
  { stdio: 'inherit' }
)

console.log(`\n✅  Tamamlandı!\n`)
console.log(`   📁  Klasör : release\\${urunAdi}-win32-x64\\`)
console.log(`   🗜️  ZIP    : release\\${zipAdi}`)
console.log(`\n   Diğer bilgisayara ZIP'i kopyala, çıkart, "Masaüstüne_Ekle.bat" çalıştır.\n`)
