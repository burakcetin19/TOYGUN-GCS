/**
 * Toygun GCS — MAVLink WebSocket Bağlantı Yöneticisi
 * mavlink2rest bridge'e bağlanarak telemetri verilerini Pinia store'a yazar.
 */

import { useAracStore } from '@/stores/arac'
import {
  type MavlinkHeartbeat,
  type MavlinkVfrHud,
  type MavlinkSysStatus,
  type MavlinkAttitude,
  type MavlinkGlobalPositionInt,
  type MavlinkGpsRawInt,
  px4ModuCoz,
  MAV_MODE_FLAG_SAFETY_ARMED,
} from './mesajlar'

/** Bağlantı konfigürasyonu */
export interface BaglantiAyarlari {
  wsUrl: string            // ör: ws://192.168.1.1:6040/ws/mavlink
  yenidenDeneSuresi?: number // ms
}

const VARSAYILAN_AYARLAR: BaglantiAyarlari = {
  wsUrl: 'ws://192.168.1.1:6040/ws/mavlink',
  yenidenDeneSuresi: 3000,
}

const BAGLANTI_ZAMAN_ASIMI = 10_000  // 10 saniye içinde bağlanamazsa hata ver

let ws: WebSocket | null = null
let yenidenDeneZamanlayici: ReturnType<typeof setTimeout> | null = null
let zamanAsimZamanlayici: ReturnType<typeof setTimeout> | null = null
let baglantiKuruldu = false  // onopen tetiklendiyse true — kurulu bağlantı düşerse retry yapar
let aktifAyarlar: BaglantiAyarlari = { ...VARSAYILAN_AYARLAR }

/**
 * mavlink2rest WebSocket'e bağlanır.
 * Bağlantı kesildiğinde otomatik olarak yeniden dener.
 */
export function mavlinkBaglan(ayarlar?: Partial<BaglantiAyarlari>): void {
  aktifAyarlar = { ...VARSAYILAN_AYARLAR, ...ayarlar }
  const store = useAracStore()

  // Mevcut bağlantıyı temizle
  mavlinkKes()

  baglantiKuruldu = false
  store.baglantiDurumu = 'baglaniliyor'
  store.baglantiHataMesaji = null
  console.log(`[MAVLink] Bağlanılıyor: ${aktifAyarlar.wsUrl}`)

  try {
    ws = new WebSocket(aktifAyarlar.wsUrl)
  } catch (hata) {
    console.error('[MAVLink] WebSocket oluşturulamadı:', hata)
    store.baglantiDurumu = 'baglantiKesik'
    store.baglantiHataMesaji = 'Geçersiz adres — WebSocket oluşturulamadı'
    return
  }

  // 10 saniye içinde bağlantı kurulamazsa kullanıcıya hata göster
  zamanAsimZamanlayici = setTimeout(() => {
    zamanAsimZamanlayici = null
    if (!baglantiKuruldu && ws) {
      console.warn('[MAVLink] Bağlantı zaman aşımına uğradı')
      ws.onclose = null
      ws.close()
      ws = null
      store.baglantiDurumu = 'baglantiKesik'
      store.baglantiHataMesaji = 'Bağlantı zaman aşımına uğradı — adres ve portu kontrol edin'
    }
  }, BAGLANTI_ZAMAN_ASIMI)

  ws.onopen = () => {
    baglantiKuruldu = true
    if (zamanAsimZamanlayici) {
      clearTimeout(zamanAsimZamanlayici)
      zamanAsimZamanlayici = null
    }
    console.log('[MAVLink] Bağlantı kuruldu')
    store.baglantiDurumu = 'baglandi'
    store.baglantiHataMesaji = null

    const istenenMesajlar = [
      'HEARTBEAT', 'VFR_HUD', 'SYS_STATUS',
      'ATTITUDE', 'GLOBAL_POSITION_INT', 'GPS_RAW_INT',
    ]
    console.log(`[MAVLink] Mesaj akışı bekleniyor: ${istenenMesajlar.join(', ')}`)
  }

  ws.onmessage = (event) => {
    try {
      const veri = JSON.parse(event.data)
      mesajIsle(veri, store)
    } catch {
      // Binary veya çözümlenemeyen mesajları sessizce geç
    }
  }

  ws.onerror = (hata) => {
    console.error('[MAVLink] WebSocket hatası:', hata)
  }

  ws.onclose = (event) => {
    if (zamanAsimZamanlayici) {
      clearTimeout(zamanAsimZamanlayici)
      zamanAsimZamanlayici = null
    }
    console.log(`[MAVLink] Bağlantı kapandı (kod: ${event.code})`)
    store.baglantiDurumu = 'baglantiKesik'
    ws = null
    // Sadece kurulu bir bağlantı düştüyse otomatik yeniden bağlan
    if (baglantiKuruldu) {
      baglantiKuruldu = false
      yenidenDene()
    }
  }
}

