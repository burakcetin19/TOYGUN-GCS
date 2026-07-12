<template>
  <div class="ozel-modlar">
    <h3 class="modlar-baslik">
      <v-icon size="16" class="mr-1">mdi-lightning-bolt</v-icon>
      ÖZEL MODLAR
    </h3>

    <div class="mod-butonlar">
      <button
        class="tg-buton mod-buton"
        :class="kamikazeAktif ? 'kamikaze-reset' : 'kamikaze'"
        :disabled="!aracStore.aracCevrimici || kamikazeIslemde"
        @click="kamikazeTetikle"
      >
        <v-icon size="18" class="mr-2">{{ kamikazeAktif ? 'mdi-restart' : 'mdi-target' }}</v-icon>
        {{ kamikazeAktif ? 'KAMİKAZE RESET' : 'KAMİKAZE BAŞLAT' }}
      </button>

      <button
        class="tg-buton mod-buton it-dalasi"
        :disabled="!aracStore.aracCevrimici"
        @click="modCalistir('it-dalasi')"
      >
        <v-icon size="18" class="mr-2">mdi-sword-cross</v-icon>
        İT DALAŞI MODU
      </button>

      <button
        class="tg-buton mod-buton acil-inis"
        :disabled="!aracStore.aracCevrimici"
        @click="acilInisOnayi"
      >
        <v-icon size="18" class="mr-2">mdi-airplane-landing</v-icon>
        ACİL İNİŞ
      </button>
    </div>

    <div v-if="!aracStore.aracCevrimici" class="mod-uyari">
      <v-icon size="14">mdi-alert-circle-outline</v-icon>
      <span>Araç bağlı değil</span>
    </div>
  </div>

  <!-- Acil İniş Onay Diyalogu -->
  <teleport to="body">
    <div v-if="onayGoster" class="diyalog-arka" @click.self="onayGoster = false">
      <div class="diyalog cam-panel-koyu">
        <div class="diyalog-ikon">
          <v-icon size="48" color="#dc2626">mdi-alert-octagon</v-icon>
        </div>
        <h3 class="diyalog-baslik">Acil İniş Onayı</h3>
        <p class="diyalog-mesaj">Araç acil iniş moduna geçecek. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?</p>
        <div class="diyalog-butonlar">
          <button class="tg-buton tg-buton-cam" @click="onayGoster = false">İptal</button>
          <button class="tg-buton tg-buton-tehlike" @click="acilInisOnayla">ONAYLA</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAracStore } from '@/stores/arac'
import { servisCagir, rosbridgeDurumu } from '@/libs/ros2/rosbridge-baglanti'

const aracStore = useAracStore()
const onayGoster = ref(false)
const islemde = ref(false)
const kamikazeAktif = ref(false)     // true → RESET görünümü, false → BAŞLAT görünümü
const kamikazeIslemde = ref(false)   // yalnızca bu butona özel meşguliyet kilidi

const bildirim = (mesaj: string, tip: string) => {
  const fn = (window as any).__toygunBildirim
  if (fn) fn(mesaj, tip)
}

const termLog = (mesaj: string, tip: string) => {
  const fn = (window as any).__toygunTerminal
  if (fn) fn(mesaj, tip as any)
}

const ROS2_SERVISLER: Record<string, string> = {
  'it-dalasi': '/toygun/it_dalasi_modu',
  'acil-inis': '/toygun/acil_inis',
}

const KAMIKAZE_START_SERVIS = '/kamikaze/start_mission'
const KAMIKAZE_RESET_SERVIS = '/kamikaze/reset'

const kamikazeTetikle = async () => {
  if (kamikazeIslemde.value) return
  kamikazeIslemde.value = true

  if (rosbridgeDurumu.value !== 'baglandi') {
    bildirim('ROS2 bağlı değil — Ayarlar\'dan bağlanın', 'hata')
    kamikazeIslemde.value = false
    return
  }

  const eylemEtiketi = kamikazeAktif.value ? 'RESET' : 'BAŞLAT'
  const hedefServis = kamikazeAktif.value ? KAMIKAZE_RESET_SERVIS : KAMIKAZE_START_SERVIS

  try {
    termLog(`[ROS2] KAMİKAZE ${eylemEtiketi} → ${hedefServis} gönderiliyor...`, 'info')
    const yanit = await servisCagir(hedefServis, 'std_srvs/srv/Trigger')
    const mesaj = yanit.degerler?.message
    const basarili = yanit.basarili === true && yanit.degerler?.success === true

    if (basarili) {
      kamikazeAktif.value = !kamikazeAktif.value
      bildirim(`Kamikaze ${eylemEtiketi} başarılı — ${mesaj ?? 'komut kabul edildi'}`, 'basari')
      termLog(`[ROS2] ✓ ${hedefServis} → ${mesaj ?? 'başarılı'}`, 'ok')
    } else {
      bildirim(`Kamikaze ${eylemEtiketi} reddedildi — ${mesaj ?? 'FSM isteği reddetti'}`, 'hata')
      termLog(`[ROS2] ✗ ${hedefServis} → ${mesaj ?? 'reddedildi'}`, 'error')
    }
  } catch (hata: any) {
    bildirim(`Kamikaze ${eylemEtiketi}: ${hata.message}`, 'hata')
    termLog(`[ROS2] ✗ ${hedefServis} → ${hata.message}`, 'error')
  } finally {
    kamikazeIslemde.value = false
  }
}

