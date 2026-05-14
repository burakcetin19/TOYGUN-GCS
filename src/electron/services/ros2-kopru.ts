/**
 * Toygun GCS — ROS2 IPC Köprüsü
 * Electron ana süreci üzerinden rclnodejs ile ROS2 servis çağrıları
 */

import { ipcMain } from 'electron'

type GorevEylemi = 'kamikaze' | 'it-dalasi' | 'acil-inis'

// ROS2 servis adları (ortam değişkenleri ile özelleştirilebilir)
const SERVIS_ADLARI: Record<GorevEylemi, string> = {
  'kamikaze': process.env.TOYGUN_ROS2_SERVICE_KAMIKAZE ?? '/toygun/kamikaze_modu',
  'it-dalasi': process.env.TOYGUN_ROS2_SERVICE_DOGFIGHT ?? '/toygun/it_dalasi_modu',
  'acil-inis': process.env.TOYGUN_ROS2_SERVICE_EMERGENCY ?? '/toygun/acil_inis',
}

let rclnodejs: any = null
let ros2Node: any = null
let baslangicDenendi = false

/**
 * ROS2 çalışma zamanını tembel yükleme ile başlatır.
 * rclnodejs mevcut değilse sessizce atlar.
 */
async function ros2Baslat(): Promise<boolean> {
  if (ros2Node) return true
  if (baslangicDenendi) return false

  baslangicDenendi = true

  try {
    rclnodejs = require('rclnodejs')
    await rclnodejs.init()
    ros2Node = rclnodejs.createNode('toygun_gcs_node')
    rclnodejs.spin(ros2Node)
    console.log('[ROS2] Düğüm başlatıldı: toygun_gcs_node')
    return true
  } catch (hata: any) {
    console.warn(`[ROS2] rclnodejs kullanılamıyor: ${hata.message}`)
    console.warn('[ROS2] ROS2 özellikleri devre dışı, uygulama normal çalışmaya devam edecek.')
    return false
  }
}

/**
 * ROS2 std_srvs/Trigger servisi çağır
 */
async function servisCagir(servisAdi: string): Promise<{ basarili: boolean; mesaj: string }> {
  const hazir = await ros2Baslat()
  if (!hazir || !ros2Node) {
    return { basarili: false, mesaj: 'ROS2 çalışma zamanı kullanılamıyor' }
  }

  return new Promise((resolve) => {
    try {
      const client = ros2Node.createClient('std_srvs/srv/Trigger', servisAdi)

      const zaman_asimi = setTimeout(() => {
        resolve({ basarili: false, mesaj: `Zaman aşımı: ${servisAdi} servisi yanıt vermedi` })
      }, 2500)

      const servisMevcut = client.waitForService(1000)
      if (!servisMevcut) {
        clearTimeout(zaman_asimi)
        resolve({ basarili: false, mesaj: `Servis bulunamadı: ${servisAdi}` })
        return
      }

      client.sendRequest({}, (yanit: any) => {
        clearTimeout(zaman_asimi)
        resolve({
          basarili: yanit.success ?? true,
          mesaj: yanit.message ?? 'Komut gönderildi',
        })
      })
    } catch (hata: any) {
      resolve({ basarili: false, mesaj: `Servis hatası: ${hata.message}` })
    }
  })
}

/**
 * IPC handler'ları kurar
 */
export function ros2KoprusuKur(): void {
  ipcMain.handle('toygun-gorev-eylemi', async (_event, eylem: GorevEylemi) => {
    const servisAdi = SERVIS_ADLARI[eylem]
    if (!servisAdi) {
      return { basarili: false, mesaj: `Bilinmeyen eylem: ${eylem}` }
    }

    console.log(`[ROS2] Görev eylemi: ${eylem} → ${servisAdi}`)
    return await servisCagir(servisAdi)
  })

  console.log('[ROS2] IPC köprüsü kuruldu')
}
