/**
 * Toygun GCS — Web Serial API Bağlantısı
 * navigator.serial üzerinden seri port bağlantısı kurar.
 * Electron + Chrome/Edge'de çalışır. Native modül gerektirmez.
 * serialport paketi yüklenemediğinde otomatik fallback olarak kullanılır.
 */

import { useAracStore } from '@/stores/arac'
import { MavlinkAyristirici, cerceveCoz } from './cerceve'
import { mavlinkMesajiIsle } from './donanim-dinleyici'

// ── Bağlantı Durumu ────────────────────────────────────────────────────────────
let aktifPort: any = null        // SerialPort (Web API)
let aktifReader: any = null      // ReadableStreamDefaultReader
let watchdogTimer: ReturnType<typeof setInterval> | null = null
let sonHeartbeat = 0

function watchdogBaslat(): void {
  watchdogDurdur()
  sonHeartbeat = Date.now()
  watchdogTimer = setInterval(() => {
    const store = useAracStore()
    if (store.baglantiDurumu !== 'baglandi') return
    if (Date.now() - sonHeartbeat > 5000) {
      store.baglantiDurumu = 'baglantiKesik'
      store.telemetriSifirla()
      ;(window as any).__toygunBildirim?.('MAVLink bağlantısı kesildi (zaman aşımı)', 'hata')
      watchdogDurdur()
    }
  }, 3000)
}

function watchdogDurdur(): void {
  if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null }
}

// ── API ────────────────────────────────────────────────────────────────────────
export function webSerialDestekleniyor(): boolean {
  return !!(navigator as any).serial
}

export function webSerialAktifMi(): boolean {
  return aktifPort !== null
}

// Yazmalar sıraya alınır — aynı anda iki getWriter() çağrısı "stream is locked" hatası verir
let yazmaKuyrugu: Promise<void> = Promise.resolve()

export function webSerialYaz(bytes: Uint8Array): Promise<void> {
  const is = yazmaKuyrugu.then(async () => {
    if (!aktifPort?.writable) throw new Error('Web Serial portu yazılabilir değil')
    const writer = aktifPort.writable.getWriter()
    try {
      await writer.write(bytes)
    } finally {
      writer.releaseLock()
    }
  })
  yazmaKuyrugu = is.catch(() => {})
  return is
}

/**
 * Web Serial API ile seri porta bağlan.
 * vidHex / pidHex: '26ac', '0032' formatında — filtre için kullanılır.
 * Electron modunda select-serial-port eventi ile dialog gösterilmez.
 */
export async function webSerialBaglan(
  baud: number,
  vidHex?: string,
  pidHex?: string,
): Promise<{ basarili: boolean; hata?: string }> {
  try {
    webSerialKes()
    const serial = (navigator as any).serial as any

    // Daha önce izin verilen portlardan eşleştir
    let port: any = null
    if (vidHex && pidHex) {
      const portlar: any[] = await serial.getPorts()
      port = portlar.find((p: any) => {
        const info = p.getInfo()
        return (
          info.usbVendorId  === parseInt(vidHex, 16) &&
          info.usbProductId === parseInt(pidHex, 16)
        )
      }) ?? null
    }

    // Eşleşme yoksa requestPort() ile seçtir (Electron otomatik onaylar)
    if (!port) {
      const filters = (vidHex && pidHex)
        ? [{ usbVendorId: parseInt(vidHex, 16), usbProductId: parseInt(pidHex, 16) }]
        : []
      port = await serial.requestPort({ filters })
    }

    aktifPort = port
    await aktifPort.open({ baudRate: baud })

    const store = useAracStore()
    store.baglantiDurumu = 'baglandi'

    // Ortak, CRC doğrulamalı ayrıştırıcı (Electron yoluyla aynı)
    const parser = new MavlinkAyristirici((cerceve) => {
      const mesaj = cerceveCoz(cerceve)
      if (!mesaj) return
      if (mesaj.tip === 'HEARTBEAT' && mesaj.veri.aracHeartbeati !== false) sonHeartbeat = Date.now()
      mavlinkMesajiIsle(mesaj.tip, mesaj.veri, store)
    })

    watchdogBaslat()

    // Okuma döngüsü — UI thread'ini bloklamaz (async/await)
    const reader = aktifPort.readable.getReader()
    aktifReader = reader
    ;(async () => {
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          parser.ekle(value)
        }
      } catch { /* port kapatıldı veya fiziksel bağlantı kesildi */ } finally {
        reader.releaseLock()
        aktifPort   = null
        aktifReader = null
        watchdogDurdur()
        const s = useAracStore()
        if (s.baglantiDurumu === 'baglandi') {
          s.baglantiDurumu = 'baglantiKesik'
          s.telemetriSifirla()
        }
      }
    })()

    return { basarili: true }
  } catch (hata: any) {
    return { basarili: false, hata: hata.message }
  }
}

export function webSerialKes(): void {
  watchdogDurdur()
  if (aktifReader) {
    aktifReader.cancel().catch(() => {})
    aktifReader = null
  }
  if (aktifPort) {
    aktifPort.close().catch(() => {})
    aktifPort = null
  }
}
