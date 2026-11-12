/**
 * Toygun GCS — Donanım Bağlantı Servisi
 * Serial (COM port), UDP ve TCP protokolleri üzerinden doğrudan MAVLink bağlantısı.
 * Electron main process'te çalışır. Raw MAVLink v1/v2 byte akışını parse eder.
 */

import { ipcMain, BrowserWindow } from 'electron'
import * as dgram from 'dgram'
import * as net from 'net'
import { createRequire } from 'module'
import { MavlinkAyristirici, cerceveCoz, komutKodla } from '../../libs/mavlink/cerceve'

// serialport native bir modüldür ve vite.config.ts'te external tutulur.
// Asar içinden güvenilir yükleme için ESM import() yerine CJS require kullanılır.
const yerelRequire = createRequire(__filename)
let serialportModulu: any = null
let serialportHatasi: string | null = null

function serialportYukle(): any {
  if (serialportModulu) return serialportModulu
  try {
    serialportModulu = yerelRequire('serialport')
    serialportHatasi = null
    return serialportModulu
  } catch (e: any) {
    if (serialportHatasi !== e.message) console.error('[Donanım] serialport yüklenemedi:', e.message)
    serialportHatasi = e.message
    throw e
  }
}

// ── Port Bilgisi Arayüzü ───────────────────────────────────────────────────────
export interface PortBilgisi {
  yol: string
  uretici: string
  aciklama: string
  vendorId: string
  productId: string
  cihazTipi: string
  pixhawkMu: boolean
}

// ── VID/PID Tanıma Tablosu ─────────────────────────────────────────────────────
const VID_PID_TABLOSU: Record<string, { tip: string; pixhawkMu: boolean }> = {
  '26ac:0011': { tip: 'Pixhawk',            pixhawkMu: true  },
  '26ac:0032': { tip: 'Cube Orange',        pixhawkMu: true  },
  '26ac:0001': { tip: 'Pixhawk 2.4.8',      pixhawkMu: true  },
  '26ac:0010': { tip: 'Cube Black',         pixhawkMu: true  },
  '26ac:0024': { tip: 'Cube Purple',        pixhawkMu: true  },
  '26ac:0050': { tip: 'CubePilot Orange+',  pixhawkMu: true  },
  '2dae:1011': { tip: 'Cube Orange',        pixhawkMu: true  },
  '2dae:1016': { tip: 'Cube Orange',        pixhawkMu: true  },
  '2dae:1058': { tip: 'Cube Orange+',       pixhawkMu: true  },
  '3162:004b': { tip: 'Holybro Pixhawk 6C', pixhawkMu: true  },
  '27ac:0011': { tip: 'mRo Pixhawk',        pixhawkMu: true  },
  '0483:5740': { tip: 'STM32 VCP',          pixhawkMu: true  },
  '0483:df11': { tip: 'STM32 DFU',          pixhawkMu: true  },
  '0403:6001': { tip: 'FTDI FT232',         pixhawkMu: false },
  '0403:6015': { tip: '3DR Radio',          pixhawkMu: false },
  '10c4:ea60': { tip: 'SiLabs CP210x',      pixhawkMu: false },
  '1a86:7523': { tip: 'CH340',              pixhawkMu: false },
  '067b:2303': { tip: 'PL2303',             pixhawkMu: false },
}

function cihazTipiBelirle(vid: string, pid: string): { tip: string; pixhawkMu: boolean } {
  const anahtar = `${vid.toLowerCase().padStart(4, '0')}:${pid.toLowerCase().padStart(4, '0')}`
  return VID_PID_TABLOSU[anahtar] ?? { tip: 'Bilinmeyen', pixhawkMu: false }
}

