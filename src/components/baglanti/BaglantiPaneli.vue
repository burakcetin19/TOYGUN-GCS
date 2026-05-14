<template>
  <div class="baglanti-paneli">
    <!-- Satır 1: Protokol seçimi -->
    <div class="bp-satirlar">
      <select v-model="protokol" class="bp-secim" :disabled="baglaniyor" @change="protokolDegisti">
        <option v-for="p in protokolSecenekleri" :key="p.deger" :value="p.deger">{{ p.etiket }}</option>
      </select>
      <!-- Baud rate — sadece Serial'da göster -->
      <select v-if="protokol === 'serial'" v-model="aracStore.bantGenisligi" class="bp-secim bp-bant" :disabled="baglaniyor">
        <option v-for="bant in bantGenilikler" :key="bant" :value="bant">{{ bant }}</option>
      </select>
    </div>

    <!-- Satır 2: Protokole özgü parametreler -->
    <div v-if="protokol === 'websocket'" class="bp-param-satir">
      <input
        v-model="wsAdres"
        type="text"
        class="bp-giris"
        placeholder="ws://192.168.1.1:6040/ws/mavlink"
        :disabled="baglaniyor"
        @change="wsAdresKaydet"
      />
    </div>

    <div v-else-if="protokol === 'serial'" class="bp-param-satir">
      <!-- Port listesi varsa dropdown, yoksa manuel giriş -->
      <select
        v-if="portListesi.length > 0"
        v-model="seciliPort"
        class="bp-secim bp-port"
        :disabled="baglaniyor"
      >
        <option value="" disabled>-- Port seç --</option>
        <option v-for="port in portListesi" :key="port.yol" :value="port.yol">
          {{ port.pixhawkMu ? '★ ' : '' }}{{ port.yol }} — {{ port.cihazTipi !== 'Bilinmeyen' ? port.cihazTipi : (port.aciklama || port.yol) }}
        </option>
      </select>
      <input
        v-else
        v-model="seciliPort"
        type="text"
        class="bp-giris bp-port"
        placeholder="COM3 / COM7 / /dev/ttyUSB0"
        :disabled="baglaniyor"
      />
      <button
        class="bp-yenile-buton"
        :class="{ 'bp-yenile-spin': portYukleniyor }"
        :disabled="baglaniyor"
        title="Portları yenile"
        @click="portlariYenileManuel"
      >
        <span class="bp-yenile-ikon">↻</span>
      </button>
    </div>

    <div v-else-if="protokol === 'udp'" class="bp-param-satir">
      <input
        v-model.number="udpPort"
        type="number"
        class="bp-giris"
        placeholder="Port (ör: 14550)"
        :disabled="baglaniyor"
        min="1024" max="65535"
      />
    </div>

    <div v-else-if="protokol === 'tcp'" class="bp-param-satir">
      <input
        v-model="tcpHost"
        type="text"
        class="bp-giris bp-host"
        placeholder="Host (ör: 192.168.1.1)"
        :disabled="baglaniyor"
      />
      <input
        v-model.number="tcpPort"
        type="number"
        class="bp-giris bp-kisa"
        placeholder="Port"
        :disabled="baglaniyor"
        min="1" max="65535"
      />
    </div>

    <!-- Satır 3: LED durumu + Bağlan/Kes butonu -->
    <div class="bp-alt-satir">
      <div class="baglanti-durumu" :class="baglantiClass">
        <div class="baglanti-led" />
        <span>{{ baglantiMetni }}</span>
      </div>
      <button
        class="bp-buton"
        :class="aracStore.aracCevrimici ? 'bp-buton-kes' : 'bp-buton-baglan'"
        :disabled="baglaniyor || !baglantiHazir"
        @click="baglantiToggle"
      >
        {{ butonMetni }}
      </button>
    </div>

    <!-- Hata mesajı -->
    <div v-if="gorunenHata" class="bp-hata">{{ gorunenHata }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAracStore } from '@/stores/arac'
import { mavlinkBaglan, mavlinkKes } from '@/libs/mavlink/baglanti'
import { donanımDinleyiciBaslat } from '@/libs/mavlink/donanim-dinleyici'
import { webSerialBaglan, webSerialKes, webSerialDestekleniyor } from '@/libs/mavlink/web-serial-baglanti'

const aracStore = useAracStore()

// ── Protokol Seçenekleri ───────────────────────────────────────────────────────
const protokolSecenekleri = [
  { deger: 'websocket', etiket: 'WebSocket' },
  { deger: 'serial',    etiket: 'Serial'    },
  { deger: 'udp',       etiket: 'UDP'       },
  { deger: 'tcp',       etiket: 'TCP'       },
]
const bantGenilikler = [9600, 57600, 115200, 230400, 460800]

