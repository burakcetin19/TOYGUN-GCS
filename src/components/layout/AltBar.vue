<template>
  <footer class="alt-bar cam-panel-koyu">
    <div class="alt-bilgi">
      <template v-if="aracStore.aracCevrimici">
        <div class="alt-item">
          <v-icon size="13" color="var(--tg-cyan)">mdi-speedometer</v-icon>
          <span class="alt-etiket">Hız</span>
          <span class="alt-deger">{{ aracStore.yerHizi.toFixed(1) }} m/s</span>
        </div>
        <div class="alt-ayirici" />
        <div class="alt-item">
          <v-icon size="13" color="var(--tg-cyan)">mdi-altimeter</v-icon>
          <span class="alt-etiket">Yük.</span>
          <span class="alt-deger">{{ aracStore.yukseklik.toFixed(0) }} m</span>
        </div>
        <div class="alt-ayirici" />
        <div class="alt-item">
          <v-icon size="13" :color="aracStore.bataryaDurumRengi">mdi-battery</v-icon>
          <span class="alt-etiket">Bat.</span>
          <span class="alt-deger" :style="{ color: aracStore.bataryaDurumRengi }">
            {{ aracStore.bataryaYuzde >= 0 ? aracStore.bataryaYuzde.toFixed(0) + '%' : '—' }}
          </span>
        </div>
        <div class="alt-ayirici" />
        <div class="alt-item">
          <v-icon size="13" color="var(--tg-basari)">mdi-satellite-variant</v-icon>
          <span class="alt-etiket">GPS</span>
          <span class="alt-deger">{{ aracStore.gpsSayisi }} uydu</span>
        </div>
        <div class="alt-ayirici" />
        <div class="alt-item">
          <v-icon size="13" color="var(--tg-turuncu)">mdi-compass</v-icon>
          <span class="alt-etiket">Yön</span>
          <span class="alt-deger">{{ aracStore.heading.toFixed(0) }}°</span>
        </div>
      </template>
      <template v-else>
        <div class="alt-item">
          <v-icon size="13" color="var(--tg-metin-cok-soluk)">mdi-airplane-off</v-icon>
          <span class="alt-etiket" style="color: var(--tg-metin-cok-soluk)">Araç bağlı değil</span>
        </div>
      </template>
    </div>

    <!-- Merkez ikon çubuğu -->
    <div class="alt-ikonlar">
      <button
        class="alt-ikon-btn"
        :class="{ 'alt-ikon-aktif': panelAcikMi('telemetri') }"
        title="Telemetri"
        @click="togglePanel('telemetri')"
      >
        <v-icon size="15">mdi-chart-line</v-icon>
      </button>
      <button
        class="alt-ikon-btn"
        :class="{ 'alt-ikon-aktif': panelAcikMi('kontrol') }"
        title="Kontrol Listesi"
        @click="togglePanel('kontrol')"
      >
        <v-icon size="15">mdi-clipboard-check-outline</v-icon>
      </button>
      <button
        class="alt-ikon-btn"
        :class="{ 'alt-ikon-aktif': panelAcikMi('modlar') }"
        title="Özel Modlar"
        @click="togglePanel('modlar')"
      >
        <v-icon size="15">mdi-rocket-launch</v-icon>
      </button>
      <button
        class="alt-ikon-btn"
        :class="{ 'alt-ikon-aktif': panelAcikMi('video') }"
        title="Video Kamera"
        @click="togglePanel('video')"
      >
        <v-icon size="15">mdi-video</v-icon>
      </button>
    </div>

    <div class="alt-sag">
      <ArmKaydirici />
      <div class="alt-ayirici" style="margin: 0 8px;" />
      <span class="alt-zaman">{{ saat }}</span>
    </div>
  </footer>

  <!-- Yüzen Paneller (birden fazlası aynı anda açık kalabilir) -->
  <Teleport to="body">
    <transition name="panel-yukari">
      <div v-if="panelAcikMi('telemetri')" class="yuzen-panel cam-panel-koyu yuzen-telemetri">
        <TelemetriPaneli />
      </div>
    </transition>
  </Teleport>

  <Teleport to="body">
    <transition name="panel-yukari">
      <div v-if="panelAcikMi('kontrol')" class="yuzen-panel cam-panel-koyu yuzen-kontrol">
        <GorevKontrolListesi />
      </div>
    </transition>
  </Teleport>

  <Teleport to="body">
    <transition name="panel-yukari">
      <div v-if="panelAcikMi('modlar')" class="yuzen-panel cam-panel-koyu yuzen-modlar">
        <UcusModuSecici />
        <div class="panel-ayirici" />
        <OzelModlar />
      </div>
    </transition>
  </Teleport>

  <Teleport to="body">
    <transition name="panel-yukari">
      <div v-if="panelAcikMi('video')" class="yuzen-panel yuzen-video">
        <VideoOynatici />
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAracStore } from '@/stores/arac'
import TelemetriPaneli from '@/components/telemetri/TelemetriPaneli.vue'
import GorevKontrolListesi from '@/components/gorev/GorevKontrolListesi.vue'
import OzelModlar from '@/components/gorev/OzelModlar.vue'
import UcusModuSecici from '@/components/ucus/UcusModuSecici.vue'
import VideoOynatici from '@/components/video/VideoOynatici.vue'
import ArmKaydirici from '@/components/arm/ArmKaydirici.vue'

