/**
 * Toygun GCS — MAVLink Komut Gönderici
 * Arm/Disarm, mod değiştirme, görev yükleme komutları
 */

import { mavlinkKomutGonder, type KomutSonucu } from './baglanti'
import { mesajBekle, mesajDinle } from './mesaj-olaylari'
import { GCS_SYSID, MAV_RESULT_ADI, MAV_MISSION_RESULT_ADI } from './cerceve'
import { modBul, type Otopilot, type AracSinifi, type UcusModuTanimi } from './otopilot'
import { useAracStore } from '@/stores/arac'

// ── MAV_CMD sabitleri ──
const MAV_CMD = {
  DO_SET_MODE: 176,
  COMPONENT_ARM_DISARM: 400,
}

const MAV_RESULT_ACCEPTED = 0
const MAV_RESULT_IN_PROGRESS = 5

/** Bize (GCS'e) yönelik mi? 0 = yayın */
const bizeMi = (v: Record<string, any>) =>
  v.target_system === undefined || v.target_system === 0 || v.target_system === GCS_SYSID

// ── Komut + COMMAND_ACK ────────────────────────────────────────────────────────

export interface KomutAckSonucu {
  /** kabul: araç onayladı · red: araç reddetti · yanitYok: ACK gelmedi · gonderilemedi: bağlantı hatası */
  durum: 'kabul' | 'red' | 'yanitYok' | 'gonderilemedi'
  mesaj: string
}

/** Geriye dönük ad */
export type ArmSonucu = KomutAckSonucu

/**
 * COMMAND_LONG gönderir ve aynı komut için COMMAND_ACK bekler (3 sn).
 * islem: kullanıcıya gösterilen ad ("ARM", "Mod → RTL" …)
 */
async function komutGonderAckBekle(
  islem: string,
  komutAdi: string,
  komutNo: number,
  p: { param1?: number; param2?: number; param3?: number; param4?: number; param5?: number; param6?: number; param7?: number },
  redIpucu = '',
): Promise<KomutAckSonucu> {
  // ACK dinleyicisini göndermeden ÖNCE kur — hızlı yanıt kaçmasın
  const ackBekle = mesajBekle(
    'COMMAND_ACK',
    (v) => v.command === komutNo && v.result !== MAV_RESULT_IN_PROGRESS && bizeMi(v),
    3000,
  )

  const gonderim = await mavlinkKomutGonder({
    header: { system_id: GCS_SYSID, component_id: 0, sequence: 0 },
    message: {
      type: 'COMMAND_LONG',
      target_system: 1,
      target_component: 1,
      command: { type: komutAdi },
      confirmation: 0,
      param1: p.param1 ?? 0, param2: p.param2 ?? 0, param3: p.param3 ?? 0, param4: p.param4 ?? 0,
      param5: p.param5 ?? 0, param6: p.param6 ?? 0, param7: p.param7 ?? 0,
    },
  })
  console.log(`[MAVLink] ${islem} komutu gönderildi`, gonderim)

  if (!gonderim.basarili) {
    return { durum: 'gonderilemedi', mesaj: `${islem} komutu gönderilemedi: ${gonderim.hata ?? 'bilinmeyen hata'}` }
  }

  const ack = await ackBekle
  if (!ack) return { durum: 'yanitYok', mesaj: `${islem} için araçtan onay (COMMAND_ACK) gelmedi` }
  if (ack.result === MAV_RESULT_ACCEPTED) return { durum: 'kabul', mesaj: `${islem} araç tarafından kabul edildi` }
  return {
    durum: 'red',
    mesaj: `${islem} reddedildi: ${MAV_RESULT_ADI[ack.result] ?? `sonuç ${ack.result}`}${redIpucu}`,
  }
}

// ── ARM / DISARM ───────────────────────────────────────────────────────────────

