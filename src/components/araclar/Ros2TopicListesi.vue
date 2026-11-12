<template>
  <div class="ros2-topic-listesi">
    <!-- ROS2 Bağlantı Durum Şeridi -->
    <div class="rt-durum-seridi" :class="`rt-durum-${rosbridgeDurumu}`">
      <span class="rt-durum-led" />
      <span class="rt-durum-metin">
        {{ rosbridgeDurumu === 'baglandi' ? 'ROS2 Bağlı' : rosbridgeDurumu === 'baglaniliyor' ? 'Bağlanılıyor...' : 'ROS2 Bağlı Değil — Ayarlar\'dan bağlanın' }}
      </span>
      <button v-if="rosbridgeDurumu === 'baglandi'" class="rt-yenile-btn" @click="topicListesiniYenile">
        <v-icon size="12">mdi-refresh</v-icon> Yenile
      </button>
    </div>

    <!-- Sol + Sağ panel kapsayıcı -->
    <div class="rt-icerik">
    <!-- Sol: Topic Listesi -->
    <div class="rt-sol">
      <h4 class="rt-bolum-baslik">PX4 ROS2 Topic'leri</h4>
      <div class="rt-arama">
        <input
          v-model="aramaMetni"
          type="text"
          class="panel-giris"
          placeholder="Topic ara..."
        />
      </div>
      <div class="rt-liste">
        <div
          v-for="topic in filtrelenmisListe"
          :key="topic.ad"
          class="rt-liste-item"
          :class="{
            'rt-aktif': secili === topic.ad,
            'rt-yon-in': topic.yon === 'in',
            'rt-yon-out': topic.yon === 'out',
          }"
          @click="secili = topic.ad"
        >
          <span class="rt-yon-etiket" :class="`yon-${topic.yon}`">{{ topic.yon === 'out' ? '←' : '→' }}</span>
          {{ topic.ad }}
        </div>
      </div>
    </div>

    <!-- Sağ: Topic Detayları -->
    <div class="rt-sag">
      <h4 class="rt-bolum-baslik">Topic Detayları</h4>

      <div v-if="!secili" class="rt-bos">
        <v-icon size="32" color="var(--tg-metin-cok-soluk)">mdi-robot</v-icon>
        <p>Bir topic seçerek mesaj yapısını görüntüleyin</p>
      </div>

      <div v-else class="rt-detay">
        <div class="rt-detay-baslik">
          <span class="rt-topic-adi">{{ secili }}</span>
          <span class="rt-msg-tipi">{{ secilenTopic?.msgTipi }}</span>
        </div>
        <div class="rt-bicim">
          <span class="rt-yon-badge" :class="`badge-${secilenTopic?.yon}`">
            {{ secilenTopic?.yon === 'out' ? 'FMU → GCS (Çıkış)' : 'GCS → FMU (Giriş)' }}
          </span>
          <span class="rt-hz">{{ secilenTopic?.hz ?? '—' }} Hz</span>
        </div>

        <div class="rt-alanlar">
          <div class="rt-alanlar-baslik">
            <span>Alan Adı</span>
            <span>Tip</span>
            <span>Değer</span>
          </div>
          <div v-for="alan in secilenTopic?.alanlar" :key="alan.ad" class="rt-alan-satir">
            <span class="rt-alan-adi">{{ alan.ad }}</span>
            <span class="rt-alan-tip">{{ alan.tip }}</span>
            <span class="rt-alan-deger">{{ canliDeger(secili!, alan.ad) }}</span>
          </div>
        </div>
      </div>
    </div>
    </div><!-- /rt-icerik -->
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import { useAracStore } from '@/stores/arac'
import {
  rosbridgeDurumu,
  topicAboneOl,
  topicAbonelikIptal,
  topicListesiAl,
} from '@/libs/ros2/rosbridge-baglanti'

const aracStore = useAracStore()
const aramaMetni = ref('')
const secili = ref<string | null>(null)

