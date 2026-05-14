/**
 * Toygun GCS — MAVLink Komut Gönderici
 * Arm/Disarm, mod değiştirme, görev yükleme/indirme komutları
 */

import { mavlinkKomutGonder } from './baglanti'

// ── MAV_CMD sabitleri ──
const MAV_CMD = {
  COMPONENT_ARM_DISARM: 400,
  DO_SET_MODE: 176,
  NAV_WAYPOINT: 16,
  NAV_RETURN_TO_LAUNCH: 20,
  NAV_LAND: 21,
  DO_SET_HOME: 179,
  MISSION_START: 300,
}

/**
 * Aracı ARM/DISARM yap
 */
export function aracArmDisarm(arm: boolean): void {
  mavlinkKomutGonder({
    header: { system_id: 255, component_id: 0, sequence: 0 },
    message: {
      type: 'COMMAND_LONG',
      target_system: 1,
      target_component: 1,
      command: { type: 'MAV_CMD_COMPONENT_ARM_DISARM' },
      confirmation: 0,
      param1: arm ? 1 : 0,
      param2: 0, param3: 0, param4: 0, param5: 0, param6: 0, param7: 0,
    },
  })
  console.log(`[MAVLink] ${arm ? 'ARM' : 'DISARM'} komutu gönderildi`)
}

/**
 * Uçuş modunu değiştir — MAV_CMD_DO_SET_MODE (176) via COMMAND_LONG.
 * PX4 custom_mode encoding: bit16-23 = main_mode, bit24-31 = sub_mode
 */
export function ucusModuDegistir(customMode: number): void {
  const mainMode = (customMode >> 16) & 0xFF
  const subMode  = (customMode >> 24) & 0xFF
  mavlinkKomutGonder({
    header: { system_id: 255, component_id: 240, sequence: 0 },
    message: {
      type: 'COMMAND_LONG',
      target_system: 1,
      target_component: 1,
      command: { type: 'MAV_CMD_DO_SET_MODE' },
      confirmation: 0,
      param1: 1,        // MAV_MODE_FLAG_CUSTOM_MODE_ENABLED
      param2: mainMode,
      param3: subMode,
      param4: 0, param5: 0, param6: 0, param7: 0,
    },
  })
  console.log(`[MAVLink] Mod komutu → main:${mainMode} sub:${subMode} (raw:${customMode})`)
}

/**
 * RTL (Eve Dönüş) komutu
 */
export function eveDon(): void {
  ucusModuDegistir(5) // AUTO.RTL
}

/**
 * İniş komutu
 */
export function inisYap(): void {
  ucusModuDegistir(11) // AUTO.LAND
}

/**
 * Görev başlat
 */
export function gorevBaslat(): void {
  mavlinkKomutGonder({
    header: { system_id: 255, component_id: 0, sequence: 0 },
    message: {
      type: 'COMMAND_LONG',
      target_system: 1,
      target_component: 1,
      command: { type: 'MAV_CMD_MISSION_START' },
      confirmation: 0,
      param1: 0, param2: 0, param3: 0, param4: 0, param5: 0, param6: 0, param7: 0,
    },
  })
  console.log('[MAVLink] Görev başlatma komutu gönderildi')
}

/**
 * Ev noktası ayarla
 */
export function evNoktasiAyarla(enlem: number, boylam: number, yukseklik: number): void {
  mavlinkKomutGonder({
    header: { system_id: 255, component_id: 0, sequence: 0 },
    message: {
      type: 'COMMAND_LONG',
      target_system: 1,
      target_component: 1,
      command: { type: 'MAV_CMD_DO_SET_HOME' },
      confirmation: 0,
      param1: 0, // Mevcut konumu kullan = 1, belirli konum = 0
      param2: 0, param3: 0, param4: 0,
      param5: enlem,
      param6: boylam,
      param7: yukseklik,
    },
  })
  console.log(`[MAVLink] Ev noktası ayarlandı: ${enlem}, ${boylam}`)
}

/**
 * Görev noktalarını araca yükle (MISSION_ITEM_INT protokolü)
 */
export function gorevYukle(
  noktalar: Array<{ enlem: number; boylam: number; yukseklik: number; sira: number }>
): void {
  // Önce görev sayısını bildir
  mavlinkKomutGonder({
    header: { system_id: 255, component_id: 0, sequence: 0 },
    message: {
      type: 'MISSION_COUNT',
      target_system: 1,
      target_component: 1,
      count: noktalar.length,
      mission_type: { type: 'MAV_MISSION_TYPE_MISSION' },
    },
  })

  // Ardından her noktayı gönder
  noktalar.forEach((nokta, index) => {
    setTimeout(() => {
      mavlinkKomutGonder({
        header: { system_id: 255, component_id: 0, sequence: 0 },
        message: {
          type: 'MISSION_ITEM_INT',
          target_system: 1,
          target_component: 1,
          seq: index,
          frame: { type: 'MAV_FRAME_GLOBAL_RELATIVE_ALT_INT' },
          command: { type: 'MAV_CMD_NAV_WAYPOINT' },
          current: index === 0 ? 1 : 0,
          autocontinue: 1,
          param1: 0, param2: 0, param3: 0, param4: 0,
          x: Math.round(nokta.enlem * 1e7),
          y: Math.round(nokta.boylam * 1e7),
          z: nokta.yukseklik,
          mission_type: { type: 'MAV_MISSION_TYPE_MISSION' },
        },
      })
    }, index * 50) // Her noktayı 50ms aralıkla gönder
  })

  console.log(`[MAVLink] ${noktalar.length} görev noktası yükleniyor`)
}
