<template>
  <div class="kontrol-listesi">
    <h3 class="kl-baslik">
      <v-icon size="16" class="mr-1">mdi-clipboard-check-outline</v-icon>
      GÖREV KONTROL LİSTESİ
    </h3>

    <div class="kl-icerik">
      <div v-for="madde in maddeler" :key="madde.id" class="kl-madde" :class="{ 'kl-tamam': madde.tamam }">
        <v-icon size="16" :color="madde.tamam ? '#22c55e' : 'var(--tg-metin-cok-soluk)'">
          {{ madde.tamam ? 'mdi-check-circle' : 'mdi-circle-outline' }}
        </v-icon>
        <span>{{ madde.metin }}</span>
      </div>
    </div>

    <div class="kl-ozet">
      <span :class="tumTamam ? 'kl-ozet-tamam' : 'kl-ozet-eksik'">
        {{ tamamSayisi }}/{{ maddeler.length }} tamamlandı
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAracStore } from '@/stores/arac'
import { useGorevStore } from '@/stores/gorev'

const aracStore = useAracStore()
const gorevStore = useGorevStore()

interface KontrolMaddesi {
  id: string
  metin: string
  tamam: boolean
}

const maddeler = computed<KontrolMaddesi[]>(() => [
  {
    id: 'baglanti',
    metin: 'Araç bağlantısı kuruldu',
    tamam: aracStore.aracCevrimici,
  },
  {
    id: 'gps',
    metin: 'GPS fix alındı (3D)',
    tamam: aracStore.aracCevrimici && aracStore.gpsFixTipi >= 3,
  },
  {
    id: 'batarya',
    metin: 'Batarya seviyesi yeterli (>%20)',
    tamam: aracStore.aracCevrimici && aracStore.bataryaYuzde > 20,
  },
  {
    id: 'ev-noktasi',
    metin: 'Ev noktası ayarlandı',
    tamam: gorevStore.evNoktasi !== null,
  },
  {
    id: 'gorev-yuklu',
    metin: 'Görev noktaları eklendi',
    tamam: gorevStore.noktalar.length >= 2,
  },
  {
    id: 'gorev-araca',
    metin: 'Görev araca yüklendi',
    tamam: gorevStore.gorevAraca,
  },
])

const tamamSayisi = computed(() => maddeler.value.filter((m) => m.tamam).length)
const tumTamam = computed(() => tamamSayisi.value === maddeler.value.length)
</script>

<style scoped>
.kontrol-listesi {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kl-baslik {
  display: flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--tg-metin-soluk);
  margin-bottom: 4px;
}

.kl-icerik {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kl-madde {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--tg-metin-soluk);
  background: var(--tg-subtle-bg);
  transition: all 0.3s;
}

.kl-tamam {
  color: var(--tg-metin);
  background: rgba(34, 197, 94, 0.06);
}

.kl-ozet {
  margin-top: 6px;
  font-size: 11px;
  text-align: center;
}

.kl-ozet-tamam { color: var(--tg-basari); font-weight: 600; }
.kl-ozet-eksik { color: var(--tg-metin-cok-soluk); }
</style>
