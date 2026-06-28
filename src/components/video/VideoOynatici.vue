<template>
  <div class="video-oynatici cam-panel-koyu">
    <div class="video-baslik">
      <v-icon size="16" class="mr-1">mdi-video</v-icon>
      <span>CANLI VİDEO</span>
      <div class="video-sag">
        <input
          v-model="videoUrl"
          type="text"
          class="video-url-giris"
          placeholder="rtsp:// veya http:// akış adresi"
          @keyup.enter="akisiBaslat"
        />
        <button class="tg-buton tg-buton-cam video-btn" @click="akisiBaslat">
          <v-icon size="14">mdi-play</v-icon>
        </button>
        <button
          class="tg-buton video-btn webcam-btn"
          :class="webcamAktif ? 'webcam-btn-aktif' : 'tg-buton-cam'"
          @click="webcamBaslat"
          title="Webcam bağla / kes"
        >
          <v-icon size="14">{{ webcamAktif ? 'mdi-camera-off' : 'mdi-camera' }}</v-icon>
          <span>{{ webcamAktif ? 'Kes' : 'Webcam' }}</span>
        </button>
      </div>
    </div>

    <!-- ROS2 topic satırı -->
    <div class="video-ros2-satir">
      <v-icon size="13" color="var(--tg-cyan)" class="mr-1">mdi-robot-industrial</v-icon>
      <input
        v-model="ros2Topic"
        type="text"
        class="video-url-giris"
        placeholder="/camera/image_raw/compressed"
      />
      <span v-if="ros2Aktif" class="ros2-fps">{{ ros2Fps }} fps</span>
      <button
        class="tg-buton video-btn"
        :class="ros2Aktif ? 'ros2-btn-aktif' : 'tg-buton-cam'"
        @click="ros2BaslaBirak"
      >
        <v-icon size="14">{{ ros2Aktif ? 'mdi-stop' : 'mdi-broadcast' }}</v-icon>
        <span>{{ ros2Aktif ? 'Durdur' : 'ROS2' }}</span>
      </button>
    </div>

    <!-- GStreamer hızlı bağlantı satırı -->
    <div class="video-gst-satir">
      <v-icon size="13" color="var(--tg-turuncu)" class="mr-1">mdi-video-wireless</v-icon>
      <span class="gst-etiket">GStreamer</span>
      <input
        v-model="gstIp"
        type="text"
        class="video-url-giris gst-ip-giris"
        placeholder="192.168.1.100"
      />
      <span class="gst-ayirac">:</span>
      <input
        v-model="gstPort"
        type="text"
        class="video-url-giris gst-port-giris"
        placeholder="8080"
      />
      <button
        class="tg-buton video-btn tg-buton-cam gst-btn"
        title="MJPEG akışına bağlan (http://{ip}:{port})"
        @click="gstMjpegBaglan"
      >
        <v-icon size="14">mdi-play-network</v-icon>
        <span>MJPEG</span>
      </button>
      <button
        class="tg-buton video-btn tg-buton-cam gst-btn"
        title="go2rtc WebRTC akışına bağlan (http://{ip}:1984/api/whep?src=camera)"
        @click="gstWebrtcBaglan"
      >
        <v-icon size="14">mdi-broadcast</v-icon>
        <span>WebRTC</span>
      </button>
    </div>

    <div class="video-alan">
      <!-- ROS2 topic canvas akışı -->
      <canvas v-if="ros2Aktif" ref="canvasRef" class="video-eleman" />

      <!-- HTTP MJPEG akışı (<img> ile — multipart/x-mixed-replace) -->
      <img v-else-if="mjpegAktif" :src="videoUrl" class="video-eleman" @error="mjpegHata" />

      <!-- WebRTC akışı -->
      <video
        v-else-if="aktif"
        ref="videoRef"
        autoplay
        muted
        playsinline
        class="video-eleman"
      />

      <!-- Akış yok durumu -->
      <div v-else class="video-bos">
        <v-icon size="56" color="rgba(255,255,255,0.15)">mdi-video-off-outline</v-icon>
        <p>Video akışı bekleniyor</p>
        <p class="video-ipucu">Akış adresini girin veya kamera bağlayın</p>
      </div>

      <!-- Telemetri overlay -->
      <div v-if="(aktif || mjpegAktif || ros2Aktif) && overlayGoster" class="video-overlay">
        <div class="overlay-sol">
          <span>{{ aracStore.yerHizi.toFixed(1) }} m/s</span>
          <span>{{ aracStore.yukseklik.toFixed(0) }} m</span>
        </div>
        <div class="overlay-sag">
          <span>{{ aracStore.heading.toFixed(0) }}°</span>
          <span>{{ aracStore.ucusModu }}</span>
        </div>
        <div class="overlay-alt">
          <span>{{ aracStore.enlem.toFixed(5) }}, {{ aracStore.boylam.toFixed(5) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onUnmounted } from 'vue'
import { useAracStore } from '@/stores/arac'
import { topicAboneOl, topicAbonelikIptal, rosbridgeDurumu } from '@/libs/ros2/rosbridge-baglanti'

const aracStore = useAracStore()
const videoRef  = ref<HTMLVideoElement>()
const canvasRef = ref<HTMLCanvasElement>()
const videoUrl  = ref('')
const aktif      = ref(false)
const mjpegAktif = ref(false)
const overlayGoster = ref(true)
const webcamAktif   = ref(false)
let webcamStream: MediaStream | null = null

// ── GStreamer hızlı bağlantı ───────────────────────────────────────────────────
const gstIp   = ref('192.168.1.100')
const gstPort = ref('8080')

const gstMjpegBaglan = () => {
  const ip   = gstIp.value.trim()
  const port = gstPort.value.trim() || '8080'
  if (!ip) { (window as any).__toygunBildirim?.('IP adresi giriniz', 'uyari'); return }
  videoUrl.value = `http://${ip}:${port}`
  aktif.value = false
  ros2Aktif.value = false
  mjpegAktif.value = true
  ;(window as any).__toygunTerminal?.(`GStreamer MJPEG: http://${ip}:${port}`, 'ok')
  ;(window as any).__toygunBildirim?.('GStreamer MJPEG akışı başlatıldı', 'basari')
}

const gstWebrtcBaglan = async () => {
  const ip = gstIp.value.trim()
  if (!ip) { (window as any).__toygunBildirim?.('IP adresi giriniz', 'uyari'); return }
  videoUrl.value = `http://${ip}:1984/api/whep?src=camera`
  ros2Aktif.value = false
  mjpegAktif.value = false
  await akisiBaslat()
}

// ── ROS2 kamera topic ──────────────────────────────────────────────────────────
const ros2Topic = ref('/camera/image_raw/compressed')
const ros2Aktif = ref(false)
const ros2Fps   = ref(0)
let frameCount  = 0
let fpsInterval: ReturnType<typeof setInterval> | null = null

const ros2BaslaBirak = () => {
  const bildirim = (window as any).__toygunBildirim

  if (ros2Aktif.value) {
    topicAbonelikIptal(ros2Topic.value)
    ros2Aktif.value = false
    if (fpsInterval) { clearInterval(fpsInterval); fpsInterval = null }
    ros2Fps.value = 0
    ;(window as any).__toygunTerminal?.('ROS2 kamera akışı durduruldu', 'warn')
    return
  }

  if (rosbridgeDurumu.value !== 'baglandi') {
    bildirim?.('ROS2 bağlı değil — önce Ayarlar\'dan ROS2 bağlantısı kurun', 'uyari')
    return
  }

  ros2Aktif.value = true
  aktif.value = false   // video elementini gizle, canvas göster
  frameCount = 0
  ros2Fps.value = 0

  fpsInterval = setInterval(() => {
    ros2Fps.value = frameCount
    frameCount = 0
  }, 1000)

  topicAboneOl(ros2Topic.value, 'sensor_msgs/msg/CompressedImage', (msg: any) => {
    frameCount++
    const canvas = canvasRef.value
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.onload = () => {
      if (canvas.width !== img.width)  canvas.width  = img.width
      if (canvas.height !== img.height) canvas.height = img.height
      ctx.drawImage(img, 0, 0)
    }
    img.src = `data:image/${msg.format ?? 'jpeg'};base64,${msg.data}`
  })

  ;(window as any).__toygunTerminal?.(`ROS2 kamera: ${ros2Topic.value}`, 'ok')
  bildirim?.('ROS2 kamera akışı başlatıldı', 'basari')
}

const webcamBaslat = async () => {
  const bildirimFn = (window as any).__toygunBildirim
  if (webcamAktif.value) {
    webcamStream?.getTracks().forEach(t => t.stop())
    webcamStream = null
    webcamAktif.value = false
    aktif.value = false
    bildirimFn?.('Webcam bağlantısı kesildi', 'uyari')
    return
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    webcamStream = stream
    webcamAktif.value = true
    mjpegAktif.value = false
    aktif.value = true
    await nextTick()
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      videoRef.value.play()
    }
    bildirimFn?.('Webcam bağlandı', 'basari')
    ;(window as any).__toygunTerminal?.('Webcam akışı başlatıldı', 'ok')
  } catch (err: any) {
    const mesaj = err?.name === 'NotFoundError'
      ? 'Kamera bulunamadı — USB kamera bağlı mı?'
      : err?.name === 'NotAllowedError'
        ? 'Kamera izni reddedildi — tarayıcı ayarlarından izin ver'
        : `Webcam hatası: ${err?.message ?? 'bilinmiyor'}`
    bildirimFn?.(mesaj, 'hata')
  }
}

