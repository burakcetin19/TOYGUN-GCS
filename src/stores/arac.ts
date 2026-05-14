import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAracStore = defineStore('arac', () => {
  // ── Bağlantı ──
  const baglantiDurumu = ref<'baglandi' | 'baglantiKesik' | 'baglaniliyor'>('baglantiKesik')
  const baglantiHataMesaji = ref<string | null>(null)
  const sonMesajZamani = ref(0)
  const baglantiTipi = ref<'Serial' | 'UDP In' | 'UDP Out' | 'TCP In' | 'TCP Out' | 'USB'>('Serial')
  const bantGenisligi = ref<number>(115200)

  // ── Telemetri ──
  const yerHizi      = ref(0)
  const havaHizi     = ref(0)
  const yukseklik    = ref(0)
  const yapiYukseklik = ref(0)
  const bataryaVoltaj = ref(0)
  const bataryaYuzde  = ref(-1)
  const bataryaAkim   = ref(0)
  const gpsFixTipi    = ref(0)
  const gpsSayisi     = ref(0)
  const gpsHdop       = ref(99.9)
  const heading       = ref(0)
  const enlem         = ref(0)
  const boylam        = ref(0)
  const pitch         = ref(0)
  const roll          = ref(0)
  const yaw           = ref(0)
  const armed         = ref(false)
  const ucusModu      = ref('—')

  // ── Simülasyon ──
  const simuleAktif = ref(false)
  let simuleInterval: ReturnType<typeof setInterval> | null = null
  let simuleAci = 0
  let simuleTick = 0

  // ── Bağlantı Protokolü ──
  const baglantiProtokolu = ref<'websocket' | 'serial' | 'udp' | 'tcp'>('websocket')

  const aracCevrimici = computed(() => baglantiDurumu.value === 'baglandi')

  const bataryaDurumRengi = computed(() => {
    if (bataryaYuzde.value < 0)  return 'var(--tg-metin-soluk)'
    if (bataryaYuzde.value < 20) return 'var(--tg-tehlike)'
    if (bataryaYuzde.value < 40) return 'var(--tg-uyari)'
    return 'var(--tg-basari)'
  })

  const gpsFixMetni = computed(() => {
    if (!aracCevrimici.value) return '—'
    const labels: Record<number, string> = {
      0: 'Fix Yok', 1: 'Fix Yok', 2: '2D Fix', 3: '3D Fix',
      4: 'DGPS', 5: 'RTK Float', 6: 'RTK Fix',
    }
    return labels[gpsFixTipi.value] ?? 'Bilinmiyor'
  })

  const telemetriSifirla = () => {
    yerHizi.value = 0; havaHizi.value = 0; yukseklik.value = 0; yapiYukseklik.value = 0
    bataryaVoltaj.value = 0; bataryaYuzde.value = -1; bataryaAkim.value = 0
    gpsFixTipi.value = 0; gpsSayisi.value = 0; gpsHdop.value = 99.9
    heading.value = 0; enlem.value = 0; boylam.value = 0
    pitch.value = 0; roll.value = 0; yaw.value = 0
    armed.value = false; ucusModu.value = '—'
  }

  // ── Bağlantı ──
  const baglan = () => {
    if (simuleAktif.value) return
    baglantiHataMesaji.value = null
    baglantiDurumu.value = 'baglaniliyor'
  }

  // Simülasyon modunu açıkça başlatmak için (BaglantilarPaneli simülasyon butonu)
  const simuleModuBaslat = () => {
    if (simuleAktif.value) return
    baglantiDurumu.value = 'baglaniliyor'
    setTimeout(() => {
      if (baglantiDurumu.value === 'baglaniliyor') simuleBaslat()
    }, 1500)
  }

  const baglantiyiKes = () => {
    if (simuleAktif.value) {
      simuleAktif.value = false
      if (simuleInterval) { clearInterval(simuleInterval); simuleInterval = null }
    }
    baglantiDurumu.value = 'baglantiKesik'
    telemetriSifirla()
  }

  const baglandiOnayla = () => { baglantiDurumu.value = 'baglandi' }

  // ── Simülasyon ──
  const simuleBaslat = () => {
    if (simuleAktif.value) return
    simuleAktif.value = true
    simuleAci = 45
    simuleTick = 0

    // Başlangıç değerleri — Ankara üstü uçuş
    baglantiDurumu.value = 'baglandi'
    enlem.value = 39.9334 + 0.008 * Math.cos((simuleAci * Math.PI) / 180)
    boylam.value = 32.8597 + 0.008 * Math.sin((simuleAci * Math.PI) / 180)
    armed.value = true
    ucusModu.value = 'AUTO'
    gpsFixTipi.value = 3
    gpsSayisi.value = 14
    gpsHdop.value = 0.85
    bataryaVoltaj.value = 16.82
    bataryaYuzde.value = 87.0
    bataryaAkim.value = 28.5
    yukseklik.value = 596.4
    yapiYukseklik.value = 104.2
    heading.value = 135
    yerHizi.value = 18.4
    havaHizi.value = 21.7
    pitch.value = 2.8
    roll.value = -4.2
    yaw.value = 135

    const logFn = (m: string, t: string) => (window as any).__toygunTerminal?.(m, t as any)
    const bildirimFn = (m: string, t: string) => (window as any).__toygunBildirim?.(m, t)

    logFn('── Simülasyon modu başlatıldı ──', 'sys')
    setTimeout(() => logFn('GPS kilidi alındı: 14 uydu, 3D Fix', 'ok'), 300)
    setTimeout(() => logFn('Araç ARMED — AUTO modu aktif', 'mod'), 700)
    setTimeout(() => bildirimFn('Simülasyon modu aktif', 'basari'), 400)

    const modlar = ['AUTO', 'AUTO', 'AUTO', 'LOITER', 'GUIDED', 'FBWA', 'AUTO']
    let modIdx = 0

    simuleInterval = setInterval(() => {
      simuleTick++

      // Dairesel devriye yolu
      simuleAci = (simuleAci + 0.4) % 360
      const radyan = (simuleAci * Math.PI) / 180
      enlem.value  = 39.9334 + 0.008 * Math.cos(radyan) + (Math.random() - 0.5) * 0.0002
      boylam.value = 32.8597 + 0.008 * Math.sin(radyan) + (Math.random() - 0.5) * 0.0002

      // Başlık: tanjant yönü
      heading.value = (simuleAci + 90 + (Math.random() - 0.5) * 4 + 360) % 360
      yaw.value = heading.value

      // Hız değişimi
      yerHizi.value  = Math.max(12, Math.min(26, yerHizi.value + (Math.random() - 0.5) * 0.8))
      havaHizi.value = yerHizi.value + 2.5 + Math.random() * 2

      // Yükseklik salınımı
      yukseklik.value    = Math.max(580, Math.min(640, yukseklik.value + (Math.random() - 0.5) * 2.5))
      yapiYukseklik.value = yukseklik.value - 492.2

      // Pitch/roll gerçekçi
      pitch.value = (Math.random() - 0.5) * 10
      roll.value  = (Math.random() - 0.5) * 20

      // Batarya yavaş tükeniyor
      bataryaYuzde.value  = Math.max(0, bataryaYuzde.value - 0.004)
      bataryaAkim.value   = 25 + Math.random() * 8
      bataryaVoltaj.value = 14.8 + (bataryaYuzde.value / 100) * 2.0

      // Mod değişimi her ~25 sn
      if (simuleTick % 125 === 0) {
        modIdx = (modIdx + 1) % modlar.length
        ucusModu.value = modlar[modIdx]
      }
    }, 200) // 5 Hz
  }

  const simuleDurdur = () => {
    if (!simuleAktif.value) return
    const logFn = (m: string, t: string) => (window as any).__toygunTerminal?.(m, t as any)
    logFn('── Simülasyon modu durduruldu ──', 'warn')
    baglantiyiKes() // simuleAktif.value=true → baglantiyiKes clears it
  }

  // ── ARM ──
  const armHataKontrol = (): string[] => {
    const hatalar: string[] = []
    if (!aracCevrimici.value) hatalar.push('Araç bağlı değil')
    if (gpsFixTipi.value < 3) hatalar.push(`GPS fix yok (${gpsFixMetni.value}) — 3D Fix gerekli`)
    if (bataryaYuzde.value >= 0 && bataryaYuzde.value < 20)
      hatalar.push(`Batarya çok düşük (%${bataryaYuzde.value.toFixed(0)}) — en az %20 gerekli`)
    return hatalar
  }

  const armEt = (): { basarili: boolean; hatalar: string[] } => {
    const hatalar = armHataKontrol()
    if (hatalar.length > 0) return { basarili: false, hatalar }
    armed.value = true
    return { basarili: true, hatalar: [] }
  }

  const disarmEt = () => { armed.value = false }

  return {
    baglantiDurumu, baglantiHataMesaji, sonMesajZamani, baglantiTipi, bantGenisligi, baglantiProtokolu,
    baglan, baglantiyiKes, baglandiOnayla, simuleModuBaslat,
    yerHizi, havaHizi, yukseklik, yapiYukseklik,
    bataryaVoltaj, bataryaYuzde, bataryaAkim,
    gpsFixTipi, gpsSayisi, gpsHdop,
    heading, enlem, boylam,
    pitch, roll, yaw,
    armed, ucusModu,
    simuleAktif, simuleBaslat, simuleDurdur,
    aracCevrimici, bataryaDurumRengi, gpsFixMetni,
    telemetriSifirla, armEt, disarmEt, armHataKontrol,
  }
})