// Canlı ROS2 mesajları: topic adı → son gelen mesaj objesi
const canliMesajlar = ref<Map<string, Record<string, any>>>(new Map())

// Aktif abonelik
let aktifAbone: string | null = null

// Topic seçilince rosbridge'e abone ol
watch(secili, (yeniSecili, eskiSecili) => {
  if (eskiSecili) {
    topicAbonelikIptal(eskiSecili)
    aktifAbone = null
  }
  if (yeniSecili && rosbridgeDurumu.value === 'baglandi') {
    const topic = topicler.find(t => t.ad === yeniSecili)
    if (topic) {
      aktifAbone = yeniSecili
      topicAboneOl(yeniSecili, topic.msgTipi, (mesaj) => {
        canliMesajlar.value = new Map(canliMesajlar.value).set(yeniSecili, mesaj)
      })
    }
  }
})

// Bağlantı koptuğunda aboneliği temizle
watch(rosbridgeDurumu, (durum) => {
  if (durum !== 'baglandi') {
    canliMesajlar.value.clear()
    aktifAbone = null
  } else if (secili.value) {
    // Yeniden bağlandı, aktif topic'e yeniden abone ol
    const topic = topicler.find(t => t.ad === secili.value)
    if (topic) {
      topicAboneOl(secili.value, topic.msgTipi, (mesaj) => {
        canliMesajlar.value = new Map(canliMesajlar.value).set(secili.value!, mesaj)
      })
    }
  }
})

onUnmounted(() => {
  if (aktifAbone) topicAbonelikIptal(aktifAbone)
})

// Jetson'dan dinamik topic listesini çek
async function topicListesiniYenile() {
  try {
    const { isimler } = await topicListesiAl()
    // Bilinmeyen topic'leri listeye ekle (metadata olmadan)
    isimler.forEach((isim: string) => {
      if (!topicler.find(t => t.ad === isim)) {
        topicler.push({
          ad: isim,
          yon: isim.includes('/out/') ? 'out' : 'in',
          msgTipi: '',
          hz: 0,
          alanlar: [],
        })
      }
    })
  } catch (hata: any) {
    console.warn('[ROS2 Listesi] Topic listesi alınamadı:', hata.message)
  }
}

interface TopicAlani {
  ad: string
  tip: string
}

interface Ros2Topic {
  ad: string
  yon: 'in' | 'out'
  msgTipi: string
  hz: number
  alanlar: TopicAlani[]
}