onUnmounted(() => {
  webcamStream?.getTracks().forEach(t => t.stop())
  if (ros2Aktif.value) topicAbonelikIptal(ros2Topic.value)
  if (fpsInterval) clearInterval(fpsInterval)
})

const mjpegHata = () => {
  ;(window as any).__toygunBildirim?.('MJPEG akışına bağlanılamadı — URL ve sunucu doğru mu?', 'hata')
  mjpegAktif.value = false
}

const akisiBaslat = async () => {
  if (!videoUrl.value) return

  const bildirim = (window as any).__toygunBildirim

  // HTTP → <img> ile MJPEG multipart stream (video elementi çalışmaz)
  if (videoUrl.value.startsWith('http')) {
    aktif.value = false
    mjpegAktif.value = true
    bildirim?.('MJPEG akışı başlatıldı', 'basari')
    ;(window as any).__toygunTerminal?.(`Video: ${videoUrl.value}`, 'ok')
    return
  }

  // WebRTC desteği (go2rtc veya benzeri)
  if (videoUrl.value.includes('webrtc') || videoUrl.value.includes('whep')) {
    try {
      const pc = new RTCPeerConnection()
      pc.addTransceiver('video', { direction: 'recvonly' })

      pc.ontrack = (event) => {
        aktif.value = true
        setTimeout(() => {
          if (videoRef.value) {
            videoRef.value.srcObject = event.streams[0]
          }
        }, 100)
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const yanit = await fetch(videoUrl.value, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: offer.sdp,
      })

      const answerSdp = await yanit.text()
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }))

      bildirim?.('WebRTC akışı bağlandı', 'basari')
    } catch (hata) {
      bildirim?.('WebRTC bağlantısı başarısız', 'hata')
      console.error('[Video]', hata)
    }
    return
  }

  bildirim?.('Desteklenmeyen akış formatı. HTTP veya WebRTC URL kullanın.', 'uyari')
}
</script>