// ── Port Tipi ─────────────────────────────────────────────────────────────────
interface PortBilgisi {
  yol: string; uretici: string; aciklama: string
  vendorId: string; productId: string; cihazTipi: string; pixhawkMu: boolean
}

// ── Yerel State ────────────────────────────────────────────────────────────────
const protokol       = ref<'websocket' | 'serial' | 'udp' | 'tcp'>('websocket')
const portListesi      = ref<PortBilgisi[]>([])
const seciliPort       = ref('')
const portYukleniyor   = ref(false)
let portDegisikligiHandler: ((portlar: PortBilgisi[]) => void) | null = null
const udpPort        = ref(14550)
const tcpHost        = ref('192.168.1.1')
const tcpPort        = ref(5760)
const hataMetni      = ref('')

// WebSocket URL'yi Ayarlar.vue ile paylaşmak için localStorage
const WS_ADRES_KEY = 'tg-ws-adres'
const wsAdres = ref(localStorage.getItem(WS_ADRES_KEY) ?? 'ws://192.168.1.1:6040/ws/mavlink')

// ── Computed ───────────────────────────────────────────────────────────────────
const gorunenHata = computed(() => hataMetni.value || aracStore.baglantiHataMesaji || '')

const elektronModu = computed(() => !!(window as any).toygunAPI?.portListele)

const baglaniyor = computed(() => aracStore.baglantiDurumu === 'baglaniliyor')

const baglantiHazir = computed(() => {
  if (baglaniyor.value) return false
  if (protokol.value === 'serial') return !!seciliPort.value
  return true
})

const baglantiClass = computed(() => ({
  baglandi: aracStore.baglantiDurumu === 'baglandi',
  baglaniliyor: aracStore.baglantiDurumu === 'baglaniliyor',
  kesik: aracStore.baglantiDurumu === 'baglantiKesik',
}))

const baglantiMetni = computed(() => {
  const map: Record<string, string> = {
    baglandi: 'Bağlandı',
    baglaniliyor: 'Bağlanılıyor...',
    baglantiKesik: 'Bağlantı Yok',
  }
  return map[aracStore.baglantiDurumu] ?? 'Bilinmiyor'
})

const butonMetni = computed(() => {
  if (aracStore.aracCevrimici) return 'Kes'
  if (baglaniyor.value) return 'Bağlanıyor...'
  return 'Bağlan'
})

// ── Lifecycle ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  if (elektronModu.value) {
    await portlariYenile()
    donanımDinleyiciBaslat(aracStore)

    // Electron IPC hot-plug dinleyicisi
    const api = (window as any).toygunAPI
    if (api?.onPortDegisikligi) {
      portDegisikligiHandler = (gelenPortlar: PortBilgisi[]) => {
        const onceki = portListesi.value.map(p => p.yol)
        portListesi.value = gelenPortlar

        // Seçili port çıkarıldıysa temizle
        if (seciliPort.value && !gelenPortlar.some(p => p.yol === seciliPort.value)) {
          seciliPort.value = ''
        }

        // Bağlı değilken yeni port gelirse otomatik seç + bildir
        if (!aracStore.aracCevrimici) {
          const yeniPortlar = gelenPortlar.filter(p => !onceki.includes(p.yol))
          if (yeniPortlar.length > 0) {
            const bildirim = (window as any).__toygunBildirim
            yeniPortlar.forEach(p => {
              const ad = p.cihazTipi !== 'Bilinmeyen' ? p.cihazTipi : p.aciklama
              bildirim?.(`Yeni port algılandı: ${p.yol} — ${ad}`, p.pixhawkMu ? 'basari' : 'bilgi')
            })
            portOtomatikSec(gelenPortlar)
          }
        }
      }
      api.onPortDegisikligi(portDegisikligiHandler)
    }
  }

  // Web Serial API hot-plug (Electron + Chrome/Edge)
  if (webSerialDestekleniyor()) {
    const serial = (navigator as any).serial
    const webSerialBaglandi = async () => {
      await portlariYenileWebSerial()
    }
    const webSerialKesik = () => {
      portlariYenileWebSerial()
    }
    serial.addEventListener('connect', webSerialBaglandi)
    serial.addEventListener('disconnect', webSerialKesik)
  }
})

onUnmounted(() => {
  if (portDegisikligiHandler) {
    ;(window as any).toygunAPI?.offPortDegisikligi(portDegisikligiHandler)
    portDegisikligiHandler = null
  }
})

// ── Fonksiyonlar ───────────────────────────────────────────────────────────────
function wsAdresKaydet() {
  localStorage.setItem(WS_ADRES_KEY, wsAdres.value)
}

