<template>
  <div class="mavlink-denetci">
    <!-- Sol: Mesaj Tip Listesi -->
    <div class="md-sol">
      <h4 class="md-bolum-baslik">Kullanılabilir Mesaj Tipleri</h4>
      <div class="md-arama">
        <input
          v-model="aramaMetni"
          type="text"
          class="panel-giris"
          placeholder="Mesaj ara..."
        />
        <button class="tg-buton tg-buton-cam md-sifirla" @click="aramaMetni = ''">
          SIFIRLA
        </button>
      </div>
      <div class="md-liste">
        <div
          v-for="tip in filtrelenmisListesi"
          :key="tip.id"
          class="md-liste-item"
          :class="{ 'md-liste-item-aktif': seciliTipler.has(tip.id) }"
          @click="tipToggle(tip.id)"
        >
          {{ tip.ad }}
        </div>
      </div>
    </div>

    <!-- Sağ: Mesaj Değerleri -->
    <div class="md-sag">
      <h4 class="md-bolum-baslik">Mesaj Değerleri</h4>
      <div v-if="seciliTipler.size === 0" class="md-bos">
        <v-icon size="32" color="rgba(255,255,255,0.1)">mdi-message-text-outline</v-icon>
        <p>Bir mesaj tipine tıklayarak detaylarını görüntüleyin</p>
      </div>
      <div v-else class="md-degerler">
        <div v-for="tipId in seciliTipler" :key="tipId" class="md-mesaj-kutu">
          <div class="md-mesaj-baslik">
            <span class="md-mesaj-adi">{{ mesajTipleri.find(t => t.id === tipId)?.ad }}</span>
            <v-btn icon="mdi-close" size="x-small" variant="text" @click="tipKaldir(tipId)" />
          </div>

          <div class="md-yonlu">
            <div class="md-yon-baslik gelen">Gelen Mesajlar:</div>
            <div v-if="gelenMesajlar[tipId]" class="md-alan-listesi">
              <div v-for="alan in gelenMesajlar[tipId]" :key="alan.ad" class="md-alan">
                <span class="md-alan-adi">{{ alan.ad }}</span>
                <span class="md-alan-deger">{{ alan.deger }}</span>
              </div>
            </div>
            <div v-else class="md-yon-bos">Gelen mesaj yok</div>
          </div>

          <div class="md-yonlu">
            <div class="md-yon-baslik giden">Giden Mesajlar:</div>
            <div v-if="gidenMesajlar[tipId]" class="md-alan-listesi">
              <div v-for="alan in gidenMesajlar[tipId]" :key="alan.ad" class="md-alan">
                <span class="md-alan-adi">{{ alan.ad }}</span>
                <span class="md-alan-deger">{{ alan.deger }}</span>
              </div>
            </div>
            <div v-else class="md-yon-bos">Giden mesaj yok</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useAracStore } from '@/stores/arac'

const aracStore = useAracStore()
const aramaMetni = ref('')
const seciliTipler = reactive(new Set<number>())

interface MesajTipi {
  id: number
  ad: string
}

interface MesajAlani {
  ad: string
  deger: string
}

// MAVLink v2 mesaj tipleri (en yaygın PX4 mesajları)
const mesajTipleri: MesajTipi[] = [
  { id: 0, ad: 'HEARTBEAT' },
  { id: 1, ad: 'SYS_STATUS' },
  { id: 24, ad: 'GPS_RAW_INT' },
  { id: 29, ad: 'SCALED_PRESSURE' },
  { id: 30, ad: 'ATTITUDE' },
  { id: 31, ad: 'ATTITUDE_QUATERNION' },
  { id: 32, ad: 'LOCAL_POSITION_NED' },
  { id: 33, ad: 'GLOBAL_POSITION_INT' },
  { id: 36, ad: 'SERVO_OUTPUT_RAW' },
  { id: 42, ad: 'MISSION_CURRENT' },
  { id: 62, ad: 'NAV_CONTROLLER_OUTPUT' },
  { id: 65, ad: 'RC_CHANNELS' },
  { id: 74, ad: 'VFR_HUD' },
  { id: 76, ad: 'COMMAND_ACK' },
  { id: 77, ad: 'COMMAND_LONG' },
  { id: 105, ad: 'HIGHRES_IMU' },
  { id: 111, ad: 'TIMESYNC' },
  { id: 125, ad: 'POWER_STATUS' },
  { id: 141, ad: 'ALTITUDE' },
  { id: 147, ad: 'BATTERY_STATUS' },
  { id: 148, ad: 'AUTOPILOT_VERSION' },
  { id: 230, ad: 'ESTIMATOR_STATUS' },
  { id: 231, ad: 'WIND_COV' },
  { id: 241, ad: 'VIBRATION' },
  { id: 242, ad: 'HOME_POSITION' },
  { id: 245, ad: 'EXTENDED_SYS_STATE' },
  { id: 253, ad: 'STATUSTEXT' },
  { id: 261, ad: 'ODOMETRY' },
  { id: 264, ad: 'UTM_GLOBAL_POSITION' },
  { id: 330, ad: 'OBSTACLE_DISTANCE' },
  { id: 340, ad: 'UTM_GLOBAL_POSITION' },
  { id: 390, ad: 'COMPONENT_INFORMATION' },
  { id: 397, ad: 'COMPONENT_METADATA' },
]