<style scoped>
.video-oynatici {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.video-baslik {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--tg-metin-soluk);
  border-bottom: 1px solid var(--tg-divider);
}

.video-sag {
  margin-left: auto;
  display: flex;
  gap: 4px;
  align-items: center;
}

.video-url-giris {
  width: 220px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  color: var(--tg-metin);
  font-size: 11px;
  outline: none;
  font-family: 'Inter', monospace;
}

.video-url-giris:focus {
  border-color: var(--tg-turuncu);
}

.video-btn {
  padding: 4px 8px !important;
  min-width: 0 !important;
}

.webcam-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.webcam-btn-aktif {
  background: rgba(220, 38, 38, 0.1) !important;
  border: 1px solid rgba(220, 38, 38, 0.3) !important;
  color: var(--tg-tehlike) !important;
}

.video-ros2-satir {
  display: flex;
  align-items: center;
  padding: 5px 12px;
  gap: 4px;
  border-bottom: 1px solid var(--tg-divider);
  background: rgba(71, 199, 252, 0.03);
}

.ros2-fps {
  font-size: 10px;
  color: var(--tg-cyan);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  white-space: nowrap;
  min-width: 42px;
}

.ros2-btn-aktif {
  background: rgba(220, 38, 38, 0.1) !important;
  border: 1px solid rgba(220, 38, 38, 0.3) !important;
  color: var(--tg-tehlike) !important;
}

.video-gst-satir {
  display: flex;
  align-items: center;
  padding: 5px 12px;
  gap: 4px;
  border-bottom: 1px solid var(--tg-divider);
  background: rgba(255, 128, 0, 0.03);
}

.gst-etiket {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--tg-turuncu);
  white-space: nowrap;
  margin-right: 2px;
}

.gst-ip-giris {
  width: 130px !important;
}

.gst-port-giris {
  width: 50px !important;
}

.gst-ayirac {
  font-size: 13px;
  color: var(--tg-metin-soluk);
  line-height: 1;
}

.gst-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.video-alan {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.video-eleman {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.video-bos {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--tg-metin-cok-soluk);
}

.video-bos p {
  font-size: 13px;
}

.video-ipucu {
  font-size: 11px !important;
  color: var(--tg-metin-cok-soluk);
}

.video-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  padding: 12px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

.overlay-sol {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.overlay-sag {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: right;
}

.overlay-alt {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
}
</style>
