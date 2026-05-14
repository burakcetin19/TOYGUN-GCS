import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useAracStore } from './arac'
import { useGorevStore } from './gorev'

export interface LogKaydi {
  zaman: number    // Unix ms
  yerHizi: number
  havaHizi: number
  yukseklik: number
  bataryaVoltaj: number
  bataryaYuzde: number
  bataryaAkim: number
  gpsFixTipi: number
  gpsSayisi: number
  heading: number
  pitch: number
  roll: number
  yaw: number
  enlem: number
  boylam: number
  ucusModu: string
  armed: boolean
}

export const useUcusLoguStore = defineStore('ucusLogu', () => {
  const kayitBasladi = ref(false)
  const kayitlar = ref<LogKaydi[]>([])
  const baslangicZamani = ref<number | null>(null)
  let logInterval: ReturnType<typeof setInterval> | null = null

  const kayitiBaslat = () => {
    if (kayitBasladi.value) return
    kayitBasladi.value = true
    kayitlar.value = []
    baslangicZamani.value = Date.now()

    logInterval = setInterval(() => {
      const aracStore = useAracStore()
      if (!aracStore.armed) return
      kayitlar.value.push({
        zaman: Date.now(),
        yerHizi: aracStore.yerHizi,
        havaHizi: aracStore.havaHizi,
        yukseklik: aracStore.yukseklik,
        bataryaVoltaj: aracStore.bataryaVoltaj,
        bataryaYuzde: aracStore.bataryaYuzde,
        bataryaAkim: aracStore.bataryaAkim,
        gpsFixTipi: aracStore.gpsFixTipi,
        gpsSayisi: aracStore.gpsSayisi,
        heading: aracStore.heading,
        pitch: aracStore.pitch,
        roll: aracStore.roll,
        yaw: aracStore.yaw,
        enlem: aracStore.enlem,
        boylam: aracStore.boylam,
        ucusModu: aracStore.ucusModu,
        armed: aracStore.armed,
      })
    }, 500) // 2 Hz log
  }

  const kayitiDurdurVeKaydet = (gorevAdi: string) => {
    if (!kayitBasladi.value) return
    kayitBasladi.value = false
    if (logInterval) { clearInterval(logInterval); logInterval = null }

    if (kayitlar.value.length === 0) return

    const veri = {
      gorevAdi,
      baslangic: new Date(baslangicZamani.value ?? Date.now()).toISOString(),
      bitis: new Date().toISOString(),
      kayitSayisi: kayitlar.value.length,
      kayitlar: kayitlar.value,
    }

    const json = JSON.stringify(veri, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const dosyaAdi = `${gorevAdi.replace(/[^a-zA-Z0-9_\-\u00C0-\u017E]/g, '_')}_log_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
    a.download = dosyaAdi
    a.click()
    URL.revokeObjectURL(url)

    kayitlar.value = []
    baslangicZamani.value = null
  }

  // armed değişimini izle — arm olunca log başlat, disarm olunca kaydet
  const armiIzle = () => {
    const aracStore = useAracStore()
    const gorevStore = useGorevStore()

    watch(() => aracStore.armed, (yeni, eski) => {
      if (yeni && !eski) {
        kayitiBaslat()
      } else if (!yeni && eski) {
        kayitiDurdurVeKaydet(gorevStore.gorevAdi)
      }
    })
  }

  return {
    kayitBasladi, kayitlar, baslangicZamani,
    kayitiBaslat, kayitiDurdurVeKaydet, armiIzle,
  }
})