const filtrelenmisListesi = computed(() => {
  if (!aramaMetni.value) return mesajTipleri
  const arama = aramaMetni.value.toUpperCase()
  return mesajTipleri.filter(t => t.ad.includes(arama))
})

const tipToggle = (id: number) => {
  if (seciliTipler.has(id)) {
    seciliTipler.delete(id)
  } else {
    seciliTipler.add(id)
  }
}

const tipKaldir = (id: number) => {
  seciliTipler.delete(id)
}

// Gerçek zamanlı mesaj alanları (store'dan beslenir)
const gelenMesajlar = computed<Record<number, MesajAlani[]>>(() => {
  const sonuc: Record<number, MesajAlani[]> = {}

  if (!aracStore.aracCevrimici) return sonuc

  // HEARTBEAT
  if (seciliTipler.has(0)) {
    sonuc[0] = [
      { ad: 'type', deger: '2 (FIXED_WING)' },
      { ad: 'autopilot', deger: '12 (PX4)' },
      { ad: 'base_mode', deger: aracStore.armed ? '209 (ARMED)' : '81 (DISARMED)' },
      { ad: 'custom_mode', deger: aracStore.ucusModu },
      { ad: 'system_status', deger: '4 (ACTIVE)' },
    ]
  }

  // SYS_STATUS
  if (seciliTipler.has(1)) {
    sonuc[1] = [
      { ad: 'voltage_battery', deger: `${(aracStore.bataryaVoltaj * 1000).toFixed(0)} mV` },
      { ad: 'current_battery', deger: `${(aracStore.bataryaAkim * 100).toFixed(0)} cA` },
      { ad: 'battery_remaining', deger: `${aracStore.bataryaYuzde}%` },
    ]
  }

  // GPS_RAW_INT
  if (seciliTipler.has(24)) {
    sonuc[24] = [
      { ad: 'fix_type', deger: `${aracStore.gpsFixTipi}` },
      { ad: 'lat', deger: `${(aracStore.enlem * 1e7).toFixed(0)}` },
      { ad: 'lon', deger: `${(aracStore.boylam * 1e7).toFixed(0)}` },
      { ad: 'satellites_visible', deger: `${aracStore.gpsSayisi}` },
      { ad: 'eph', deger: `${(aracStore.gpsHdop * 100).toFixed(0)}` },
    ]
  }

  // ATTITUDE
  if (seciliTipler.has(30)) {
    sonuc[30] = [
      { ad: 'roll', deger: `${(aracStore.roll * Math.PI / 180).toFixed(4)} rad` },
      { ad: 'pitch', deger: `${(aracStore.pitch * Math.PI / 180).toFixed(4)} rad` },
      { ad: 'yaw', deger: `${(aracStore.yaw * Math.PI / 180).toFixed(4)} rad` },
    ]
  }

  // GLOBAL_POSITION_INT
  if (seciliTipler.has(33)) {
    sonuc[33] = [
      { ad: 'lat', deger: `${(aracStore.enlem * 1e7).toFixed(0)}` },
      { ad: 'lon', deger: `${(aracStore.boylam * 1e7).toFixed(0)}` },
      { ad: 'alt', deger: `${(aracStore.yukseklik * 1000).toFixed(0)} mm` },
      { ad: 'relative_alt', deger: `${(aracStore.yapiYukseklik * 1000).toFixed(0)} mm` },
      { ad: 'hdg', deger: `${(aracStore.heading * 100).toFixed(0)} cdeg` },
    ]
  }

  // VFR_HUD
  if (seciliTipler.has(74)) {
    sonuc[74] = [
      { ad: 'airspeed', deger: `${aracStore.havaHizi.toFixed(2)} m/s` },
      { ad: 'groundspeed', deger: `${aracStore.yerHizi.toFixed(2)} m/s` },
      { ad: 'heading', deger: `${aracStore.heading.toFixed(0)} deg` },
      { ad: 'throttle', deger: '—' },
      { ad: 'alt', deger: `${aracStore.yukseklik.toFixed(2)} m` },
      { ad: 'climb', deger: '—' },
    ]
  }

  // BATTERY_STATUS
  if (seciliTipler.has(147)) {
    sonuc[147] = [
      { ad: 'id', deger: '0' },
      { ad: 'voltage', deger: `${(aracStore.bataryaVoltaj * 1000).toFixed(0)} mV` },
      { ad: 'current_battery', deger: `${(aracStore.bataryaAkim * 100).toFixed(0)} cA` },
      { ad: 'battery_remaining', deger: `${aracStore.bataryaYuzde}%` },
    ]
  }

  // HOME_POSITION
  if (seciliTipler.has(242)) {
    sonuc[242] = [
      { ad: 'latitude', deger: `${(aracStore.enlem * 1e7).toFixed(0)}` },
      { ad: 'longitude', deger: `${(aracStore.boylam * 1e7).toFixed(0)}` },
      { ad: 'altitude', deger: `${(aracStore.yukseklik * 1000).toFixed(0)} mm` },
    ]
  }

  return sonuc
})