/**
 * ARM/DISARM komutunu gönderir ve COMMAND_ACK bekler (3 sn).
 * Not: ARM durumunun asıl kaynağı HEARTBEAT'tir; bu fonksiyon store'daki armed alanını değiştirmez.
 */
export function armDisarmGonder(arm: boolean): Promise<KomutAckSonucu> {
  return komutGonderAckBekle(
    arm ? 'ARM' : 'DISARM',
    'MAV_CMD_COMPONENT_ARM_DISARM',
    MAV_CMD.COMPONENT_ARM_DISARM,
    // param2 = 21196 zorlar; kasıtlı olarak kullanılmıyor (otopilot havadayken disarm'ı reddetsin)
    { param1: arm ? 1 : 0, param2: 0 },
    ' — ön uçuş kontrollerini kontrol edin',
  )
}

/** Geriye dönük uyumluluk — sonucu beklemeden gönderir */
export function aracArmDisarm(arm: boolean): void {
  void armDisarmGonder(arm)
}

// ── Uçuş Modu ──────────────────────────────────────────────────────────────────

/**
 * Uçuş modunu değiştirir — MAV_CMD_DO_SET_MODE (176), COMMAND_ACK bekler.
 *   PX4:       param2 = main_mode, param3 = sub_mode
 *   ArduPilot: param2 = mod numarası
 * Mod tanımı otopilot.ts → modListesi()'nden gelmelidir.
 */
export function modDegistirGonder(mod: UcusModuTanimi): Promise<KomutAckSonucu> {
  const param2 = mod.px4 ? mod.px4.ana : mod.customMode
  const param3 = mod.px4 ? mod.px4.alt : 0
  return komutGonderAckBekle(
    `Mod → ${mod.ad}`,
    'MAV_CMD_DO_SET_MODE',
    MAV_CMD.DO_SET_MODE,
    { param1: 1 /* MAV_MODE_FLAG_CUSTOM_MODE_ENABLED */, param2, param3 },
  )
}

/** Bağlı aracın otopilotuna göre adı verilen moda geçer (ör. 'RTL' / 'AUTO.RTL'). */
function adlaModaGec(adaylar: Partial<Record<Otopilot, string>>, sinifAdaylari?: Partial<Record<AracSinifi, string>>): Promise<KomutAckSonucu> {
  const store = useAracStore()
  const ad = (store.otopilot === 'ardupilot' && sinifAdaylari?.[store.aracSinifi]) || adaylar[store.otopilot]
  const mod = ad ? modBul(store.otopilot, store.aracSinifi, ad) : undefined
  if (!mod) {
    return Promise.resolve({ durum: 'gonderilemedi', mesaj: `Bu araç için uygun mod bulunamadı (otopilot: ${store.otopilot})` })
  }
  return modDegistirGonder(mod)
}

/** RTL (Eve Dönüş) */
export function eveDon(): Promise<KomutAckSonucu> {
  return adlaModaGec({ px4: 'AUTO.RTL', ardupilot: 'RTL' })
}

/** İniş — ArduPlane'de LAND modu yoktur (iniş görevle ya da VTOL'de QLAND ile yapılır) */
export function inisYap(): Promise<KomutAckSonucu> {
  return adlaModaGec({ px4: 'AUTO.LAND' }, { cokRotor: 'LAND', vtol: 'QLAND' })
}

/** Görev başlat */
export function gorevBaslat(): Promise<KomutSonucu> {
  console.log('[MAVLink] Görev başlatma komutu gönderiliyor')
  return mavlinkKomutGonder({
    header: { system_id: GCS_SYSID, component_id: 0, sequence: 0 },
    message: {
      type: 'COMMAND_LONG',
      target_system: 1,
      target_component: 1,
      command: { type: 'MAV_CMD_MISSION_START' },
      confirmation: 0,
      param1: 0, param2: 0, param3: 0, param4: 0, param5: 0, param6: 0, param7: 0,
    },
  })
}

