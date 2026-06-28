/**
 * Toygun GCS — Donanım Bağlantı Servisi
 * Serial (COM port), UDP ve TCP protokolleri üzerinden doğrudan MAVLink bağlantısı.
 * Electron main process'te çalışır. Raw MAVLink v1/v2 byte akışını parse eder.
 */

import { ipcMain, BrowserWindow } from 'electron'
import * as dgram from 'dgram'
import * as net from 'net'

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
    const { SerialPort } = await import('serialport')
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
    console.warn('[Donanım] serialport yüklenemedi, WMI kullanılıyor')
    return portListeAlWMI()
  }
}

// ── Port Sıcak Bağlantı İzleyici ──────────────────────────────────────────────
let portIzleyiciInterval: ReturnType<typeof setInterval> | null = null
let oncekiPortYollari: Set<string> = new Set()

export function portIzleyiciBaslat(pencere: BrowserWindow): void {
  if (portIzleyiciInterval) return

  const kontrol = async () => {
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

// ── MAVLink Sabitleri ──────────────────────────────────────────────────────────
const MAVLINK_V1_STX = 0xFE
const MAVLINK_V2_STX = 0xFD
const MAV_ARMED_BAYRAGI = 128

function px4ModuCoz(customMode: number): string {
  const anaMode = (customMode >> 16) & 0xFF
  const altMode = (customMode >> 24) & 0xFF
  const ALT: Record<number, string> = {
    2: 'AUTO.TAKEOFF', 3: 'AUTO.LOITER', 4: 'AUTO.MISSION',
    5: 'AUTO.RTL',     6: 'AUTO.LAND',   7: 'AUTO.RTGS',
    8: 'AUTO.FOLLOW',  9: 'AUTO.PRECLAND',
  }
  const ANA: Record<number, string> = {
    1: 'MANUAL', 2: 'ALTCTL', 3: 'POSCTL',
    5: 'ACRO',   6: 'OFFBOARD', 7: 'STABILIZED',
  }
  if (anaMode === 4) return ALT[altMode] ?? 'AUTO'
  if (anaMode !== 0) return ANA[anaMode] ?? `MOD_${anaMode}`
  const ESKİ: Record<number, string> = {
    0: 'MANUAL', 1: 'ALTCTL', 2: 'POSCTL', 3: 'AUTO.MISSION',
    4: 'AUTO.LOITER', 5: 'AUTO.RTL', 6: 'ACRO', 8: 'STABILIZED',
    9: 'OFFBOARD', 10: 'AUTO.TAKEOFF', 11: 'AUTO.LAND',
    12: 'AUTO.FOLLOW', 14: 'AUTO.PRECLAND',
  }
  return ESKİ[customMode] ?? `MOD_${customMode}`
}

const GPS_FIX_TIPLERI: Record<number, string> = {
  0: 'NO_GPS', 1: 'NO_FIX', 2: 'FIX_2D',
  3: 'FIX_3D', 4: 'DGPS', 5: 'RTK_FLOAT', 6: 'RTK_FIXED',
}

// ── Aktif Bağlantı Referansları ────────────────────────────────────────────────
let aktifSerialPort: any = null
let aktifUdpSocket: dgram.Socket | null = null
let aktifTcpSocket: net.Socket | null = null
let aktifPencere: BrowserWindow | null = null
let aktifUdpHedef: { adres: string; port: number } | null = null  // gelen paketten öğrenilir

// ── MAVLink Byte Akışı Ayrıştırıcı ────────────────────────────────────────────
/**
 * MAVLink v1 ve v2 çerçevelerini ham byte akışından ayrıştırır.
 * Sadece kullanılan 6 mesaj tipini decode eder.
 */
class MavlinkAyrıştırıcı {
  private tampon = Buffer.alloc(0)
  private onMesaj: (tip: string, veri: Record<string, any>) => void

  constructor(onMesaj: (tip: string, veri: Record<string, any>) => void) {
    this.onMesaj = onMesaj
  }

  isle(gelen: Buffer): void {
    this.tampon = Buffer.concat([this.tampon, gelen])
    // Tampon çok büyüdüyse baştaki eski veriyi at
    if (this.tampon.length > 4096) {
      this.tampon = this.tampon.slice(this.tampon.length - 2048)
    }
    this.cercevele()
  }

  private cercevele(): void {
    while (true) {
      // Başlangıç baytına senkronize ol
      let basIdx = -1
      for (let i = 0; i < this.tampon.length; i++) {
        if (this.tampon[i] === MAVLINK_V1_STX || this.tampon[i] === MAVLINK_V2_STX) {
          basIdx = i
          break
        }
      }
      if (basIdx === -1) { this.tampon = Buffer.alloc(0); return }
      if (basIdx > 0) this.tampon = this.tampon.slice(basIdx)
      if (this.tampon.length < 2) return

      const stx = this.tampon[0]
      const govdeBoys = this.tampon[1]

      if (stx === MAVLINK_V1_STX) {
        // MAVLink v1: STX(1) + LEN(1) + SEQ(1) + SYSID(1) + COMPID(1) + MSGID(1) + PAYLOAD + CRC(2)
        const toplam = 6 + govdeBoys + 2
        if (this.tampon.length < toplam) return
        const mesajId = this.tampon[5]
        const govde = this.tampon.slice(6, 6 + govdeBoys)
        this.tampon = this.tampon.slice(toplam)
        this.mesajCoz(mesajId, govde)
      } else {
        // MAVLink v2: STX(1)+LEN(1)+INCOMPAT(1)+COMPAT(1)+SEQ(1)+SYSID(1)+COMPID(1)+MSGID(3)+PAYLOAD+CRC(2)[+SIG(13)]
        if (this.tampon.length < 10) return
        const uyumsuz = this.tampon[2]
        const imzaBoyu = (uyumsuz & 0x01) ? 13 : 0
        const toplam = 10 + govdeBoys + 2 + imzaBoyu
        if (this.tampon.length < toplam) return
        const mesajId = this.tampon[7] | (this.tampon[8] << 8) | (this.tampon[9] << 16)
        const govde = this.tampon.slice(10, 10 + govdeBoys)
        this.tampon = this.tampon.slice(toplam)
        this.mesajCoz(mesajId, govde)
      }
    }
  }

  private mesajCoz(mesajId: number, govde: Buffer): void {
    try {
      switch (mesajId) {
        case 0:  this.heartbeatCoz(govde); break     // HEARTBEAT
        case 1:  this.sysStatusCoz(govde); break     // SYS_STATUS
        case 24: this.gpsRawCoz(govde); break        // GPS_RAW_INT
        case 30: this.attitudeCoz(govde); break      // ATTITUDE
        case 33: this.globalPositionCoz(govde); break // GLOBAL_POSITION_INT
        case 74: this.vfrHudCoz(govde); break        // VFR_HUD
      }
    } catch {
      // Bozuk paket — sessizce atla
    }
  }

  // HEARTBEAT: custom_mode(u32), type(u8), autopilot(u8), base_mode(u8), system_status(u8), mavlink_version(u8)
  private heartbeatCoz(g: Buffer): void {
    if (g.length < 9) return
    const customMode = g.readUInt32LE(0)
    const baseMode = g[6]
    this.onMesaj('HEARTBEAT', {
      custom_mode: customMode,
      base_mode: { bits: baseMode },
      armed: (baseMode & MAV_ARMED_BAYRAGI) !== 0,
      ucusModu: px4ModuCoz(customMode),
    })
  }

  // VFR_HUD: airspeed(f), groundspeed(f), alt(f), climb(f), heading(i16), throttle(u16)
  private vfrHudCoz(g: Buffer): void {
    if (g.length < 20) return
    this.onMesaj('VFR_HUD', {
      airspeed: g.readFloatLE(0),
      groundspeed: g.readFloatLE(4),
      alt: g.readFloatLE(8),
      heading: g.readInt16LE(16),
    })
  }

  // SYS_STATUS: ...(12b)..., voltage_battery(u16@14), current_battery(i16@16), ..., battery_remaining(i8@30)
  private sysStatusCoz(g: Buffer): void {
    if (g.length < 31) return
    this.onMesaj('SYS_STATUS', {
      voltage_battery: g.readUInt16LE(14),   // mV
      current_battery: g.readInt16LE(16),    // cA
      battery_remaining: g.readInt8(30),     // %
    })
  }

  // ATTITUDE: time_boot_ms(u32), roll(f@4), pitch(f@8), yaw(f@12), ...
  private attitudeCoz(g: Buffer): void {
    if (g.length < 16) return
    this.onMesaj('ATTITUDE', {
      roll: g.readFloatLE(4),    // rad
      pitch: g.readFloatLE(8),   // rad
      yaw: g.readFloatLE(12),    // rad
    })
  }

  // GLOBAL_POSITION_INT: time_boot_ms(u32), lat(i32@4), lon(i32@8), alt(i32@12), relative_alt(i32@16), vx/vy/vz(i16), hdg(u16@26)
  private globalPositionCoz(g: Buffer): void {
    if (g.length < 28) return
    this.onMesaj('GLOBAL_POSITION_INT', {
      lat: g.readInt32LE(4),
      lon: g.readInt32LE(8),
      alt: g.readInt32LE(12),         // mm
      relative_alt: g.readInt32LE(16), // mm
      hdg: g.readUInt16LE(26),        // cdeg
    })
  }

  // GPS_RAW_INT: time_usec(u64@0), lat(i32@8), lon(i32@12), alt(i32@16), eph(u16@20), ..., fix_type(u8@28), satellites_visible(u8@29)
  private gpsRawCoz(g: Buffer): void {
    if (g.length < 30) return
    const fixSayisi = g[28]
    this.onMesaj('GPS_RAW_INT', {
      fix_type: { type: GPS_FIX_TIPLERI[fixSayisi] ?? 'NO_FIX' },
      lat: g.readInt32LE(8),
      lon: g.readInt32LE(12),
      eph: g.readUInt16LE(20),        // cm
      satellites_visible: g[29],
    })
  }
}

// ── MAVLink v1 Byte Encoder (main process, Node.js Buffer) ───────────────────

let mavSeqGCS = 0

function x25Crc(buf: Buffer): number {
  let crc = 0xFFFF
  for (const byte of buf) {
    let tmp = (byte ^ (crc & 0xFF)) & 0xFF
    tmp ^= (tmp << 4) & 0xFF
    crc = ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xFFFF
  }
  return crc
}

function mavV1Kare(msgId: number, crcExtra: number, payload: Buffer): Buffer {
  const seq = mavSeqGCS++ & 0xFF
  const header = Buffer.from([payload.length, seq, 255, 240, msgId])
  const crcInput = Buffer.concat([header, payload, Buffer.from([crcExtra])])
  const crc = x25Crc(crcInput)
  const crcBuf = Buffer.from([crc & 0xFF, (crc >> 8) & 0xFF])
  return Buffer.concat([Buffer.from([0xFE]), header, payload, crcBuf])
}

function commandLongBuf(
  command: number,
  p1 = 0, p2 = 0, p3 = 0, p4 = 0, p5 = 0, p6 = 0, p7 = 0,
  tSys = 1, tComp = 1, conf = 0,
): Buffer {
  const p = Buffer.alloc(33)
  p.writeFloatLE(p1, 0); p.writeFloatLE(p2, 4); p.writeFloatLE(p3, 8)
  p.writeFloatLE(p4, 12); p.writeFloatLE(p5, 16); p.writeFloatLE(p6, 20); p.writeFloatLE(p7, 24)
  p.writeUInt16LE(command, 28); p[30] = tSys; p[31] = tComp; p[32] = conf
  return mavV1Kare(76, 152, p)
}

const KOMUT_NO: Record<string, number> = {
  MAV_CMD_COMPONENT_ARM_DISARM: 400,
  MAV_CMD_DO_SET_MODE: 176,
  MAV_CMD_MISSION_START: 300,
  MAV_CMD_DO_SET_HOME: 179,
}

function mavlinkKomutKodet(komut: Record<string, any>): Buffer | null {
  const msg = komut.message ?? komut
  if (msg.type !== 'COMMAND_LONG') return null
  const cmdRaw = msg.command?.type ?? msg.command ?? 0
  const cmd = typeof cmdRaw === 'number' ? cmdRaw : (KOMUT_NO[cmdRaw] ?? 0)
  return commandLongBuf(
    cmd,
    msg.param1 ?? 0, msg.param2 ?? 0, msg.param3 ?? 0, msg.param4 ?? 0,
    msg.param5 ?? 0, msg.param6 ?? 0, msg.param7 ?? 0,
    msg.target_system ?? 1, msg.target_component ?? 1, msg.confirmation ?? 0,
  )
}

function mavlinkNativeYaz(bytes: Buffer): void {
  if (aktifSerialPort) {
    aktifSerialPort.write(bytes, (err: any) => {
      if (err) console.warn('[MAVLink] Seri yazma hatası:', err.message)
      else console.log(`[MAVLink] ${bytes.length} byte seri porta yazıldı`)
    })
  } else if (aktifUdpSocket && aktifUdpHedef) {
    aktifUdpSocket.send(bytes, aktifUdpHedef.port, aktifUdpHedef.adres, (err: any) => {
      if (err) console.warn('[MAVLink] UDP yazma hatası:', err.message)
    })
  } else if (aktifTcpSocket) {
    aktifTcpSocket.write(bytes, (err: any) => {
      if (err) console.warn('[MAVLink] TCP yazma hatası:', err?.message)
    })
  }
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
        SerialPort = (await import('serialport')).SerialPort
      } catch (modülHata: any) {
        baglantiDurumuGonder('baglantiKesik')
        return { basarili: false, hata: modülHata.message, webSerialFallback: true }
      }

      const ayrıştırıcı = new MavlinkAyrıştırıcı((tip, veri) => {
        pencereGonder('mavlink-mesaj', { tip, veri })
      })

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
      const ayrıştırıcı = new MavlinkAyrıştırıcı((tip, veri) => {
        pencereGonder('mavlink-mesaj', { tip, veri })
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

      const ayrıştırıcı = new MavlinkAyrıştırıcı((tip, veri) => {
        pencereGonder('mavlink-mesaj', { tip, veri })
      })

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
        const bytes = mavlinkKomutKodet(komut)
        if (bytes) {
          mavlinkNativeYaz(bytes)
          return { basarili: true }
        }
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