const topicler: Ros2Topic[] = reactive([
  // ── Çıkış (FMU → GCS) ──
  {
    ad: '/fmu/out/vehicle_status',
    yon: 'out',
    msgTipi: 'px4_msgs/msg/VehicleStatus',
    hz: 5,
    alanlar: [
      { ad: 'timestamp', tip: 'uint64' },
      { ad: 'armed_time', tip: 'uint64' },
      { ad: 'takeoff_time', tip: 'uint64' },
      { ad: 'arming_state', tip: 'uint8' },
      { ad: 'nav_state', tip: 'uint8' },
      { ad: 'vehicle_type', tip: 'uint8' },
      { ad: 'failsafe', tip: 'bool' },
      { ad: 'system_id', tip: 'uint8' },
      { ad: 'component_id', tip: 'uint8' },
    ],
  },
  {
    ad: '/fmu/out/vehicle_local_position',
    yon: 'out',
    msgTipi: 'px4_msgs/msg/VehicleLocalPosition',
    hz: 50,
    alanlar: [
      { ad: 'timestamp', tip: 'uint64' },
      { ad: 'x', tip: 'float32' },
      { ad: 'y', tip: 'float32' },
      { ad: 'z', tip: 'float32' },
      { ad: 'vx', tip: 'float32' },
      { ad: 'vy', tip: 'float32' },
      { ad: 'vz', tip: 'float32' },
      { ad: 'heading', tip: 'float32' },
      { ad: 'xy_valid', tip: 'bool' },
      { ad: 'z_valid', tip: 'bool' },
    ],
  },
  {
    ad: '/fmu/out/vehicle_global_position',
    yon: 'out',
    msgTipi: 'px4_msgs/msg/VehicleGlobalPosition',
    hz: 50,
    alanlar: [
      { ad: 'timestamp', tip: 'uint64' },
      { ad: 'lat', tip: 'float64' },
      { ad: 'lon', tip: 'float64' },
      { ad: 'alt', tip: 'float32' },
      { ad: 'alt_ellipsoid', tip: 'float32' },
      { ad: 'eph', tip: 'float32' },
      { ad: 'epv', tip: 'float32' },
    ],
  },
  {
    ad: '/fmu/out/vehicle_attitude',
    yon: 'out',
    msgTipi: 'px4_msgs/msg/VehicleAttitude',
    hz: 100,
    alanlar: [
      { ad: 'timestamp', tip: 'uint64' },
      { ad: 'q[0]', tip: 'float32' },
      { ad: 'q[1]', tip: 'float32' },
      { ad: 'q[2]', tip: 'float32' },
      { ad: 'q[3]', tip: 'float32' },
    ],
  },
  {
    ad: '/fmu/out/sensor_combined',
    yon: 'out',
    msgTipi: 'px4_msgs/msg/SensorCombined',
    hz: 200,
    alanlar: [
      { ad: 'timestamp', tip: 'uint64' },
      { ad: 'gyro_rad[0]', tip: 'float32' },
      { ad: 'gyro_rad[1]', tip: 'float32' },
      { ad: 'gyro_rad[2]', tip: 'float32' },
      { ad: 'accelerometer_m_s2[0]', tip: 'float32' },
      { ad: 'accelerometer_m_s2[1]', tip: 'float32' },
      { ad: 'accelerometer_m_s2[2]', tip: 'float32' },
    ],
  },
  {
    ad: '/fmu/out/battery_status',
    yon: 'out',
    msgTipi: 'px4_msgs/msg/BatteryStatus',
    hz: 1,
    alanlar: [
      { ad: 'timestamp', tip: 'uint64' },
      { ad: 'voltage_v', tip: 'float32' },
      { ad: 'current_a', tip: 'float32' },
      { ad: 'remaining', tip: 'float32' },
      { ad: 'cell_count', tip: 'uint8' },
      { ad: 'temperature', tip: 'float32' },
    ],
  },
  {
    ad: '/fmu/out/vehicle_gps_position',
    yon: 'out',
    msgTipi: 'px4_msgs/msg/SensorGps',
    hz: 10,
    alanlar: [
      { ad: 'timestamp', tip: 'uint64' },
      { ad: 'lat', tip: 'int32' },
      { ad: 'lon', tip: 'int32' },
      { ad: 'alt', tip: 'int32' },
      { ad: 'satellites_used', tip: 'uint8' },
      { ad: 'fix_type', tip: 'uint8' },
      { ad: 'eph', tip: 'float32' },
      { ad: 'epv', tip: 'float32' },
    ],
  },
  {
    ad: '/fmu/out/estimator_status_flags',
    yon: 'out',
    msgTipi: 'px4_msgs/msg/EstimatorStatusFlags',
    hz: 1,
    alanlar: [
      { ad: 'timestamp', tip: 'uint64' },
      { ad: 'cs_pos_horiz_abs', tip: 'bool' },
      { ad: 'cs_pos_vert_abs', tip: 'bool' },
      { ad: 'cs_pred_pos_horiz_abs', tip: 'bool' },
      { ad: 'cs_gps', tip: 'bool' },
    ],
  },
  {
    ad: '/fmu/out/vehicle_land_detected',
    yon: 'out',
    msgTipi: 'px4_msgs/msg/VehicleLandDetected',
    hz: 2,
    alanlar: [
      { ad: 'timestamp', tip: 'uint64' },
      { ad: 'freefall', tip: 'bool' },
      { ad: 'ground_contact', tip: 'bool' },
      { ad: 'maybe_landed', tip: 'bool' },
      { ad: 'landed', tip: 'bool' },
    ],
  },
  {
    ad: '/fmu/out/failsafe_flags',
    yon: 'out',
    msgTipi: 'px4_msgs/msg/FailsafeFlags',
    hz: 1,
    alanlar: [
      { ad: 'timestamp', tip: 'uint64' },
      { ad: 'mode_req_angular_velocity', tip: 'bool' },
      { ad: 'mode_req_attitude', tip: 'bool' },
      { ad: 'mode_req_local_position', tip: 'bool' },
      { ad: 'mode_req_global_position', tip: 'bool' },
      { ad: 'mode_req_mission', tip: 'bool' },
    ],
  },
  // ── Giriş (GCS → FMU) ──
  {
    ad: '/fmu/in/vehicle_command',
    yon: 'in',
    msgTipi: 'px4_msgs/msg/VehicleCommand',
    hz: 0,
    alanlar: [
      { ad: 'timestamp', tip: 'uint64' },
      { ad: 'command', tip: 'uint32' },
      { ad: 'param1', tip: 'float32' },
      { ad: 'param2', tip: 'float32' },
      { ad: 'param3', tip: 'float32' },
      { ad: 'param5', tip: 'float64' },
      { ad: 'param6', tip: 'float64' },
      { ad: 'param7', tip: 'float32' },
      { ad: 'target_system', tip: 'uint8' },
      { ad: 'target_component', tip: 'uint8' },
    ],
  },
  {
    ad: '/fmu/in/offboard_control_mode',
    yon: 'in',
    msgTipi: 'px4_msgs/msg/OffboardControlMode',
    hz: 0,
    alanlar: [
      { ad: 'timestamp', tip: 'uint64' },
      { ad: 'position', tip: 'bool' },
      { ad: 'velocity', tip: 'bool' },
      { ad: 'acceleration', tip: 'bool' },
      { ad: 'attitude', tip: 'bool' },
      { ad: 'body_rate', tip: 'bool' },
    ],
  },
  {
    ad: '/fmu/in/trajectory_setpoint',
    yon: 'in',
    msgTipi: 'px4_msgs/msg/TrajectorySetpoint',
    hz: 0,
    alanlar: [
      { ad: 'timestamp', tip: 'uint64' },
      { ad: 'position[0]', tip: 'float32' },
      { ad: 'position[1]', tip: 'float32' },
      { ad: 'position[2]', tip: 'float32' },
      { ad: 'yaw', tip: 'float32' },
    ],
  },
  {
    ad: '/fmu/in/vehicle_visual_odometry',
    yon: 'in',
    msgTipi: 'px4_msgs/msg/VehicleOdometry',
    hz: 0,
    alanlar: [
      { ad: 'timestamp', tip: 'uint64' },
      { ad: 'position[0]', tip: 'float32' },
      { ad: 'position[1]', tip: 'float32' },
      { ad: 'position[2]', tip: 'float32' },
      { ad: 'q[0]', tip: 'float32' },
      { ad: 'q[1]', tip: 'float32' },
      { ad: 'q[2]', tip: 'float32' },
      { ad: 'q[3]', tip: 'float32' },
    ],
  },
]) // reactive dizisi — Jetson'dan gelen topic'ler push ile eklenir

