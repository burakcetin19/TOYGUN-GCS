/**
 * Toygun GCS — Web Serial API Bağlantısı
 * navigator.serial üzerinden seri port bağlantısı kurar.
 * Electron + Chrome/Edge'de çalışır. Native modül gerektirmez.
 * serialport paketi yüklenemediğinde otomatik fallback olarak kullanılır.
 */

import { useAracStore } from '@/stores/arac'
import { px4ModuCoz, MAV_MODE_FLAG_SAFETY_ARMED } from './mesajlar'

// ── MAVLink Sabitleri ──────────────────────────────────────────────────────────
const GPS_FIX_ADI: Record<number, string> = {
  0: 'NO_GPS', 1: 'NO_FIX', 2: 'FIX_2D', 3: 'FIX_3D',
  4: 'DGPS',   5: 'RTK_FLOAT', 6: 'RTK_FIXED',
}

// ── MAVLink v1/v2 Ayrıştırıcı (Uint8Array/DataView — Buffer gerektirmez) ───────
class WebSerialMavlinkParser {
  private buf = new Uint8Array(0)
  private readonly onMesaj: (tip: string, veri: Record<string, any>) => void

  constructor(onMesaj: (tip: string, veri: Record<string, any>) => void) {
    this.onMesaj = onMesaj
  }

  isle(chunk: Uint8Array): void {
    const merged = new Uint8Array(this.buf.length + chunk.length)
    merged.set(this.buf)
    merged.set(chunk, this.buf.length)
    this.buf = merged.length > 4096 ? merged.slice(merged.length - 2048) : merged
    this.ayristir()
  }

  private ayristir(): void {
    while (true) {
      // STX baytına senkronize ol
      let bas = -1
      for (let i = 0; i < this.buf.length; i++) {
        if (this.buf[i] === 0xFE || this.buf[i] === 0xFD) { bas = i; break }
      }
      if (bas === -1) { this.buf = new Uint8Array(0); return }
      if (bas > 0) this.buf = this.buf.slice(bas)
      if (this.buf.length < 2) return

      const stx      = this.buf[0]
      const govdeBoy = this.buf[1]

      if (stx === 0xFE) {
        // MAVLink v1
        const toplam = 6 + govdeBoy + 2
        if (this.buf.length < toplam) return
        const mesajId = this.buf[5]
        const govde   = this.buf.slice(6, 6 + govdeBoy)
        this.buf = this.buf.slice(toplam)
        this.coz(mesajId, govde)
      } else {
        // MAVLink v2
        if (this.buf.length < 10) return
        const imza   = (this.buf[2] & 0x01) ? 13 : 0
        const toplam = 10 + govdeBoy + 2 + imza
        if (this.buf.length < toplam) return
        const mesajId = this.buf[7] | (this.buf[8] << 8) | (this.buf[9] << 16)
        const govde   = this.buf.slice(10, 10 + govdeBoy)
        this.buf = this.buf.slice(toplam)
        this.coz(mesajId, govde)
      }
    }
  }

  private coz(mesajId: number, govde: Uint8Array): void {
    if (govde.length === 0) return
    try {
      const dv = new DataView(govde.buffer, govde.byteOffset, govde.byteLength)
      switch (mesajId) {
        case 0: {  // HEARTBEAT
          if (govde.length < 9) return
          const customMode = dv.getUint32(0, true)
          const baseMode   = govde[6]
          this.onMesaj('HEARTBEAT', {
            custom_mode: customMode,
            base_mode:   { bits: baseMode },
            armed:       (baseMode & MAV_MODE_FLAG_SAFETY_ARMED) !== 0,
            ucusModu:    px4ModuCoz(customMode),
          })
          break
        }
        case 74: { // VFR_HUD
          if (govde.length < 20) return
          this.onMesaj('VFR_HUD', {
            airspeed:    dv.getFloat32(0, true),
            groundspeed: dv.getFloat32(4, true),
            alt:         dv.getFloat32(8, true),
            heading:     dv.getInt16(16, true),
          })
          break
        }
        case 1: {  // SYS_STATUS
          if (govde.length < 31) return
          this.onMesaj('SYS_STATUS', {
            voltage_battery:   dv.getUint16(14, true),
            current_battery:   dv.getInt16(16, true),
            battery_remaining: dv.getInt8(30),
          })
          break
        }
        case 30: { // ATTITUDE
          if (govde.length < 16) return
          this.onMesaj('ATTITUDE', {
            roll:  dv.getFloat32(4,  true),
            pitch: dv.getFloat32(8,  true),
            yaw:   dv.getFloat32(12, true),
          })
          break
        }
        case 33: { // GLOBAL_POSITION_INT
          if (govde.length < 28) return
          this.onMesaj('GLOBAL_POSITION_INT', {
            lat:          dv.getInt32(4,  true),
            lon:          dv.getInt32(8,  true),
            alt:          dv.getInt32(12, true),
            relative_alt: dv.getInt32(16, true),
            hdg:          dv.getUint16(26, true),
          })
          break
        }
        case 24: { // GPS_RAW_INT
          if (govde.length < 30) return
          this.onMesaj('GPS_RAW_INT', {
            fix_type:           { type: GPS_FIX_ADI[govde[28]] ?? 'NO_FIX' },
            lat:                dv.getInt32(8,  true),
            lon:                dv.getInt32(12, true),
            eph:                dv.getUint16(20, true),
            satellites_visible: govde[29],
          })
          break
        }
      }
    } catch { /* bozuk paket — atla */ }
  }
}

