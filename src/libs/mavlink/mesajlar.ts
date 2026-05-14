/**
 * Toygun GCS — MAVLink mesaj tip tanımları
 * mavlink2rest WebSocket üzerinden gelen mesajlar için arayüzler
 */

// ── Heartbeat ──
export interface MavlinkHeartbeat {
  type: { type: string }
  autopilot: { type: string }
  base_mode: { bits: number }
  custom_mode: number
  system_status: { type: string }
  mavlink_version: number
}

// ── GPS ──
export interface MavlinkGpsRawInt {
  fix_type: { type: string }
  lat: number       // degE7
  lon: number       // degE7
  alt: number       // mm MSL
  eph: number       // HDOP * 100
  epv: number       // VDOP * 100
  vel: number       // cm/s
  cog: number       // cdeg
  satellites_visible: number
}

// ── VFR HUD ──
export interface MavlinkVfrHud {
  airspeed: number      // m/s
  groundspeed: number   // m/s
  heading: number       // deg (0-360)
  throttle: number      // %
  alt: number           // m MSL
  climb: number         // m/s
}

// ── Batarya ──
export interface MavlinkSysStatus {
  voltage_battery: number   // mV
  current_battery: number   // cA (10 mA)
  battery_remaining: number // % (-1 bilinmiyor)
}

// ── Attitude ──
export interface MavlinkAttitude {
  roll: number       // rad
  pitch: number      // rad
  yaw: number        // rad
  rollspeed: number
  pitchspeed: number
  yawspeed: number
}

// ── Global Position ──
export interface MavlinkGlobalPositionInt {
  lat: number      // degE7
  lon: number      // degE7
  alt: number      // mm MSL
  relative_alt: number  // mm AGL
  vx: number       // cm/s
  vy: number       // cm/s
  vz: number       // cm/s
  hdg: number      // cdeg
}

// ── Genel Mesaj Zarfı ──
export interface MavlinkMesajZarfi<T = any> {
  header: {
    system_id: number
    component_id: number
    sequence: number
  }
  message: T
}

// ── Uçuş Modları (PX4) ──
// PX4 custom_mode: 32-bit değer — bit16-23 = main_mode, bit24-31 = sub_mode
// Geriye dönük uyumluluk için eski düz indeks tablosu da korunuyor
export const PX4_UCM_MODLARI: Record<number, string> = {
  0: 'MANUAL', 1: 'ALTCTL', 2: 'POSCTL', 3: 'AUTO.MISSION',
  4: 'AUTO.LOITER', 5: 'AUTO.RTL', 6: 'ACRO', 8: 'STABILIZED',
  9: 'OFFBOARD', 10: 'AUTO.TAKEOFF', 11: 'AUTO.LAND',
  12: 'AUTO.FOLLOW', 14: 'AUTO.PRECLAND',
}

const PX4_ANA_MOD: Record<number, string> = {
  1: 'MANUAL', 2: 'ALTCTL', 3: 'POSCTL',
  5: 'ACRO', 6: 'OFFBOARD', 7: 'STABILIZED',
}

const PX4_ALT_MOD: Record<number, string> = {
  2: 'AUTO.TAKEOFF', 3: 'AUTO.LOITER', 4: 'AUTO.MISSION',
  5: 'AUTO.RTL',     6: 'AUTO.LAND',   7: 'AUTO.RTGS',
  8: 'AUTO.FOLLOW',  9: 'AUTO.PRECLAND',
}

/**
 * PX4 HEARTBEAT custom_mode değerini uçuş modu adına çevirir.
 * Modern PX4 (v1.10+): bit16-23 = main_mode, bit24-31 = sub_mode
 */
export function px4ModuCoz(customMode: number): string {
  const anaMode = (customMode >> 16) & 0xFF
  const altMode = (customMode >> 24) & 0xFF

  if (anaMode === 4) return PX4_ALT_MOD[altMode] ?? 'AUTO'
  if (anaMode !== 0) return PX4_ANA_MOD[anaMode] ?? `MOD_${anaMode}`

  // Eski düz indeks formatı (PX4 v1.9 ve öncesi)
  return PX4_UCM_MODLARI[customMode] ?? `MOD_${customMode}`
}

// ARM bitmask
export const MAV_MODE_FLAG_SAFETY_ARMED = 128