const filtrelenmisListe = computed(() => {
  if (!aramaMetni.value) return topicler
  const arama = aramaMetni.value.toLowerCase()
  return topicler.filter(t => t.ad.toLowerCase().includes(arama) || t.msgTipi.toLowerCase().includes(arama))
})

const secilenTopic = computed(() => topicler.find(t => t.ad === secili.value) ?? null)

// Canlı değer: önce gerçek ROS2 verisi, yoksa store fallback
const canliDeger = (topicAd: string, alanAd: string): string => {
  // 1. Gerçek ROS2 verisi (rosbridge üzerinden)
  const rosMesaj = canliMesajlar.value.get(topicAd)
  if (rosMesaj !== undefined) {
    const deger = rosMesaj[alanAd]
    if (deger !== undefined) {
      if (typeof deger === 'number') return Number.isInteger(deger) ? `${deger}` : deger.toFixed(5)
      return String(deger)
    }
    return '—'
  }

  // 2. Store fallback (ROS2 bağlı değilse MAVLink store'undan)
  if (!aracStore.aracCevrimici) return '—'

  if (topicAd === '/fmu/out/vehicle_global_position') {
    if (alanAd === 'lat') return aracStore.enlem.toFixed(7)
    if (alanAd === 'lon') return aracStore.boylam.toFixed(7)
    if (alanAd === 'alt') return `${aracStore.yukseklik.toFixed(2)}`
  }
  if (topicAd === '/fmu/out/vehicle_status') {
    if (alanAd === 'arming_state') return aracStore.armed ? '2 (ARMED)' : '1 (STANDBY)'
    if (alanAd === 'nav_state') return aracStore.ucusModu
    if (alanAd === 'vehicle_type') return '2 (FIXED_WING)'
    if (alanAd === 'failsafe') return 'false'
  }
  if (topicAd === '/fmu/out/battery_status') {
    if (alanAd === 'voltage_v') return `${aracStore.bataryaVoltaj.toFixed(2)}`
    if (alanAd === 'current_a') return `${aracStore.bataryaAkim.toFixed(2)}`
    if (alanAd === 'remaining') return `${(aracStore.bataryaYuzde / 100).toFixed(2)}`
  }
  if (topicAd === '/fmu/out/vehicle_attitude') {
    if (alanAd === 'q[0]') return '1.0'
    if (alanAd === 'q[1]') return `${(aracStore.roll * Math.PI / 180).toFixed(4)}`
    if (alanAd === 'q[2]') return `${(aracStore.pitch * Math.PI / 180).toFixed(4)}`
    if (alanAd === 'q[3]') return `${(aracStore.yaw * Math.PI / 180).toFixed(4)}`
  }
  if (topicAd === '/fmu/out/vehicle_gps_position') {
    if (alanAd === 'satellites_used') return `${aracStore.gpsSayisi}`
    if (alanAd === 'fix_type') return `${aracStore.gpsFixTipi}`
    if (alanAd === 'lat') return `${(aracStore.enlem * 1e7).toFixed(0)}`
    if (alanAd === 'lon') return `${(aracStore.boylam * 1e7).toFixed(0)}`
  }
  if (alanAd === 'timestamp') return `${Date.now() * 1000}`
  return '—'
}
</script>