/** Bağlantıyı keser */
export function mavlinkKes(): void {
  if (zamanAsimZamanlayici) {
    clearTimeout(zamanAsimZamanlayici)
    zamanAsimZamanlayici = null
  }
  if (yenidenDeneZamanlayici) {
    clearTimeout(yenidenDeneZamanlayici)
    yenidenDeneZamanlayici = null
  }
  if (ws) {
    ws.onclose = null // Yeniden denemeyi tetikleme
    ws.close()
    ws = null
  }
  baglantiKuruldu = false
}

/**
 * MAVLink komutu gönder — aktif bağlantı tipine göre doğru yolu seçer.
 *
 * Öncelik sırası:
 *  1. Web Serial aktif → byte kodlayıp doğrudan seri porta yaz
 *  2. Electron IPC (native serial/UDP/TCP) → main process byte yazar
 *  3. REST fallback (mavlink2rest WebSocket modu)
 */
export function mavlinkKomutGonder(komut: Record<string, any>): void {
  // 1. Web Serial (renderer'dan doğrudan yazma)
  import('./web-serial-baglanti').then(({ webSerialAktifMi, webSerialYaz }) => {
    if (webSerialAktifMi()) {
      import('./kodlama').then(({ komutKodet }) => {
        const bytes = komutKodet(komut)
        if (bytes) {
          webSerialYaz(bytes).catch((e: any) =>
            console.warn('[MAVLink] Web Serial yazma hatası:', e),
          )
        } else {
          console.warn('[MAVLink] Komut encode edilemedi:', komut?.message?.type)
        }
      })
      return
    }

    // 2. Electron IPC — native serial/UDP/TCP bağlantısı (main process bayt yazar)
    const api = (window as any).toygunAPI
    if (typeof api?.mavlinkKomutGonder === 'function') {
      const url = wsUrldenHttpYap(aktifAyarlar.wsUrl)
      api.mavlinkKomutGonder(komut, url).catch((e: any) =>
        console.warn('[MAVLink] Komut IPC hatası:', e),
      )
      return
    }

    // 3. REST fallback (mavlink2rest)
    const url = wsUrldenHttpYap(aktifAyarlar.wsUrl)
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(komut),
    })
      .then(yanit => {
        if (!yanit.ok) console.warn(`[MAVLink] Komut reddedildi: HTTP ${yanit.status}`)
      })
      .catch(hata => console.warn('[MAVLink] Komut gönderilemedi:', hata))
  })
}

/**
 * WebSocket URL'sini REST komut endpoint'ine dönüştürür.
 * ws://192.168.1.1:6040/ws/mavlink → http://192.168.1.1:6040/mavlink
 */
