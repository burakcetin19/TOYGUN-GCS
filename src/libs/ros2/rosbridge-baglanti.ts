/**
 * Toygun GCS — rosbridge WebSocket İstemcisi
 * rosbridge_suite (ws://jetson-ip:9090) üzerinden ROS2 topic/servis erişimi.
 *
 * Jetson'da kurulum:
 *   sudo apt install ros-humble-rosbridge-suite
 *   ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090
 *
 * Protocol: rosbridge v2 JSON — https://github.com/RobotWebTools/rosbridge_suite
 */

import { ref } from 'vue'

// ── Tip Tanımları ─────────────────────────────────────────────────────────────

export interface RosbridgeAyarlari {
  wsUrl: string    // ws://192.168.1.1:9090
}

export type RosbridgeDurumu = 'baglandi' | 'baglaniliyor' | 'baglantiKesik'

interface BekleyenServis {
  coz: (yanit: any) => void
  reddet: (hata: Error) => void
  zamanlayici: ReturnType<typeof setTimeout>
}

// ── Reaktif Durum ─────────────────────────────────────────────────────────────

export const rosbridgeDurumu = ref<RosbridgeDurumu>('baglantiKesik')

// ── İç State ──────────────────────────────────────────────────────────────────

let ws: WebSocket | null = null
let aktifAyarlar: RosbridgeAyarlari = { wsUrl: 'ws://192.168.1.1:9090' }
let yenidenDeneZamanlayici: ReturnType<typeof setTimeout> | null = null
let yenidenDeneSayisi = 0
const MAX_YENIDEN_DENE = 3

// Topic callback'leri: topic adı → callback fonksiyonu
const topicCallbackleri = new Map<string, (mesaj: any) => void>()

// Servis yanıt bekleyenler: id → { resolve, reject, timer }
const bekleyenServisler = new Map<string, BekleyenServis>()

let mesajSayaci = 0
function yeniId(): string {
  return `tg_${++mesajSayaci}_${Date.now()}`
}

// ── Bağlantı Yönetimi ─────────────────────────────────────────────────────────

/** rosbridge WebSocket bağlantısı başlatır */
export function rosbridgeBaglan(ayarlar: RosbridgeAyarlari): void {
  aktifAyarlar = { ...ayarlar }
  yenidenDeneSayisi = 0
  baglantiKur()
}

/** rosbridge bağlantısını keser (yeniden denemeyi durdurur) */
export function rosbridgeKes(): void {
  if (yenidenDeneZamanlayici) {
    clearTimeout(yenidenDeneZamanlayici)
    yenidenDeneZamanlayici = null
  }
  if (ws) {
    ws.onclose = null  // yeniden denemeyi engelle
    ws.close()
    ws = null
  }
  rosbridgeDurumu.value = 'baglantiKesik'
}

function baglantiKur(): void {
  rosbridgeDurumu.value = 'baglaniliyor'
  console.log(`[ROS2] Bağlanılıyor: ${aktifAyarlar.wsUrl}`)

  try {
    ws = new WebSocket(aktifAyarlar.wsUrl)
  } catch (hata: any) {
    console.error('[ROS2] WebSocket oluşturulamadı:', hata.message)
    rosbridgeDurumu.value = 'baglantiKesik'
    return
  }

  ws.onopen = () => {
    console.log('[ROS2] rosbridge bağlantısı kuruldu')
    yenidenDeneSayisi = 0
    rosbridgeDurumu.value = 'baglandi'
    // Mevcut abonelikleri yeniden kur (bağlantı kopup yeniden bağlandıysa)
    topicCallbackleri.forEach((_cb, topic) => {
      // Tip bilgisi yok, ama rosbridge subscribe isteğini yeniden gönder
      // Tip bilgisini saklamak için ayrı bir map gerekir
    })
    // Kayıtlı topic'leri yeniden subscribe et
    kayitliTopicler.forEach((tip, topic) => {
      gonder({ op: 'subscribe', id: yeniId(), topic, type: tip })
    })
  }

  ws.onmessage = (event: MessageEvent) => {
    try {
      const mesaj = JSON.parse(event.data)
      mesajIsle(mesaj)
    } catch {
      // Bozuk JSON, atla
    }
  }

  ws.onerror = (hata) => {
    console.warn('[ROS2] WebSocket hatası:', hata)
  }

  ws.onclose = (event) => {
    console.log(`[ROS2] Bağlantı kapandı (kod: ${event.code})`)
    rosbridgeDurumu.value = 'baglantiKesik'
    ws = null

    // Sınırlı sayıda yeniden dene
    if (yenidenDeneSayisi < MAX_YENIDEN_DENE) {
      yenidenDeneSayisi++
      const sure = Math.min(3000 * yenidenDeneSayisi, 10000)
      console.log(`[ROS2] ${sure}ms sonra yeniden denenecek (${yenidenDeneSayisi}/${MAX_YENIDEN_DENE})`)
      yenidenDeneZamanlayici = setTimeout(() => {
        yenidenDeneZamanlayici = null
        baglantiKur()
      }, sure)
    }
  }
}