<style scoped>
.ros2-topic-listesi {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--tg-subtle-bg);
}

/* Durum şeridi */
.rt-durum-seridi {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  font-size: 11px;
  border-bottom: 1px solid var(--tg-divider);
  flex-shrink: 0;
}

.rt-durum-led {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.rt-durum-baglandi .rt-durum-led   { background: var(--tg-basari); box-shadow: 0 0 4px var(--tg-basari); }
.rt-durum-baglaniliyor .rt-durum-led { background: var(--tg-uyari); animation: pulse 1s infinite; }
.rt-durum-baglantiKesik .rt-durum-led { background: var(--tg-tehlike); }

.rt-durum-baglandi    { color: var(--tg-basari); }
.rt-durum-baglaniliyor { color: var(--tg-uyari); }
.rt-durum-baglantiKesik { color: var(--tg-metin-soluk); }

.rt-durum-metin { flex: 1; }

.rt-yenile-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  background: var(--tg-input-bg);
  border: 1px solid var(--tg-input-border);
  border-radius: 4px;
  color: var(--tg-metin-soluk);
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s;
}
.rt-yenile-btn:hover { border-color: var(--tg-turuncu); color: var(--tg-turuncu); }

/* Ana içerik alanı */
.rt-icerik {
  display: flex;
  flex: 1;
  gap: 1px;
  overflow: hidden;
}