const gidenMesajlar = computed<Record<number, MesajAlani[] | null>>(() => {
  const sonuc: Record<number, MesajAlani[] | null> = {}
  for (const tipId of seciliTipler) {
    // COMMAND_LONG giden mesaj örneği
    if (tipId === 77) {
      sonuc[77] = [
        { ad: 'target_system', deger: '1' },
        { ad: 'target_component', deger: '1' },
        { ad: 'command', deger: '—' },
        { ad: 'confirmation', deger: '0' },
      ]
    } else {
      sonuc[tipId] = null
    }
  }
  return sonuc
})
</script>

<style scoped>
.mavlink-denetci {
  display: flex;
  height: 100%;
  gap: 1px;
  background: rgba(255, 255, 255, 0.04);
}

.md-sol {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.2);
  padding: 12px;
}

.md-sag {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.2);
  padding: 12px;
  overflow-y: auto;
}

.md-bolum-baslik {
  font-size: 12px;
  font-weight: 600;
  color: var(--tg-metin);
  margin-bottom: 10px;
}

.md-arama {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.md-arama .panel-giris {
  flex: 1;
  padding: 6px 8px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: var(--tg-turuncu);
  outline: none;
}

.md-arama .panel-giris:focus {
  border-color: var(--tg-turuncu);
}

.md-sifirla {
  padding: 4px 8px !important;
  font-size: 10px !important;
  min-width: 0 !important;
}

.md-liste {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.md-liste-item {
  padding: 6px 10px;
  font-size: 12px;
  font-family: 'Roboto Mono', 'Consolas', monospace;
  color: var(--tg-metin-soluk);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
  user-select: none;
}

.md-liste-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--tg-metin);
}

.md-liste-item-aktif {
  background: rgba(255, 128, 0, 0.12) !important;
  color: var(--tg-turuncu) !important;
  font-weight: 600;
}

.md-bos {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--tg-metin-cok-soluk);
  font-size: 13px;
}

.md-degerler {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.md-mesaj-kutu {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  overflow: hidden;
}

.md-mesaj-baslik {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.md-mesaj-adi {
  font-size: 13px;
  font-weight: 700;
  font-family: 'Roboto Mono', monospace;
  color: var(--tg-metin);
  letter-spacing: 0.5px;
}

.md-yonlu {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.md-yonlu:last-child {
  border-bottom: none;
}

.md-yon-baslik {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.md-yon-baslik.gelen {
  color: var(--tg-cyan);
}

.md-yon-baslik.giden {
  color: var(--tg-turuncu);
}

.md-yon-bos {
  font-size: 11px;
  color: var(--tg-metin-cok-soluk);
  font-style: italic;
}

.md-alan-listesi {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.md-alan {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 0;
}

.md-alan-adi {
  font-size: 11px;
  font-family: 'Roboto Mono', monospace;
  color: var(--tg-metin-soluk);
}

.md-alan-deger {
  font-size: 11px;
  font-family: 'Roboto Mono', monospace;
  color: var(--tg-metin);
  font-variant-numeric: tabular-nums;
}
</style>
