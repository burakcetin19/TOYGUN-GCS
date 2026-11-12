<template>
  <div class="ayarlar-sayfasi">
    <div class="ayarlar-panel cam-panel-koyu">
      <h2 class="ayarlar-baslik">
        <v-icon size="24" class="mr-2">mdi-cog</v-icon>
        Ayarlar
      </h2>

      <div class="ayar-grup">
        <h3 class="grup-baslik">MAVLink Bağlantısı</h3>
        <div class="ayar-satir">
          <label class="ayar-etiket">WebSocket Adresi</label>
          <input v-model="wsAdresi" type="text" class="panel-giris" placeholder="ws://192.168.1.1:6040/ws/mavlink" />
        </div>
        <button
          class="tg-buton mt-2"
          :class="aracStore.baglantiDurumu === 'baglandi' ? 'tg-buton-tehlike' : 'tg-buton-turuncu'"
          @click="baglantiToggle"
        >
          <v-icon size="16" class="mr-1">
            {{ aracStore.baglantiDurumu === 'baglandi' ? 'mdi-close-circle' : 'mdi-connection' }}
          </v-icon>
          {{ aracStore.baglantiDurumu === 'baglandi' ? 'Bağlantıyı Kes' : 'Bağlan' }}
        </button>
        <p class="baglanti-durum mt-1" :class="`durum-${aracStore.baglantiDurumu}`">
          {{ baglantiDurumMetni }}
        </p>
      </div>

      <v-divider class="my-4" style="border-color: var(--tg-divider)" />

      <!-- ROS2 / rosbridge Bağlantısı -->
      <div class="ayar-grup">
        <h3 class="grup-baslik">ROS2 Bağlantısı (rosbridge)</h3>
        <div class="ayar-satir">
          <label class="ayar-etiket">rosbridge WebSocket Adresi</label>
          <input
            v-model="ros2Adresi"
            type="text"
            class="panel-giris"
            placeholder="ws://192.168.1.1:9090"
            @change="ros2AdresKaydet"
          />
        </div>
        <button
          class="tg-buton mt-2"
          :class="rosbridgeDurumu === 'baglandi' ? 'tg-buton-tehlike' : 'tg-buton-turuncu'"
          @click="ros2BaglantiToggle"
        >
          <v-icon size="16" class="mr-1">
            {{ rosbridgeDurumu === 'baglandi' ? 'mdi-close-circle' : 'mdi-robot-industrial' }}
          </v-icon>
          {{ ros2ButonMetni }}
        </button>
        <p class="baglanti-durum mt-1" :class="`durum-${rosbridgeDurumu}`">
          {{ ros2DurumMetni }}
        </p>
        <p class="ayar-aciklama">
          Jetson'da: <code>ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090</code>
        </p>
      </div>

      <v-divider class="my-4" style="border-color: var(--tg-divider)" />

      <div class="ayar-grup">
        <h3 class="grup-baslik">ROS2 Servis Adları</h3>
        <div class="ayar-satir">
          <label class="ayar-etiket">Kamikaze Modu</label>
          <input v-model="kamikazeServis" type="text" class="panel-giris" />
        </div>
        <div class="ayar-satir">
          <label class="ayar-etiket">İt Dalaşı Modu</label>
          <input v-model="itDalasiServis" type="text" class="panel-giris" />
        </div>
        <div class="ayar-satir">
          <label class="ayar-etiket">Acil İniş</label>
          <input v-model="acilInisServis" type="text" class="panel-giris" />
        </div>
      </div>

      <v-divider class="my-4" style="border-color: var(--tg-divider)" />

      <div class="ayar-grup">
        <h3 class="grup-baslik">Görünüm</h3>
        <div class="tema-secici" role="radiogroup" aria-label="Tema">
          <button
            v-for="secenek in temaSecenekleri"
            :key="secenek.deger"
            class="tema-secenek"
            :class="{ 'tema-secenek-aktif': temaStore.tema === secenek.deger }"
            role="radio"
            :aria-checked="temaStore.tema === secenek.deger"
            @click="temaStore.tema = secenek.deger"
          >
            <v-icon size="16" class="mr-1">{{ secenek.ikon }}</v-icon>
            {{ secenek.ad }}
          </button>
        </div>
      </div>

      <v-divider class="my-4" style="border-color: var(--tg-divider)" />

      <div class="ayar-grup">
        <h3 class="grup-baslik">Hakkında</h3>
        <div class="hakkinda">
          <div class="hakkinda-logo" role="img" aria-label="Toygun logosu" />
          <p class="hakkinda-baslik">TOYGUN GCS</p>
          <p class="hakkinda-aciklama">PX4 sabit kanatlı araçlar için özelleştirilmiş yer kontrol istasyonu</p>
          <p class="hakkinda-versiyon">Sürüm 1.0.0</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAracStore } from '@/stores/arac'
import { useTemaStore, type TemaAdi } from '@/stores/tema'
import { mavlinkBaglan, mavlinkKes } from '@/libs/mavlink/baglanti'
import {
  rosbridgeBaglan,
  rosbridgeKes,
  rosbridgeDurumu,
} from '@/libs/ros2/rosbridge-baglanti'

const aracStore = useAracStore()
const temaStore = useTemaStore()
const temaSecenekleri: { deger: TemaAdi; ad: string; ikon: string }[] = [
  { deger: 'acik', ad: 'Açık', ikon: 'mdi-white-balance-sunny' },
  { deger: 'koyu', ad: 'Koyu', ikon: 'mdi-weather-night' },
]