function wsUrldenHttpYap(wsUrl: string): string {
  return wsUrl
    .replace(/^wss?:\/\//, (m) => (m === 'wss://' ? 'https://' : 'http://'))
    .replace(/\/ws\/mavlink.*$/, '/mavlink')
}

// ── Dahili Fonksiyonlar ──

function yenidenDene(): void {
  if (yenidenDeneZamanlayici) return
  const sure = aktifAyarlar.yenidenDeneSuresi ?? 3000
  console.log(`[MAVLink] ${sure}ms sonra yeniden denenecek...`)
  yenidenDeneZamanlayici = setTimeout(() => {
    yenidenDeneZamanlayici = null
    mavlinkBaglan(aktifAyarlar)
  }, sure)
}

function mesajIsle(veri: any, store: ReturnType<typeof useAracStore>): void {
  // mavlink2rest mesaj formatı: { header: {...}, message: {...} }
  // veya basit format: { type: "HEARTBEAT", ... }
  const mesajTipi = veri?.message_type ?? veri?.type ?? mesajTipiCikar(veri)
  if (!mesajTipi) return

  store.sonMesajZamani = Date.now()

  switch (mesajTipi) {
    case 'HEARTBEAT':
      heartbeatIsle(veri.message ?? veri, store)
      break
    case 'VFR_HUD':
      vfrHudIsle(veri.message ?? veri, store)
      break
    case 'SYS_STATUS':
      sysStatusIsle(veri.message ?? veri, store)
      break
    case 'ATTITUDE':
      attitudeIsle(veri.message ?? veri, store)
      break
    case 'GLOBAL_POSITION_INT':
      globalPositionIsle(veri.message ?? veri, store)
      break
    case 'GPS_RAW_INT':
      gpsRawIsle(veri.message ?? veri, store)
      break
  }
}

function mesajTipiCikar(veri: any): string | null {
  if (veri?.header?.msg_id !== undefined) {
    const idMap: Record<number, string> = {
      0: 'HEARTBEAT', 74: 'VFR_HUD', 1: 'SYS_STATUS',
      30: 'ATTITUDE', 33: 'GLOBAL_POSITION_INT', 24: 'GPS_RAW_INT',
    }
    return idMap[veri.header.msg_id] ?? null
  }
  return null
}

function heartbeatIsle(msg: MavlinkHeartbeat, store: ReturnType<typeof useAracStore>): void {
  store.armed = (msg.base_mode?.bits & MAV_MODE_FLAG_SAFETY_ARMED) !== 0
  store.ucusModu = px4ModuCoz(msg.custom_mode)
}

function vfrHudIsle(msg: MavlinkVfrHud, store: ReturnType<typeof useAracStore>): void {
  store.yerHizi = msg.groundspeed
  store.havaHizi = msg.airspeed
  store.yukseklik = msg.alt
  store.heading = msg.heading
}

function sysStatusIsle(msg: MavlinkSysStatus, store: ReturnType<typeof useAracStore>): void {
  store.bataryaVoltaj = msg.voltage_battery / 1000  // mV → V
  store.bataryaAkim = msg.current_battery / 100      // cA → A
  store.bataryaYuzde = msg.battery_remaining
}

function attitudeIsle(msg: MavlinkAttitude, store: ReturnType<typeof useAracStore>): void {
  store.pitch = msg.pitch * (180 / Math.PI)   // rad → deg
  store.roll = msg.roll * (180 / Math.PI)
  store.yaw = msg.yaw * (180 / Math.PI)
}

function globalPositionIsle(msg: MavlinkGlobalPositionInt, store: ReturnType<typeof useAracStore>): void {
  store.enlem = msg.lat / 1e7
  store.boylam = msg.lon / 1e7
  store.yukseklik = msg.alt / 1000             // mm → m
  store.yapiYukseklik = msg.relative_alt / 1000
  store.heading = msg.hdg / 100                // cdeg → deg
}

function gpsRawIsle(msg: MavlinkGpsRawInt, store: ReturnType<typeof useAracStore>): void {
  const fixMap: Record<string, number> = {
    'NO_GPS': 0, 'NO_FIX': 1, 'FIX_2D': 2, 'FIX_3D': 3,
    'DGPS': 4, 'RTK_FLOAT': 5, 'RTK_FIXED': 6,
  }
  store.gpsFixTipi = fixMap[msg.fix_type?.type] ?? 0
  store.gpsSayisi = msg.satellites_visible
  store.gpsHdop = msg.eph / 100
}
