/**
 * Toygun GCS — Ortak MAVLink Çerçeve Katmanı
 *
 * Hem Electron ana sürecinde (Serial/UDP/TCP) hem de renderer'da (Web Serial)
 * kullanılır. Yalnızca Uint8Array/DataView kullanır — Node Buffer veya DOM gerektirmez.
 *
 *  - MAVLink v1/v2 ayrıştırıcı: CRC doğrulaması + v2 sıfır-kırpma (payload truncation) düzeltmesi
 *  - Kullanılan mesajların çözümü (HEARTBEAT, VFR_HUD, ..., COMMAND_ACK, MISSION_*)
 *  - Giden mesaj kodlayıcıları (COMMAND_LONG, SET_MODE, MISSION_COUNT, MISSION_ITEM_INT, HEARTBEAT)
 */

import { MAV_MODE_FLAG_SAFETY_ARMED } from './mesajlar'
import { otopilotBelirle, aracSinifiBelirle, aracHeartbeatiMi, modAdiCoz } from './otopilot'

// ── Mesaj Kimlikleri ───────────────────────────────────────────────────────────
export const MSG = {
  HEARTBEAT: 0,
  SYS_STATUS: 1,
  GPS_RAW_INT: 24,
  ATTITUDE: 30,
  GLOBAL_POSITION_INT: 33,
  MISSION_REQUEST: 40,
  MISSION_COUNT: 44,
  MISSION_ACK: 47,
  MISSION_REQUEST_INT: 51,
  MISSION_ITEM_INT: 73,
  VFR_HUD: 74,
  COMMAND_LONG: 76,
  COMMAND_ACK: 77,
} as const

/** CRC_EXTRA (mesaj tanımından türetilen tohum) — CRC doğrulaması için zorunlu */
const CRC_EXTRA: Record<number, number> = {
  [MSG.HEARTBEAT]: 50,
  [MSG.SYS_STATUS]: 124,
  [MSG.GPS_RAW_INT]: 24,
  [MSG.ATTITUDE]: 39,
  [MSG.GLOBAL_POSITION_INT]: 104,
  [MSG.MISSION_REQUEST]: 230,
  [MSG.MISSION_COUNT]: 221,
  [MSG.MISSION_ACK]: 153,
  [MSG.MISSION_REQUEST_INT]: 196,
  [MSG.MISSION_ITEM_INT]: 38,
  [MSG.VFR_HUD]: 20,
  [MSG.COMMAND_LONG]: 152,
  [MSG.COMMAND_ACK]: 143,
}

/**
 * Uzantılar dahil tam payload uzunluğu. MAVLink v2 sondaki sıfır baytları kırpar;
 * çözmeden önce payload bu uzunluğa sıfırla doldurulur.
 */
const TAM_UZUNLUK: Record<number, number> = {
  [MSG.HEARTBEAT]: 9,
  [MSG.SYS_STATUS]: 43,
  [MSG.GPS_RAW_INT]: 52,
  [MSG.ATTITUDE]: 28,
  [MSG.GLOBAL_POSITION_INT]: 28,
  [MSG.MISSION_REQUEST]: 5,
  [MSG.MISSION_COUNT]: 9,
  [MSG.MISSION_ACK]: 8,
  [MSG.MISSION_REQUEST_INT]: 5,
  [MSG.MISSION_ITEM_INT]: 38,
  [MSG.VFR_HUD]: 20,
  [MSG.COMMAND_LONG]: 33,
  [MSG.COMMAND_ACK]: 10,
}

// ── GCS Kimliği ────────────────────────────────────────────────────────────────
export const GCS_SYSID = 255
export const GCS_COMPID = 190 // MAV_COMP_ID_MISSIONPLANNER

// ── X.25 CRC (MCRF4XX) ────────────────────────────────────────────────────────
export function x25Crc(veri: Uint8Array, crc = 0xffff): number {
  for (let i = 0; i < veri.length; i++) {
    let tmp = (veri[i] ^ (crc & 0xff)) & 0xff
    tmp = (tmp ^ (tmp << 4)) & 0xff
    crc = ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xffff
  }
  return crc
}

