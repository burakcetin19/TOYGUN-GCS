<template>
  <div class="arm-kaydirici" :class="{ 'arm-silahli': aracStore.armed }">
    <!-- Hata mesajı -->
    <Transition name="hata-goster">
      <div v-if="hataMesaji" class="arm-hata-popup">
        <v-icon size="13" color="#dc2626" class="mr-1">mdi-alert-circle</v-icon>
        <span>{{ hataMesaji }}</span>
      </div>
    </Transition>

    <!-- Disarm butonu (silahlanmış durum) -->
    <div v-if="aracStore.armed" class="disarm-alan" :class="{ 'disarm-onay': disarmOnayBekliyor }" @click="disarmEt">
      <v-icon size="14" color="#dc2626">mdi-shield-off</v-icon>
      <span class="arm-durum-metin silahli">{{ komutBekleniyor ? 'GÖNDERİLİYOR…' : 'SİLAHLI' }}</span>
      <span class="disarm-ipucu">{{ disarmOnayBekliyor ? '— onay için tekrar tıkla' : '— kes' }}</span>
    </div>

    <!-- Slide-to-arm (silahlı değil) -->
    <div v-else class="arm-track" ref="trackRef">
      <!-- Arka plan etiketi -->
      <span class="arm-label">{{ komutBekleniyor ? 'ARM gönderiliyor…' : 'Kaydır → ARM' }}</span>

      <!-- Sürüklenebilir thumb -->
      <div
        class="arm-thumb"
        :class="{ 'arm-thumb-serbest': !surukleniyor }"
        :style="{ transform: `translateX(${thumbX}px)` }"
        @mousedown.prevent="suruklemeyiBaslat"
        @touchstart.prevent="suruklemeyiBaslatTouch"
      >
        <v-icon size="16" color="rgba(0,0,0,0.8)">mdi-shield-lock</v-icon>
      </div>

      <!-- İlerleme dolgusu -->
      <div class="arm-dolgu" :style="{ width: dolguGenisligi + 'px' }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useAracStore } from '@/stores/arac'
import { armDisarmGonder, type ArmSonucu } from '@/libs/mavlink/komutlar'

const aracStore = useAracStore()

const trackRef = ref<HTMLElement>()
const thumbX = ref(0)
const surukleniyor = ref(false)
const hataMesaji = ref('')
let hataZamanlayici: ReturnType<typeof setTimeout> | null = null

const THUMB_GENISLIK = 36
const trackGenislik = computed(() => (trackRef.value?.offsetWidth ?? 160) - THUMB_GENISLIK)
const dolguGenisligi = computed(() => thumbX.value + THUMB_GENISLIK / 2)

const hataGoster = (mesajlar: string[]) => {
  if (hataZamanlayici) clearTimeout(hataZamanlayici)
  hataMesaji.value = mesajlar[0]  // ilk hatayı göster
  hataZamanlayici = setTimeout(() => { hataMesaji.value = '' }, 4000)
}

const komutBekleniyor = ref(false)
const disarmOnayBekliyor = ref(false)
let disarmOnayZamanlayici: ReturnType<typeof setTimeout> | null = null

const log = (m: string, t: string) => (window as any).__toygunTerminal?.(m, t)
const bildirim = (m: string, t: string) => (window as any).__toygunBildirim?.(m, t)

const sonucuBildir = (sonuc: ArmSonucu) => {
  if (sonuc.durum === 'kabul') {
    log(sonuc.mesaj, 'ok')
    return
  }
  if (sonuc.durum === 'yanitYok') {
    // ACK gelmeyebilir (ör. mavlink2rest yolu) — asıl durum HEARTBEAT'ten okunur
    log(sonuc.mesaj, 'warn')
    bildirim(sonuc.mesaj, 'uyari')
    return
  }
  log(sonuc.mesaj, 'error')
  bildirim(sonuc.mesaj, 'hata')
  hataGoster([sonuc.mesaj])
}

const armDenemesi = async () => {
  if (komutBekleniyor.value) return
  const sonuc = aracStore.armEt()
  if (!sonuc.basarili) {
    hataGoster(sonuc.hatalar)
    return
  }
  if (aracStore.simuleAktif) return // simülasyonda store yerel olarak ARM'landı

  komutBekleniyor.value = true
  log('ARM komutu gönderiliyor…', 'sys')
  try {
    sonucuBildir(await armDisarmGonder(true))
  } finally {
    komutBekleniyor.value = false
  }
}

