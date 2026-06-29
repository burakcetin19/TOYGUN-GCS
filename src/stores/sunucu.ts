/**
 * Toygun GCS — Sunucu Store
 * Yarışma sunucusu ile haberleşmeyi yönetir.
 * PDF: SIHA Haberleşme Dokümanı 2026
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAracStore } from '@/stores/arac'

// ── Veri Tipleri ───────────────────────────────────────────────────────────────

export interface Rakip {
  id: number
  takimNo: number
  enlem: number
  boylam: number
  irtifa: number        // metre (AGL)
  baslik: number        // derece (0-360), iha_yonelme
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

interface SunucuSaatiObj {
  gun?: number
  saat: number
  dakika: number
  saniye: number
  milisaniye: number
}

// ── Store ──────────────────────────────────────────────────────────────────────

export const useSunucuStore = defineStore('sunucu', () => {
  // Bağlantı
  const bagliMi     = ref(false)
  const gecikme     = ref(0)
  const hataMesaji  = ref<string | null>(null)

  // Yapılandırma (BaglantilarPaneli ile paylaşılır)
  // Varsayılan: belge formatı http://127.0.0.25:5000
  const ip        = ref('127.0.0.25')
  const port      = ref(5000)
  const kullanici = ref('')   // API'de "kadi" alanı olarak gönderilir
  const sifre     = ref('')
  const takimNo   = ref(0)

  // Kilitlenme verileri (telemetri ile gönderilir)
  const ihaKilitlenme  = ref(0)
  const hedefMerkezX   = ref(0)
  const hedefMerkezY   = ref(0)
  const hedefGenislik  = ref(0)
  const hedefYukseklik = ref(0)

  // Sunucudan gelen veriler
  const rakiplar     = ref<Rakip[]>([])
  const hssZonelari  = ref<HssZon[]>([])
  const ucusSiniri   = ref<UcusSiniri | null>(null)
  const sunucuZamani = ref<string | null>(null)
  const zamanFarki   = ref(0)   // ms
  const qrKoordinati = ref<{ enlem: number; boylam: number } | null>(null)

  const zamanFarkKritik = computed(() => Math.abs(zamanFarki.value) > 500)

  let telemetriInterval: ReturnType<typeof setInterval> | null = null
  let hssInterval: ReturnType<typeof setInterval> | null = null

  // ── Yardımcı ──────────────────────────────────────────────────────────────────

  function temelUrl() {
    return `http://${ip.value}:${port.value}`
  }

  /** Oturum çerezi ile fetch — sunucu session tabanlı kimlik doğrulaması kullanır */
  function fetchSesyon(url: string, options: RequestInit = {}) {
    return fetch(url, { ...options, credentials: 'include' })
  }

  function termLog(mesaj: string, tip: 'info' | 'ok' | 'warn' | 'error' | 'sys' = 'info') {
    ;(window as any).__toygunTerminal?.(mesaj, tip)
  }

  function httpHataMesaji(status: number): string {
    switch (status) {
      case 204: return `Paket formatı yanlış (204) — istek gövdesi sunucu beklentisiyle uyuşmuyor`
      case 400: return `Hatalı istek (400) — kullanıcı adı, şifre veya takım numarası hatalı`
      case 401: return `Kimliksiz erişim (401) — oturum açmanız gerekiyor`
      case 403: return `Yetkisiz erişim (403) — bu hesabın yetkisi yok`
      case 404: return `Geçersiz URL (404) — sunucu adresi veya endpoint yanlış`
      case 500: return `Sunucu iç hatası (500) — sunucu tarafında bir sorun var`
      default:  return `HTTP ${status} hatası`
    }
  }

  function agHataMesaji(hata: any): { kisa: string; ipucu: string } {
    if (hata.name === 'TimeoutError' || hata.name === 'AbortError') {
      return {
        kisa:  'Zaman aşımı — sunucuya ulaşılamadı',
        ipucu: '→ IP adresi veya port numarası doğru mu? Sunucu çalışıyor mu?',
      }
    }
    const msg: string = hata.message ?? ''
    if (msg.includes('Failed to fetch') || msg.includes('fetch')) {
      return {
        kisa:  'Bağlantı kurulamadı — sunucu erişilemiyor',
        ipucu: '→ Sunucu açık mı? Ağ bağlantısı var mı? Güvenlik duvarı kapalı mı?',
      }
    }
    return {
      kisa:  msg || 'Bilinmeyen ağ hatası',
      ipucu: '',
    }
  }

  function saatStringOlustur(s: SunucuSaatiObj): string {
    return [
      String(s.saat).padStart(2, '0'),
      String(s.dakika).padStart(2, '0'),
      String(s.saniye).padStart(2, '0'),
    ].join(':')
  }

  function simdiGpsSaati() {
    const now = new Date()
    return {
      saat:       now.getUTCHours(),
      dakika:     now.getUTCMinutes(),
      saniye:     now.getUTCSeconds(),
      milisaniye: now.getUTCMilliseconds(),
    }
  }

  // ── Sunucu saati ──────────────────────────────────────────────────────────────
  // GET /api/sunucusaati → { gun, saat, dakika, saniye, milisaniye }

  async function zamanSenkronla(): Promise<void> {
    const t0 = Date.now()
    try {
      const res = await fetchSesyon(`${temelUrl()}/api/sunucusaati`, {
        signal: AbortSignal.timeout(3000),
      })
      if (!res.ok) return
      const json: SunucuSaatiObj = await res.json()
      const t1 = Date.now()
      gecikme.value = t1 - t0
      sunucuZamani.value = saatStringOlustur(json)

      // Sunucu-yerel saat farkı (UTC bazlı, RTT yarısı düşülür)
      const sunucuMs = json.saat * 3_600_000 + json.dakika * 60_000 + json.saniye * 1_000 + json.milisaniye
      const now = new Date()
      const yerelMs = now.getUTCHours() * 3_600_000 + now.getUTCMinutes() * 60_000 + now.getUTCSeconds() * 1_000 + now.getUTCMilliseconds()
      zamanFarki.value = sunucuMs - yerelMs - Math.round(gecikme.value / 2)
    } catch { /* sessiz */ }
  }

  // ── Telemetri gönder + rakip konumları al ─────────────────────────────────────
  // POST /api/telemetri_gonder
  // İstek: tam telemetri paketi
  // Yanıt: { sunucusaati: {...}, konumBilgileri: [{takim_numarasi, iha_enlem, ...}] }

  async function telemetriGonder(): Promise<void> {
    const aracStore = useAracStore()
    try {
      const ihaOtonom = aracStore.ucusModu?.startsWith('AUTO') ? 1 : 0

      const res = await fetchSesyon(`${temelUrl()}/api/telemetri_gonder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          takim_numarasi:  takimNo.value,
          iha_enlem:       aracStore.enlem,
          iha_boylam:      aracStore.boylam,
          iha_irtifa:      Math.round(aracStore.yapiYukseklik ?? aracStore.yukseklik),
          iha_dikilme:     Math.round(aracStore.pitch),
          iha_yonelme:     Math.round(aracStore.heading),
          iha_yatis:       Math.round(aracStore.roll),
          iha_hiz:         Math.round(aracStore.yerHizi),
          iha_batarya:     Math.max(0, Math.round(aracStore.bataryaYuzde)),
          iha_otonom:      ihaOtonom,
          iha_kilitlenme:  ihaKilitlenme.value,
          hedef_merkez_X:  hedefMerkezX.value,
          hedef_merkez_Y:  hedefMerkezY.value,
          hedef_genislik:  hedefGenislik.value,
          hedef_yukseklik: hedefYukseklik.value,
          gps_saati:       simdiGpsSaati(),
        }),
        signal: AbortSignal.timeout(3000),
      })

      if (res.ok) {
        const json = await res.json()

        if (json.sunucusaati) {
          sunucuZamani.value = saatStringOlustur(json.sunucusaati)
        }

        const liste: any[] = json.konumBilgileri ?? []
        rakiplar.value = liste
          .filter((t: any) => Number(t.takim_numarasi) !== takimNo.value)
          .map((t: any) => ({
            id:            Number(t.takim_numarasi),
            takimNo:       Number(t.takim_numarasi),
            enlem:         Number(t.iha_enlem  ?? 0),
            boylam:        Number(t.iha_boylam ?? 0),
            irtifa:        Number(t.iha_irtifa ?? 0),
            baslik:        Number(t.iha_yonelme ?? 0),
            hiz:           Number(t.iha_hizi   ?? 0),
            ihaKilitlendi: false,
          }))
          .filter((r: Rakip) => r.enlem !== 0 || r.boylam !== 0)
      }
    } catch { /* ağ hatası — sessiz */ }
  }

  // ── HSS koordinatlarını al ────────────────────────────────────────────────────
  // GET /api/hss_koordinatlari
  // Yanıt: { sunucusaati: {...}, hss_koordinat_bilgileri: [{id, hssEnlem, hssBoylam, hssYaricap}] }

  async function hssGuncelle(): Promise<void> {
    try {
      const res = await fetchSesyon(`${temelUrl()}/api/hss_koordinatlari`, {
        signal: AbortSignal.timeout(3000),
      })
      if (!res.ok) return
      const json = await res.json()
      const liste: any[] = json.hss_koordinat_bilgileri ?? []
      hssZonelari.value = liste.map((z: any) => ({
        id:      Number(z.id ?? 0),
        enlem:   Number(z.hssEnlem  ?? 0),
        boylam:  Number(z.hssBoylam ?? 0),
        yaricap: Number(z.hssYaricap ?? 300),
      }))
    } catch { /* sessiz */ }
  }

  // ── Uçuş alanı (belgelenmiş değil, opsiyonel) ─────────────────────────────────

  async function ucusAlaniGuncelle(): Promise<void> {
    try {
      const res = await fetchSesyon(`${temelUrl()}/api/ucus_alani`, {
        signal: AbortSignal.timeout(3000),
      })
      if (!res.ok) return
      const liste: any[] = await res.json()
      if (Array.isArray(liste) && liste.length >= 3) {
        ucusSiniri.value = {
          noktalar: liste.map((n: any) => [Number(n.enlem ?? n.lat), Number(n.boylam ?? n.lon)] as [number, number]),
        }
      }
    } catch { /* sessiz */ }
  }

  // ── Kilitlenme bilgisi gönder ─────────────────────────────────────────────────
  // POST /api/kilitlenme_bilgisi
  // { kilitlenmeBitisZamani: {saat,dakika,saniye,milisaniye}, otonom_kilitlenme: 0|1 }

  async function kilitlenmeBilgisiGonder(otonom: boolean): Promise<boolean> {
    try {
      const res = await fetchSesyon(`${temelUrl()}/api/kilitlenme_bilgisi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kilitlenmeBitisZamani: simdiGpsSaati(),
          otonom_kilitlenme: otonom ? 1 : 0,
        }),
        signal: AbortSignal.timeout(5000),
      })
      return res.ok
    } catch { return false }
  }

  // ── Kamikaze bilgisi gönder ───────────────────────────────────────────────────
  // POST /api/kamikaze_bilgisi
  // { kamikazeBaslangicZamani: {...}, kamikazeBitisZamani: {...}, qrMetni: "..." }

  async function kamikazeBilgisiGonder(
    baslangic: Date,
    bitis: Date,
    qrMetni: string,
  ): Promise<boolean> {
    function tarihtenSaat(d: Date): SunucuSaatiObj {
      return {
        saat:       d.getUTCHours(),
        dakika:     d.getUTCMinutes(),
        saniye:     d.getUTCSeconds(),
        milisaniye: d.getUTCMilliseconds(),
      }
    }
    try {
      const res = await fetchSesyon(`${temelUrl()}/api/kamikaze_bilgisi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kamikazeBaslangicZamani: tarihtenSaat(baslangic),
          kamikazeBitisZamani:     tarihtenSaat(bitis),
          qrMetni,
        }),
        signal: AbortSignal.timeout(5000),
      })
      return res.ok
    } catch { return false }
  }

  // ── QR koordinatı al ──────────────────────────────────────────────────────────
  // GET /api/qr_koordinati → { qrEnlem, qrBoylam }

  async function qrKoordinatiAl(): Promise<{ enlem: number; boylam: number } | null> {
    try {
      const res = await fetchSesyon(`${temelUrl()}/api/qr_koordinati`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) return null
      const json = await res.json()
      const konum = { enlem: Number(json.qrEnlem), boylam: Number(json.qrBoylam) }
      qrKoordinati.value = konum
      return konum
    } catch { return null }
  }

  // ── Bağlantı Yönetimi ─────────────────────────────────────────────────────────
  // POST /api/giris → { kadi, sifre } — yanıt: takim_numarasi

  async function baglan(): Promise<{ basarili: boolean; hata?: string }> {
    try {
      hataMesaji.value = null
      const url = temelUrl()
      termLog(`─── Sunucu bağlantısı başlatılıyor ───`, 'sys')
      termLog(`Adres : ${url}`, 'info')
      termLog(`Hesap : kullanıcı="${kullanici.value}", takım=${takimNo.value}`, 'info')
      termLog(`POST  : ${url}/api/giris`, 'info')

      const t0 = Date.now()

      const res = await fetchSesyon(`${url}/api/giris`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kadi:           kullanici.value,
          sifre:          sifre.value,
          takim_numarasi: takimNo.value,
        }),
        signal: AbortSignal.timeout(5000),
      })

      gecikme.value = Date.now() - t0

      if (!res.ok) {
        const aciklama = httpHataMesaji(res.status)
        hataMesaji.value = aciklama
        termLog(`HATA  : ${aciklama}`, 'error')
        if (res.status === 400 || res.status === 401) {
          termLog(`→ Kullanıcı adı, şifre ve takım numarasını kontrol edin`, 'warn')
        } else if (res.status === 404) {
          termLog(`→ Sunucu IP/port adresi doğru mu? (${url})`, 'warn')
        }
        return { basarili: false, hata: aciklama }
      }

      termLog(`Giriş başarılı — gecikme: ${gecikme.value} ms`, 'ok')

      // Başarılı girişte sunucu takim_numarasi döner
      try {
        const json = await res.json()
        if (json?.takim_numarasi != null) {
          takimNo.value = Number(json.takim_numarasi)
          termLog(`Takım numarası: ${takimNo.value}`, 'info')
        }
      } catch { /* gövde boşsa yoksay */ }

      bagliMi.value = true

      termLog(`GET   : ${url}/api/sunucusaati`, 'info')
      await zamanSenkronla()
      if (sunucuZamani.value) termLog(`Sunucu saati: ${sunucuZamani.value} (Δ${zamanFarki.value} ms)`, 'ok')

      termLog(`POST  : ${url}/api/telemetri_gonder (ilk paket)`, 'info')
      await telemetriGonder()

      termLog(`GET   : ${url}/api/hss_koordinatlari`, 'info')
      await hssGuncelle()
      termLog(`HSS bölge sayısı: ${hssZonelari.value.length}`, 'ok')

      await ucusAlaniGuncelle()
      termLog(`─── Bağlantı hazır — telemetri 1 Hz ───`, 'sys')

      // 1 Hz telemetri (PDF: en az 1 Hz, max 2 Hz)
      telemetriInterval = setInterval(telemetriGonder, 1000)

      // HSS + QR 3 saniyede bir güncellenir
      hssInterval = setInterval(() => {
        hssGuncelle()
        ucusAlaniGuncelle()
        qrKoordinatiAl()
      }, 3000)

      return { basarili: true }
    } catch (hata: any) {
      const { kisa, ipucu } = agHataMesaji(hata)
      hataMesaji.value = kisa
      termLog(`HATA  : ${kisa}`, 'error')
      if (ipucu) termLog(ipucu, 'warn')
      return { basarili: false, hata: kisa }
    }
  }

  function kes(): void {
    if (telemetriInterval) { clearInterval(telemetriInterval); telemetriInterval = null }
    if (hssInterval)       { clearInterval(hssInterval);       hssInterval = null }
    bagliMi.value      = false
    gecikme.value      = 0
    hataMesaji.value   = null
    rakiplar.value     = []
    hssZonelari.value  = []
    ucusSiniri.value   = null
    sunucuZamani.value = null
    zamanFarki.value   = 0
    qrKoordinati.value = null
  }

  return {
    // Yapılandırma
    ip, port, kullanici, sifre, takimNo,
    // Kilitlenme parametreleri
    ihaKilitlenme, hedefMerkezX, hedefMerkezY, hedefGenislik, hedefYukseklik,
    // Durum
    bagliMi, gecikme, hataMesaji, sunucuZamani, zamanFarki, zamanFarkKritik,
    // Veriler
    rakiplar, hssZonelari, ucusSiniri, qrKoordinati,
    // Metodlar
    baglan, kes, zamanSenkronla,
    kilitlenmeBilgisiGonder, kamikazeBilgisiGonder, qrKoordinatiAl,
  }
})
