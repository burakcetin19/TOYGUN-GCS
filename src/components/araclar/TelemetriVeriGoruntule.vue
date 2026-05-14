<template>
  <div class="telemetri-veri-paneli">
    <!-- Sol: Değişken kategorileri -->
    <div class="tv-sol">
      <h4 class="tv-bolum-baslik">Ekran Telemetri Verisi</h4>

      <!-- Frekans ayarı -->
      <div class="tv-frekans">
        <label class="tv-etiket">Güncelleme sıklığı</label>
        <div class="tv-slider-satir">
          <input v-model.number="frekans" type="range" min="1" max="30" class="tv-slider" />
          <span class="tv-slider-deger">{{ frekans }} Hz</span>
        </div>
      </div>

      <!-- Kategoriler -->
      <div v-for="kat in kategoriler" :key="kat.id" class="tv-kategori">
        <div class="tv-kat-baslik" @click="kat.acik = !kat.acik">
          <v-icon size="14">{{ kat.acik ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
          <span>{{ kat.baslik }}</span>
        </div>
        <div v-if="kat.acik" class="tv-degisken-listesi">
          <div
            v-for="deg in kat.degiskenler"
            :key="deg.id"
            class="tv-degisken"
            :class="{ 'tv-degisken-aktif': aktifDegiskenler.has(deg.id) }"
            @click="degiskenToggle(deg.id)"
          >
            <v-icon size="12">{{ aktifDegiskenler.has(deg.id) ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline' }}</v-icon>
            <span>{{ deg.ad }}</span>
          </div>
        </div>
      </div>

      <button class="tg-buton tg-buton-cam tv-sifirla-btn" @click="aktifDegiskenler.clear()">
        <v-icon size="14" class="mr-1">mdi-refresh</v-icon>
        KONUMLARI SIFIRLA
      </button>
    </div>

    <!-- Sağ: Grafik alanı -->
    <div class="tv-sag">
      <!-- Aktif etiketler -->
      <div class="tv-etiketler">
        <span
          v-for="degId in aktifDegiskenler"
          :key="degId"
          class="tv-etiket-chip"
          :style="{ borderColor: degiskenRenk(degId) }"
        >
          {{ degiskenAd(degId) }}
          <v-icon size="12" class="tv-etiket-sil" @click="aktifDegiskenler.delete(degId)">mdi-close</v-icon>
        </span>
      </div>

      <!-- Grafikler -->
      <div v-if="aktifDegiskenler.size === 0" class="tv-bos">
        <v-icon size="40" color="rgba(255,255,255,0.08)">mdi-chart-line</v-icon>
        <p>Sol panelden değişken seçerek grafik ekleyin</p>
      </div>

      <div v-else class="tv-grafik-alani">
        <div v-for="degId in aktifDegiskenler" :key="degId" class="tv-grafik-kart">
          <div class="tv-grafik-baslik">
            <span class="tv-grafik-adi" :style="{ color: degiskenRenk(degId) }">{{ degiskenAd(degId) }}</span>
            <span class="tv-grafik-deger">{{ sonDeger(degId) }}</span>
          </div>
          <canvas :ref="el => canvasRefs[degId] = el as HTMLCanvasElement" class="tv-canvas" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useAracStore } from '@/stores/arac'

const aracStore = useAracStore()
const frekans = ref(5)
const aktifDegiskenler = reactive(new Set<string>())
const canvasRefs: Record<string, HTMLCanvasElement | null> = {}

// Zaman serisi verileri
const veriTarihcesi: Record<string, number[]> = {}
const MAX_VERI = 120

interface Degisken {
  id: string
  ad: string
  birim: string
  deger: () => number
  renk: string
}

interface Kategori {
  id: string
  baslik: string
  acik: boolean
  degiskenler: Degisken[]
}

const tumDegiskenler: Degisken[] = [
  // Uçuş
  { id: 'yer_hizi', ad: 'Yer Hızı', birim: 'm/s', deger: () => aracStore.yerHizi, renk: '#47C7FC' },
  { id: 'hava_hizi', ad: 'Hava Hızı', birim: 'm/s', deger: () => aracStore.havaHizi, renk: '#3B9FD4' },
  { id: 'yukseklik', ad: 'Yükseklik (MSL)', birim: 'm', deger: () => aracStore.yukseklik, renk: '#22c55e' },
  { id: 'yapi_yukseklik', ad: 'Yükseklik (AGL)', birim: 'm', deger: () => aracStore.yapiYukseklik, renk: '#16a34a' },
  { id: 'heading', ad: 'Heading', birim: '°', deger: () => aracStore.heading, renk: '#FF8000' },
  // Tutum
  { id: 'pitch', ad: 'Pitch', birim: '°', deger: () => aracStore.pitch, renk: '#e879f9' },
  { id: 'roll', ad: 'Roll', birim: '°', deger: () => aracStore.roll, renk: '#c084fc' },
  { id: 'yaw', ad: 'Yaw', birim: '°', deger: () => aracStore.yaw, renk: '#a855f7' },
  // Batarya
  { id: 'bat_voltaj', ad: 'Batarya Voltaj', birim: 'V', deger: () => aracStore.bataryaVoltaj, renk: '#facc15' },
  { id: 'bat_akim', ad: 'Batarya Akım', birim: 'A', deger: () => aracStore.bataryaAkim, renk: '#f59e0b' },
  { id: 'bat_yuzde', ad: 'Batarya %', birim: '%', deger: () => aracStore.bataryaYuzde, renk: '#eab308' },
  // GPS
  { id: 'gps_sayisi', ad: 'GPS Uydu', birim: '', deger: () => aracStore.gpsSayisi, renk: '#34d399' },
  { id: 'gps_hdop', ad: 'GPS HDOP', birim: '', deger: () => aracStore.gpsHdop, renk: '#6ee7b7' },
  { id: 'enlem', ad: 'Enlem', birim: '°', deger: () => aracStore.enlem, renk: '#67e8f9' },
  { id: 'boylam', ad: 'Boylam', birim: '°', deger: () => aracStore.boylam, renk: '#22d3ee' },
]

const kategoriler = reactive<Kategori[]>([
  {
    id: 'ucus', baslik: 'Uçuş Değişkenleri', acik: true,
    degiskenler: tumDegiskenler.filter(d => ['yer_hizi', 'hava_hizi', 'yukseklik', 'yapi_yukseklik', 'heading'].includes(d.id)),
  },
  {
    id: 'tutum', baslik: 'Tutum (Attitude)', acik: false,
    degiskenler: tumDegiskenler.filter(d => ['pitch', 'roll', 'yaw'].includes(d.id)),
  },
  {
    id: 'batarya', baslik: 'Batarya', acik: false,
    degiskenler: tumDegiskenler.filter(d => d.id.startsWith('bat_')),
  },
  {
    id: 'gps', baslik: 'GPS / Konum', acik: false,
    degiskenler: tumDegiskenler.filter(d => ['gps_sayisi', 'gps_hdop', 'enlem', 'boylam'].includes(d.id)),
  },
])

const degiskenToggle = (id: string) => {
  if (aktifDegiskenler.has(id)) {
    aktifDegiskenler.delete(id)
    delete veriTarihcesi[id]
  } else {
    aktifDegiskenler.add(id)
    veriTarihcesi[id] = []
  }
}

const degiskenBul = (id: string) => tumDegiskenler.find(d => d.id === id)
const degiskenAd = (id: string) => degiskenBul(id)?.ad ?? id
const degiskenRenk = (id: string) => degiskenBul(id)?.renk ?? '#ffffff'

const sonDeger = (id: string) => {
  const deg = degiskenBul(id)
  if (!deg || !aracStore.aracCevrimici) return '—'
  return `${deg.deger().toFixed(2)} ${deg.birim}`
}

// Canvas grafik çizimi
const grafikCiz = (degId: string) => {
  const canvas = canvasRefs[degId]
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * 2
  canvas.height = rect.height * 2
  ctx.scale(2, 2)

  const w = rect.width
  const h = rect.height
  const veri = veriTarihcesi[degId] ?? []
  const renk = degiskenRenk(degId)

  // Arkaplan
  ctx.clearRect(0, 0, w, h)

  // Izgaralar
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 0.5
  for (let i = 0; i < 5; i++) {
    const y = (h / 5) * i
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }

  if (veri.length < 2) return

  const min = Math.min(...veri) - 1
  const max = Math.max(...veri) + 1
  const aralik = max - min || 1

  // Min/Max etiketleri
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.font = '9px Inter'
  ctx.fillText(max.toFixed(1), 2, 10)
  ctx.fillText(min.toFixed(1), 2, h - 3)

  // Çizgi grafiği
  ctx.strokeStyle = renk
  ctx.lineWidth = 1.5
  ctx.lineJoin = 'round'
  ctx.beginPath()

  const adim = w / (MAX_VERI - 1)
  const baslangic = MAX_VERI - veri.length

  for (let i = 0; i < veri.length; i++) {
    const x = (baslangic + i) * adim
    const y = h - ((veri[i] - min) / aralik) * (h - 16) - 8
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Dolgu gradyan
  const son = veri.length - 1
  const sonX = (baslangic + son) * adim
  const sonY = h - ((veri[son] - min) / aralik) * (h - 16) - 8

  ctx.lineTo(sonX, h)
  ctx.lineTo((baslangic) * adim, h)
  ctx.closePath()

  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, renk + '30')
  grad.addColorStop(1, renk + '05')
  ctx.fillStyle = grad
  ctx.fill()
}

// Güncelleme döngüsü
let zamanlayici: ReturnType<typeof setInterval> | null = null

const guncellemeBaslat = () => {
  if (zamanlayici) clearInterval(zamanlayici)
  zamanlayici = setInterval(() => {
    for (const degId of aktifDegiskenler) {
      const deg = degiskenBul(degId)
      if (!deg) continue

      if (!veriTarihcesi[degId]) veriTarihcesi[degId] = []
      veriTarihcesi[degId].push(aracStore.aracCevrimici ? deg.deger() : 0)

      if (veriTarihcesi[degId].length > MAX_VERI) {
        veriTarihcesi[degId].shift()
      }

      nextTick(() => grafikCiz(degId))
    }
  }, 1000 / frekans.value)
}

watch(frekans, guncellemeBaslat)
watch(() => aktifDegiskenler.size, () => nextTick(guncellemeBaslat))

onMounted(guncellemeBaslat)
onUnmounted(() => { if (zamanlayici) clearInterval(zamanlayici) })
</script>

<style scoped>
.telemetri-veri-paneli {
  display: flex;
  height: 100%;
  gap: 1px;
}

.tv-sol {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.2);
  padding: 14px;
  overflow-y: auto;
}

.tv-sag {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.15);
  padding: 14px;
  overflow-y: auto;
}

.tv-bolum-baslik {
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-metin);
  margin-bottom: 12px;
}

