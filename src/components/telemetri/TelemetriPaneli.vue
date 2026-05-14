<template>
  <div class="telemetri-paneli-ic">
    <h3 class="panel-baslik">
      <v-icon size="16" class="mr-1">mdi-gauge</v-icon>
      TELEMETRİ
    </h3>

    <!-- Bağlantı yok durumu -->
    <div v-if="!aracStore.aracCevrimici" class="baglanti-yok">
      <v-icon size="36" color="var(--tg-metin-cok-soluk)">mdi-airplane-off</v-icon>
      <p>Araç bağlı değil</p>
      <p class="baglanti-ipucu">Ayarlar'dan MAVLink bağlantısı kurun</p>
    </div>

    <!-- Bağlı durumu — gerçek veriler -->
    <template v-else>
      <!-- Hız -->
      <div class="telem-kart">
        <div class="telem-ust">
          <v-icon size="16" color="#47C7FC">mdi-speedometer</v-icon>
          <span class="telem-etiket">Hız</span>
        </div>
        <div class="telem-deger-satir">
          <div class="telem-ana-deger">{{ aracStore.yerHizi.toFixed(1) }}</div>
          <div class="telem-birim">m/s</div>
        </div>
        <div class="telem-alt">Hava: {{ aracStore.havaHizi.toFixed(1) }} m/s</div>
      </div>

      <!-- Yükseklik -->
      <div class="telem-kart">
        <div class="telem-ust">
          <v-icon size="16" color="#47C7FC">mdi-altimeter</v-icon>
          <span class="telem-etiket">Yükseklik</span>
        </div>
        <div class="telem-deger-satir">
          <div class="telem-ana-deger">{{ aracStore.yukseklik.toFixed(0) }}</div>
          <div class="telem-birim">m MSL</div>
        </div>
        <div class="telem-alt">AGL: {{ aracStore.yapiYukseklik.toFixed(0) }} m</div>
      </div>

      <!-- Batarya -->
      <div class="telem-kart">
        <div class="telem-ust">
          <v-icon size="16" :color="aracStore.bataryaDurumRengi">mdi-battery</v-icon>
          <span class="telem-etiket">Batarya</span>
        </div>
        <div class="telem-deger-satir">
          <div class="telem-ana-deger" :style="{ color: aracStore.bataryaDurumRengi }">
            {{ aracStore.bataryaYuzde >= 0 ? aracStore.bataryaYuzde.toFixed(0) : '—' }}
          </div>
          <div class="telem-birim">%</div>
        </div>
        <div class="telem-alt">{{ aracStore.bataryaVoltaj.toFixed(1) }}V · {{ aracStore.bataryaAkim.toFixed(1) }}A</div>
      </div>

      <!-- GPS -->
      <div class="telem-kart">
        <div class="telem-ust">
          <v-icon size="16" color="#22c55e">mdi-satellite-variant</v-icon>
          <span class="telem-etiket">GPS</span>
        </div>
        <div class="telem-deger-satir">
          <div class="telem-ana-deger">{{ aracStore.gpsSayisi }}</div>
          <div class="telem-birim">uydu</div>
        </div>
        <div class="telem-alt">{{ aracStore.gpsFixMetni }} · HDOP {{ aracStore.gpsHdop.toFixed(1) }}</div>
      </div>

      <!-- Yön -->
      <div class="telem-kart">
        <div class="telem-ust">
          <v-icon size="16" color="#FF8000">mdi-compass</v-icon>
          <span class="telem-etiket">Yön (Heading)</span>
        </div>
        <div class="telem-deger-satir">
          <div class="telem-ana-deger">{{ aracStore.heading.toFixed(0) }}</div>
          <div class="telem-birim">°</div>
        </div>
        <div class="telem-alt">Pitch: {{ aracStore.pitch.toFixed(1) }}° · Roll: {{ aracStore.roll.toFixed(1) }}°</div>
      </div>

      <!-- Konum -->
      <div class="telem-kart telem-kart-kucuk">
        <div class="telem-ust">
          <v-icon size="14" color="#47C7FC">mdi-crosshairs-gps</v-icon>
          <span class="telem-etiket">Konum</span>
        </div>
        <div class="telem-konum">{{ aracStore.enlem.toFixed(6) }}, {{ aracStore.boylam.toFixed(6) }}</div>
      </div>

      <!-- Durum -->
      <div class="telem-kart telem-kart-kucuk">
        <div class="durum-satir">
          <div class="durum-item">
            <div class="durum-led" :class="aracStore.armed ? 'durum-led-aktif' : 'durum-led-inaktif'" />
            <span>{{ aracStore.armed ? 'ARM' : 'DİSARM' }}</span>
          </div>
          <div class="durum-item">
            <v-icon size="14">mdi-airplane</v-icon>
            <span>{{ aracStore.ucusModu }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useAracStore } from '@/stores/arac'

const aracStore = useAracStore()
</script>

<style scoped>
.telemetri-paneli-ic {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.panel-baslik {
  display: flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.5px;
  color: var(--tg-metin-soluk);
  margin-bottom: 4px;
}

.baglanti-yok {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 30px 10px;
  text-align: center;
}

.baglanti-yok p {
  font-size: 13px;
  color: var(--tg-metin-cok-soluk);
}

.baglanti-ipucu {
  font-size: 11px !important;
  color: var(--tg-metin-cok-soluk);
}

.telem-kart {
  padding: 10px;
  border-radius: 8px;
  background: var(--tg-subtle-bg);
  border: 1px solid var(--tg-divider);
}

.telem-kart-kucuk { padding: 8px 10px; }

.telem-ust {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.telem-etiket {
  font-size: 10px;
  font-weight: 500;
  color: var(--tg-metin-soluk);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.telem-deger-satir {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.telem-ana-deger {
  font-size: 22px;
  font-weight: 700;
  color: var(--tg-metin);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.telem-birim {
  font-size: 11px;
  color: var(--tg-metin-cok-soluk);
  font-weight: 500;
}

.telem-alt {
  font-size: 10px;
  color: var(--tg-metin-cok-soluk);
  margin-top: 2px;
}

.telem-konum {
  font-size: 11px;
  color: var(--tg-metin);
  font-variant-numeric: tabular-nums;
  font-family: 'Inter', monospace;
}

.durum-satir {
  display: flex;
  justify-content: space-between;
}

.durum-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
}

.durum-led {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.durum-led-aktif {
  background: var(--tg-basari);
  box-shadow: 0 0 6px var(--tg-basari);
}

.durum-led-inaktif {
  background: var(--tg-tehlike);
}
</style>