// localStorage anahtarları (BaglantiPaneli.vue ile paylaşılır)
const WS_ADRES_KEY   = 'tg-ws-adres'
const ROS2_ADRES_KEY = 'tg-ros2-adres'

const wsAdresi    = ref(localStorage.getItem(WS_ADRES_KEY)   ?? 'ws://192.168.1.1:6040/ws/mavlink')
const ros2Adresi  = ref(localStorage.getItem(ROS2_ADRES_KEY) ?? 'ws://192.168.1.1:9090')
const kamikazeServis = ref('/toygun/kamikaze_modu')
const itDalasiServis = ref('/toygun/it_dalasi_modu')
const acilInisServis = ref('/toygun/acil_inis')

// ── MAVLink Bağlantısı ────────────────────────────────────────────────────────
const baglantiDurumMetni = computed(() => {
  const metinler: Record<string, string> = {
    baglandi: '● Bağlantı aktif',
    baglaniliyor: '◌ Bağlanılıyor...',
    baglantiKesik: '○ Bağlantı yok',
  }
  return metinler[aracStore.baglantiDurumu] ?? ''
})

const baglantiToggle = () => {
  if (aracStore.baglantiDurumu === 'baglandi') {
    mavlinkKes()
    aracStore.baglantiDurumu = 'baglantiKesik'
    ;(window as any).__toygunBildirim?.('Bağlantı kesildi', 'bilgi')
  } else {
    localStorage.setItem(WS_ADRES_KEY, wsAdresi.value)
    mavlinkBaglan({ wsUrl: wsAdresi.value })
    ;(window as any).__toygunBildirim?.(`Bağlanılıyor: ${wsAdresi.value}`, 'bilgi')
  }
}

// ── ROS2 / rosbridge Bağlantısı ───────────────────────────────────────────────
const ros2DurumMetni = computed(() => {
  const metinler: Record<string, string> = {
    baglandi: '● ROS2 bağlı',
    baglaniliyor: '◌ Bağlanılıyor...',
    baglantiKesik: '○ ROS2 bağlı değil',
  }
  return metinler[rosbridgeDurumu.value] ?? ''
})

const ros2ButonMetni = computed(() => {
  if (rosbridgeDurumu.value === 'baglandi')    return 'ROS2 Bağlantısını Kes'
  if (rosbridgeDurumu.value === 'baglaniliyor') return 'Bağlanılıyor...'
  return 'ROS2 Bağlan'
})

function ros2AdresKaydet() {
  localStorage.setItem(ROS2_ADRES_KEY, ros2Adresi.value)
}

function ros2BaglantiToggle() {
  if (rosbridgeDurumu.value === 'baglandi') {
    rosbridgeKes()
    ;(window as any).__toygunBildirim?.('ROS2 bağlantısı kesildi', 'bilgi')
  } else {
    ros2AdresKaydet()
    rosbridgeBaglan({ wsUrl: ros2Adresi.value })
    ;(window as any).__toygunBildirim?.(`ROS2 bağlanılıyor: ${ros2Adresi.value}`, 'bilgi')
  }
}
</script>

<style scoped>
.ayarlar-sayfasi {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  padding: 24px;
  overflow-y: auto;
}

.ayarlar-panel {
  width: 100%;
  max-width: 600px;
  padding: 24px;
  height: fit-content;
}

.ayarlar-baslik {
  display: flex;
  align-items: center;
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 24px;
  color: var(--tg-turuncu);
}

.ayar-grup { margin-bottom: 8px; }

.grup-baslik {
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-metin);
  margin-bottom: 12px;
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
  font-family: 'Inter', monospace;
}

.panel-giris:focus { border-color: var(--tg-turuncu); }

.mt-2 { margin-top: 8px; }
.my-4 { margin: 16px 0; }

.hakkinda {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 20px 0;
}

.hakkinda-logo {
  width: 120px;
  height: 44px;
  margin: 0 auto 12px;
  background-color: var(--tg-logo-renk);
  -webkit-mask: url('@/assets/toygun-logo-yatay.png') center / contain no-repeat;
  mask: url('@/assets/toygun-logo-yatay.png') center / contain no-repeat;
}

.tema-secici { display: flex; gap: 8px; }

.tema-secenek {
  display: inline-flex;
  align-items: center;
  padding: 7px 14px;
  border-radius: 6px;
  border: 1px solid var(--tg-input-border);
  background: var(--tg-input-bg);
  color: var(--tg-metin-soluk);
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.tema-secenek:hover { background: var(--tg-hover-bg-2); color: var(--tg-metin); }

.tema-secenek-aktif {
  border-color: var(--tg-turuncu);
  color: var(--tg-turuncu);
  background: rgba(255, 128, 0, 0.1);
}
.hakkinda-baslik { font-size: 18px; font-weight: 700; color: var(--tg-turuncu); letter-spacing: 2px; }
.hakkinda-aciklama { font-size: 12px; color: var(--tg-metin-soluk); margin-top: 6px; }
.hakkinda-versiyon { font-size: 11px; color: var(--tg-metin-soluk); margin-top: 4px; }

.baglanti-durum { font-size: 11px; }
.durum-baglandi    { color: var(--tg-basari); }
.durum-baglaniliyor { color: var(--tg-uyari); }
.durum-baglantiKesik { color: var(--tg-metin-soluk); }

.ayar-aciklama {
  font-size: 11px;
  color: var(--tg-metin-soluk);
  margin-top: 8px;
  line-height: 1.5;
}

.ayar-aciklama code {
  background: var(--tg-badge-bg);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 10px;
}
</style>
