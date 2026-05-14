<template>
  <aside class="yan-bar cam-panel-koyu">
    <div class="yan-bar-ust">
      <button
        v-for="madde in maddeler"
        :key="madde.id"
        class="yan-buton"
        :class="{ 'yan-buton-aktif': aktifId === madde.id }"
        :title="madde.baslik"
        @click="tiklandi(madde.id)"
      >
        <v-icon size="20">{{ madde.ikon }}</v-icon>
      </button>
    </div>

    <div class="yan-bar-alt">
      <!-- Ayarlar Alt Menü -->
      <transition name="alt-menu-gecis">
        <div v-if="ayarlarAcik" class="ayarlar-alt-menu">
          <button class="yan-buton" title="Akıllı Telemetri / Veri" @click="telemetriGoster = true">
            <v-icon size="18">mdi-chart-line</v-icon>
          </button>
          <button class="yan-buton" title="Geliştirici Ayarları" @click="gelistiriciGoster = true">
            <v-icon size="18" style="font-weight: 900; font-family: 'Inter', sans-serif; font-size: 11px;">DEV</v-icon>
          </button>
          <button class="yan-buton" title="Genel Ayarlar" @click="$router.push('/ayarlar')">
            <v-icon size="18">mdi-tune</v-icon>
          </button>
        </div>
      </transition>
      <button
        class="yan-buton"
        :class="{ 'yan-buton-aktif': ayarlarAcik }"
        title="Ayarlar"
        @click="ayarlarAcik = !ayarlarAcik"
      >
        <v-icon size="20">mdi-cog</v-icon>
      </button>
    </div>
  </aside>

  <!-- Bağlantılar Paneli -->
  <teleport to="body">
    <BaglantilarPaneli v-if="baglantilarGoster" @kapat="baglantilarGoster = false" />
  </teleport>

  <!-- Kamera Ayarları Paneli -->
  <teleport to="body">
    <div v-if="kameraAyarlariGoster" class="diyalog-arka" @click.self="kameraAyarlariGoster = false">
      <div class="ayar-diyalog cam-panel-koyu">
        <div class="diyalog-ust">
          <h3>Video Yapılandırması</h3>
          <v-btn icon="mdi-close" size="small" variant="text" @click="kameraAyarlariGoster = false" />
        </div>

        <div class="ayar-bolum">
          <h4 class="bolum-baslik">
            <v-icon size="16" class="mr-1">mdi-video-input-antenna</v-icon>
            Akış Kaynakları
          </h4>
          <div class="akis-tablo">
            <div class="akis-baslik-satir">
              <span>Ad</span>
              <span>Kaynak</span>
              <span>Çözünürlük</span>
              <span>Durum</span>
            </div>
            <div v-if="akislar.length === 0" class="akis-bos">
              Kullanılabilir akış bulunamadı.
            </div>
            <div v-for="akis in akislar" :key="akis.ad" class="akis-satir">
              <span>{{ akis.ad }}</span>
              <span>{{ akis.kaynak }}</span>
              <span>{{ akis.cozunurluk }}</span>
              <span :class="akis.aktif ? 'durum-aktif' : 'durum-inaktif'">
                {{ akis.aktif ? 'Aktif' : 'Kapalı' }}
              </span>
            </div>
          </div>
          <div class="akis-ekle">
            <input v-model="yeniAkisUrl" type="text" class="panel-giris" placeholder="rtsp:// veya http:// akış adresi" />
            <button class="tg-buton tg-buton-turuncu" @click="akisEkle">
              <v-icon size="14">mdi-plus</v-icon> Ekle
            </button>
          </div>
        </div>

        <v-divider class="my-3" style="border-color: var(--tg-divider)" />

        <div class="ayar-bolum">
          <h4 class="bolum-baslik">
            <v-icon size="16" class="mr-1">mdi-web</v-icon>
            WebRTC Ayarları
          </h4>
          <div class="ayar-satir">
            <label class="ayar-etiket">İzin Verilen IP Adresleri</label>
            <input v-model="webrtcIP" type="text" class="panel-giris" placeholder="192.168.1.1, 10.0.0.1" />
          </div>
          <div class="ayar-satir protokol-satir">
            <label class="ayar-etiket">İzin Verilen Protokoller:</label>
            <div class="onay-grup">
              <label class="onay-etiket"><input v-model="udpAktif" type="checkbox" /> UDP</label>
              <label class="onay-etiket"><input v-model="tcpAktif" type="checkbox" /> TCP</label>
            </div>
          </div>
          <div class="ayar-satir">
            <label class="ayar-etiket">RTP Jitter Buffer (ms)</label>
            <input v-model.number="jitterBuffer" type="number" class="panel-giris kisa" />
          </div>
        </div>
      </div>
    </div>
  </teleport>

  <!-- Görev Yapılandırması Paneli -->
  <teleport to="body">
    <div v-if="gorevAyarlariGoster" class="diyalog-arka" @click.self="gorevAyarlariGoster = false">
      <div class="ayar-diyalog cam-panel-koyu">
        <div class="diyalog-ust">
          <h3>Görev Yapılandırması</h3>
          <v-btn icon="mdi-close" size="small" variant="text" @click="gorevAyarlariGoster = false" />
        </div>
        <div class="ayar-bolum">
          <div class="toggle-grup">
            <div class="toggle-satir"><span>Ön-arm kontrol listesi</span><v-switch v-model="onArmKontrol" density="compact" hide-details color="#FF8000" /></div>
            <div class="toggle-satir"><span>Kaydırarak onayla</span><v-switch v-model="kaydirOnayla" density="compact" hide-details color="#FF8000" /></div>
            <div class="toggle-satir"><span>Görev oluşturma kontrol listesi</span><v-switch v-model="gorevKontrolListesi" density="compact" hide-details color="#FF8000" /></div>
            <div class="toggle-satir"><span>Görev yüklemede otomatik uçuş modu</span><v-switch v-model="otomatikMod" density="compact" hide-details color="#FF8000" /></div>
          </div>
        </div>
        <v-divider class="my-3" style="border-color: var(--tg-divider)" />
        <div class="ayar-bolum">
          <h4 class="bolum-baslik">Onay Gerektiren Kategoriler</h4>
          <div class="onay-grup-genis">
            <label v-for="kat in kategoriler" :key="kat.id" class="onay-etiket">
              <input v-model="kat.aktif" type="checkbox" /> {{ kat.ad }}
            </label>
          </div>
        </div>
        <v-divider class="my-3" style="border-color: var(--tg-divider)" />
        <div class="ayar-bolum">
          <h4 class="bolum-baslik"><v-icon size="16" class="mr-1">mdi-map</v-icon> Harita Seçenekleri</h4>
          <div class="harita-ayar">
            <div><label class="ayar-etiket">Varsayılan Enlem</label><input v-model.number="varsayilanEnlem" type="number" step="0.0001" class="panel-giris" /></div>
            <div><label class="ayar-etiket">Varsayılan Boylam</label><input v-model.number="varsayilanBoylam" type="number" step="0.0001" class="panel-giris" /></div>
            <div><label class="ayar-etiket">Zoom (1-19)</label><input v-model.number="varsayilanZoom" type="number" min="1" max="19" class="panel-giris kisa" /></div>
          </div>
        </div>
      </div>
    </div>
  </teleport>

  <!-- Araçlar Paneli -->
  <teleport to="body">
    <div v-if="araclarGoster" class="diyalog-arka" @click.self="araclarGoster = false">
      <div class="araclar-diyalog cam-panel-koyu">
        <div class="diyalog-ust">
          <div class="araclar-sekme-bar">
            <button class="araclar-sekme" :class="{ 'araclar-sekme-aktif': araclarSekme === 'mavlink' }" @click="araclarSekme = 'mavlink'">
              <v-icon size="16" class="mr-1">mdi-message-processing</v-icon>MAVLink
            </button>
            <button class="araclar-sekme" :class="{ 'araclar-sekme-aktif': araclarSekme === 'ros2' }" @click="araclarSekme = 'ros2'">
              <v-icon size="16" class="mr-1">mdi-robot</v-icon>ROS2 Topics
            </button>
          </div>
          <v-btn icon="mdi-close" size="small" variant="text" @click="araclarGoster = false" />
        </div>
        <div class="araclar-icerik">
          <MavlinkDenetci v-if="araclarSekme === 'mavlink'" />
          <Ros2TopicListesi v-if="araclarSekme === 'ros2'" />
        </div>
      </div>
    </div>
  </teleport>

  <!-- Telemetri Veri Paneli -->
  <teleport to="body">
    <div v-if="telemetriGoster" class="diyalog-arka" @click.self="telemetriGoster = false">
      <div class="araclar-diyalog cam-panel-koyu">
        <div class="diyalog-ust">
          <h3>Ekran Telemetri Verisi</h3>
          <v-btn icon="mdi-close" size="small" variant="text" @click="telemetriGoster = false" />
        </div>
        <div class="araclar-icerik"><TelemetriVeriGoruntule /></div>
      </div>
    </div>
  </teleport>

  <!-- Geliştirici Yapılandırması -->
  <teleport to="body">
    <div v-if="gelistiriciGoster" class="diyalog-arka" @click.self="gelistiriciGoster = false">
      <div class="araclar-diyalog cam-panel-koyu">
        <div class="diyalog-ust">
          <h3>Geliştirici Yapılandırması</h3>
          <v-btn icon="mdi-close" size="small" variant="text" @click="gelistiriciGoster = false" />
        </div>
        <div class="araclar-icerik"><GelistiriciYapilandirma /></div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import MavlinkDenetci from '@/components/araclar/MavlinkDenetci.vue'