// ── Ayrıştırıcı ────────────────────────────────────────────────────────────────
export interface MavlinkCerceve {
  msgId: number
  sysid: number
  compid: number
  /** TAM_UZUNLUK'a sıfırla doldurulmuş payload */
  payload: Uint8Array
}

const STX_V1 = 0xfe
const STX_V2 = 0xfd
const AZAMI_TAMPON = 8192

export class MavlinkAyristirici {
  private tampon = new Uint8Array(0)
  /** CRC hatası nedeniyle atılan çerçeve sayısı (tanı amaçlı) */
  crcHatasi = 0

  constructor(private readonly onCerceve: (c: MavlinkCerceve) => void) {}

  ekle(gelen: Uint8Array): void {
    const birlesik = new Uint8Array(this.tampon.length + gelen.length)
    birlesik.set(this.tampon)
    birlesik.set(gelen, this.tampon.length)
    // Doğru senkronda tampon bir yarım çerçeveyi (≤280 B) geçmez; bu sadece emniyet sınırı
    this.tampon = birlesik.length > AZAMI_TAMPON ? birlesik.slice(birlesik.length - 512) : birlesik
    this.cercevele()
  }

  private cercevele(): void {
    let bas = 0
    const t = this.tampon

    while (true) {
      // Başlangıç baytına senkronize ol
      while (bas < t.length && t[bas] !== STX_V1 && t[bas] !== STX_V2) bas++
      if (bas >= t.length) break

      const v2 = t[bas] === STX_V2
      const baslikBoyu = v2 ? 10 : 6
      if (t.length - bas < baslikBoyu) break

      const govdeBoyu = t[bas + 1]
      const imzaBoyu = v2 && (t[bas + 2] & 0x01) ? 13 : 0
      const toplam = baslikBoyu + govdeBoyu + 2 + imzaBoyu
      if (t.length - bas < toplam) break

      const msgId = v2 ? t[bas + 7] | (t[bas + 8] << 8) | (t[bas + 9] << 16) : t[bas + 5]
      const crcExtra = CRC_EXTRA[msgId]

      if (crcExtra === undefined) {
        // Bilmediğimiz bir mesaj — doğrulayamayız, çerçeveyi atla
        bas += toplam
        continue
      }

      const crcSonu = bas + baslikBoyu + govdeBoyu
      let crc = x25Crc(t.subarray(bas + 1, crcSonu))
      crc = x25Crc(Uint8Array.of(crcExtra), crc)
      const gelenCrc = t[crcSonu] | (t[crcSonu + 1] << 8)

      if (crc !== gelenCrc) {
        // Bozuk çerçeve ya da sahte STX — bir bayt ilerleyip yeniden senkronize ol
        this.crcHatasi++
        bas += 1
        continue
      }

      const tamBoy = Math.max(TAM_UZUNLUK[msgId] ?? govdeBoyu, govdeBoyu)
      const payload = new Uint8Array(tamBoy)
      payload.set(t.subarray(bas + baslikBoyu, bas + baslikBoyu + govdeBoyu))

      const sysid = v2 ? t[bas + 5] : t[bas + 3]
      const compid = v2 ? t[bas + 6] : t[bas + 4]
      bas += toplam

      try {
        this.onCerceve({ msgId, sysid, compid, payload })
      } catch (e) {
        console.warn('[MAVLink] Çerçeve işleme hatası:', e)
      }
    }

    this.tampon = bas > 0 ? t.slice(bas) : t
  }
}

// ── Mesaj Çözümü ───────────────────────────────────────────────────────────────
const GPS_FIX_ADI: Record<number, string> = {
  0: 'NO_GPS', 1: 'NO_FIX', 2: 'FIX_2D', 3: 'FIX_3D',
  4: 'DGPS', 5: 'RTK_FLOAT', 6: 'RTK_FIXED',
}

export interface CozulmusMesaj {
  tip: string
  veri: Record<string, any>
}

