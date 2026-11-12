import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export interface Nokta {
  id: string
  enlem: number
  boylam: number
  yukseklik: number
  sira: number
}

/** Görev planlama store'u */
export const useGorevStore = defineStore('gorev', () => {
  const gorevAdi = ref('Görev 1')
  const noktalar = ref<Nokta[]>([])
  const evNoktasi = ref<{ enlem: number; boylam: number } | null>(null)
  const gorevYukleniyor = ref(false)
  const gorevCalisiyorMu = ref(false)
  const gorevAraca = ref(false)
  const mevcutHedefNokta = ref(0)

  // Noktalar değişince araçtaki görev artık planla aynı değildir
  watch(noktalar, () => {
    if (!gorevYukleniyor.value) gorevAraca.value = false
  }, { deep: true })

  const noktaEkle = (enlem: number, boylam: number, yukseklik = 100) => {
    noktalar.value.push({
      id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      enlem,
      boylam,
      yukseklik,
      sira: noktalar.value.length + 1,
    })
  }

  const noktaSil = (id: string) => {
    noktalar.value = noktalar.value.filter((n) => n.id !== id)
    noktalar.value.forEach((n, i) => (n.sira = i + 1))
  }

  const noktaGuncelle = (id: string, guncelleme: Partial<Nokta>) => {
    const nokta = noktalar.value.find((n) => n.id === id)
    if (nokta) Object.assign(nokta, guncelleme)
  }

  const tumunuTemizle = () => {
    noktalar.value = []
    evNoktasi.value = null
  }

  const evNokBelirle = (enlem: number, boylam: number) => {
    evNoktasi.value = { enlem, boylam }
  }

  const gorevDosyasiKaydet = () => {
    const veri = JSON.stringify({
      versiyon: 1,
      evNoktasi: evNoktasi.value,
      noktalar: noktalar.value,
      tarih: new Date().toISOString(),
    }, null, 2)
    const blob = new Blob([veri], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `toygun_gorev_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const gorevDosyasiYukle = (dosyaIcerigi: string) => {
    try {
      const veri = JSON.parse(dosyaIcerigi)
      if (veri.noktalar) {
        noktalar.value = veri.noktalar
        evNoktasi.value = veri.evNoktasi ?? null
      }
    } catch {
      console.error('Görev dosyası okunamadı')
    }
  }

  return {
    gorevAdi,
    noktalar, evNoktasi, gorevYukleniyor, gorevCalisiyorMu, gorevAraca, mevcutHedefNokta,
    noktaEkle, noktaSil, noktaGuncelle, tumunuTemizle, evNokBelirle,
    gorevDosyasiKaydet, gorevDosyasiYukle,
  }
})