// ── Store Güncelleme ───────────────────────────────────────────────────────────
const RAD_DERECE = 180 / Math.PI

function storeGuncelle(tip: string, veri: Record<string, any>): void {
  const store = useAracStore()
  store.sonMesajZamani = Date.now()

  switch (tip) {
    case 'HEARTBEAT':
      if (veri.armed !== undefined)   store.armed     = veri.armed
      if (veri.ucusModu !== undefined) store.ucusModu = veri.ucusModu
      break
    case 'VFR_HUD':
      if (veri.groundspeed !== undefined) store.yerHizi   = veri.groundspeed
      if (veri.airspeed    !== undefined) store.havaHizi  = veri.airspeed
      if (veri.alt         !== undefined) store.yukseklik = veri.alt
      if (veri.heading     !== undefined) store.heading   = veri.heading
      break
    case 'SYS_STATUS':
      if (veri.voltage_battery   !== undefined) store.bataryaVoltaj = veri.voltage_battery / 1000
      if (veri.current_battery   !== undefined) store.bataryaAkim   = veri.current_battery / 100
      if (veri.battery_remaining !== undefined) store.bataryaYuzde  = veri.battery_remaining
      break
    case 'ATTITUDE':
      if (veri.roll  !== undefined) store.roll  = veri.roll  * RAD_DERECE
      if (veri.pitch !== undefined) store.pitch = veri.pitch * RAD_DERECE
      if (veri.yaw   !== undefined) store.yaw   = veri.yaw   * RAD_DERECE
      break
    case 'GLOBAL_POSITION_INT':
      if (veri.lat          !== undefined) store.enlem          = veri.lat / 1e7
      if (veri.lon          !== undefined) store.boylam         = veri.lon / 1e7
      if (veri.alt          !== undefined) store.yukseklik      = veri.alt / 1000
      if (veri.relative_alt !== undefined) store.yapiYukseklik  = veri.relative_alt / 1000
      if (veri.hdg          !== undefined) store.heading        = veri.hdg / 100
      break
    case 'GPS_RAW_INT': {
      const fixMap: Record<string, number> = {
        'NO_GPS': 0, 'NO_FIX': 1, 'FIX_2D': 2, 'FIX_3D': 3,
        'DGPS': 4, 'RTK_FLOAT': 5, 'RTK_FIXED': 6,
      }
      if (veri.fix_type?.type   !== undefined) store.gpsFixTipi = fixMap[veri.fix_type.type] ?? 0
      if (veri.satellites_visible !== undefined) store.gpsSayisi = veri.satellites_visible
      if (veri.eph              !== undefined) store.gpsHdop    = veri.eph / 100
      break
    }
  }
}

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

export async function webSerialYaz(bytes: Uint8Array): Promise<void> {
  if (!aktifPort?.writable) return
  const writer = aktifPort.writable.getWriter()
  try {
    await writer.write(bytes)
  } finally {
    writer.releaseLock()
  }
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

    const parser = new WebSerialMavlinkParser((tip, veri) => {
      if (tip === 'HEARTBEAT') sonHeartbeat = Date.now()
      storeGuncelle(tip, veri)
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
          parser.isle(value)
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
