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

    <div class="video-alan">
      <!-- WebRTC / HTTP akışı -->
      <video
        v-if="aktif"
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
      <div v-if="aktif && overlayGoster" class="video-overlay">
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

const aracStore = useAracStore()
const videoRef = ref<HTMLVideoElement>()
const videoUrl = ref('')
const aktif = ref(false)
const overlayGoster = ref(true)
const webcamAktif = ref(false)
let webcamStream: MediaStream | null = null

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
})

const akisiBaslat = async () => {
  if (!videoUrl.value) return

  const bildirim = (window as any).__toygunBildirim

  // HTTP/HLS akışı desteği
  if (videoUrl.value.startsWith('http')) {
    aktif.value = true
    setTimeout(() => {
      if (videoRef.value) {
        videoRef.value.src = videoUrl.value
        videoRef.value.play().catch(() => {
          bildirim?.('Video akışı başlatılamadı', 'hata')
          aktif.value = false
        })
      }
    }, 100)
    bildirim?.('Video akışı başlatılıyor...', 'bilgi')
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