const aracStore = useAracStore()
const saat = ref('')
let zamanlayici: ReturnType<typeof setInterval>

const saatiGuncelle = () => {
  saat.value = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

onMounted(() => {
  saatiGuncelle()
  zamanlayici = setInterval(saatiGuncelle, 1000)
})
onUnmounted(() => clearInterval(zamanlayici))

/* Çok-panelli toggle: her panel bağımsız açılıp kapanır */
const acikPaneller = ref(new Set<string>())

const panelAcikMi = (isim: string) => acikPaneller.value.has(isim)

const togglePanel = (isim: string) => {
  const s = new Set(acikPaneller.value)
  s.has(isim) ? s.delete(isim) : s.add(isim)
  acikPaneller.value = s
}
</script>

<style scoped>
.alt-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: var(--tg-alt-bar-yukseklik);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  z-index: 1000;
  border-radius: 0;
  border-bottom: none;
  border-left: none;
  border-right: none;
}

.alt-bilgi {
  display: flex;
  align-items: center;
  gap: 6px;
}

.alt-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.alt-etiket {
  font-size: 10px;
  color: var(--tg-metin-soluk);
  font-weight: 500;
}

.alt-deger {
  font-size: 12px;
  font-weight: 600;
  color: var(--tg-metin);
  font-variant-numeric: tabular-nums;
}

.alt-ayirici {
  width: 1px;
  height: 16px;
  background: var(--tg-divider);
  margin: 0 4px;
}

/* Merkez ikon çubuğu */
.alt-ikonlar {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 2px;
}

.alt-ikon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--tg-metin-soluk);
  cursor: pointer;
  transition: all 0.15s;
}

.alt-ikon-btn:hover {
  background: var(--tg-hover-bg-2);
  color: var(--tg-metin);
}

.alt-ikon-aktif {
  background: rgba(255, 128, 0, 0.12) !important;
  color: var(--tg-turuncu) !important;
}

.alt-sag {
  display: flex;
  align-items: center;
}

.alt-zaman {
  font-size: 11px;
  font-weight: 500;
  color: var(--tg-metin-soluk);
  font-variant-numeric: tabular-nums;
}

/* Yüzen paneller */
.yuzen-panel {
  position: fixed;
  bottom: calc(var(--tg-alt-bar-yukseklik) + 8px);
  z-index: 1100;
  padding: 12px;
  max-height: 60vh;
  overflow-y: auto;
}

.yuzen-telemetri {
  left: 80px;
  width: 240px;
}

.yuzen-kontrol {
  left: 50%;
  transform: translateX(-50%);
  width: 280px;
}

.yuzen-modlar {
  right: 408px;
  width: 260px;
}

.panel-ayirici {
  height: 1px;
  background: var(--tg-panel-border);
  margin: 8px 0;
}

.yuzen-video {
  right: 16px;
  width: 380px;
  height: 280px;
  padding: 0;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid var(--tg-panel-border);
}

/* Slide-up transition */
.panel-yukari-enter-active, .panel-yukari-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.panel-yukari-enter-from, .panel-yukari-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

:global(.yuzen-video) {
  position: fixed;
  bottom: calc(var(--tg-alt-bar-yukseklik) + 8px);
  right: 16px;
  width: 380px;
  height: 280px;
  z-index: 1100;
  border-radius: 8px;
  overflow: hidden;
}
</style>