/** Çerçeveyi uygulamanın kullandığı { tip, veri } biçimine çevirir; ilgilenmediklerimiz için null */
export function cerceveCoz(c: MavlinkCerceve): CozulmusMesaj | null {
  const g = c.payload
  const dv = new DataView(g.buffer, g.byteOffset, g.byteLength)
  const kaynak = { sysid: c.sysid, compid: c.compid }

  switch (c.msgId) {
    case MSG.HEARTBEAT: {
      // custom_mode(u32@0) type(u8@4) autopilot(u8@5) base_mode(u8@6) system_status(u8@7) mavlink_version(u8@8)
      const customMode = dv.getUint32(0, true)
      const baseMode = g[6]
      const otopilot = otopilotBelirle(g[5])
      const aracSinifi = aracSinifiBelirle(g[4])
      return {
        tip: 'HEARTBEAT',
        veri: {
          ...kaynak,
          custom_mode: customMode,
          mav_type: g[4],
          autopilot: g[5],
          base_mode: { bits: baseMode },
          armed: (baseMode & MAV_MODE_FLAG_SAFETY_ARMED) !== 0,
          // false → kamera/gimbal/yardımcı bilgisayar/başka GCS; araç durumunu değiştirmemeli
          aracHeartbeati: aracHeartbeatiMi(g[5], g[4]),
          otopilot,
          aracSinifi,
          ucusModu: modAdiCoz(otopilot, aracSinifi, customMode),
        },
      }
    }
    case MSG.VFR_HUD:
      // airspeed(f@0) groundspeed(f@4) alt(f@8) climb(f@12) heading(i16@16) throttle(u16@18)
      return {
        tip: 'VFR_HUD',
        veri: {
          ...kaynak,
          airspeed: dv.getFloat32(0, true),
          groundspeed: dv.getFloat32(4, true),
          alt: dv.getFloat32(8, true),
          climb: dv.getFloat32(12, true),
          heading: dv.getInt16(16, true),
          throttle: dv.getUint16(18, true),
        },
      }
    case MSG.SYS_STATUS:
      // voltage_battery(u16@14) current_battery(i16@16) battery_remaining(i8@30)
      return {
        tip: 'SYS_STATUS',
        veri: {
          ...kaynak,
          voltage_battery: dv.getUint16(14, true),
          current_battery: dv.getInt16(16, true),
          battery_remaining: dv.getInt8(30),
        },
      }
    case MSG.ATTITUDE:
      return {
        tip: 'ATTITUDE',
        veri: {
          ...kaynak,
          roll: dv.getFloat32(4, true),
          pitch: dv.getFloat32(8, true),
          yaw: dv.getFloat32(12, true),
        },
      }
    case MSG.GLOBAL_POSITION_INT: {
      const hdg = dv.getUint16(26, true)
      return {
        tip: 'GLOBAL_POSITION_INT',
        veri: {
          ...kaynak,
          lat: dv.getInt32(4, true),
          lon: dv.getInt32(8, true),
          alt: dv.getInt32(12, true),          // mm MSL
          relative_alt: dv.getInt32(16, true), // mm AGL
          // UINT16_MAX = bilinmiyor → alanı hiç gönderme (VFR_HUD heading'i geçerli kalsın)
          ...(hdg !== 0xffff ? { hdg } : {}),
        },
      }
    }
    case MSG.GPS_RAW_INT:
      // time_usec(u64@0) lat(i32@8) lon(i32@12) alt(i32@16) eph(u16@20) epv(u16@22) vel(u16@24) cog(u16@26) fix_type(u8@28) satellites_visible(u8@29)
      return {
        tip: 'GPS_RAW_INT',
        veri: {
          ...kaynak,
          fix_type: { type: GPS_FIX_ADI[g[28]] ?? 'NO_FIX' },
          lat: dv.getInt32(8, true),
          lon: dv.getInt32(12, true),
          eph: dv.getUint16(20, true),
          satellites_visible: g[29],
        },
      }
    case MSG.COMMAND_ACK:
      // command(u16@0) result(u8@2) progress(u8@3) result_param2(i32@4) target_system(u8@8) target_component(u8@9)
      return {
        tip: 'COMMAND_ACK',
        veri: { ...kaynak, command: dv.getUint16(0, true), result: g[2], target_system: g[8] },
      }
    case MSG.MISSION_REQUEST_INT:
    case MSG.MISSION_REQUEST:
      // seq(u16@0) target_system(u8@2) target_component(u8@3) mission_type(u8@4)
      // Eski MISSION_REQUEST da aynı şekilde ele alınır — yanıt her durumda MISSION_ITEM_INT
      return {
        tip: 'MISSION_REQUEST_INT',
        veri: { ...kaynak, seq: dv.getUint16(0, true), target_system: g[2], mission_type: g[4] },
      }
    case MSG.MISSION_ACK:
      // target_system(u8@0) target_component(u8@1) type(u8@2) mission_type(u8@3)
      return {
        tip: 'MISSION_ACK',
        veri: { ...kaynak, target_system: g[0], type: g[2], mission_type: g[3] },
      }
  }
  return null
}