// ── WMI Tabanlı Port Listesi (Build Tools gerektirmez) ────────────────────────
// ClassGuid filtresi: yalnızca "Ports (COM & LPT)" sınıfı — çok daha hızlı ve güvenilir
async function portListeAlWMI(): Promise<PortBilgisi[]> {
  const { exec } = await import('child_process')
  return new Promise((resolve) => {
    // ClassGuid ile doğrudan COM & LPT portlarını sorgula (Win32_PnPEntity'nin tamamı değil)
    const cmd = 'powershell -NoProfile -NonInteractive -Command "'
      + "Get-CimInstance Win32_PnPEntity -Filter \\\"ClassGuid='{4d36e978-e325-11ce-bfc1-08002be10318}'\\\" "
      + '| Select-Object Name,PNPDeviceID '
      + '| ConvertTo-Json -Compress"'

    exec(cmd, { timeout: 6000 }, (err: any, stdout: string) => {
      if (err || !stdout.trim()) { resolve([]); return }
      try {
        let items: any = JSON.parse(stdout.trim())
        if (!Array.isArray(items)) items = [items]
        const sonuc: PortBilgisi[] = []
        for (const item of items) {
          const comMatch = (item.Name as string)?.match(/\(?(COM\d+)\)?/)
          if (!comMatch) continue
          const comPort = comMatch[1]
          const pnpId: string = item.PNPDeviceID ?? ''
          const vidM = pnpId.match(/VID_([0-9A-Fa-f]{4})/i)
          const pidM = pnpId.match(/PID_([0-9A-Fa-f]{4})/i)
          const vid = vidM?.[1]?.toLowerCase() ?? ''
          const pid = pidM?.[1]?.toLowerCase() ?? ''
          const { tip, pixhawkMu } = cihazTipiBelirle(vid, pid)
          sonuc.push({
            yol: comPort,
            uretici: '',
            aciklama: item.Name ?? comPort,
            vendorId: vid,
            productId: pid,
            cihazTipi: tip,
            pixhawkMu,
          })
        }
        resolve(sonuc)
      } catch { resolve([]) }
    })
  })
}

// ── Port Listesi Yardımcı Fonksiyonu ──────────────────────────────────────────
async function portListeAl(): Promise<PortBilgisi[]> {
  try {
    const { SerialPort } = serialportYukle()
    const portlar = await SerialPort.list()
    return portlar.map((p: any) => {
      const vid = p.vendorId ?? ''
      const pid = p.productId ?? ''
      const { tip, pixhawkMu } = cihazTipiBelirle(vid, pid)
      return {
        yol: p.path,
        uretici: p.manufacturer ?? '',
        aciklama: p.friendlyName ?? p.pnpId ?? p.path,
        vendorId: vid,
        productId: pid,
        cihazTipi: tip,
        pixhawkMu,
      }
    })
  } catch {
    // serialport yüklenemediyse (yalnızca Windows'ta anlamlı) WMI ile listele
    return process.platform === 'win32' ? portListeAlWMI() : []
  }
}

// ── Port Sıcak Bağlantı İzleyici ──────────────────────────────────────────────
let portIzleyiciInterval: ReturnType<typeof setInterval> | null = null
let oncekiPortYollari: Set<string> = new Set()

export function portIzleyiciBaslat(pencere: BrowserWindow): void {
  if (portIzleyiciInterval) return

  let calisiyor = false
  const kontrol = async () => {
    if (calisiyor) return // önceki tarama bitmeden yenisini başlatma
    calisiyor = true
    try {
      await taraVeBildir()
    } finally {
      calisiyor = false
    }
  }

  const taraVeBildir = async () => {
    const portlar = await portListeAl()
    const yeniYollar = new Set(portlar.map(p => p.yol))
    const degisti =
      yeniYollar.size !== oncekiPortYollari.size ||
      [...yeniYollar].some(y => !oncekiPortYollari.has(y)) ||
      [...oncekiPortYollari].some(y => !yeniYollar.has(y))

    if (degisti) {
      oncekiPortYollari = yeniYollar
      if (!pencere.isDestroyed()) {
        pencere.webContents.send('port-degisikligi', portlar)
      }
    }
  }

  kontrol() // İlk çalıştırma
  portIzleyiciInterval = setInterval(kontrol, 1000)
  console.log('[Donanım] Port izleyici başlatıldı (1 sn aralıklı)')
}