function gonder(mesaj: object): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(mesaj))
  }
}

// ── Mesaj İşleme ───────────────────────────────────────────────────────────────

function mesajIsle(mesaj: any): void {
  switch (mesaj.op) {
    case 'publish':
      // Topic verisi geldi
      topicCallbackleri.get(mesaj.topic)?.(mesaj.msg)
      break

    case 'service_response':
      // Servis yanıtı geldi
      if (mesaj.id) {
        const bekleyen = bekleyenServisler.get(mesaj.id)
        if (bekleyen) {
          clearTimeout(bekleyen.zamanlayici)
          bekleyenServisler.delete(mesaj.id)
          bekleyen.coz({ basarili: mesaj.result, degerler: mesaj.values })
        }
      }
      break

    case 'status':
      if (mesaj.level === 'error') {
        console.warn('[ROS2] rosbridge hata:', mesaj.msg)
      }
      break
  }
}

// ── Topic İşlemleri ────────────────────────────────────────────────────────────

// Tip bilgisi ile topic kaydı (yeniden bağlantı için)
const kayitliTopicler = new Map<string, string>()

/**
 * Bir ROS2 topic'ine abone ol.
 * @param topic - Topic adı (ör: '/fmu/out/vehicle_status')
 * @param tip   - Mesaj tipi (ör: 'px4_msgs/msg/VehicleStatus')
 * @param cb    - Her mesajda çağrılacak callback
 */
export function topicAboneOl(topic: string, tip: string, cb: (mesaj: any) => void): void {
  topicCallbackleri.set(topic, cb)
  kayitliTopicler.set(topic, tip)
  gonder({ op: 'subscribe', id: yeniId(), topic, type: tip })
}

/**
 * Topic aboneliğini iptal et.
 */
export function topicAbonelikIptal(topic: string): void {
  topicCallbackleri.delete(topic)
  kayitliTopicler.delete(topic)
  gonder({ op: 'unsubscribe', id: yeniId(), topic })
}

/**
 * Jetson'daki mevcut ROS2 topic listesini döndürür.
 */
export function topicListesiAl(): Promise<{ isimler: string[]; tipler: string[] }> {
  return new Promise((coz, reddet) => {
    if (rosbridgeDurumu.value !== 'baglandi') {
      reddet(new Error('ROS2 bağlı değil'))
      return
    }
    const id = yeniId()
    const zamanlayici = setTimeout(() => {
      bekleyenServisler.delete(id)
      reddet(new Error('Topic listesi zaman aşımı'))
    }, 5000)

    bekleyenServisler.set(id, {
      coz: (yanit) => coz({ isimler: yanit.degerler?.topics ?? [], tipler: yanit.degerler?.types ?? [] }),
      reddet,
      zamanlayici,
    })

    gonder({
      op: 'call_service',
      id,
      service: '/rosapi/topics',
      type: 'rosapi/srv/Topics',
      args: {},
    })
  })
}

/**
 * ROS2 servisi çağır (std_srvs/Trigger veya diğer tipler).
 * @param servis - Servis adı (ör: '/toygun/kamikaze_modu')
 * @param tip    - Servis tipi (ör: 'std_srvs/srv/Trigger')
 * @param istek  - Servis isteği argümanları (Trigger için boş)
 */
export function servisCagir(
  servis: string,
  tip: string,
  istek: Record<string, any> = {},
): Promise<{ basarili: boolean; degerler: any }> {
  return new Promise((coz, reddet) => {
    if (rosbridgeDurumu.value !== 'baglandi') {
      reddet(new Error('ROS2 bağlı değil'))
      return
    }
    const id = yeniId()
    const zamanlayici = setTimeout(() => {
      bekleyenServisler.delete(id)
      reddet(new Error(`Servis zaman aşımı: ${servis}`))
    }, 5000)

    bekleyenServisler.set(id, { coz, reddet, zamanlayici })

    gonder({
      op: 'call_service',
      id,
      service: servis,
      type: tip,
      args: istek,
    })
  })
}
