import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type TemaAdi = 'acik' | 'koyu'

const DEPOLAMA_ANAHTARI = 'toygun-tema'

/** Kayıtlı tercihi okur; yoksa açık tema (mevcut varsayılan görünüm). */
export function kayitliTemaOku(): TemaAdi {
  try {
    const deger = localStorage.getItem(DEPOLAMA_ANAHTARI)
    if (deger === 'acik' || deger === 'koyu') return deger
  } catch { /* depolama erişilemez (gizli pencere vb.) */ }
  return 'acik'
}

/** <html data-tema="..."> — CSS değişkenleri buna göre değişir (global.css) */
export function temayiBelgeyeUygula(tema: TemaAdi): void {
  document.documentElement.dataset.tema = tema
}

/**
 * Uygulama teması (açık / koyu).
 * Vuetify teması App.vue içinde bu store'a bağlanır.
 */
export const useTemaStore = defineStore('tema', () => {
  const tema = ref<TemaAdi>(kayitliTemaOku())

  watch(tema, (yeni) => {
    // Geçiş anında kısa bir renk animasyonu — sürekli transition performansı etkiler
    const kok = document.documentElement
    kok.classList.add('tema-gecisi')
    temayiBelgeyeUygula(yeni)
    window.setTimeout(() => kok.classList.remove('tema-gecisi'), 300)
    try { localStorage.setItem(DEPOLAMA_ANAHTARI, yeni) } catch { /* yok say */ }
  })

  const temaDegistir = () => {
    tema.value = tema.value === 'koyu' ? 'acik' : 'koyu'
  }

  return { tema, temaDegistir }
})