export function portIzleyiciDurdur(): void {
  if (portIzleyiciInterval) {
    clearInterval(portIzleyiciInterval)
    portIzleyiciInterval = null
    console.log('[Donanım] Port izleyici durduruldu')
  }
}

// ── Aktif Bağlantı Referansları ────────────────────────────────────────────────
let aktifSerialPort: any = null
let aktifUdpSocket: dgram.Socket | null = null
let aktifTcpSocket: net.Socket | null = null
let aktifPencere: BrowserWindow | null = null
let aktifUdpHedef: { adres: string; port: number } | null = null  // gelen paketten öğrenilir

// ── MAVLink Ayrıştırıcı Fabrikası ─────────────────────────────────────────────
/** Ortak (CRC doğrulamalı) ayrıştırıcıyı kurar; çözülen mesajları renderer'a iletir. */
function ayristiriciOlustur(ekCb?: (tip: string) => void): { isle: (veri: Buffer) => void } {
  const ayristirici = new MavlinkAyristirici((cerceve) => {
    const mesaj = cerceveCoz(cerceve)
    if (!mesaj) return
    pencereGonder('mavlink-mesaj', mesaj)
    ekCb?.(mesaj.tip)
  })
  return {
    // Buffer bir Uint8Array alt sınıfıdır — doğrudan verilebilir
    isle: (veri: Buffer) => ayristirici.ekle(veri),
  }
}

type YazmaSonucu = { basarili: boolean; hata?: string }

function mavlinkNativeYaz(bytes: Buffer): Promise<YazmaSonucu> {
  return new Promise((coz) => {
    const bitti = (err?: Error | null) => {
      if (err) {
        console.warn('[MAVLink] Yazma hatası:', err.message)
        coz({ basarili: false, hata: err.message })
      } else {
        coz({ basarili: true })
      }
    }
    if (aktifSerialPort) {
      aktifSerialPort.write(bytes, (err: Error | null | undefined) => bitti(err))
    } else if (aktifUdpSocket) {
      if (!aktifUdpHedef) {
        coz({ basarili: false, hata: 'UDP hedefi bilinmiyor — araçtan henüz paket alınmadı' })
        return
      }
      aktifUdpSocket.send(bytes, aktifUdpHedef.port, aktifUdpHedef.adres, (err) => bitti(err))
    } else if (aktifTcpSocket) {
      aktifTcpSocket.write(bytes, (err) => bitti(err))
    } else {
      coz({ basarili: false, hata: 'Aktif donanım bağlantısı yok' })
    }
  })
}

// ── Yardımcı Fonksiyonlar ──────────────────────────────────────────────────────

function pencereGonder(kanal: string, veri: any): void {
  if (aktifPencere && !aktifPencere.isDestroyed()) {
    aktifPencere.webContents.send(kanal, veri)
  }
}

function baglantiDurumuGonder(durum: 'baglandi' | 'baglaniliyor' | 'baglantiKesik'): void {
  pencereGonder('baglanti-durumu', durum)
}

function aktifBaglantiyiKes(): void {
  if (aktifSerialPort) {
    try { aktifSerialPort.close() } catch { /* ignore */ }
    aktifSerialPort = null
  }
  if (aktifUdpSocket) {
    try { aktifUdpSocket.close() } catch { /* ignore */ }
    aktifUdpSocket = null
  }
  if (aktifTcpSocket) {
    aktifTcpSocket.destroy()
    aktifTcpSocket = null
  }
}

// ── IPC Handler Kurulumu ───────────────────────────────────────────────────────

