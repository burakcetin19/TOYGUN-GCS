/**
 * Toygun GCS — Otopilot Algılama ve Uçuş Modu Tabloları
 *
 * PX4 ve ArduPilot custom_mode'u farklı kodlar:
 *   - PX4:       bit16-23 = main_mode, bit24-31 = sub_mode   (DO_SET_MODE: param2=main, param3=sub)
 *   - ArduPilot: düz mod numarası, araç tipine göre anlamı değişir (DO_SET_MODE: param2=mod)
 * Otopilot HEARTBEAT.autopilot alanından, araç sınıfı HEARTBEAT.type alanından belirlenir.
 *
 * Saf modül — Electron ana süreci (cerceve.ts) ve renderer birlikte kullanır.
 */

import { px4ModuCoz } from './mesajlar'

export type Otopilot = 'px4' | 'ardupilot' | 'bilinmiyor'
export type AracSinifi = 'sabitKanat' | 'cokRotor' | 'vtol' | 'diger'

// MAV_AUTOPILOT
export const MAV_AUTOPILOT_GENERIC = 0
export const MAV_AUTOPILOT_ARDUPILOTMEGA = 3
export const MAV_AUTOPILOT_INVALID = 8
export const MAV_AUTOPILOT_PX4 = 12

// MAV_TYPE
const MAV_TYPE = {
  FIXED_WING: 1, QUADROTOR: 2, COAXIAL: 3, HELICOPTER: 4, GCS: 6,
  HEXAROTOR: 13, OCTOROTOR: 14, TRICOPTER: 15, DODECAROTOR: 29, DECAROTOR: 35,
  VTOL_TAILSITTER_DUOROTOR: 19, VTOL_TAILSITTER_QUADROTOR: 20, VTOL_TILTROTOR: 21,
  VTOL_FIXEDROTOR: 22, VTOL_TAILSITTER: 23, VTOL_TILTWING: 24, VTOL_RESERVED5: 25,
} as const

const COK_ROTOR = new Set<number>([
  MAV_TYPE.QUADROTOR, MAV_TYPE.COAXIAL, MAV_TYPE.HELICOPTER, MAV_TYPE.HEXAROTOR,
  MAV_TYPE.OCTOROTOR, MAV_TYPE.TRICOPTER, MAV_TYPE.DODECAROTOR, MAV_TYPE.DECAROTOR,
])
const VTOL = new Set<number>([19, 20, 21, 22, 23, 24, 25])

export function otopilotBelirle(autopilot: number): Otopilot {
  if (autopilot === MAV_AUTOPILOT_PX4) return 'px4'
  if (autopilot === MAV_AUTOPILOT_ARDUPILOTMEGA) return 'ardupilot'
  return 'bilinmiyor'
}

export function aracSinifiBelirle(mavType: number): AracSinifi {
  if (mavType === MAV_TYPE.FIXED_WING) return 'sabitKanat'
  if (VTOL.has(mavType)) return 'vtol'
  if (COK_ROTOR.has(mavType)) return 'cokRotor'
  return 'diger'
}

/**
 * Bu HEARTBEAT aracın kendisinden mi? Kamera, gimbal, yardımcı bilgisayar ve diğer
 * GCS'ler autopilot=INVALID gönderir; bunlar mod/ARM durumunu değiştirmemeli.
 */
export function aracHeartbeatiMi(autopilot: number, mavType: number): boolean {
  return autopilot !== MAV_AUTOPILOT_INVALID && mavType !== MAV_TYPE.GCS
}

// ── mavlink2rest enum adları → sayı ────────────────────────────────────────────
const AUTOPILOT_ADI: Record<string, number> = {
  MAV_AUTOPILOT_GENERIC: 0, MAV_AUTOPILOT_ARDUPILOTMEGA: 3, MAV_AUTOPILOT_INVALID: 8, MAV_AUTOPILOT_PX4: 12,
}
const MAV_TYPE_ADI: Record<string, number> = Object.fromEntries(
  Object.entries(MAV_TYPE).map(([ad, no]) => [`MAV_TYPE_${ad}`, no]),
)

/** Sayı ya da { type: 'MAV_...' } biçimindeki enum değerini sayıya çevirir */
export function enumSayisi(deger: any, tur: 'autopilot' | 'mavType'): number {
  const ham = deger?.type ?? deger
  if (typeof ham === 'number') return ham
  if (typeof ham === 'string') {
    const tablo = tur === 'autopilot' ? AUTOPILOT_ADI : MAV_TYPE_ADI
    return tablo[ham] ?? -1
  }
  return -1
}

