/**
 * Toygun GCS — Donanım MAVLink Dinleyici
 * Electron IPC üzerinden gelen ham MAVLink mesajlarını (Serial/UDP/TCP)
 * Pinia store'a yazar. mavlink2rest WebSocket yolundan bağımsız çalışır.
 *
 * Kullanım: Electron modunda, donanım bağlantısı başlatıldıktan sonra çağrılır.
 * Web modunda (toygunAPI yok) sessizce atlanır.
 */

import { useAracStore } from '@/stores/arac'
import { px4ModuCoz, MAV_MODE_FLAG_SAFETY_ARMED } from './mesajlar'

type AracStore = ReturnType<typeof useAracStore>

let kuruldu = false
let watchdogInterval: ReturnType<typeof setInterval> | null = null
let sonHeartbeatZamani = 0

/**
 * Electron IPC mesaj dinleyicilerini başlatır.
 * Birden fazla çağrıda tekrar kurulum yapmaz.
 */
export function donanımDinleyiciBaslat(store: AracStore): void {
  const api = (window as any).toygunAPI
  if (!api?.onMavlinkMesaj || !api?.onBaglantiDurumu) {
    // Web modunda çalışıyoruz, IPC yok — atla
    return
  }
  if (kuruldu) return
  kuruldu = true

  // Bağlantı durumu değişikliklerini dinle (Serial/UDP/TCP bağlantıları için)
  api.onBaglantiDurumu((durum: 'baglandi' | 'baglaniliyor' | 'baglantiKesik') => {
    store.baglantiDurumu = durum
    if (durum === 'baglantiKesik') {
      store.telemetriSifirla()
      sonHeartbeatZamani = 0
    }
  })

  // Ham MAVLink mesajlarını dinle
  api.onMavlinkMesaj(({ tip, veri }: { tip: string; veri: Record<string, any> }) => {
    store.sonMesajZamani = Date.now()
    if (tip === 'HEARTBEAT') sonHeartbeatZamani = Date.now()
    mesajIsle(tip, veri, store)
  })

  // HEARTBEAT watchdog: 5 sn HEARTBEAT gelmezse bağlantı kopmuş say
  watchdogInterval = setInterval(() => {
    if (store.baglantiDurumu !== 'baglandi') return
    if (sonHeartbeatZamani === 0) return
    if (Date.now() - sonHeartbeatZamani > 5000) {
      store.baglantiDurumu = 'baglantiKesik'
      store.telemetriSifirla()
      sonHeartbeatZamani = 0
      ;(window as any).__toygunBildirim?.('MAVLink bağlantısı kesildi (HEARTBEAT zaman aşımı)', 'hata')
    }
  }, 3000)

  console.log('[Donanım Dinleyici] IPC dinleyiciler kuruldu')
}

/** Donanım dinleyiciyi sıfırla (test veya yeniden bağlantı için) */
export function donanımDinleyiciSifirla(): void {
  kuruldu = false
  if (watchdogInterval) {
    clearInterval(watchdogInterval)
    watchdogInterval = null
  }
  sonHeartbeatZamani = 0
}

// ── Mesaj İşleme ───────────────────────────────────────────────────────────────

function mesajIsle(tip: string, veri: Record<string, any>, store: AracStore): void {
  switch (tip) {
    case 'HEARTBEAT':
      heartbeatIsle(veri, store)
      break
    case 'VFR_HUD':
      vfrHudIsle(veri, store)
      break
    case 'SYS_STATUS':
      sysStatusIsle(veri, store)
      break
    case 'ATTITUDE':
      attitudeIsle(veri, store)
      break
    case 'GLOBAL_POSITION_INT':
      globalPositionIsle(veri, store)
      break
    case 'GPS_RAW_INT':
      gpsRawIsle(veri, store)
      break
  }
}

function heartbeatIsle(veri: any, store: AracStore): void {
  // armed: donanim-baglanti.ts zaten hesapladı, ama base_mode ile de kontrol edebiliriz
  if (veri.armed !== undefined) {
    store.armed = veri.armed
  } else if (veri.base_mode?.bits !== undefined) {
    store.armed = (veri.base_mode.bits & MAV_MODE_FLAG_SAFETY_ARMED) !== 0
  }
  if (veri.ucusModu) {
    store.ucusModu = veri.ucusModu
  } else if (veri.custom_mode !== undefined) {
    store.ucusModu = px4ModuCoz(veri.custom_mode)
  }
}

function vfrHudIsle(veri: any, store: AracStore): void {
  if (veri.groundspeed !== undefined) store.yerHizi = veri.groundspeed
  if (veri.airspeed !== undefined)    store.havaHizi = veri.airspeed
  if (veri.alt !== undefined)         store.yukseklik = veri.alt
  if (veri.heading !== undefined)     store.heading = veri.heading
}

function sysStatusIsle(veri: any, store: AracStore): void {
  if (veri.voltage_battery !== undefined) store.bataryaVoltaj = veri.voltage_battery / 1000  // mV → V
  if (veri.current_battery !== undefined) store.bataryaAkim   = veri.current_battery / 100   // cA → A
  if (veri.battery_remaining !== undefined) store.bataryaYuzde = veri.battery_remaining
}

function attitudeIsle(veri: any, store: AracStore): void {
  const radDerece = 180 / Math.PI
  if (veri.roll  !== undefined) store.roll  = veri.roll  * radDerece
  if (veri.pitch !== undefined) store.pitch = veri.pitch * radDerece
  if (veri.yaw   !== undefined) store.yaw   = veri.yaw   * radDerece
}

function globalPositionIsle(veri: any, store: AracStore): void {
  if (veri.lat !== undefined) store.enlem  = veri.lat / 1e7
  if (veri.lon !== undefined) store.boylam = veri.lon / 1e7
  if (veri.alt !== undefined) store.yukseklik = veri.alt / 1000       // mm → m
  if (veri.relative_alt !== undefined) store.yapiYukseklik = veri.relative_alt / 1000
  if (veri.hdg !== undefined) store.heading = veri.hdg / 100          // cdeg → deg
}

function gpsRawIsle(veri: any, store: AracStore): void {
  const fixMap: Record<string, number> = {
    'NO_GPS': 0, 'NO_FIX': 1, 'FIX_2D': 2, 'FIX_3D': 3,
    'DGPS': 4, 'RTK_FLOAT': 5, 'RTK_FIXED': 6,
  }
  if (veri.fix_type?.type !== undefined) {
    store.gpsFixTipi = fixMap[veri.fix_type.type] ?? 0
  }
  if (veri.satellites_visible !== undefined) store.gpsSayisi = veri.satellites_visible
  if (veri.eph !== undefined) store.gpsHdop = veri.eph / 100          // cm → m (HDOP olarak yaklaşık)
}