export function donanımBaglantiKur(pencere: BrowserWindow): void {
  aktifPencere = pencere

  // ── COM Port Listesi ────────────────────────────────────────────────────────
  ipcMain.handle('port-listele', async () => portListeAl())

  // ── Serial Bağlantı ─────────────────────────────────────────────────────────
  ipcMain.handle('serial-baglan', async (_e, yol: string, baud: number) => {
    try {
      aktifBaglantiyiKes()
      baglantiDurumuGonder('baglaniliyor')

      let SerialPort: any
      try {
        SerialPort = serialportYukle().SerialPort
      } catch (modülHata: any) {
        baglantiDurumuGonder('baglantiKesik')
        return { basarili: false, hata: modülHata.message, webSerialFallback: true }
      }

      const ayrıştırıcı = ayristiriciOlustur()

      aktifSerialPort = new SerialPort({ path: yol, baudRate: baud, autoOpen: false })

      aktifSerialPort.on('data', (veri: Buffer) => ayrıştırıcı.isle(veri))
      aktifSerialPort.on('error', (hata: Error) => {
        console.error('[Serial] Port hatası:', hata.message)
        baglantiDurumuGonder('baglantiKesik')
      })
      aktifSerialPort.on('close', () => {
        console.log('[Serial] Port kapandı')
        baglantiDurumuGonder('baglantiKesik')
        aktifSerialPort = null
      })

      await new Promise<void>((coz, reddet) => {
        aktifSerialPort.open((hata: Error | null) => {
          if (hata) reddet(hata)
          else coz()
        })
      })

      baglantiDurumuGonder('baglandi')
      console.log(`[Serial] Bağlandı: ${yol} @ ${baud} baud`)
      return { basarili: true }
    } catch (hata: any) {
      baglantiDurumuGonder('baglantiKesik')
      aktifSerialPort = null
      return { basarili: false, hata: hata.message }
    }
  })

  ipcMain.handle('serial-kes', () => {
    if (aktifSerialPort) {
      try { aktifSerialPort.close() } catch { /* ignore */ }
      aktifSerialPort = null
    }
    baglantiDurumuGonder('baglantiKesik')
    return { basarili: true }
  })

  // ── UDP Bağlantı ────────────────────────────────────────────────────────────
  // UDP connectionless: socket.bind() yalnızca yerel port açar, araca bağlanmaz.
  // 'baglandi' sinyali soket açılınca değil, ilk HEARTBEAT gelince gönderilir.
  ipcMain.handle('udp-baglan', async (_e, yerelPort: number) => {
    try {
      aktifBaglantiyiKes()
      baglantiDurumuGonder('baglaniliyor')

      let heartbeatAlindi = false
      const ayrıştırıcı = ayristiriciOlustur((tip) => {
        if (!heartbeatAlindi && tip === 'HEARTBEAT') {
          heartbeatAlindi = true
          baglantiDurumuGonder('baglandi')
          console.log('[UDP] İlk HEARTBEAT alındı — bağlantı onaylandı')
        }
      })

      aktifUdpSocket = dgram.createSocket('udp4')
      aktifUdpSocket.on('message', (msg, rinfo) => {
        aktifUdpHedef = { adres: rinfo.address, port: rinfo.port }
        ayrıştırıcı.isle(msg)
      })
      aktifUdpSocket.on('close', () => {
        baglantiDurumuGonder('baglantiKesik')
        aktifUdpSocket = null
      })

      return await new Promise<{ basarili: boolean; hata?: string }>((coz) => {
        aktifUdpSocket!.once('listening', () => {
          // Port açıldı — sadece 'baglaniliyor' durumunda kal, araç bağlanmadı
          console.log(`[UDP] Port ${yerelPort} dinlemede — HEARTBEAT bekleniyor`)
          coz({ basarili: true })
        })
        aktifUdpSocket!.once('error', (hata: Error) => {
          console.error('[UDP] Bind hatası:', hata.message)
          baglantiDurumuGonder('baglantiKesik')
          aktifUdpSocket = null
          coz({ basarili: false, hata: hata.message })
        })
        aktifUdpSocket!.bind(yerelPort)
      })
    } catch (hata: any) {
      console.error('[UDP] Bağlantı hatası:', hata.message)
      baglantiDurumuGonder('baglantiKesik')
      return { basarili: false, hata: hata.message }
    }
  })

  ipcMain.handle('udp-kes', () => {
    if (aktifUdpSocket) {
      try { aktifUdpSocket.close() } catch { /* ignore */ }
      aktifUdpSocket = null
    }
    baglantiDurumuGonder('baglantiKesik')
    return { basarili: true }
  })

  // ── TCP Bağlantı ────────────────────────────────────────────────────────────
  ipcMain.handle('tcp-baglan', async (_e, host: string, port: number) => {
    try {
      aktifBaglantiyiKes()
      baglantiDurumuGonder('baglaniliyor')

      const ayrıştırıcı = ayristiriciOlustur()

      aktifTcpSocket = new net.Socket()
      aktifTcpSocket.on('data', (veri) => ayrıştırıcı.isle(veri))
      aktifTcpSocket.on('close', () => {
        baglantiDurumuGonder('baglantiKesik')
        aktifTcpSocket = null
      })

      return await new Promise<{ basarili: boolean; hata?: string }>((coz) => {
        aktifTcpSocket!.once('connect', () => {
          baglantiDurumuGonder('baglandi')
          console.log(`[TCP] Bağlandı: ${host}:${port}`)
          coz({ basarili: true })
        })
        aktifTcpSocket!.once('error', (hata: Error) => {
          console.error('[TCP] Bağlantı hatası:', hata.message)
          baglantiDurumuGonder('baglantiKesik')
          aktifTcpSocket = null
          coz({ basarili: false, hata: hata.message })
        })
        aktifTcpSocket!.connect(port, host)
      })
    } catch (hata: any) {
      console.error('[TCP] Bağlantı hatası:', hata.message)
      baglantiDurumuGonder('baglantiKesik')
      return { basarili: false, hata: hata.message }
    }
  })

  ipcMain.handle('tcp-kes', () => {
    if (aktifTcpSocket) {
      aktifTcpSocket.destroy()
      aktifTcpSocket = null
    }
    baglantiDurumuGonder('baglantiKesik')
    return { basarili: true }
  })

  // ── Genel Donanım Bağlantısı Kes ───────────────────────────────────────────
  ipcMain.handle('donanim-kes', () => {
    aktifBaglantiyiKes()
    baglantiDurumuGonder('baglantiKesik')
    return { basarili: true }
  })

  // ── MAVLink Komut Gönderici ─────────────────────────────────────────────────
  // Native bağlantı varsa byte olarak yazar; yoksa mavlink2rest REST'e POST eder.
  ipcMain.handle('mavlink-komut-gonder', async (_e, komut: Record<string, any>, url: string) => {
    // Native serial/UDP/TCP aktifse → MAVLink byte kodla ve yaz
    if (aktifSerialPort || aktifUdpSocket || aktifTcpSocket) {
      try {
        const bytes = komutKodla(komut)
        if (bytes) {
          return await mavlinkNativeYaz(Buffer.from(bytes))
        }
        console.warn('[MAVLink] Native bağlantıda desteklenmeyen mesaj:', komut?.message?.type)
        return { basarili: false, hata: `Desteklenmeyen mesaj tipi: ${komut?.message?.type}` }
      } catch (e: any) {
        console.warn('[MAVLink] Komut kodlama hatası:', e.message)
      }
    }
    // Fallback: mavlink2rest REST API
    try {
      const yanit = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(komut),
      })
      if (!yanit.ok) console.warn(`[MAVLink] REST komutu reddedildi: HTTP ${yanit.status}`)
      return { basarili: yanit.ok, durum: yanit.status }
    } catch (hata: any) {
      console.warn('[MAVLink] REST komutu gönderilemedi:', hata.message)
      return { basarili: false, hata: hata.message }
    }
  })

  console.log('[Donanım] Bağlantı IPC köprüsü kuruldu (Serial/UDP/TCP)')
}