// ── Mod Tabloları ──────────────────────────────────────────────────────────────
const ARDUPLANE_MODLARI: Record<number, string> = {
  0: 'MANUAL', 1: 'CIRCLE', 2: 'STABILIZE', 3: 'TRAINING', 4: 'ACRO', 5: 'FBWA', 6: 'FBWB',
  7: 'CRUISE', 8: 'AUTOTUNE', 10: 'AUTO', 11: 'RTL', 12: 'LOITER', 13: 'TAKEOFF',
  14: 'AVOID_ADSB', 15: 'GUIDED', 16: 'INITIALISING', 17: 'QSTABILIZE', 18: 'QHOVER',
  19: 'QLOITER', 20: 'QLAND', 21: 'QRTL', 22: 'QAUTOTUNE', 23: 'QACRO', 24: 'THERMAL',
  25: 'LOITER_ALT_QLAND', 26: 'AUTOLAND',
}

const ARDUCOPTER_MODLARI: Record<number, string> = {
  0: 'STABILIZE', 1: 'ACRO', 2: 'ALT_HOLD', 3: 'AUTO', 4: 'GUIDED', 5: 'LOITER', 6: 'RTL',
  7: 'CIRCLE', 9: 'LAND', 11: 'DRIFT', 13: 'SPORT', 14: 'FLIP', 15: 'AUTOTUNE', 16: 'POSHOLD',
  17: 'BRAKE', 18: 'THROW', 19: 'AVOID_ADSB', 20: 'GUIDED_NOGPS', 21: 'SMART_RTL',
  22: 'FLOWHOLD', 23: 'FOLLOW', 24: 'ZIGZAG', 25: 'SYSTEMID', 26: 'AUTOROTATE', 27: 'AUTO_RTL',
}

/** Otonom sayılan modlar (yarışma telemetrisindeki iha_otonom alanı için) */
const ARDUPLANE_OTONOM = new Set([
  'AUTO', 'RTL', 'LOITER', 'CIRCLE', 'TAKEOFF', 'GUIDED', 'AVOID_ADSB', 'QLAND', 'QRTL',
  'LOITER_ALT_QLAND', 'AUTOLAND', 'THERMAL',
])
const ARDUCOPTER_OTONOM = new Set([
  'AUTO', 'GUIDED', 'RTL', 'LAND', 'CIRCLE', 'SMART_RTL', 'FOLLOW', 'AUTO_RTL', 'AVOID_ADSB',
])

function ardupilotTablosu(sinif: AracSinifi): Record<number, string> | null {
  if (sinif === 'sabitKanat' || sinif === 'vtol') return ARDUPLANE_MODLARI
  if (sinif === 'cokRotor') return ARDUCOPTER_MODLARI
  return null
}

/** HEARTBEAT custom_mode → okunur mod adı */
export function modAdiCoz(otopilot: Otopilot, sinif: AracSinifi, customMode: number): string {
  if (otopilot === 'ardupilot') {
    return ardupilotTablosu(sinif)?.[customMode] ?? `MOD_${customMode}`
  }
  // PX4 ve bilinmeyen otopilotlar için PX4 çözümü (geriye dönük davranış)
  return px4ModuCoz(customMode)
}

export function otonomModMu(otopilot: Otopilot, sinif: AracSinifi, modAdi: string): boolean {
  if (otopilot === 'ardupilot') {
    return (sinif === 'cokRotor' ? ARDUCOPTER_OTONOM : ARDUPLANE_OTONOM).has(modAdi)
  }
  return modAdi.startsWith('AUTO')
}

// ── Mod seçici listeleri ───────────────────────────────────────────────────────
export interface UcusModuTanimi {
  /** HEARTBEAT'ten çözülen adla aynı — aktif mod karşılaştırması bununla yapılır */
  ad: string
  ikon: string
  grup: 'temel' | 'otonom' | 'vtol'
  /** PX4: (ana<<16)|(alt<<24) · ArduPilot: düz mod numarası */
  customMode: number
  /** Varsa PX4 kodlaması; DO_SET_MODE param2/param3 buradan doldurulur */
  px4?: { ana: number; alt: number }
}

const px4 = (ad: string, ikon: string, grup: UcusModuTanimi['grup'], ana: number, alt = 0): UcusModuTanimi =>
  ({ ad, ikon, grup, customMode: ((ana << 16) | (alt << 24)) >>> 0, px4: { ana, alt } })

const apm = (ad: string, ikon: string, grup: UcusModuTanimi['grup'], tablo: Record<number, string>): UcusModuTanimi => {
  const no = Number(Object.keys(tablo).find((k) => tablo[Number(k)] === ad))
  return { ad, ikon, grup, customMode: no }
}

