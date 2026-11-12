<template>
  <div class="gelistirici-paneli">
    <!-- Üst: Geliştirici Seçenekleri -->
    <div class="gp-ust">
      <div class="gp-togglelar">
        <div class="gp-toggle-item">
          <span>Geliştirici modu</span>
          <v-switch v-model="gelistiriciModu" density="compact" hide-details color="#FF8000" />
        </div>
        <div class="gp-toggle-item">
          <span>Sistem loglama</span>
          <v-switch v-model="sistemLoglama" density="compact" hide-details color="#FF8000" />
        </div>
        <div class="gp-toggle-item">
          <span>Kullanım istatistikleri</span>
          <v-switch v-model="kullanimIstatistik" density="compact" hide-details color="#FF8000" />
        </div>
        <div class="gp-toggle-item">
          <span>Açılış ekranını göster</span>
          <v-switch v-model="acilisEkrani" density="compact" hide-details color="#FF8000" />
        </div>
      </div>

      <div class="gp-slider-satir">
        <span class="gp-slider-etiket">Dev info blur level</span>
        <input v-model.number="blurSeviye" type="range" min="0" max="20" class="gp-slider" />
        <span class="gp-slider-deger">{{ blurSeviye }}</span>
      </div>
    </div>

    <v-divider class="my-2" style="border-color: var(--tg-divider)" />

    <!-- Sistem Logları -->
    <div class="gp-loglar">
      <div class="gp-loglar-baslik">
        <h4>
          <v-icon size="16" class="mr-1">mdi-file-document-outline</v-icon>
          Sistem Logları
        </h4>
        <div class="gp-log-eylemler">
          <button class="tg-buton tg-buton-cam gp-kucuk-btn" @click="tumunuIndir" title="Tümünü İndir">
            <v-icon size="14">mdi-download</v-icon>
          </button>
          <button class="tg-buton tg-buton-cam gp-kucuk-btn" @click="temizleOnayi = true" title="Tümünü Sil">
            <v-icon size="14">mdi-delete-outline</v-icon>
          </button>
        </div>
      </div>

      <!-- Log Tablosu -->
      <div class="gp-tablo-container">
        <table class="gp-tablo">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Saat</th>
              <th>Tarih</th>
              <th>Olay</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="gorunenLoglar.length === 0">
              <td colspan="5" class="gp-tablo-bos">Kayıtlı log bulunamadı.</td>
            </tr>
            <tr v-for="log in gorunenLoglar" :key="log.id">
              <td class="gp-log-adi">{{ log.ad }}</td>
              <td>{{ log.saat }}</td>
              <td>{{ log.tarih }}</td>
              <td>{{ log.olaylar }}</td>
              <td class="gp-islem-hucre">
                <button class="gp-islem-btn" title="İndir" @click="logIndir(log)">
                  <v-icon size="14">mdi-download</v-icon>
                </button>
                <button class="gp-islem-btn gp-sil-btn" title="Sil" @click="logSil(log.id)">
                  <v-icon size="14">mdi-delete</v-icon>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Sayfalama -->
      <div class="gp-sayfalama">
        <div class="gp-sayfa-boyut">
          <span>Sayfa başına:</span>
          <select v-model.number="sayfaBoyutu" class="gp-select">
            <option :value="5">5</option>
            <option :value="10">10</option>
            <option :value="25">25</option>
          </select>
        </div>
        <div class="gp-sayfa-bilgi">
          {{ (mevcutSayfa - 1) * sayfaBoyutu + 1 }}-{{ Math.min(mevcutSayfa * sayfaBoyutu, loglar.length) }}
          / {{ loglar.length }}
        </div>
        <div class="gp-sayfa-nav">
          <button class="gp-nav-btn" :disabled="mevcutSayfa <= 1" @click="mevcutSayfa = 1">
            <v-icon size="14">mdi-page-first</v-icon>
          </button>
          <button class="gp-nav-btn" :disabled="mevcutSayfa <= 1" @click="mevcutSayfa--">
            <v-icon size="14">mdi-chevron-left</v-icon>
          </button>
          <button class="gp-nav-btn" :disabled="mevcutSayfa >= toplamSayfa" @click="mevcutSayfa++">
            <v-icon size="14">mdi-chevron-right</v-icon>
          </button>
          <button class="gp-nav-btn" :disabled="mevcutSayfa >= toplamSayfa" @click="mevcutSayfa = toplamSayfa">
            <v-icon size="14">mdi-page-last</v-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- Silme Onay Diyalogu -->
    <teleport to="body">
      <div v-if="temizleOnayi" class="gp-onay-arka" @click.self="temizleOnayi = false">
        <div class="gp-onay-kutu cam-panel-koyu">
          <h4>Tüm logları sil?</h4>
          <p>Bu işlem geri alınamaz. Tüm sistem logları kalıcı olarak silinecektir.</p>
          <div class="gp-onay-butonlar">
            <button class="tg-buton tg-buton-cam" @click="temizleOnayi = false">İptal</button>
            <button class="tg-buton" style="background: var(--tg-tehlike); color: #fff" @click="tumunuSil">Tümünü Sil</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const gelistiriciModu = ref(false)
