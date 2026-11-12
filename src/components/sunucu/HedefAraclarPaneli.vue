<template>
  <div class="hedef-panel-alani" :class="{ 'panel-acik': acik }">
    <!-- Toggle sekmesi — her zaman görünür -->
    <button class="panel-sekme" @click="acik = !acik" :title="acik ? 'Kapat' : 'Hedef araçları göster'">
      <div v-if="rakiplar.length > 0" class="rakip-sayac-badge">{{ rakiplar.length }}</div>
      <v-icon size="13" class="sekme-ok-ikon">
        {{ acik ? 'mdi-chevron-right' : 'mdi-chevron-left' }}
      </v-icon>
      <span class="sekme-metin">HEDEFLER</span>
      <v-icon size="13" style="color: var(--tg-tehlike); margin-top: 2px;">mdi-airplane-alert</v-icon>
    </button>

    <!-- Panel içeriği -->
    <transition name="panel-kayan">
      <div v-if="acik" class="hedef-icerik cam-panel-koyu">

        <!-- Panel başlığı -->
        <div class="icerik-baslik">
          <v-icon size="11" color="var(--tg-tehlike)" class="mr-1">mdi-radar</v-icon>
          <span>HEDEF ARAÇLAR</span>
          <span class="toplam-badge">{{ rakiplar.length }} araç</span>
        </div>

        <!-- Sunucuya bağlı değil uyarısı -->
        <div v-if="!sunucuBagliMi" class="uyari-durum">
          <v-icon size="18" color="var(--tg-metin-cok-soluk)">mdi-server-off</v-icon>
          <span>Sunucuya bağlı değil</span>
        </div>

        <!-- Veri yok -->
        <div v-else-if="rakiplar.length === 0" class="uyari-durum">
          <v-icon size="18" color="var(--tg-metin-cok-soluk)">mdi-radar</v-icon>
          <span>Hedef araç yok</span>
        </div>

        <!-- Rakip listesi -->
        <div v-else class="rakip-listesi">
          <div
            v-for="rakip in rakiplar"
            :key="rakip.id"
            class="rakip-kart"
            :class="{ 'rakip-kilitli': rakip.ihaKilitlendi }"
          >
            <!-- Kart başlığı -->
            <div class="kart-baslik">
              <div class="takim-no-kutu">
                <span class="takim-harf">T</span>
                <span class="takim-no">{{ rakip.takimNo }}</span>
              </div>

              <div v-if="rakip.ihaKilitlendi" class="kilit-etiketi">
                <v-icon size="9" color="var(--tg-tehlike)">mdi-crosshairs-gps</v-icon>
                KİLİT
              </div>

              <div class="canli-nokta" :title="'Son güncelleme'">
                <span class="nokta-ic"></span>
              </div>
            </div>

            <!-- Veri satırları -->
            <div class="veri-satirlar">
              <div class="veri-satir">
                <div class="veri-kutu">
                  <span class="veri-etiket">HIZ</span>
                  <span class="veri-deger">
                    {{ rakip.hiz.toFixed(1) }}<span class="veri-birim">m/s</span>
                  </span>
                </div>
                <div class="veri-kutu">
                  <span class="veri-etiket">İRTİFA</span>
                  <span class="veri-deger">
                    {{ rakip.irtifa.toFixed(0) }}<span class="veri-birim">m</span>
                  </span>
                </div>
                <div class="veri-kutu">
                  <span class="veri-etiket">BAŞLIK</span>
                  <span class="veri-deger">
                    {{ rakip.baslik.toFixed(0) }}<span class="veri-birim">°</span>
                  </span>
                </div>
              </div>

              <div class="konum-satir">
                <v-icon size="9" style="color: var(--tg-metin-cok-soluk); flex-shrink: 0;">mdi-map-marker</v-icon>
                <span class="konum-metin">
                  {{ rakip.enlem.toFixed(5) }}, {{ rakip.boylam.toFixed(5) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Sunucu saat bilgisi (bağlıysa) -->
        <div v-if="sunucuBagliMi && sunucuZamani" class="saat-satir">
          <v-icon size="9" style="color: var(--tg-metin-cok-soluk);">mdi-clock-outline</v-icon>
          <span>{{ sunucuZamani }}</span>
          <span v-if="zamanFarkKritik" class="zaman-uyari">
            <v-icon size="9" color="var(--tg-uyari)">mdi-alert</v-icon>
            Δ{{ Math.abs(zamanFarki) }}ms
          </span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSunucuStore } from '@/stores/sunucu'

const sunucuStore = useSunucuStore()
const acik = ref(false)

const rakiplar    = computed(() => sunucuStore.rakiplar)
const sunucuBagliMi = computed(() => sunucuStore.bagliMi)
const sunucuZamani  = computed(() => sunucuStore.sunucuZamani)
const zamanFarki    = computed(() => sunucuStore.zamanFarki)
const zamanFarkKritik = computed(() => sunucuStore.zamanFarkKritik)
</script>

<style scoped>
/* ── Dış kap: sağ kenara yapışık ── */
.hedef-panel-alani {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  z-index: 500;
  display: flex;
  align-items: center;
  pointer-events: auto;
  gap: 0;
}

/* ── Toggle sekmesi ── */
.panel-sekme {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px 5px;
  width: 24px;
  min-height: 90px;
  background: var(--tg-panel-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--tg-panel-border);
  border-right: none;
  border-radius: 8px 0 0 8px;
  cursor: pointer;
  position: relative;
  order: 2;
  transition: background 0.15s;
  font-family: 'Inter', sans-serif;
}

.panel-sekme:hover {
  background: var(--tg-panel-bg);
}

.panel-acik .panel-sekme {
  background: rgba(255, 128, 0, 0.07);
  border-color: rgba(255, 128, 0, 0.2);
}

.sekme-ok-ikon {
  color: var(--tg-metin-soluk) !important;
}

.sekme-metin {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  transform: rotate(180deg);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--tg-metin-soluk);
}

