<template>
  <Teleport to="body">
    <Transition name="bildirim-gir">
      <div v-if="durum !== 'yok'" class="guncelleme-karti cam-panel-koyu">
        <!-- Güncelleme mevcut -->
        <template v-if="durum === 'mevcut'">
          <div class="gk-baslik">
            <v-icon size="15" color="#47C7FC">mdi-arrow-up-circle</v-icon>
            <span>Güncelleme mevcut</span>
            <button class="gk-kapat" @click="kapat">×</button>
          </div>
          <div class="gk-icerik">
            <span class="gk-surum">v{{ mevcutSurum }} → <strong>v{{ yeniSurum }}</strong></span>
          </div>
          <div class="gk-butonlar">
            <button class="gk-btn gk-btn-indir" @click="indir">İndir</button>
            <button class="gk-btn gk-btn-atla" @click="kapat">Sonra</button>
          </div>
        </template>

        <!-- İndirme devam ediyor -->
        <template v-else-if="durum === 'indiriliyor'">
          <div class="gk-baslik">
            <v-icon size="15" color="#FF8000">mdi-download</v-icon>
            <span>İndiriliyor...</span>
          </div>
          <div class="gk-ilerleme">
            <div class="gk-ilerleme-dolgu" :style="{ width: indirmeYuzde + '%' }" />
          </div>
          <span class="gk-hiz">{{ indirmeYuzde }}% — {{ indirmeHiz }} KB/s</span>
        </template>

        <!-- İndirme tamamlandı -->
        <template v-else-if="durum === 'hazir'">
          <div class="gk-baslik">
            <v-icon size="15" color="#22c55e">mdi-check-circle</v-icon>
            <span>Hazır — kurulacak</span>
          </div>
          <div class="gk-butonlar">
            <button class="gk-btn gk-btn-indir" @click="kur">Kur ve Yeniden Başlat</button>
            <button class="gk-btn gk-btn-atla" @click="kapat">Çıkışta Kur</button>
          </div>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

type Durum = 'yok' | 'mevcut' | 'indiriliyor' | 'hazir'

const durum = ref<Durum>('yok')
const mevcutSurum = ref('')
const yeniSurum = ref('')
const indirmeYuzde = ref(0)
const indirmeHiz = ref(0)

const api = (window as any).toygunAPI

const indir = () => {
  durum.value = 'indiriliyor'
  api?.guncellemeIndir()
}

const kur = () => {
  api?.guncellemeKur()
}

const kapat = () => {
  durum.value = 'yok'
}

onMounted(() => {
  if (!api) return

  api.onGuncellemeMevcut((veri: { mevcutSurum: string; yeniSurum: string }) => {
    mevcutSurum.value = veri.mevcutSurum
    yeniSurum.value = veri.yeniSurum
    durum.value = 'mevcut'
  })

  api.onGuncellemeIndirme((veri: { yuzde: number; hiz: number }) => {
    indirmeYuzde.value = veri.yuzde
    indirmeHiz.value = veri.hiz
    durum.value = 'indiriliyor'
  })

  api.onGuncellemeHazir(() => {
    durum.value = 'hazir'
  })
})
</script>

<style scoped>
.guncelleme-karti {
  position: fixed;
  bottom: calc(var(--tg-alt-bar-yukseklik) + 12px);
  right: 16px;
  z-index: 3000;
  width: 240px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid rgba(71, 199, 252, 0.2);
}

.gk-baslik {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--tg-metin);
}

.gk-kapat {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--tg-metin-soluk);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
}

.gk-icerik {
  font-size: 11px;
  color: var(--tg-metin-soluk);
}

.gk-surum strong {
  color: var(--tg-cyan);
}

.gk-butonlar {
  display: flex;
  gap: 6px;
}

.gk-btn {
  flex: 1;
  padding: 5px 8px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  transition: all 0.15s;
}

.gk-btn-indir {
  background: rgba(71, 199, 252, 0.12);
  border-color: rgba(71, 199, 252, 0.3);
  color: var(--tg-cyan);
}

.gk-btn-indir:hover {
  background: rgba(71, 199, 252, 0.22);
}

.gk-btn-atla {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.1);
  color: var(--tg-metin-soluk);
}

.gk-btn-atla:hover {
  background: rgba(255, 255, 255, 0.05);
}

.gk-ilerleme {
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.gk-ilerleme-dolgu {
  height: 100%;
  background: var(--tg-turuncu);
  border-radius: 2px;
  transition: width 0.3s;
}

.gk-hiz {
  font-size: 10px;
  color: var(--tg-metin-cok-soluk);
  font-variant-numeric: tabular-nums;
}

.bildirim-gir-enter-active,
.bildirim-gir-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.bildirim-gir-enter-from,
.bildirim-gir-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