const sistemLoglama = ref(true)
const kullanimIstatistik = ref(false)
const acilisEkrani = ref(true)
const blurSeviye = ref(5)

const mevcutSayfa = ref(1)
const sayfaBoyutu = ref(10)
const temizleOnayi = ref(false)

interface SistemLog {
  id: string
  ad: string
  saat: string
  tarih: string
  olaylar: number
}

const loglar = ref<SistemLog[]>([])

// Başlangıç logları oluştur
onMounted(() => {
  const simdi = new Date()
  const ornekLoglar: SistemLog[] = []

  for (let i = 0; i < 12; i++) {
    const zaman = new Date(simdi.getTime() - i * 15 * 60 * 1000)
    const saatStr = zaman.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const tarihStr = zaman.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })

    ornekLoglar.push({
      id: `log-${i}`,
      ad: `Toygun (${tarihStr} - ${saatStr}).syslog`,
      saat: saatStr,
      tarih: tarihStr,
      olaylar: Math.floor(Math.random() * 1200) + 50,
    })
  }

  loglar.value = ornekLoglar
})

const toplamSayfa = computed(() => Math.max(1, Math.ceil(loglar.value.length / sayfaBoyutu.value)))

const gorunenLoglar = computed(() => {
  const baslangic = (mevcutSayfa.value - 1) * sayfaBoyutu.value
  return loglar.value.slice(baslangic, baslangic + sayfaBoyutu.value)
})