function portOtomatikSec(liste: PortBilgisi[]) {
  if (seciliPort.value && liste.some(p => p.yol === seciliPort.value)) return // mevcut seçim hâlâ geçerli
  // Önce Pixhawk, bulamazsan ilk portu seç
  const hedef = liste.find(p => p.pixhawkMu) ?? liste[0]
  if (hedef) seciliPort.value = hedef.yol
}

async function portlariYenile() {
  if (!elektronModu.value) return
  try {
    portListesi.value = await (window as any).toygunAPI.portListele()
    portOtomatikSec(portListesi.value)
  } catch {
    portListesi.value = []
  }
}

async function portlariYenileManuel() {
  portYukleniyor.value = true
  await portlariYenile()
  await portlariYenileWebSerial()
  portYukleniyor.value = false
}

// Web Serial API port listesi — izin verilmiş portları getir
async function portlariYenileWebSerial() {
  if (!webSerialDestekleniyor()) return
  try {
    const serial = (navigator as any).serial
    const portlar: any[] = await serial.getPorts()
    const yeniListe: PortBilgisi[] = portlar.map((p: any) => {
      const info = p.getInfo()
      const vid = (info.usbVendorId  ?? 0).toString(16).padStart(4, '0')
      const pid = (info.usbProductId ?? 0).toString(16).padStart(4, '0')
      // VID/PID eşleştirmesi için mevcut portListesi'nden cihaz adını bul
      const eslesen = portListesi.value.find(e => e.vendorId === vid && e.productId === pid)
      return {
        yol:        eslesen?.yol      ?? `VID:${vid} PID:${pid}`,
        uretici:    '',
        aciklama:   eslesen?.aciklama ?? `${vid}:${pid}`,
        vendorId:   vid,
        productId:  pid,
        cihazTipi:  eslesen?.cihazTipi ?? 'Bilinmeyen',
        pixhawkMu:  eslesen?.pixhawkMu ?? false,
      }
    })
    // WMI listesiyle birleştir — tekrar eklenmesin
    for (const p of yeniListe) {
      if (!portListesi.value.some(e => e.vendorId === p.vendorId && e.productId === p.productId)) {
        portListesi.value.push(p)
      }
    }
    if (!seciliPort.value) {
      const px = portListesi.value.find(p => p.pixhawkMu)
      if (px) {
        seciliPort.value = px.yol
        ;(window as any).__toygunBildirim?.(`Pixhawk algılandı: ${px.yol}`, 'basari')
      }
    }
  } catch { /* izin verilmemiş — atla */ }
}

function protokolDegisti() {
  hataMetni.value = ''
  // Protokol değiştiğinde store'u güncelle
  aracStore.baglantiProtokolu = protokol.value
}

async function baglantiToggle() {
  hataMetni.value = ''
  aracStore.baglantiHataMesaji = null

  if (aracStore.aracCevrimici) {
    await baglantiyi_kes()
    return
  }

  aracStore.baglan()
  aracStore.baglantiProtokolu = protokol.value

  try {
    if (protokol.value === 'websocket') {
      mavlinkBaglan({ wsUrl: wsAdres.value })

    } else if (protokol.value === 'serial') {
      if (!seciliPort.value) { hataMetni.value = 'Lütfen bir COM port seçin.'; aracStore.baglantiyiKes(); return }

      // 1. Önce Electron IPC (native serialport) dene
      let ipcBasarili = false
      if (elektronModu.value) {
        const sonuc = await (window as any).toygunAPI.serialBaglan(seciliPort.value, aracStore.bantGenisligi)
        ipcBasarili = sonuc.basarili
      }

      // 2. Native modül yoksa veya web modundaysak → Web Serial API
      if (!ipcBasarili) {
        if (!webSerialDestekleniyor()) {
          hataMetni.value = 'Seri port için Electron veya Chrome/Edge gerekli.'
          aracStore.baglantiyiKes()
          return
        }
        const port = portListesi.value.find(p => p.yol === seciliPort.value)
        const wsResult = await webSerialBaglan(
          aracStore.bantGenisligi,
          port?.vendorId  || undefined,
          port?.productId || undefined,
        )
        if (!wsResult.basarili) {
          hataMetni.value = wsResult.hata ?? 'Serial bağlantı hatası'
          aracStore.baglantiyiKes()
        }
      }

    } else if (protokol.value === 'udp') {
      const sonuc = await (window as any).toygunAPI.udpBaglan(udpPort.value)
      if (!sonuc.basarili) {
        hataMetni.value = sonuc.hata ?? 'UDP bağlantı hatası'
        aracStore.baglantiyiKes()
      }
    } else if (protokol.value === 'tcp') {
      const sonuc = await (window as any).toygunAPI.tcpBaglan(tcpHost.value, tcpPort.value)
      if (!sonuc.basarili) {
        hataMetni.value = sonuc.hata ?? 'TCP bağlantı hatası'
        aracStore.baglantiyiKes()
      }
    }
  } catch (hata: any) {
    hataMetni.value = hata.message ?? 'Bağlantı hatası'
    aracStore.baglantiyiKes()
  }
}