// PX4 main_mode: 1=MANUAL 2=ALTCTL 3=POSCTL 4=AUTO 5=ACRO 6=OFFBOARD 7=STABILIZED
// PX4 AUTO sub_mode: 2=TAKEOFF 3=LOITER 4=MISSION 5=RTL 6=LAND
const PX4_LISTESI: UcusModuTanimi[] = [
  px4('MANUAL', 'mdi-hand-back-right', 'temel', 1),
  px4('STABILIZED', 'mdi-airplane-check', 'temel', 7),
  px4('ALTCTL', 'mdi-altimeter', 'temel', 2),
  px4('POSCTL', 'mdi-crosshairs-gps', 'temel', 3),
  px4('ACRO', 'mdi-rotate-3d-variant', 'temel', 5),
  px4('OFFBOARD', 'mdi-remote', 'temel', 6),
  px4('AUTO.LOITER', 'mdi-motion-pause', 'otonom', 4, 3),
  px4('AUTO.MISSION', 'mdi-map-marker-path', 'otonom', 4, 4),
  px4('AUTO.RTL', 'mdi-home-import-outline', 'otonom', 4, 5),
  px4('AUTO.TAKEOFF', 'mdi-airplane-takeoff', 'otonom', 4, 2),
  px4('AUTO.LAND', 'mdi-airplane-landing', 'otonom', 4, 6),
]

const P = ARDUPLANE_MODLARI
const ARDUPLANE_LISTESI: UcusModuTanimi[] = [
  apm('MANUAL', 'mdi-hand-back-right', 'temel', P),
  apm('STABILIZE', 'mdi-airplane-check', 'temel', P),
  apm('FBWA', 'mdi-airplane', 'temel', P),
  apm('FBWB', 'mdi-altimeter', 'temel', P),
  apm('CRUISE', 'mdi-airplane-marker', 'temel', P),
  apm('ACRO', 'mdi-rotate-3d-variant', 'temel', P),
  apm('AUTO', 'mdi-map-marker-path', 'otonom', P),
  apm('RTL', 'mdi-home-import-outline', 'otonom', P),
  apm('LOITER', 'mdi-motion-pause', 'otonom', P),
  apm('CIRCLE', 'mdi-rotate-right', 'otonom', P),
  apm('TAKEOFF', 'mdi-airplane-takeoff', 'otonom', P),
  apm('GUIDED', 'mdi-crosshairs-gps', 'otonom', P),
]

const ARDUPLANE_VTOL_EK: UcusModuTanimi[] = [
  apm('QSTABILIZE', 'mdi-helicopter', 'vtol', P),
  apm('QHOVER', 'mdi-arrow-collapse-vertical', 'vtol', P),
  apm('QLOITER', 'mdi-motion-pause-outline', 'vtol', P),
  apm('QLAND', 'mdi-airplane-landing', 'vtol', P),
  apm('QRTL', 'mdi-home-import-outline', 'vtol', P),
]

const C = ARDUCOPTER_MODLARI
const ARDUCOPTER_LISTESI: UcusModuTanimi[] = [
  apm('STABILIZE', 'mdi-airplane-check', 'temel', C),
  apm('ALT_HOLD', 'mdi-altimeter', 'temel', C),
  apm('LOITER', 'mdi-motion-pause', 'temel', C),
  apm('POSHOLD', 'mdi-crosshairs-gps', 'temel', C),
  apm('ACRO', 'mdi-rotate-3d-variant', 'temel', C),
  apm('AUTO', 'mdi-map-marker-path', 'otonom', C),
  apm('GUIDED', 'mdi-crosshairs', 'otonom', C),
  apm('RTL', 'mdi-home-import-outline', 'otonom', C),
  apm('SMART_RTL', 'mdi-home-search-outline', 'otonom', C),
  apm('LAND', 'mdi-airplane-landing', 'otonom', C),
  apm('BRAKE', 'mdi-car-brake-hold', 'otonom', C),
]

/** Bağlı araca uygun mod listesi. Bilinmeyen otopilotta boş — yanlış mod göndermemek için. */
export function modListesi(otopilot: Otopilot, sinif: AracSinifi): UcusModuTanimi[] {
  if (otopilot === 'px4') return PX4_LISTESI
  if (otopilot === 'ardupilot') {
    if (sinif === 'sabitKanat') return ARDUPLANE_LISTESI
    if (sinif === 'vtol') return [...ARDUPLANE_LISTESI, ...ARDUPLANE_VTOL_EK]
    if (sinif === 'cokRotor') return ARDUCOPTER_LISTESI
  }
  return []
}

export function modBul(otopilot: Otopilot, sinif: AracSinifi, ad: string): UcusModuTanimi | undefined {
  return modListesi(otopilot, sinif).find((m) => m.ad === ad)
}

export function otopilotEtiketi(otopilot: Otopilot, sinif: AracSinifi): string {
  if (otopilot === 'px4') return 'PX4'
  if (otopilot === 'ardupilot') {
    if (sinif === 'cokRotor') return 'ArduCopter'
    if (sinif === 'vtol') return 'ArduPlane (VTOL)'
    if (sinif === 'sabitKanat') return 'ArduPlane'
    return 'ArduPilot'
  }
  return '—'
}