import Ros2TopicListesi from '@/components/araclar/Ros2TopicListesi.vue'
import TelemetriVeriGoruntule from '@/components/araclar/TelemetriVeriGoruntule.vue'
import GelistiriciYapilandirma from '@/components/araclar/GelistiriciYapilandirma.vue'
import BaglantilarPaneli from '@/components/baglanti/BaglantilarPaneli.vue'

const emit = defineEmits<{ (e: 'secim', id: string): void }>()

const aktifId = ref('ucus')

const maddeler = [
  { id: 'ucus',      ikon: 'mdi-airplane',        baslik: 'Uçuş Görünümü' },
  { id: 'gorev',     ikon: 'mdi-map-marker-path',  baslik: 'Görev Planlama' },
  { id: 'baglanti',  ikon: 'mdi-lan-connect',      baslik: 'Bağlantılar' },
  { id: 'video',     ikon: 'mdi-video',             baslik: 'Video / Kamera' },
  { id: 'gorev-ayar',ikon: 'mdi-clipboard-check',  baslik: 'Görev Yapılandırması' },
  { id: 'araclar',   ikon: 'mdi-wrench',            baslik: 'Araçlar (MAVLink / ROS2)' },
]

const baglantilarGoster   = ref(false)
const kameraAyarlariGoster = ref(false)
const gorevAyarlariGoster  = ref(false)
const araclarGoster        = ref(false)
const araclarSekme         = ref<'mavlink' | 'ros2'>('mavlink')
const ayarlarAcik          = ref(false)
const telemetriGoster      = ref(false)
const gelistiriciGoster    = ref(false)