// ── Kodlayıcılar (MAVLink v1 çıkış) ────────────────────────────────────────────
let sira = 0

export function v1Cerceve(msgId: number, payload: Uint8Array): Uint8Array {
  const crcExtra = CRC_EXTRA[msgId]
  if (crcExtra === undefined) throw new Error(`CRC_EXTRA bilinmiyor: msgId=${msgId}`)

  const cerceve = new Uint8Array(6 + payload.length + 2)
  cerceve[0] = STX_V1
  cerceve[1] = payload.length
  cerceve[2] = sira++ & 0xff
  cerceve[3] = GCS_SYSID
  cerceve[4] = GCS_COMPID
  cerceve[5] = msgId
  cerceve.set(payload, 6)

  let crc = x25Crc(cerceve.subarray(1, 6 + payload.length))
  crc = x25Crc(Uint8Array.of(crcExtra), crc)
  cerceve[6 + payload.length] = crc & 0xff
  cerceve[7 + payload.length] = (crc >> 8) & 0xff
  return cerceve
}

export function commandLongKodla(
  command: number,
  p: [number, number, number, number, number, number, number],
  hedefSistem = 1, hedefBilesen = 1, onay = 0,
): Uint8Array {
  const b = new Uint8Array(33)
  const dv = new DataView(b.buffer)
  p.forEach((deger, i) => dv.setFloat32(i * 4, deger, true))
  dv.setUint16(28, command, true)
  b[30] = hedefSistem
  b[31] = hedefBilesen
  b[32] = onay
  return v1Cerceve(MSG.COMMAND_LONG, b)
}

export function missionCountKodla(adet: number, hedefSistem = 1, hedefBilesen = 1): Uint8Array {
  // count(u16@0) target_system(u8@2) target_component(u8@3)
  const b = new Uint8Array(4)
  const dv = new DataView(b.buffer)
  dv.setUint16(0, adet, true)
  b[2] = hedefSistem
  b[3] = hedefBilesen
  return v1Cerceve(MSG.MISSION_COUNT, b)
}

export interface GorevOgesi {
  seq: number
  frame: number
  command: number
  current: number
  autocontinue: number
  param1: number; param2: number; param3: number; param4: number
  x: number // lat × 1e7
  y: number // lon × 1e7
  z: number // m
}

export function missionItemIntKodla(o: GorevOgesi, hedefSistem = 1, hedefBilesen = 1): Uint8Array {
  // param1-4(f@0..12) x(i32@16) y(i32@20) z(f@24) seq(u16@28) command(u16@30)
  // target_system(u8@32) target_component(u8@33) frame(u8@34) current(u8@35) autocontinue(u8@36)
  const b = new Uint8Array(37)
  const dv = new DataView(b.buffer)
  dv.setFloat32(0, o.param1, true)
  dv.setFloat32(4, o.param2, true)
  dv.setFloat32(8, o.param3, true)
  dv.setFloat32(12, o.param4, true)
  dv.setInt32(16, o.x, true)
  dv.setInt32(20, o.y, true)
  dv.setFloat32(24, o.z, true)
  dv.setUint16(28, o.seq, true)
  dv.setUint16(30, o.command, true)
  b[32] = hedefSistem
  b[33] = hedefBilesen
  b[34] = o.frame
  b[35] = o.current
  b[36] = o.autocontinue
  return v1Cerceve(MSG.MISSION_ITEM_INT, b)
}