.rt-sol {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.2);
  padding: 12px;
}

.rt-sag {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.2);
  padding: 12px;
  overflow-y: auto;
}

.rt-bolum-baslik {
  font-size: 12px;
  font-weight: 600;
  color: var(--tg-metin);
  margin-bottom: 10px;
}

.rt-arama .panel-giris {
  width: 100%;
  padding: 6px 8px;
  font-size: 12px;
  background: var(--tg-input-bg);
  border: 1px solid var(--tg-input-border);
  border-radius: 4px;
  color: var(--tg-metin);
  outline: none;
  margin-bottom: 8px;
}

.rt-liste {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.rt-liste-item {
  padding: 5px 8px;
  font-size: 11px;
  font-family: 'Roboto Mono', monospace;
  color: var(--tg-metin-soluk);
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s;
}

.rt-liste-item:hover {
  background: var(--tg-hover-bg-2);
  color: var(--tg-metin);
}

.rt-aktif {
  background: rgba(255, 128, 0, 0.12) !important;
  color: var(--tg-turuncu) !important;
  font-weight: 600;
}

.rt-yon-etiket {
  font-size: 10px;
  font-weight: 700;
  width: 14px;
  text-align: center;
}

.yon-out { color: var(--tg-cyan); }
.yon-in { color: var(--tg-turuncu); }

.rt-bos {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--tg-metin-soluk);
  font-size: 13px;
}

.rt-detay {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rt-detay-baslik {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rt-topic-adi {
  font-size: 14px;
  font-weight: 700;
  font-family: 'Roboto Mono', monospace;
  color: var(--tg-metin);
}

.rt-msg-tipi {
  font-size: 11px;
  color: var(--tg-cyan);
  font-family: 'Roboto Mono', monospace;
}

.rt-bicim {
  display: flex;
  gap: 12px;
  align-items: center;
}

.rt-yon-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 12px;
}

.badge-out {
  background: rgba(71, 199, 252, 0.12);
  color: var(--tg-cyan);
  border: 1px solid rgba(71, 199, 252, 0.2);
}

.badge-in {
  background: rgba(255, 128, 0, 0.12);
  color: var(--tg-turuncu);
  border: 1px solid rgba(255, 128, 0, 0.2);
}

.rt-hz {
  font-size: 11px;
  color: var(--tg-metin-soluk);
}

.rt-alanlar {
  border: 1px solid var(--tg-divider);
  border-radius: 6px;
  overflow: hidden;
}

.rt-alanlar-baslik {
  display: grid;
  grid-template-columns: 2fr 1fr 1.5fr;
  padding: 6px 10px;
  font-size: 10px;
  font-weight: 600;
  color: var(--tg-metin-soluk);
  background: var(--tg-subtle-bg);
  border-bottom: 1px solid var(--tg-divider);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.rt-alan-satir {
  display: grid;
  grid-template-columns: 2fr 1fr 1.5fr;
  padding: 4px 10px;
  border-bottom: 1px solid var(--tg-divider);
}

.rt-alan-satir:last-child {
  border-bottom: none;
}

.rt-alan-adi {
  font-size: 11px;
  font-family: 'Roboto Mono', monospace;
  color: var(--tg-metin-soluk);
}

.rt-alan-tip {
  font-size: 10px;
  font-family: 'Roboto Mono', monospace;
  color: var(--tg-metin-soluk);
}

.rt-alan-deger {
  font-size: 11px;
  font-family: 'Roboto Mono', monospace;
  color: var(--tg-metin);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
</style>