async function baglantiyi_kes() {
  webSerialKes()
  if (protokol.value === 'websocket') {
    mavlinkKes()
  } else {
    try { await (window as any).toygunAPI?.donanımKes() } catch { /* ignore */ }
  }
  aracStore.baglantiyiKes()
}
</script>

<style scoped>
.baglanti-paneli {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.bp-satirlar,
.bp-param-satir {
  display: flex;
  gap: 4px;
}

.bp-secim {
  padding: 3px 6px;
  background: var(--tg-input-bg);
  border: 1px solid var(--tg-input-border);
  border-radius: 4px;
  color: var(--tg-metin);
  font-size: 11px;
  outline: none;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  flex: 1;
  transition: border-color 0.15s;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='rgba(255,255,255,0.2)'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  padding-right: 20px;
}

.bp-secim.bp-bant { flex: 0 0 80px; }
.bp-secim.bp-port { flex: 1; }

.bp-secim:focus { border-color: var(--tg-turuncu); }
.bp-secim:disabled { opacity: 0.5; cursor: not-allowed; }
.bp-secim option { background: var(--tg-select-bg); color: var(--tg-metin); }

.bp-giris {
  padding: 3px 6px;
  background: var(--tg-input-bg);
  border: 1px solid var(--tg-input-border);
  border-radius: 4px;
  color: var(--tg-metin);
  font-size: 11px;
  outline: none;
  font-family: 'Inter', sans-serif;
  flex: 1;
  transition: border-color 0.15s;
}

.bp-giris:focus { border-color: var(--tg-turuncu); }
.bp-giris:disabled { opacity: 0.5; }
.bp-giris.bp-host { flex: 2; }
.bp-giris.bp-kisa { flex: 1; min-width: 60px; }

.bp-yenile-buton {
  padding: 2px 7px;
  background: var(--tg-input-bg);
  border: 1px solid var(--tg-input-border);
  border-radius: 4px;
  color: var(--tg-metin-soluk);
  cursor: pointer;
  font-size: 13px;
  flex-shrink: 0;
  transition: all 0.15s;
}

.bp-yenile-buton:hover:not(:disabled) {
  border-color: var(--tg-turuncu);
  color: var(--tg-turuncu);
}

.bp-yenile-ikon { display: inline-block; }
.bp-yenile-buton:not(:disabled):active .bp-yenile-ikon { transform: rotate(180deg); }
.bp-yenile-spin .bp-yenile-ikon { animation: spin 0.6s linear infinite; }

@keyframes spin {
  from { display: inline-block; transform: rotate(0deg); }
  to   { display: inline-block; transform: rotate(360deg); }
}

.bp-alt-satir {
  display: flex;
  align-items: center;
  gap: 6px;
}

.baglanti-durumu {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 500;
  flex: 1;
}

.baglanti-led {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background 0.3s;
}

.baglandi .baglanti-led       { background: var(--tg-basari); box-shadow: 0 0 5px var(--tg-basari); }
.baglaniliyor .baglanti-led   { background: var(--tg-uyari); animation: pulse 1s infinite; }
.kesik .baglanti-led          { background: var(--tg-tehlike); }
.baglandi                     { color: var(--tg-basari); }
.baglaniliyor                 { color: var(--tg-uyari); }
.kesik                        { color: var(--tg-metin-soluk); }

.bp-buton {
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  border: 1px solid;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  font-family: 'Inter', sans-serif;
  flex-shrink: 0;
}

.bp-buton:disabled { opacity: 0.5; cursor: not-allowed; }

.bp-buton-baglan {
  background: rgba(71, 199, 252, 0.12);
  border-color: rgba(71, 199, 252, 0.3);
  color: var(--tg-cyan);
}
.bp-buton-baglan:hover:not(:disabled) {
  background: rgba(71, 199, 252, 0.25);
  border-color: rgba(71, 199, 252, 0.5);
}

.bp-buton-kes {
  background: rgba(220, 38, 38, 0.12);
  border-color: rgba(220, 38, 38, 0.3);
  color: var(--tg-tehlike);
}
.bp-buton-kes:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.25);
  border-color: rgba(220, 38, 38, 0.5);
}

.bp-hata {
  font-size: 10px;
  color: var(--tg-tehlike);
  padding: 2px 0;
}

@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
</style>
