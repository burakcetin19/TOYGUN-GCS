/**
 * Toygun GCS — Sunucu Store
 * Yarışma sunucusundan gelen rakip konumları ve HSS bölgelerini yönetir.
 * Sunucuya bağlıyken belirli aralıklarla veri çeker ve haritayı günceller.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// ── Veri Tipleri ───────────────────────────────────────────────────────────────

export interface Rakip {
  id: number
  takimNo: number
  enlem: number
  boylam: number
  irtifa: number        // metre
  baslik: number        // derece (0-360)
  hiz: number           // m/s
  ihaKilitlendi: boolean
}

export interface HssZon {
  id: number
  enlem: number
  boylam: number
  yaricap: number       // metre
}

export interface UcusSiniri {
  noktalar: [number, number][]  // [enlem, boylam][]
}

// ── Store ──────────────────────────────────────────────────────────────────────

export const useSunucuStore = defineStore('sunucu', () => {
  // Bağlantı
  const bagliMi     = ref(false)
  const gecikme     = ref(0)
  const hataMesaji  = ref<string | null>(null)

  // Yapılandırma (BaglantilarPaneli ile paylaşılır)
  const ip        = ref('127.0.0.1')
  const port      = ref(8000)
  const kullanici = ref('')
  const sifre     = ref('')
  const takimNo   = ref(0)

  // Sunucudan gelen veriler
  const rakiplar    = ref<Rakip[]>([])
  const hssZonelari = ref<HssZon[]>([])
  const ucusSiniri  = ref<UcusSiniri | null>(null)
  const sunucuZamani = ref<string | null>(null)
  const zamanFarki  = ref(0)   // ms

  const zamanFarkKritik = computed(() => Math.abs(zamanFarki.value) > 500)

  let pollInterval: ReturnType<typeof setInterval> | null = null
  let token: string | null = null

  // ── Yardımcı ──────────────────────────────────────────────────────────────────

  function temelUrl() {
    return `http://${ip.value}:${port.value}`
  }

  function authHeaders(): HeadersInit {
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (token) {
      headers['Authorization'] = `Token ${token}`
    } else if (kullanici.value) {
      headers['Authorization'] = 'Basic ' + btoa(`${kullanici.value}:${sifre.value}`)
    }
    return headers
  }

  // ── Sunucu zamanı çek ─────────────────────────────────────────────────────────

  async function zamanSenkronla(): Promise<void> {
    const t0 = Date.now()
    try {
      const res = await fetch(`${temelUrl()}/api/sunucu_saati`, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(3000),
      })
      if (!res.ok) return
      const json = await res.json()
      const t1 = Date.now()
      // Beklenen format: { zaman: "HH:MM:SS" } veya { sunucu_saati: "..." }
      sunucuZamani.value = json.zaman ?? json.sunucu_saati ?? null
      zamanFarki.value = Math.round((t1 - t0) / 2)
      gecikme.value = t1 - t0
    } catch { /* sessiz */ }
  }

  // ── Rakip & HSS verisini çek ──────────────────────────────────────────────────

  async function veriGuncelle(): Promise<void> {
    try {
      // Rakip konumları
      // Beklenen format: [{ takim_numarasi, iha_enlem, iha_boylam, iha_irtifa,
      //                     iha_dikilme, iha_yatis, iha_yaw, hiz, iha_kilitlendi }]
      const resRakip = await fetch(`${temelUrl()}/api/telemetri_gonder`, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(3000),
      })
      if (resRakip.ok) {
        const liste: any[] = await resRakip.json()
        rakiplar.value = liste
          .filter((t: any) => t.takim_numarasi !== takimNo.value)
          .map((t: any, i: number) => ({
            id:            t.takim_numarasi ?? i,
            takimNo:       t.takim_numarasi ?? i,
            enlem:         Number(t.iha_enlem  ?? t.enlem  ?? 0),
            boylam:        Number(t.iha_boylam ?? t.boylam ?? 0),
            irtifa:        Number(t.iha_irtifa ?? t.irtifa ?? 0),
            baslik:        Number(t.iha_yaw    ?? t.baslik ?? 0),
            hiz:           Number(t.hiz        ?? 0),
            ihaKilitlendi: Boolean(t.iha_kilitlendi),
          }))
          .filter((r: Rakip) => r.enlem !== 0 || r.boylam !== 0)
      }

      // HSS bölgeleri
      // Beklenen format: [{ merkez_enlem, merkez_boylam, yaricap }]
      const resHss = await fetch(`${temelUrl()}/api/hss_koordinatlari`, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(3000),
      })
      if (resHss.ok) {
        const liste: any[] = await resHss.json()
        hssZonelari.value = liste.map((z: any, i: number) => ({
          id:      z.id ?? i + 1,
          enlem:   Number(z.merkez_enlem  ?? z.enlem  ?? 0),
          boylam:  Number(z.merkez_boylam ?? z.boylam ?? 0),
          yaricap: Number(z.yaricap       ?? z.radius ?? 300),
        }))
      }

      // Uçuş sınırı (opsiyonel)
      // Beklenen format: [{ enlem, boylam }]
      const resSinir = await fetch(`${temelUrl()}/api/ucus_alani`, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(3000),
      })
      if (resSinir.ok) {
        const liste: any[] = await resSinir.json()
        if (Array.isArray(liste) && liste.length >= 3) {
          ucusSiniri.value = {
            noktalar: liste.map((n: any) => [Number(n.enlem ?? n.lat), Number(n.boylam ?? n.lon)] as [number, number]),
          }
        }
      }

    } catch { /* ağ hatası — sessiz, bir sonraki tick'te tekrar denenir */ }
  }

  // ── Bağlantı Yönetimi ─────────────────────────────────────────────────────────

  async function baglan(): Promise<{ basarili: boolean; hata?: string }> {
    try {
      hataMesaji.value = null
      const t0 = Date.now()

      // Login denemesi — sunucu `/api/giris` veya `/api/login` bekleyebilir
      const res = await fetch(`${temelUrl()}/api/giris`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kullanici_adi: kullanici.value,
          sifre: sifre.value,
          takim_numarasi: takimNo.value,
        }),
        signal: AbortSignal.timeout(5000),
      })

      gecikme.value = Date.now() - t0

      if (!res.ok) {
        // 401 → hatalı kimlik bilgisi, diğer → sunucu hatası
        const mesaj = res.status === 401
          ? 'Kimlik bilgisi hatalı'
          : `Sunucu hatası: ${res.status}`
        return { basarili: false, hata: mesaj }
      }

      // Bazı sunucular token döner
      try {
        const json = await res.json()
        token = json.token ?? json.access_token ?? null
      } catch { token = null }

      bagliMi.value = true
      await zamanSenkronla()
      await veriGuncelle()

      // 1 saniyede bir poll
      pollInterval = setInterval(async () => {
        await veriGuncelle()
        await zamanSenkronla()
      }, 1000)

      return { basarili: true }
    } catch (hata: any) {
      const mesaj = hata.name === 'TimeoutError'
        ? 'Sunucuya ulaşılamıyor (zaman aşımı)'
        : (hata.message ?? 'Bağlantı hatası')
      return { basarili: false, hata: mesaj }
    }
  }

  function kes(): void {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
    bagliMi.value     = false
    gecikme.value     = 0
    token             = null
    rakiplar.value    = []
    hssZonelari.value = []
    ucusSiniri.value  = null
    sunucuZamani.value = null
  }

  return {
    // Yapılandırma
    ip, port, kullanici, sifre, takimNo,
    // Durum
    bagliMi, gecikme, hataMesaji, sunucuZamani, zamanFarki, zamanFarkKritik,
    // Veriler
    rakiplar, hssZonelari, ucusSiniri,
    // Metodlar
    baglan, kes, zamanSenkronla,
  }
})