// Log işlem fonksiyonları
const logIndir = (log: SistemLog) => {
  const icerik = JSON.stringify({
    ad: log.ad,
    saat: log.saat,
    tarih: log.tarih,
    olaylar: log.olaylar,
    veriler: `[${log.olaylar} olay kaydı]`,
  }, null, 2)

  const blob = new Blob([icerik], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = log.ad.replace('.syslog', '.json')
  a.click()
  URL.revokeObjectURL(url)

  const bildirim = (window as any).__toygunBildirim
  if (bildirim) bildirim(`${log.ad} indirildi`, 'basari')
}

const logSil = (id: string) => {
  loglar.value = loglar.value.filter(l => l.id !== id)
  if (mevcutSayfa.value > toplamSayfa.value) mevcutSayfa.value = toplamSayfa.value

  const bildirim = (window as any).__toygunBildirim
  if (bildirim) bildirim('Log silindi', 'basari')
}

const tumunuIndir = () => {
  const icerik = JSON.stringify(loglar.value, null, 2)
  const blob = new Blob([icerik], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `toygun-loglar-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)

  const bildirim = (window as any).__toygunBildirim
  if (bildirim) bildirim('Tüm loglar indirildi', 'basari')
}

const tumunuSil = () => {
  loglar.value = []
  mevcutSayfa.value = 1
  temizleOnayi.value = false

  const bildirim = (window as any).__toygunBildirim
  if (bildirim) bildirim('Tüm loglar silindi', 'basari')
}
</script>

<style scoped>
.gelistirici-paneli {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow-y: auto;
}

.gp-ust { margin-bottom: 8px; }

.gp-togglelar {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 24px;
}

.gp-toggle-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--tg-metin);
  padding: 2px 0;
}

.gp-slider-satir {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.gp-slider-etiket {
  font-size: 12px;
  color: var(--tg-metin-soluk);
  white-space: nowrap;
}

.gp-slider {
  flex: 1;
  appearance: none;
  height: 4px;
  background: var(--tg-hover-bg-2);
  border-radius: 2px;
  outline: none;
  max-width: 200px;
}

.gp-slider::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--tg-turuncu);
  cursor: pointer;
}

.gp-slider-deger {
  font-size: 11px;
  color: var(--tg-turuncu);
  font-weight: 600;
  min-width: 20px;
}

/* Loglar */
.gp-loglar {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.gp-loglar-baslik {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.gp-loglar-baslik h4 {
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-metin);
}

.gp-log-eylemler {
  display: flex;
  gap: 4px;
}

.gp-kucuk-btn {
  padding: 4px 6px !important;
  min-width: 0 !important;
}

/* Tablo */
.gp-tablo-container {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--tg-divider);
  border-radius: 6px;
}

.gp-tablo {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.gp-tablo thead {
  position: sticky;
  top: 0;
  z-index: 1;
}

.gp-tablo th {
  padding: 8px 12px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: var(--tg-metin-soluk);
  background: var(--tg-subtle-bg);
  border-bottom: 1px solid var(--tg-divider);
  white-space: nowrap;
}

.gp-tablo td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--tg-divider);
  color: var(--tg-metin);
  white-space: nowrap;
}

.gp-tablo tr:hover td {
  background: var(--tg-subtle-bg);
}

.gp-log-adi {
  font-family: 'Roboto Mono', monospace;
  font-size: 11px !important;
  color: var(--tg-metin-soluk) !important;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gp-tablo-bos {
  text-align: center !important;
  color: var(--tg-metin-cok-soluk) !important;
  padding: 24px 12px !important;
  font-style: italic;
}

.gp-islem-hucre {
  display: flex;
  gap: 4px;
}

.gp-islem-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  background: var(--tg-hover-bg);
  color: var(--tg-metin-soluk);
  cursor: pointer;
  transition: all 0.15s;
}

.gp-islem-btn:hover {
  background: var(--tg-hover-bg-2);
  color: var(--tg-metin);
}

.gp-sil-btn:hover {
  background: rgba(255, 50, 50, 0.15);
  color: var(--tg-tehlike);
}

/* Sayfalama */
.gp-sayfalama {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0 0;
  font-size: 11px;
  color: var(--tg-metin-soluk);
}

.gp-sayfa-boyut {
  display: flex;
  align-items: center;
  gap: 6px;
}

.gp-select {
  background: var(--tg-hover-bg);
  border: 1px solid var(--tg-input-border);
  border-radius: 4px;
  color: var(--tg-metin);
  padding: 2px 6px;
  font-size: 11px;
  outline: none;
}

.gp-sayfa-nav {
  display: flex;
  gap: 2px;
}

.gp-nav-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  background: var(--tg-subtle-bg);
  color: var(--tg-metin-soluk);
  cursor: pointer;
  transition: all 0.15s;
}

.gp-nav-btn:hover:not(:disabled) {
  background: var(--tg-hover-bg-2);
  color: var(--tg-metin);
}

.gp-nav-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

/* Onay diyalogu */
.gp-onay-arka {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 4000;
}

.gp-onay-kutu {
  width: 380px;
  padding: 24px;
  text-align: center;
}

.gp-onay-kutu h4 {
  font-size: 15px;
  margin-bottom: 8px;
}

.gp-onay-kutu p {
  font-size: 12px;
  color: var(--tg-metin-soluk);
  margin-bottom: 16px;
}

.gp-onay-butonlar {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.my-2 { margin: 8px 0; }
</style>