const akislar     = ref<Array<{ ad: string; kaynak: string; cozunurluk: string; aktif: boolean }>>([])
const yeniAkisUrl = ref('')
const webrtcIP    = ref('')
const udpAktif    = ref(true)
const tcpAktif    = ref(true)
const jitterBuffer = ref(0)

const onArmKontrol      = ref(true)
const kaydirOnayla      = ref(true)
const gorevKontrolListesi = ref(true)
const otomatikMod       = ref(false)
const varsayilanEnlem   = ref(39.9334)
const varsayilanBoylam  = ref(32.8597)
const varsayilanZoom    = ref(15)

const kategoriler = reactive([
  { id: 'arm',      ad: 'Arm',                 aktif: true },
  { id: 'disarm',   ad: 'Disarm',              aktif: true },
  { id: 'kalkis',   ad: 'Kalkış',              aktif: true },
  { id: 'yukseklik',ad: 'Yükseklik Değişikliği',aktif: true },
  { id: 'inis',     ad: 'İniş',                aktif: true },
  { id: 'git',      ad: 'Noktaya Git',          aktif: true },
])

const tiklandi = (id: string) => {
  aktifId.value = id
  if (id === 'baglanti')   { baglantilarGoster.value = true }
  else if (id === 'video') { kameraAyarlariGoster.value = true }
  else if (id === 'gorev-ayar') { gorevAyarlariGoster.value = true }
  else if (id === 'araclar')   { araclarGoster.value = true }
  else if (id === 'ucus')      { emit('secim', '/') }
  else if (id === 'gorev')     { emit('secim', '/gorev') }
}

const akisEkle = () => {
  if (!yeniAkisUrl.value) return
  akislar.value.push({ ad: `Kamera ${akislar.value.length + 1}`, kaynak: yeniAkisUrl.value, cozunurluk: '—', aktif: false })
  yeniAkisUrl.value = ''
}
</script>