const disarmEt = async () => {
  if (komutBekleniyor.value) return

  // İki aşamalı onay — uçuşta yanlışlıkla tıklamaya karşı
  if (!disarmOnayBekliyor.value) {
    disarmOnayBekliyor.value = true
    if (disarmOnayZamanlayici) clearTimeout(disarmOnayZamanlayici)
    disarmOnayZamanlayici = setTimeout(() => { disarmOnayBekliyor.value = false }, 3000)
    return
  }
  disarmOnayBekliyor.value = false
  if (disarmOnayZamanlayici) clearTimeout(disarmOnayZamanlayici)

  if (aracStore.simuleAktif) {
    aracStore.disarmEt()
    return
  }

  komutBekleniyor.value = true
  log('DISARM komutu gönderiliyor…', 'sys')
  try {
    sonucuBildir(await armDisarmGonder(false))
  } finally {
    komutBekleniyor.value = false
  }
}

// Mouse sürükleme
let baslangicX = 0

const suruklemeyiBaslat = (e: MouseEvent) => {
  surukleniyor.value = true
  baslangicX = e.clientX - thumbX.value
  window.addEventListener('mousemove', surukle)
  window.addEventListener('mouseup', suruklemeyiBitir)
}

const suruklemeyiBaslatTouch = (e: TouchEvent) => {
  surukleniyor.value = true
  baslangicX = e.touches[0].clientX - thumbX.value
  window.addEventListener('touchmove', surukleTouch)
  window.addEventListener('touchend', suruklemeyiBitirTouch)
}

const surukle = (e: MouseEvent) => {
  if (!surukleniyor.value) return
  const yeni = Math.max(0, Math.min(trackGenislik.value, e.clientX - baslangicX))
  thumbX.value = yeni
  if (yeni >= trackGenislik.value * 0.85) {
    suruklemeyiBitir()
    armDenemesi()
  }
}

const surukleTouch = (e: TouchEvent) => {
  if (!surukleniyor.value) return
  const yeni = Math.max(0, Math.min(trackGenislik.value, e.touches[0].clientX - baslangicX))
  thumbX.value = yeni
  if (yeni >= trackGenislik.value * 0.85) {
    suruklemeyiBitirTouch()
    armDenemesi()
  }
}

const suruklemeyiBitir = () => {
  surukleniyor.value = false
  thumbX.value = 0
  window.removeEventListener('mousemove', surukle)
  window.removeEventListener('mouseup', suruklemeyiBitir)
}

const suruklemeyiBitirTouch = () => {
  surukleniyor.value = false
  thumbX.value = 0
  window.removeEventListener('touchmove', surukleTouch)
  window.removeEventListener('touchend', suruklemeyiBitirTouch)
}

onUnmounted(() => {
  window.removeEventListener('mousemove', surukle)
  window.removeEventListener('mouseup', suruklemeyiBitir)
  window.removeEventListener('touchmove', surukleTouch)
  window.removeEventListener('touchend', suruklemeyiBitirTouch)
  if (hataZamanlayici) clearTimeout(hataZamanlayici)
  if (disarmOnayZamanlayici) clearTimeout(disarmOnayZamanlayici)
})
</script>

<style scoped>
.arm-kaydirici {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* Hata popup */
.arm-hata-popup {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  background: rgba(30, 8, 8, 0.95);
  border: 1px solid rgba(220, 38, 38, 0.5);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 11px;
  color: #fca5a5;
  white-space: nowrap;
  z-index: 2000;
  display: flex;
  align-items: center;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 16px rgba(220, 38, 38, 0.2);
  max-width: 280px;
  white-space: normal;
}

.hata-goster-enter-active,
.hata-goster-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.hata-goster-enter-from,
.hata-goster-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

/* Disarm durumu */
.disarm-alan {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  background: rgba(220, 38, 38, 0.12);
  border: 1px solid rgba(220, 38, 38, 0.35);
  cursor: pointer;
  transition: all 0.15s;
}

.disarm-alan:hover {
  background: rgba(220, 38, 38, 0.22);
  border-color: rgba(220, 38, 38, 0.6);
}

.arm-durum-metin.silahli {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #dc2626;
}

.disarm-alan.disarm-onay {
  background: rgba(220, 38, 38, 0.25);
  border-color: #dc2626;
}

.disarm-ipucu {
  font-size: 10px;
  color: rgba(220, 38, 38, 0.6);
}

/* Slide track */
.arm-track {
  position: relative;
  width: 160px;
  height: 28px;
  background: rgba(255, 128, 0, 0.06);
  border: 1px solid rgba(255, 128, 0, 0.2);
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  align-items: center;
  user-select: none;
}

.arm-label {
  position: absolute;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: rgba(255, 128, 0, 0.55);
  pointer-events: none;
  padding-left: 36px;
}

/* Dolgu */
.arm-dolgu {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: rgba(255, 128, 0, 0.12);
  pointer-events: none;
  transition: width 0.05s;
}

/* Thumb */
.arm-thumb {
  position: absolute;
  left: 2px;
  width: 36px;
  height: 24px;
  background: linear-gradient(135deg, #FF8000, #e06000);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  z-index: 2;
  box-shadow: 0 2px 8px rgba(255, 128, 0, 0.35);
}

.arm-thumb:active {
  cursor: grabbing;
}

.arm-thumb-serbest {
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
</style>