.tv-frekans {
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.tv-etiket {
  font-size: 10px;
  color: var(--tg-metin-soluk);
  display: block;
  margin-bottom: 4px;
}

.tv-slider-satir {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tv-slider {
  flex: 1;
  appearance: none;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  outline: none;
}

.tv-slider::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--tg-turuncu);
  cursor: pointer;
}

.tv-slider-deger {
  font-size: 11px;
  font-weight: 600;
  color: var(--tg-turuncu);
  min-width: 36px;
  text-align: right;
}

.tv-kategori {
  margin-bottom: 4px;
}

.tv-kat-baslik {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--tg-metin);
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s;
}

.tv-kat-baslik:hover {
  background: rgba(255, 255, 255, 0.04);
}

.tv-degisken-listesi {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-left: 8px;
  margin-bottom: 4px;
}

.tv-degisken {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  font-size: 11px;
  color: var(--tg-metin-soluk);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
}

.tv-degisken:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--tg-metin);
}

.tv-degisken-aktif {
  color: var(--tg-turuncu) !important;
}

.tv-sifirla-btn {
  margin-top: auto;
  font-size: 10px !important;
  padding: 6px !important;
}

/* Sağ: Etiketler ve Grafikler */
.tv-etiketler {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
  min-height: 28px;
}

.tv-etiket-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  color: var(--tg-metin);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid;
}

.tv-etiket-sil {
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.15s;
}

.tv-etiket-sil:hover {
  opacity: 1;
}

.tv-bos {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--tg-metin-cok-soluk);
  font-size: 13px;
}

.tv-grafik-alani {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  align-content: start;
}

.tv-grafik-kart {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  overflow: hidden;
}

.tv-grafik-baslik {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.tv-grafik-adi {
  font-size: 11px;
  font-weight: 600;
}

.tv-grafik-deger {
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--tg-metin);
}

.tv-canvas {
  width: 100%;
  height: 80px;
  display: block;
}
</style>