<style scoped>
.yan-bar {
  position: fixed;
  left: 0;
  top: var(--tg-ust-bar-yukseklik);
  bottom: var(--tg-alt-bar-yukseklik);
  width: 48px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 8px 0;
  z-index: 900;
  border-radius: 0;
  border-left: none;
  border-top: none;
  border-bottom: none;
}

.yan-bar-ust, .yan-bar-alt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.yan-buton {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--tg-metin-soluk);
  cursor: pointer;
  transition: all 0.2s;
}

.yan-buton:hover {
  background: var(--tg-hover-bg-2);
  color: var(--tg-metin);
}

.yan-buton-aktif {
  background: rgba(255, 128, 0, 0.12) !important;
  color: var(--tg-turuncu) !important;
  border-left: 2px solid var(--tg-turuncu);
  border-radius: 0 8px 8px 0;
}

/* Diyalog */
.diyalog-arka {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3000;
}

.ayar-diyalog {
  width: 560px;
  max-height: 80vh;
  overflow-y: auto;
  padding: 24px;
}

.diyalog-ust {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.diyalog-ust h3 { font-size: 16px; font-weight: 600; }

.ayar-bolum { margin-bottom: 8px; }

.bolum-baslik {
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-metin);
  margin-bottom: 10px;
}

.ayar-satir { margin-bottom: 10px; }

.ayar-etiket {
  display: block;
  font-size: 11px;
  color: var(--tg-metin-soluk);
  margin-bottom: 4px;
}

.panel-giris {
  width: 100%;
  padding: 8px 12px;
  background: var(--tg-input-bg);
  border: 1px solid var(--tg-input-border);
  border-radius: 6px;
  color: var(--tg-metin);
  font-size: 13px;
  outline: none;
  font-family: 'Inter', sans-serif;
}

.panel-giris:focus { border-color: var(--tg-turuncu); }
.panel-giris.kisa  { width: 120px; }

.akis-tablo {
  border: 1px solid var(--tg-divider);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 10px;
}

.akis-baslik-satir {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr 80px;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--tg-metin-soluk);
  background: var(--tg-subtle-bg);
  border-bottom: 1px solid var(--tg-divider);
}

.akis-satir {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr 80px;
  padding: 8px 12px;
  font-size: 12px;
  border-bottom: 1px solid var(--tg-subtle-bg);
}

.akis-bos {
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--tg-metin-cok-soluk);
}

.akis-ekle { display: flex; gap: 8px; align-items: center; }

.toggle-grup { display: flex; flex-direction: column; gap: 2px; }

.toggle-satir {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 13px;
}

.onay-grup, .onay-grup-genis { display: flex; gap: 12px; flex-wrap: wrap; }

.onay-etiket {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--tg-metin);
  cursor: pointer;
}

.onay-etiket input[type="checkbox"] { accent-color: var(--tg-turuncu); }

.protokol-satir { display: flex; flex-direction: column; gap: 6px; }

.harita-ayar { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; }

.durum-aktif  { color: var(--tg-basari); font-weight: 600; }
.durum-inaktif { color: var(--tg-metin-cok-soluk); }

.my-3 { margin: 12px 0; }

/* Araçlar */
.araclar-diyalog {
  width: 85vw;
  max-width: 900px;
  height: 75vh;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}

.araclar-diyalog .diyalog-ust {
  padding: 12px 16px;
  border-bottom: 1px solid var(--tg-divider);
  margin-bottom: 0;
}

.araclar-sekme-bar { display: flex; gap: 4px; }

.araclar-sekme {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--tg-metin-soluk);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.araclar-sekme:hover { background: var(--tg-hover-bg-2); color: var(--tg-metin); }

.araclar-sekme-aktif {
  background: rgba(255, 128, 0, 0.1) !important;
  color: var(--tg-turuncu) !important;
  font-weight: 600;
}

.araclar-icerik { flex: 1; min-height: 0; overflow: hidden; }

/* Ayarlar alt menü */
.ayarlar-alt-menu {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--tg-divider);
  margin-bottom: 4px;
}

.alt-menu-gecis-enter-active, .alt-menu-gecis-leave-active { transition: all 0.25s ease; overflow: hidden; }
.alt-menu-gecis-enter-from, .alt-menu-gecis-leave-to { max-height: 0; opacity: 0; transform: translateY(10px); }
.alt-menu-gecis-enter-to, .alt-menu-gecis-leave-from { max-height: 160px; opacity: 1; transform: translateY(0); }
</style>