// ── Nesne → bayt (mavlink2rest biçimindeki komut nesneleri) ────────────────────
const KOMUT_NO: Record<string, number> = {
  MAV_CMD_NAV_WAYPOINT: 16,
  MAV_CMD_NAV_LOITER_UNLIM: 17,
  MAV_CMD_NAV_RETURN_TO_LAUNCH: 20,
  MAV_CMD_NAV_LAND: 21,
  MAV_CMD_NAV_TAKEOFF: 22,
  MAV_CMD_DO_SET_MODE: 176,
  MAV_CMD_DO_SET_HOME: 179,
  MAV_CMD_MISSION_START: 300,
  MAV_CMD_COMPONENT_ARM_DISARM: 400,
}

const FRAME_NO: Record<string, number> = {
  MAV_FRAME_GLOBAL: 0,
  MAV_FRAME_MISSION: 2,
  MAV_FRAME_GLOBAL_RELATIVE_ALT: 3,
  MAV_FRAME_GLOBAL_INT: 5,
  MAV_FRAME_GLOBAL_RELATIVE_ALT_INT: 6,
}

function enumSayi(deger: any, tablo: Record<string, number>): number {
  const ham = deger?.type ?? deger ?? 0
  if (typeof ham === 'number') return ham
  const no = tablo[ham]
  if (no === undefined) throw new Error(`Bilinmeyen enum değeri: ${ham}`)
  return no
}

/**
 * mavlinkKomutGonder'e verilen { header, message } nesnesini MAVLink v1 baytlarına çevirir.
 * Desteklenmeyen mesaj tipi için null döner.
 */
export function komutKodla(komut: Record<string, any>): Uint8Array | null {
  const m = komut.message ?? komut
  const ts = m.target_system ?? 1
  const tc = m.target_component ?? 1

  switch (m.type) {
    case 'COMMAND_LONG':
      return commandLongKodla(
        enumSayi(m.command, KOMUT_NO),
        [m.param1 ?? 0, m.param2 ?? 0, m.param3 ?? 0, m.param4 ?? 0, m.param5 ?? 0, m.param6 ?? 0, m.param7 ?? 0],
        ts, tc, m.confirmation ?? 0,
      )
    case 'MISSION_COUNT':
      return missionCountKodla(m.count, ts, tc)
    case 'MISSION_ITEM_INT':
      return missionItemIntKodla({
        seq: m.seq,
        frame: enumSayi(m.frame, FRAME_NO),
        command: enumSayi(m.command, KOMUT_NO),
        current: m.current ?? 0,
        autocontinue: m.autocontinue ?? 1,
        param1: m.param1 ?? 0, param2: m.param2 ?? 0, param3: m.param3 ?? 0, param4: m.param4 ?? 0,
        x: m.x, y: m.y, z: m.z,
      }, ts, tc)
  }
  return null
}

// ── Sonuç kodları (insan-okur) ─────────────────────────────────────────────────
export const MAV_RESULT_ADI: Record<number, string> = {
  0: 'KABUL EDİLDİ',
  1: 'GEÇİCİ OLARAK REDDEDİLDİ',
  2: 'REDDEDİLDİ',
  3: 'DESTEKLENMİYOR',
  4: 'BAŞARISIZ',
  5: 'İŞLENİYOR',
  6: 'İPTAL EDİLDİ',
}

export const MAV_MISSION_RESULT_ADI: Record<number, string> = {
  0: 'KABUL EDİLDİ',
  1: 'HATA',
  2: 'DESTEKLENMEYEN FRAME',
  3: 'DESTEKLENMEYEN KOMUT',
  4: 'HAFIZA YETERSİZ',
  5: 'GEÇERSİZ PARAMETRE',
  6: 'GEÇERSİZ PARAM1', 7: 'GEÇERSİZ PARAM2', 8: 'GEÇERSİZ PARAM3', 9: 'GEÇERSİZ PARAM4',
  10: 'GEÇERSİZ X', 11: 'GEÇERSİZ Y', 12: 'GEÇERSİZ Z',
  13: 'SIRA HATASI',
  14: 'REDDEDİLDİ',
  15: 'İŞLEM İPTAL',
}