const modCalistir = async (mod: string) => {
  if (islemde.value) return
  islemde.value = true

  const adlar: Record<string, string> = {
    'it-dalasi': 'İt Dalaşı Modu',
  }
  const servisAdi = ROS2_SERVISLER[mod]

  // ROS2 bağlı değilse uyar
  if (rosbridgeDurumu.value !== 'baglandi') {
    bildirim('ROS2 bağlı değil — Ayarlar\'dan bağlanın', 'hata')
    islemde.value = false
    return
  }

  try {
    termLog(`[ROS2] ${adlar[mod]} komutu gönderiliyor...`, 'info')
    const yanit = await servisCagir(servisAdi, 'std_srvs/srv/Trigger')
    if (yanit.basarili) {
      bildirim(`${adlar[mod]} aktifleştirildi!`, 'basari')
      termLog(`[ROS2] ✓ ${servisAdi} → başarılı`, 'ok')
    } else {
      bildirim(`${adlar[mod]}: Komut başarısız`, 'hata')
      termLog(`[ROS2] ✗ ${servisAdi} → başarısız`, 'hata')
    }
  } catch (hata: any) {
    bildirim(`${adlar[mod]}: ${hata.message}`, 'hata')
    termLog(`[ROS2] ✗ ${servisAdi} → ${hata.message}`, 'hata')
  } finally {
    islemde.value = false
  }
}

const acilInisOnayi = () => {
  onayGoster.value = true
}

const acilInisOnayla = async () => {
  onayGoster.value = false

  if (rosbridgeDurumu.value !== 'baglandi') {
    bildirim('ROS2 bağlı değil — Ayarlar\'dan bağlanın', 'hata')
    return
  }

  islemde.value = true
  try {
    termLog('[ROS2] ACİL İNİŞ komutu gönderiliyor...', 'warn')
    const yanit = await servisCagir(ROS2_SERVISLER['acil-inis'], 'std_srvs/srv/Trigger')
    if (yanit.basarili) {
      bildirim('Acil iniş komutu gönderildi!', 'uyari')
      termLog('[ROS2] ✓ /toygun/acil_inis → tetiklendi', 'ok')
    } else {
      bildirim('Acil iniş komutu başarısız!', 'hata')
      termLog('[ROS2] ✗ /toygun/acil_inis → başarısız', 'hata')
    }
  } catch (hata: any) {
    bildirim(`Acil iniş hatası: ${hata.message}`, 'hata')
    termLog(`[ROS2] ✗ /toygun/acil_inis → ${hata.message}`, 'hata')
  } finally {
    islemde.value = false
  }
}
</script>

<style scoped>
.ozel-modlar {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.modlar-baslik {
  display: flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.5px;
  color: var(--tg-metin-soluk);
  margin-bottom: 4px;
}

.mod-butonlar {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mod-buton {
  width: 100%;
  padding: 12px 14px;
  font-size: 12px;
  justify-content: flex-start;
  letter-spacing: 0.8px;
}

.kamikaze {
  background: rgba(255, 128, 0, 0.2);
  border: 1px solid rgba(255, 128, 0, 0.3);
  color: var(--tg-turuncu);
}

.kamikaze:hover:not(:disabled) {
  background: rgba(255, 128, 0, 0.35);
}

.kamikaze-reset {
  background: rgba(220, 38, 38, 0.2);
  border: 1px solid rgba(220, 38, 38, 0.35);
  color: var(--tg-tehlike);
}

.kamikaze-reset:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.4);
}

.it-dalasi {
  background: rgba(71, 199, 252, 0.15);
  border: 1px solid rgba(71, 199, 252, 0.25);
  color: var(--tg-cyan);
}

.it-dalasi:hover:not(:disabled) {
  background: rgba(71, 199, 252, 0.3);
}

.acil-inis {
  background: rgba(220, 38, 38, 0.2);
  border: 1px solid rgba(220, 38, 38, 0.35);
  color: var(--tg-tehlike);
}

.acil-inis:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.4);
}

.mod-uyari {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--tg-metin-cok-soluk);
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--tg-subtle-bg);
}

/* Diyalog */
.diyalog-arka {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3000;
}

.diyalog {
  width: 380px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
}

.diyalog-ikon { margin-bottom: 4px; }
.diyalog-baslik { font-size: 18px; font-weight: 600; color: var(--tg-metin); }
.diyalog-mesaj { font-size: 13px; color: var(--tg-metin-soluk); line-height: 1.5; }

.diyalog-butonlar {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}
</style>
