<template>
  <header class="ust-bar cam-panel-koyu">
    <!-- Sol: Logo + Görev Adı -->
    <div class="ust-bar-sol">
      <div class="logo-resim" role="img" aria-label="Toygun logosu" title="Toygun GCS"></div>
      <span class="marka-adi">TOYGUN</span>
      <span class="marka-alt">GCS</span>
      <div class="ust-ayirici" />
      <!-- Görev adı düzenlenebilir alan -->
      <div class="gorev-adi-alan" :class="{ 'gorev-duzenleniyor': duzenleniyor }">
        <v-icon size="13" color="var(--tg-metin-soluk)" class="mr-1">mdi-clipboard-text-outline</v-icon>
        <input
          v-if="duzenleniyor"
          ref="inputRef"
          v-model="gorevStore.gorevAdi"
          class="gorev-adi-input"
          maxlength="40"
          @blur="duzenlemeKapat"
          @keydown.enter="duzenlemeKapat"
          @keydown.escape="duzenlemeKapat"
        />
        <span v-else class="gorev-adi-metin" @click="duzenlemeAc" title="Görev adını düzenle">
          {{ gorevStore.gorevAdi || 'Görev Adı...' }}
        </span>
        <v-icon
          v-if="!duzenleniyor"
          size="11"
          color="var(--tg-metin-cok-soluk)"
          class="ml-1"
          @click="duzenlemeAc"
        >mdi-pencil</v-icon>
      </div>
    </div>

    <nav class="ust-bar-orta">
      <router-link
        v-for="sayfa in sayfalar"
        :key="sayfa.yol"
        :to="sayfa.yol"
        class="nav-link"
        :class="{ 'nav-link-aktif': $route.path === sayfa.yol }"
      >
        <v-icon size="18">{{ sayfa.ikon }}</v-icon>
        <span>{{ sayfa.baslik }}</span>
      </router-link>
    </nav>

    <!-- Sağ: Batarya + Bağlantı + Mod -->
    <div class="ust-bar-sag">
      <!-- Daima görünür batarya göstergesi -->
      <div class="batarya-gosterge" :class="bataryaClass" title="Batarya durumu">
        <v-icon size="14" :color="aracStore.bataryaDurumRengi">mdi-battery{{ bataryaIkon }}</v-icon>
        <span class="bat-deger" :style="{ color: aracStore.bataryaDurumRengi }">
          {{ aracStore.bataryaYuzde >= 0 ? aracStore.bataryaYuzde.toFixed(0) + '%' : '—' }}
        </span>
        <span class="bat-voltaj">{{ aracStore.bataryaVoltaj > 0 ? aracStore.bataryaVoltaj.toFixed(1) + 'V' : '' }}</span>
        <span class="bat-akim">{{ aracStore.bataryaAkim > 0 ? aracStore.bataryaAkim.toFixed(1) + 'A' : '' }}</span>
      </div>

      <div class="ust-ayirici" />
      <button
        class="tema-dugmesi"
        :title="temaStore.tema === 'koyu' ? 'Açık temaya geç' : 'Koyu temaya geç'"
        :aria-label="temaStore.tema === 'koyu' ? 'Açık temaya geç' : 'Koyu temaya geç'"
        @click="temaStore.temaDegistir()"
      >
        <v-icon size="16">{{ temaStore.tema === 'koyu' ? 'mdi-white-balance-sunny' : 'mdi-weather-night' }}</v-icon>
      </button>
      <BaglantiPaneli />
      <div v-if="aracStore.simuleAktif" class="sim-rozeti" title="Simülasyon modu aktif">
        <v-icon size="12" class="mr-1">mdi-airplane-settings</v-icon>
        SİM
      </div>
      <div v-if="aracStore.aracCevrimici" class="mod-gosterge">
        <v-icon size="14" class="mr-1">mdi-airplane</v-icon>
        <span>{{ aracStore.ucusModu }}</span>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useAracStore } from '@/stores/arac'
import { useGorevStore } from '@/stores/gorev'
import { useTemaStore } from '@/stores/tema'
import BaglantiPaneli from '@/components/baglanti/BaglantiPaneli.vue'

const aracStore = useAracStore()
const temaStore = useTemaStore()
const gorevStore = useGorevStore()

const sayfalar = [
  { yol: '/', baslik: 'Uçuş', ikon: 'mdi-airplane' },
  { yol: '/gorev', baslik: 'Görev Planlama', ikon: 'mdi-map-marker-path' },
  { yol: '/ayarlar', baslik: 'Ayarlar', ikon: 'mdi-cog' },
]

// Görev adı düzenleme
const duzenleniyor = ref(false)
const inputRef = ref<HTMLInputElement>()

