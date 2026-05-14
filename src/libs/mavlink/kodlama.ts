/**
 * Toygun GCS — MAVLink v1 Byte Encoder
 * Renderer'da (Node.js gerektirmeden) MAVLink v1 çerçeveleri oluşturur.
 * COMMAND_LONG (ID 76) ve SET_MODE (ID 11) desteklenir.
 */

let mavSeq = 0

// ── X.25 CRC (MCRF4XX) ────────────────────────────────────────────────────────
function x25Crc(data: Uint8Array, crc = 0xFFFF): number {
  for (const byte of data) {
    let tmp = (byte ^ (crc & 0xFF)) & 0xFF
    tmp ^= (tmp << 4) & 0xFF
    crc = ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xFFFF
  }
  return crc
}

function mavV1Kare(msgId: number, crcExtra: number, payload: Uint8Array): Uint8Array {
  const seq = mavSeq++ & 0xFF
  // Header (STX hariç CRC hesabına girer): LEN, SEQ, SYSID, COMPID, MSGID
  const header = new Uint8Array([payload.length, seq, 255, 240, msgId])
  const crcInput = new Uint8Array(header.length + payload.length + 1)
  crcInput.set(header, 0)
  crcInput.set(payload, header.length)
  crcInput[header.length + payload.length] = crcExtra
  const crc = x25Crc(crcInput)

  // Tam çerçeve: STX + header + payload + CRC_LO + CRC_HI
  const frame = new Uint8Array(1 + header.length + payload.length + 2)
  frame[0] = 0xFE
  frame.set(header, 1)
  frame.set(payload, 6)
  frame[frame.length - 2] = crc & 0xFF
  frame[frame.length - 1] = (crc >> 8) & 0xFF
  return frame
}

// ── COMMAND_LONG (msg_id=76, crc_extra=152) ───────────────────────────────────
export function commandLongKodet(
  command: number,
  p1 = 0, p2 = 0, p3 = 0, p4 = 0,
  p5 = 0, p6 = 0, p7 = 0,
  targetSystem = 1, targetComponent = 1, confirmation = 0,
): Uint8Array {
  const dv = new DataView(new ArrayBuffer(33))
  dv.setFloat32(0,  p1, true)
  dv.setFloat32(4,  p2, true)
  dv.setFloat32(8,  p3, true)
  dv.setFloat32(12, p4, true)
  dv.setFloat32(16, p5, true)
  dv.setFloat32(20, p6, true)
  dv.setFloat32(24, p7, true)
  dv.setUint16(28, command, true)
  dv.setUint8(30, targetSystem)
  dv.setUint8(31, targetComponent)
  dv.setUint8(32, confirmation)
  return mavV1Kare(76, 152, new Uint8Array(dv.buffer))
}

// ── SET_MODE (msg_id=11, crc_extra=89) ────────────────────────────────────────
export function setModeKodet(
  targetSystem: number,
  baseMode: number,
  customMode: number,
): Uint8Array {
  const dv = new DataView(new ArrayBuffer(6))
  dv.setUint32(0, customMode, true)
  dv.setUint8(4, targetSystem)
  dv.setUint8(5, baseMode)
  return mavV1Kare(11, 89, new Uint8Array(dv.buffer))
}

// ── Komut adı → sayısı tablosu ────────────────────────────────────────────────
const KOMUT_SAYILARI: Record<string, number> = {
  MAV_CMD_COMPONENT_ARM_DISARM: 400,
  MAV_CMD_DO_SET_MODE:          176,
  MAV_CMD_MISSION_START:        300,
  MAV_CMD_DO_SET_HOME:          179,
  MAV_CMD_NAV_WAYPOINT:          16,
}

/**
 * mavlinkKomutGonder'in komut objesini MAVLink v1 byte dizisine çevirir.
 * Tanımlanamayan mesajlar için null döner.
 */
export function komutKodet(komut: Record<string, any>): Uint8Array | null {
  const msg = komut.message ?? komut
  const tip = msg.type

  if (tip === 'COMMAND_LONG') {
    const cmdRaw = msg.command?.type ?? msg.command ?? 0
    const cmd = typeof cmdRaw === 'number' ? cmdRaw : (KOMUT_SAYILARI[cmdRaw] ?? 0)
    return commandLongKodet(
      cmd,
      msg.param1 ?? 0, msg.param2 ?? 0, msg.param3 ?? 0, msg.param4 ?? 0,
      msg.param5 ?? 0, msg.param6 ?? 0, msg.param7 ?? 0,
      msg.target_system ?? 1, msg.target_component ?? 1, msg.confirmation ?? 0,
    )
  }

  if (tip === 'SET_MODE') {
    const bm = typeof msg.base_mode === 'object' ? msg.base_mode.bits : (msg.base_mode ?? 1)
    return setModeKodet(msg.target_system ?? 1, bm, msg.custom_mode ?? 0)
  }

  return null
}
