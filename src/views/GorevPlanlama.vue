<template>
  <div class="gorev-planlama">
    <!-- Görev Paneli (Sol) -->
    <div class="gorev-sol-panel cam-panel-koyu">
      <h3 class="panel-baslik">
        <v-icon size="18" class="mr-2">mdi-map-marker-path</v-icon>
        Görev Planlama
      </h3>

      <div class="panel-bolum">
        <button class="tg-buton tg-buton-cam tam-genislik" @click="yolOlusturModunu">
          <v-icon size="16" class="mr-1">mdi-plus</v-icon>
          {{ gorevStore.noktalar.length > 0 ? 'NOKTA EKLE' : 'YOL OLUŞTUR' }}
        </button>
      </div>

      <!-- Yükseklik ayarı -->
      <div v-if="noktaEkleModu" class="panel-bolum">
        <label class="panel-etiket">Yükseklik (m)</label>
        <input v-model.number="varsayilanYukseklik" type="number" class="panel-giris" />
        <p class="panel-ipucu">Haritaya tıklayarak nokta ekleyin</p>
        <button class="tg-buton tg-buton-cam tam-genislik mt-2" @click="noktaEkleModu = false">
          TAMAMLA
        </button>
      </div>

      <v-divider class="my-3" style="border-color: rgba(255,255,255,0.06)" />

      <!-- Waypoint listesi -->
      <div v-if="gorevStore.noktalar.length > 0" class="nokta-listesi">
        <div v-for="nokta in gorevStore.noktalar" :key="nokta.id" class="nokta-item">
          <div class="nokta-sira">{{ nokta.sira }}</div>
          <div class="nokta-bilgi">
            <span class="nokta-konum">{{ nokta.enlem.toFixed(5) }}, {{ nokta.boylam.toFixed(5) }}</span>
            <span class="nokta-yuk">{{ nokta.yukseklik }}m</span>
          </div>
          <v-btn icon="mdi-close" size="x-small" variant="text" @click="gorevStore.noktaSil(nokta.id)" />
        </div>
      </div>

      <v-divider v-if="gorevStore.noktalar.length > 0" class="my-3" style="border-color: rgba(255,255,255,0.06)" />

      <!-- Eylemler -->
      <div class="panel-eylemler">
        <button
          :disabled="gorevStore.noktalar.length < 2 || !aracStore.aracCevrimici"
          class="tg-buton tg-buton-turuncu tam-genislik"
          @click="gorevYukle"
        >
          ARACA YÜKLE
        </button>
        <button
          v-if="gorevStore.noktalar.length > 0"
          class="tg-buton tg-buton-cam tam-genislik"
          @click="gorevStore.gorevDosyasiKaydet()"
        >
          DOSYAYA KAYDET
        </button>
        <label class="tg-buton tg-buton-cam tam-genislik dosya-yukle">
          <input type="file" accept=".json" hidden @change="dosyadanYukle" />
          DOSYADAN YÜKLE
        </label>
        <button
          v-if="gorevStore.noktalar.length > 0"
          class="tg-buton tg-buton-cam tam-genislik"
          style="color: var(--tg-tehlike)"
          @click="gorevStore.tumunuTemizle()"
        >
          TEMİZLE
        </button>
      </div>

      <v-divider class="my-3" style="border-color: rgba(255,255,255,0.06)" />

      <!-- Görev Kontrol Listesi -->
      <GorevKontrolListesi />
    </div>

    <!-- Harita -->
    <div class="harita-alani">
      <GorevHaritasi :nokta-ekle-modu="noktaEkleModu" :varsayilan-yukseklik="varsayilanYukseklik" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import GorevHaritasi from '@/components/harita/GorevHaritasi.vue'
import GorevKontrolListesi from '@/components/gorev/GorevKontrolListesi.vue'
import { useGorevStore } from '@/stores/gorev'
import { useAracStore } from '@/stores/arac'

const gorevStore = useGorevStore()
const aracStore = useAracStore()

const noktaEkleModu = ref(false)
const varsayilanYukseklik = ref(100)

const yolOlusturModunu = () => {
  noktaEkleModu.value = !noktaEkleModu.value
}

const gorevYukle = () => {
  gorevStore.gorevAraca = true
  const bildirim = (window as any).__toygunBildirim
  if (bildirim) bildirim('Görev araca yüklendi!', 'basari')
}

const dosyadanYukle = (e: Event) => {
  const input = e.target as HTMLInputElement
  const dosya = input.files?.[0]
  if (!dosya) return
  const okuyucu = new FileReader()
  okuyucu.onload = () => {
    gorevStore.gorevDosyasiYukle(okuyucu.result as string)
  }
  okuyucu.readAsText(dosya)
}
</script>

<style scoped>
.gorev-planlama {
  width: 100%;
  height: 100%;
  display: flex;
  position: relative;
}

.gorev-sol-panel {
  position: absolute;
  left: 12px;
  top: 12px;
  bottom: 12px;
  width: 260px;
  z-index: 500;
  overflow-y: auto;
  padding: 14px;
}

.harita-alani {
  flex: 1;
  width: 100%;
  height: 100%;
}

.panel-baslik {
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--tg-metin);
}

.panel-bolum { margin-bottom: 8px; }

.panel-etiket {
  display: block;
  font-size: 11px;
  color: var(--tg-metin-soluk);
  margin-bottom: 4px;
}

.panel-giris {
  width: 100%;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: var(--tg-metin);
  font-size: 13px;
  outline: none;
}

.panel-giris:focus {
  border-color: var(--tg-turuncu);
}

.panel-ipucu {
  font-size: 11px;
  color: var(--tg-cyan);
  margin-top: 6px;
}

.panel-eylemler {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tam-genislik { width: 100%; }
.mt-2 { margin-top: 8px; }

.nokta-listesi {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.nokta-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
}

.nokta-sira {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--tg-turuncu);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.nokta-bilgi {
  flex: 1;
  min-width: 0;
}

.nokta-konum {
  display: block;
  font-size: 11px;
  color: var(--tg-metin-soluk);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nokta-yuk {
  font-size: 11px;
  color: var(--tg-cyan);
  font-weight: 600;
}

.dosya-yukle {
  cursor: pointer;
  text-align: center;
}
</style>