/** Ev noktası ayarla */
export function evNoktasiAyarla(enlem: number, boylam: number, yukseklik: number): Promise<KomutSonucu> {
  console.log(`[MAVLink] Ev noktası ayarlanıyor: ${enlem}, ${boylam}`)
  return mavlinkKomutGonder({
    header: { system_id: GCS_SYSID, component_id: 0, sequence: 0 },
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
}

// ── Görev Yükleme (MAVLink Mission Protocol) ──────────────────────────────────

export interface GorevYuklemeSonucu {
  basarili: boolean
  mesaj: string
}

const GOREV_ADIM_ZAMAN_ASIMI = 1500 // ms — her adımda yanıt bekleme süresi
const GOREV_AZAMI_DENEME = 5

let gorevYuklemeSurerken = false

/**
 * Görev noktalarını araca yükler.
 *
 * Akış (https://mavlink.io/en/services/mission.html):
 *   GCS → MISSION_COUNT
 *   Araç → MISSION_REQUEST_INT(seq)  ⇄  GCS → MISSION_ITEM_INT(seq)   (her öğe için)
 *   Araç → MISSION_ACK(type)
 *
 * Yanıt gelmezse son mesaj en fazla 5 kez yeniden gönderilir.
 * ArduPilot'ta öğe 0 ev noktasına ayrılmıştır — secenekler.otopilot verilirse otomatik eklenir.
 * Not: mavlink2rest (WebSocket) yolunda araç yanıtları henüz dinlenmediği için
 * yükleme zaman aşımıyla sonuçlanır — Serial/UDP/TCP veya Web Serial kullanın.
 */
export interface GorevYuklemeSecenekleri {
  /** Bağlı aracın otopilotu — ArduPilot'ta seq 0 ev noktasına ayrılmıştır */
  otopilot?: Otopilot
  /** ArduPilot seq 0 için ev konumu (araç kendi ev noktasını korur; değer yalnızca yer tutucudur) */
  evKonumu?: { enlem: number; boylam: number }
}

export function gorevYukle(
  kullaniciNoktalari: Array<{ enlem: number; boylam: number; yukseklik: number }>,
  ilerleme?: (gonderilen: number, toplam: number) => void,
  secenekler: GorevYuklemeSecenekleri = {},
): Promise<GorevYuklemeSonucu> {
  const noktaSayisi = kullaniciNoktalari.length
  if (noktaSayisi === 0) return Promise.resolve({ basarili: false, mesaj: 'Yüklenecek görev noktası yok' })

  // ArduPilot görev öğesi 0'ı ev noktası olarak kullanır ve üzerine yazar.
  // Kullanıcının ilk noktası kaybolmasın diye başa bir ev yer tutucusu eklenir.
  const evOgesiVar = secenekler.otopilot === 'ardupilot'
  const ev = secenekler.evKonumu ?? { enlem: kullaniciNoktalari[0].enlem, boylam: kullaniciNoktalari[0].boylam }
  const noktalar = evOgesiVar
    ? [{ enlem: ev.enlem, boylam: ev.boylam, yukseklik: 0, ev: true }, ...kullaniciNoktalari.map((n) => ({ ...n, ev: false }))]
    : kullaniciNoktalari.map((n) => ({ ...n, ev: false }))
  const toplam = noktalar.length
  if (gorevYuklemeSurerken) return Promise.resolve({ basarili: false, mesaj: 'Bir görev yüklemesi zaten sürüyor' })
  gorevYuklemeSurerken = true

  const ogeKomutu = (seq: number) => {
    const n = noktalar[seq]
    return {
      header: { system_id: GCS_SYSID, component_id: 0, sequence: 0 },
      message: {
        type: 'MISSION_ITEM_INT',
        target_system: 1,
        target_component: 1,
        seq,
        // ArduPilot ev öğesi mutlak (MSL) frame'de; araç zaten kendi ev noktasıyla değiştirir
        frame: { type: n.ev ? 'MAV_FRAME_GLOBAL' : 'MAV_FRAME_GLOBAL_RELATIVE_ALT_INT' },
        command: { type: 'MAV_CMD_NAV_WAYPOINT' },
        current: 0,
        autocontinue: 1,
        param1: 0, // bekleme süresi (s)
        param2: 0, // kabul yarıçapı — 0: PX4 varsayılanı
        param3: 0, // geçiş yarıçapı
        param4: 0, // yaw (sabit kanatta yok sayılır)
        x: Math.round(n.enlem * 1e7),
        y: Math.round(n.boylam * 1e7),
        z: n.yukseklik,
        mission_type: { type: 'MAV_MISSION_TYPE_MISSION' },
      },
    }
  }

  const sayiKomutu = {
    header: { system_id: GCS_SYSID, component_id: 0, sequence: 0 },
    message: {
      type: 'MISSION_COUNT',
      target_system: 1,
      target_component: 1,
      count: toplam,
      mission_type: { type: 'MAV_MISSION_TYPE_MISSION' },
    },
  }

  return new Promise<GorevYuklemeSonucu>((coz) => {
    let bitti = false
    let deneme = 0
    let sonKomut: Record<string, any> = sayiKomutu
    let zamanlayici: ReturnType<typeof setTimeout> | null = null
    const istenenler = new Set<number>()

    const bitir = (basarili: boolean, mesaj: string) => {
      if (bitti) return
      bitti = true
      if (zamanlayici) clearTimeout(zamanlayici)
      birakIstek()
      birakAck()
      gorevYuklemeSurerken = false
      coz({ basarili, mesaj })
    }

    const gonder = async (komut: Record<string, any>) => {
      if (bitti) return
      sonKomut = komut
      if (zamanlayici) clearTimeout(zamanlayici)
      zamanlayici = setTimeout(zamanAsimi, GOREV_ADIM_ZAMAN_ASIMI)
      const sonuc = await mavlinkKomutGonder(komut)
      if (!sonuc.basarili) bitir(false, `Görev mesajı gönderilemedi: ${sonuc.hata ?? 'bilinmeyen hata'}`)
    }

    const zamanAsimi = () => {
      if (bitti) return
      deneme++
      if (deneme > GOREV_AZAMI_DENEME) {
        bitir(false, `Araç yanıt vermedi (${istenenler.size}/${toplam} nokta istendi) — bağlantıyı kontrol edin`)
        return
      }
      console.warn(`[Görev] Yanıt yok, yeniden deneniyor (${deneme}/${GOREV_AZAMI_DENEME})`)
      void gonder(sonKomut)
    }

    const birakIstek = mesajDinle('MISSION_REQUEST_INT', (v) => {
      if (!bizeMi(v) || (v.mission_type ?? 0) !== 0) return
      if (v.seq >= toplam) { bitir(false, `Araç geçersiz sıra istedi: ${v.seq}`); return }
      deneme = 0
      istenenler.add(v.seq)
      ilerleme?.(Math.max(0, istenenler.size - (evOgesiVar ? 1 : 0)), noktaSayisi)
      void gonder(ogeKomutu(v.seq))
    })

    const birakAck = mesajDinle('MISSION_ACK', (v) => {
      if (!bizeMi(v) || (v.mission_type ?? 0) !== 0) return
      if (v.type === 0) {
        if (istenenler.size < toplam) {
          bitir(false, `Araç yüklemeyi erken onayladı (${istenenler.size}/${toplam})`)
        } else {
          bitir(true, `${noktaSayisi} nokta araca yüklendi`)
        }
      } else {
        bitir(false, `Araç görevi reddetti: ${MAV_MISSION_RESULT_ADI[v.type] ?? `kod ${v.type}`}`)
      }
    })

    console.log(`[Görev] ${noktaSayisi} nokta yükleniyor${evOgesiVar ? ' (+ ArduPilot ev öğesi)' : ''}`)
    void gonder(sayiKomutu)
  })
}