const duzenlemeAc = async () => {
  duzenleniyor.value = true
  await nextTick()
  inputRef.value?.select()
}

const duzenlemeKapat = () => {
  duzenleniyor.value = false
  if (!gorevStore.gorevAdi.trim()) gorevStore.gorevAdi = 'Görev 1'
}

// Batarya ikon seçimi
const bataryaIkon = computed(() => {
  const y = aracStore.bataryaYuzde
  if (y < 0) return ''
  if (y >= 90) return ''
  if (y >= 70) return '-80'
  if (y >= 50) return '-60'
  if (y >= 30) return '-40'
  if (y >= 15) return '-20'
  return '-alert'
})

const bataryaClass = computed(() => ({
  'bat-tehlike': aracStore.bataryaYuzde >= 0 && aracStore.bataryaYuzde < 20,
  'bat-uyari': aracStore.bataryaYuzde >= 20 && aracStore.bataryaYuzde < 40,
}))
</script>

<style scoped>
.ust-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--tg-ust-bar-yukseklik);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  z-index: 1000;
  border-radius: 0;
  border-top: none;
  border-left: none;
  border-right: none;
}

.ust-bar-sol {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

/* Logo PNG'si maske olarak kullanılır; rengi temaya göre --tg-logo-renk'ten gelir */
.logo-resim {
  width: 62px;
  height: 23px;
  background-color: var(--tg-logo-renk);
  -webkit-mask: url('@/assets/toygun-logo-yatay.png') center / contain no-repeat;
  mask: url('@/assets/toygun-logo-yatay.png') center / contain no-repeat;
  flex-shrink: 0;
}

.tema-dugmesi {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: 1px solid var(--tg-divider);
  background: var(--tg-badge-bg);
  color: var(--tg-metin-soluk);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}

.tema-dugmesi:hover {
  background: var(--tg-hover-bg-2);
  color: var(--tg-turuncu);
}

.marka-adi {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--tg-turuncu);
  flex-shrink: 0;
}

.marka-alt {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 1px;
  color: var(--tg-metin-soluk);
  margin-top: 2px;
  flex-shrink: 0;
}

.ust-ayirici {
  width: 1px;
  height: 18px;
  background: var(--tg-divider);
  flex-shrink: 0;
}

/* Görev adı */
.gorev-adi-alan {
  display: flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid transparent;
  transition: all 0.15s;
  max-width: 200px;
  min-width: 80px;
  cursor: default;
}

.gorev-adi-alan:hover {
  background: var(--tg-hover-bg);
  border-color: var(--tg-divider);
}

.gorev-duzenleniyor {
  background: var(--tg-input-bg) !important;
  border-color: rgba(255, 128, 0, 0.35) !important;
}

.gorev-adi-metin {
  font-size: 12px;
  font-weight: 500;
  color: var(--tg-metin-soluk);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.gorev-adi-input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--tg-metin);
  font-size: 12px;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  width: 100%;
  min-width: 80px;
  max-width: 160px;
}

/* Nav */
.ust-bar-orta {
  display: flex;
  gap: 4px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--tg-metin-soluk);
  text-decoration: none;
  transition: all 0.2s;
}

.nav-link:hover {
  color: var(--tg-metin);
  background: var(--tg-hover-bg-2);
}

.nav-link-aktif {
  color: var(--tg-turuncu) !important;
  background: rgba(255, 128, 0, 0.1);
}

/* Sağ bölüm */
.ust-bar-sag {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Batarya göstergesi */
.batarya-gosterge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--tg-badge-bg);
  border: 1px solid var(--tg-divider);
}

.bat-deger {
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.bat-voltaj,
.bat-akim {
  font-size: 10px;
  color: var(--tg-metin-soluk);
  font-variant-numeric: tabular-nums;
}

.bat-tehlike {
  background: rgba(220, 38, 38, 0.08) !important;
  border-color: rgba(220, 38, 38, 0.25) !important;
  animation: batarya-yanip-sone 1.2s infinite;
}

.bat-uyari {
  background: rgba(245, 158, 11, 0.07) !important;
  border-color: rgba(245, 158, 11, 0.2) !important;
}

@keyframes batarya-yanip-sone {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.mod-gosterge {
  display: flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--tg-cyan);
  padding: 4px 10px;
  border-radius: 20px;
  background: rgba(14, 165, 233, 0.1);
  border: 1px solid rgba(14, 165, 233, 0.2);
}

.sim-rozeti {
  display: flex;
  align-items: center;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--tg-turuncu);
  padding: 3px 8px;
  border-radius: 20px;
  background: rgba(255, 128, 0, 0.12);
  border: 1px solid rgba(255, 128, 0, 0.3);
  animation: sim-nabiz 2s infinite;
}

@keyframes sim-nabiz {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
</style>