.rakip-sayac-badge {
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--tg-tehlike);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid var(--tg-panel-bg);
}

/* ── Panel içeriği ── */
.hedef-icerik {
  order: 1;
  width: 220px;
  max-height: 480px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: none;
  border-radius: 10px 0 0 10px;
}

.icerik-baslik {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px 6px;
  border-bottom: 1px solid var(--tg-divider);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.1px;
  color: var(--tg-metin-soluk);
  text-transform: uppercase;
  flex-shrink: 0;
}

.toplam-badge {
  margin-left: auto;
  background: var(--tg-badge-bg);
  color: var(--tg-metin-cok-soluk);
  font-size: 8px;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
}

/* ── Boş / uyarı durumu ── */
.uyari-durum {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px 12px;
  color: var(--tg-metin-cok-soluk);
  font-size: 11px;
}

/* ── Rakip listesi ── */
.rakip-listesi {
  overflow-y: auto;
  flex: 1;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* ── Rakip kart ── */
.rakip-kart {
  background: var(--tg-subtle-bg);
  border: 1px solid var(--tg-divider);
  border-radius: 7px;
  padding: 6px 8px;
  transition: border-color 0.15s;
}

.rakip-kart:hover {
  border-color: rgba(0, 0, 0, 0.14);
}

.rakip-kilitli {
  border-color: rgba(220, 38, 38, 0.3) !important;
  background: rgba(220, 38, 38, 0.04) !important;
}

/* Kart başlığı */
.kart-baslik {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.takim-no-kutu {
  display: flex;
  align-items: baseline;
  gap: 2px;
  background: var(--tg-input-bg);
  border: 1px solid var(--tg-input-border);
  border-radius: 5px;
  padding: 2px 6px;
}

.takim-harf {
  font-size: 8px;
  font-weight: 600;
  color: var(--tg-metin-cok-soluk);
}

.takim-no {
  font-size: 14px;
  font-weight: 700;
  color: var(--tg-metin);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.kilit-etiketi {
  display: flex;
  align-items: center;
  gap: 3px;
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid rgba(220, 38, 38, 0.25);
  border-radius: 4px;
  padding: 2px 5px;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--tg-tehlike);
}

.canli-nokta {
  margin-left: auto;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(22, 163, 74, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.nokta-ic {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--tg-basari);
  animation: canli-nabiz 2s infinite;
}

@keyframes canli-nabiz {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.7); }
}

/* Veri satırları */
.veri-satirlar {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.veri-satir {
  display: flex;
  gap: 4px;
}

.veri-kutu {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--tg-input-bg);
  border-radius: 4px;
  padding: 3px 4px;
}

.veri-etiket {
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--tg-metin-cok-soluk);
  text-transform: uppercase;
  line-height: 1;
  margin-bottom: 1px;
}

.veri-deger {
  font-size: 13px;
  font-weight: 700;
  color: var(--tg-metin);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  display: flex;
  align-items: baseline;
  gap: 1px;
}

.veri-birim {
  font-size: 7px;
  font-weight: 500;
  color: var(--tg-metin-cok-soluk);
}

.konum-satir {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 4px;
  background: var(--tg-input-bg);
  border-radius: 4px;
}

.konum-metin {
  font-size: 9px;
  font-variant-numeric: tabular-nums;
  color: var(--tg-metin-soluk);
  line-height: 1;
}

/* ── Saat satırı ── */
.saat-satir {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px 6px;
  border-top: 1px solid var(--tg-divider);
  font-size: 8px;
  color: var(--tg-metin-cok-soluk);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.zaman-uyari {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 2px;
  color: var(--tg-uyari);
  font-weight: 600;
}

/* ── Animasyon ── */
.panel-kayan-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.panel-kayan-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.panel-kayan-enter-from {
  opacity: 0;
  transform: translateX(16px);
}
.panel-kayan-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
