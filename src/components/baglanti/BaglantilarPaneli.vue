<template>
  <div class="diyalog-arka" @click.self="$emit('kapat')">
    <div class="bag-panel cam-panel-koyu">
      <div class="bag-ust">
        <div class="bag-baslik">
          <v-icon size="16" color="var(--tg-turuncu)" class="mr-2">mdi-lan-connect</v-icon>
          BAĞLANTILAR
        </div>
        <v-btn icon="mdi-close" size="small" variant="text" @click="$emit('kapat')" />
      </div>

      <div class="bag-icerik">

        <!-- ── Server Bağlantısı ── -->
        <div class="bag-bolum">
          <h4 class="bag-bolum-baslik">
            <v-icon size="14" class="mr-1">mdi-server-network</v-icon>
            Server Bağlantısı
          </h4>

          <div class="bag-satirlar-2">
            <div class="bag-alan">
              <label class="bag-etiket">IP Adresi</label>
              <input v-model="sunucuStore.ip" type="text" class="bag-giris" placeholder="127.0.0.25" :disabled="sunucuStore.bagliMi" />
            </div>
            <div class="bag-alan">
              <label class="bag-etiket">Port</label>
              <input v-model="sunucuStore.port" type="number" class="bag-giris" placeholder="5000" :disabled="sunucuStore.bagliMi" />
            </div>
          </div>

          <div class="bag-satirlar-2">
            <div class="bag-alan">
              <label class="bag-etiket">Kullanıcı Adı</label>
              <input v-model="sunucuStore.kullanici" type="text" class="bag-giris" placeholder="kullanici" :disabled="sunucuStore.bagliMi" />
            </div>
            <div class="bag-alan">
              <label class="bag-etiket">Şifre</label>
              <input v-model="sunucuStore.sifre" type="password" class="bag-giris" placeholder="••••••" :disabled="sunucuStore.bagliMi" />
            </div>
          </div>

          <div class="bag-alan">
            <label class="bag-etiket">Takım Numarası</label>
            <input v-model="sunucuStore.takimNo" type="number" class="bag-giris bag-giris-kisa" placeholder="39" :disabled="sunucuStore.bagliMi" />
          </div>

          <div class="bag-durum-satir">
            <div class="bag-durum" :class="sunucuStore.bagliMi ? 'durum-tamam' : 'durum-yok'">
              <div class="durum-led" />
              <span>{{ sunucuStore.bagliMi ? 'Giriş başarılı' : 'Bağlı değil' }}</span>
              <span v-if="sunucuStore.bagliMi" class="latency-metin">Gecikme: {{ sunucuStore.gecikme }} ms</span>
            </div>
            <button
              class="bag-buton"
              :class="sunucuStore.bagliMi ? 'bag-buton-kes' : 'bag-buton-baglan'"
              :disabled="sunucuBaglanIkonYukleniyor"
              @click="sunucuBaglantiToggle"
            >
              {{ sunucuBaglanIkonYukleniyor ? 'Bağlanıyor...' : (sunucuStore.bagliMi ? 'Bağlantıyı Kes' : 'Bağlan') }}
            </button>
          </div>
        </div>

        <div class="bag-ayirici" />

        <!-- ── SITL Telemetri ── -->
        <div class="bag-bolum">
          <h4 class="bag-bolum-baslik">
            <v-icon size="14" class="mr-1">mdi-antenna</v-icon>
            SITL Telemetri
          </h4>

          <div class="bag-alan">
            <label class="bag-etiket">Bağlantı Dizesi</label>
            <input v-model="sitl.baglantiDizesi" type="text" class="bag-giris" placeholder="p:172.22.80.1:14551" />
          </div>

          <div class="bag-durum-satir">
            <div class="bag-durum" :class="sitl.bagliMi ? 'durum-tamam' : 'durum-yok'">
              <div class="durum-led" />
              <span>{{ sitl.bagliMi ? 'CONNECTED' : 'DISCONNECTED' }}</span>
            </div>
            <button
              class="bag-buton"
              :class="sitl.bagliMi ? 'bag-buton-kes' : 'bag-buton-baglan'"
              @click="sitlBaglantiToggle"
            >
              {{ sitl.bagliMi ? 'SITL Kes' : 'SITL Bağlan' }}
            </button>
          </div>
        </div>

        <div class="bag-ayirici" />

        <!-- ── Sunucu Zaman Senkronu ── -->
        <div class="bag-bolum">
          <h4 class="bag-bolum-baslik">
            <v-icon size="14" class="mr-1">mdi-clock-sync</v-icon>
            Sunucu Zaman Senkronu
          </h4>

          <div class="zaman-tablo">
            <div class="zaman-satir">
              <span class="zaman-etiket">Yerel Saat</span>
              <span class="zaman-deger">{{ yerelSaat }}</span>
            </div>
            <div class="zaman-satir">
              <span class="zaman-etiket">Sunucu Saati</span>
              <span class="zaman-deger">{{ sunucuStore.bagliMi ? (sunucuStore.sunucuZamani ?? '—:—:—') : '—:—:—' }}</span>
            </div>
            <div class="zaman-satir">
              <span class="zaman-etiket">Fark</span>
              <span class="zaman-deger" :class="sunucuStore.zamanFarkKritik ? 'deger-uyari' : ''">
                {{ sunucuStore.bagliMi ? sunucuStore.zamanFarki + ' ms' : '— ms' }}
              </span>
            </div>
          </div>

          <button
            class="bag-buton bag-buton-tam bag-buton-mavi"
            :disabled="!sunucuStore.bagliMi"
            @click="zamanSenkronla"
          >
            <v-icon size="13" class="mr-1">mdi-sync</v-icon>
            Zamanı Senkronla
          </button>
        </div>

        <div class="bag-ayirici" />

        <!-- ── USB / MAVLink ── -->
        <div class="bag-bolum">
          <h4 class="bag-bolum-baslik">
            <v-icon size="14" class="mr-1">mdi-usb-port</v-icon>
            USB / MAVLink
          </h4>

          <!-- Cihaz chip (seçili port bilgisi) -->
          <div
            v-if="usb.port && portBilgisiAl(usb.port)"
            class="usb-cihaz-chip"
            :class="portBilgisiAl(usb.port)?.pixhawkMu ? 'usb-chip-pixhawk' : ''"
          >
            <v-icon size="12">{{ portBilgisiAl(usb.port)?.pixhawkMu ? 'mdi-airplane' : 'mdi-chip' }}</v-icon>
            {{ portBilgisiAl(usb.port)?.cihazTipi }}
            <span class="usb-chip-vid">{{ portBilgisiAl(usb.port)?.vendorId }}:{{ portBilgisiAl(usb.port)?.productId }}</span>
          </div>

          <div class="bag-satirlar-2">
            <div class="bag-alan">
              <label class="bag-etiket">Port</label>
              <!-- Electron modunda dropdown, web modunda text input -->
              <select
                v-if="elektronModu && portListesi.length > 0"
                v-model="usb.port"
                class="bag-giris bag-secim"
                :disabled="usb.bagliMi || usb.yukleniyor"
              >
                <option value="" disabled>-- Port seç --</option>
                <option v-for="p in portListesi" :key="p.yol" :value="p.yol">
                  {{ p.pixhawkMu ? '★ ' : '' }}{{ p.yol }} — {{ p.cihazTipi !== 'Bilinmeyen' ? p.cihazTipi : (p.uretici || p.yol) }}
                </option>
              </select>
              <div v-else-if="elektronModu && portListesi.length === 0" class="usb-bos-uyari">
                USB cihaz bulunamadı
              </div>
              <input v-else v-model="usb.port" type="text" class="bag-giris" placeholder="COM3 / /dev/ttyUSB0" />
            </div>
            <div class="bag-alan">
              <label class="bag-etiket">Baud Rate</label>
              <select v-model="usb.baud" class="bag-giris bag-secim" :disabled="usb.bagliMi || usb.yukleniyor">
                <option v-for="b in baudRatelar" :key="b" :value="b">{{ b }}</option>
              </select>
            </div>
          </div>

          <div class="bag-durum-satir">
            <div class="bag-durum" :class="usb.bagliMi ? 'durum-tamam' : 'durum-yok'">
              <div class="durum-led" />
              <span>{{ usb.yukleniyor ? 'Bağlanıyor...' : (usb.bagliMi ? 'Bağlandı' : 'Bağlı Değil') }}</span>
            </div>
            <button
              class="bag-buton"
              :class="usb.bagliMi ? 'bag-buton-kes' : 'bag-buton-baglan'"
              :disabled="usb.yukleniyor || (!usb.bagliMi && !usb.port)"
              @click="usbBaglantiToggle"
            >
              {{ usb.yukleniyor ? 'Bağlanıyor...' : (usb.bagliMi ? 'Bağlantıyı Kes' : 'Bağlan') }}
            </button>
          </div>
        </div>

        <div class="bag-ayirici" />

        <!-- ── Video ── -->
        <div class="bag-bolum">
          <h4 class="bag-bolum-baslik">
            <v-icon size="14" class="mr-1">mdi-video</v-icon>
            Video
          </h4>

          <div class="bag-alan">
            <label class="bag-etiket">Kamera</label>
            <select v-model="video.seciliKamera" class="bag-giris bag-secim">
              <option v-for="k in kameralar" :key="k" :value="k">{{ k }}</option>
            </select>
          </div>

          <button
            class="bag-buton bag-buton-tam"
            :class="video.aktif ? 'bag-buton-kes' : 'bag-buton-baglan'"
            @click="videoToggle"
          >
            <v-icon size="13" class="mr-1">{{ video.aktif ? 'mdi-stop' : 'mdi-play' }}</v-icon>
            {{ video.aktif ? 'Videoyu Durdur' : 'Videoyu Başlat' }}
          </button>
        </div>

        <div class="bag-ayirici" />

        <!-- ── Simülasyon Modu ── -->
        <div class="bag-bolum">
          <h4 class="bag-bolum-baslik">
            <v-icon size="14" class="mr-1" color="var(--tg-turuncu)">mdi-airplane-settings</v-icon>
            Simülasyon Modu
          </h4>

          <div class="sim-durum-satir">
            <div class="bag-durum" :class="aracStore.simuleAktif ? 'durum-tamam' : 'durum-yok'">
              <div class="durum-led" />
              <span>{{ aracStore.simuleAktif ? 'Simülasyon Aktif' : 'Simülasyon Kapalı' }}</span>
            </div>
          </div>

          <div class="bag-satirlar-2" style="margin-top: 8px;">
            <button
              class="bag-buton bag-buton-tam bag-buton-baglan"
              :disabled="aracStore.simuleAktif"
              @click="simuleBaslat"
            >
              <v-icon size="13" class="mr-1">mdi-play-circle</v-icon>
              Başlat
            </button>
            <button
              class="bag-buton bag-buton-tam bag-buton-kes"
              :disabled="!aracStore.simuleAktif"
              @click="simuleDurdur"
            >
              <v-icon size="13" class="mr-1">mdi-stop-circle</v-icon>
              Durdur
            </button>
          </div>

          <div v-if="aracStore.simuleAktif" class="sim-bilgi">
            <v-icon size="12" class="mr-1" color="var(--tg-turuncu)">mdi-information-outline</v-icon>
            Gerçekçi telemetri üretiyor — Ankara üstü devriye
          </div>
        </div>

        <div class="bag-ayirici" />

        <!-- ── Kamikaze ── -->
        <div class="bag-bolum">
          <h4 class="bag-bolum-baslik" style="color: var(--tg-tehlike);">
            <v-icon size="14" color="var(--tg-tehlike)" class="mr-1">mdi-target</v-icon>
            Kamikaze
          </h4>
          <button class="bag-buton bag-buton-tam bag-buton-tehlike" @click="kamikazeOnayla">
            <v-icon size="13" class="mr-1">mdi-alert-octagon</v-icon>
            Kamikaze Onayla
          </button>
        </div>

      </div>
    </div>
  </div>

  <!-- Kamikaze onay diyalogu -->
  <teleport to="body">
    <div v-if="kamikazeOnayGoster" class="diyalog-arka-ic" @click.self="kamikazeOnayGoster = false">
      <div class="onay-kutu cam-panel-koyu">
        <v-icon size="40" color="var(--tg-tehlike)" class="mb-2">mdi-alert-octagon</v-icon>
        <h3>Kamikaze Modu Onayı</h3>
        <p>Bu komut geri alınamaz. Devam etmek istiyor musunuz?</p>
        <div class="bag-alan" style="width:100%; text-align:left; margin-top:4px;">
          <label class="bag-etiket">QR Metni</label>
          <input
            v-model="kamikazeQrMetni"
            type="text"
            class="bag-giris"
            placeholder="teknofest2026"
          />
        </div>
        <div class="onay-butonlar">
          <button class="bag-buton bag-buton-cam" @click="kamikazeOnayGoster = false">İptal</button>
          <button class="bag-buton bag-buton-tehlike" @click="kamikazeBaslat">ONAYLA</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, watch } from 'vue'
import { useAracStore } from '@/stores/arac'
import { useSunucuStore } from '@/stores/sunucu'

defineEmits<{ (e: 'kapat'): void }>()

const aracStore   = useAracStore()
const sunucuStore = useSunucuStore()

const bildirim = (m: string, t: string) => { (window as any).__toygunBildirim?.(m, t) }
const termLog  = (m: string, t: string) => { (window as any).__toygunTerminal?.(m, t as any) }

/* ── Server ── */
const sunucuBaglanIkonYukleniyor = ref(false)

const sunucuBaglantiToggle = async () => {
  if (sunucuStore.bagliMi) {
    sunucuStore.kes()
    bildirim('Sunucu bağlantısı kesildi', 'uyari')
    termLog('Sunucu bağlantısı kesildi', 'warn')
  } else {
    sunucuBaglanIkonYukleniyor.value = true
    bildirim('Sunucuya bağlanılıyor...', 'bilgi')
    termLog(`Sunucuya bağlanılıyor: ${sunucuStore.ip}:${sunucuStore.port}`, 'info')
    try {
      const sonuc = await sunucuStore.baglan()
      if (sonuc.basarili) {
        bildirim('Sunucu bağlantısı kuruldu', 'basari')
      } else {
        bildirim(`Sunucu bağlantısı başarısız`, 'hata')
      }
    } catch (e: any) {
      bildirim(`Bağlantı başarısız: ${e.message}`, 'hata')
      termLog(`İstisna: ${e.message}`, 'error')
    } finally {
      sunucuBaglanIkonYukleniyor.value = false
    }
  }
}

/* ── SITL ── */
const sitl = reactive({ baglantiDizesi: '', bagliMi: false })

const sitlBaglantiToggle = () => {
  if (sitl.bagliMi) {
    sitl.bagliMi = false
    bildirim('SITL bağlantısı kesildi', 'uyari')
    termLog('SITL bağlantısı kesildi', 'warn')
  } else {
    termLog(`SITL bağlantısı deneniyor: ${sitl.baglantiDizesi || 'otomatik'}`, 'info')
    setTimeout(() => {
      sitl.bagliMi = true
      bildirim('SITL bağlantısı kuruldu', 'basari')
      termLog('SITL bağlandı — telemetri akışı başladı', 'ok')
    }, 600)
  }
}

/* ── Zaman Sync ── */
const yerelSaat = ref('')
let saatZamanlayici: ReturnType<typeof setInterval>

const saatiGuncelle = () => {
  yerelSaat.value = new Date().toLocaleTimeString('tr-TR')
}

const zamanSenkronla = async () => {
  if (!sunucuStore.bagliMi) return
  await sunucuStore.zamanSenkronla()
  bildirim(`Zaman senkronize edildi — fark: ${sunucuStore.zamanFarki} ms`, 'basari')
  termLog(`Sunucu zaman senkronu: Δ${sunucuStore.zamanFarki} ms`, 'ok')
}

/* ── USB / MAVLink (gerçek Electron IPC) ── */
interface PortBilgisi {
  yol: string; uretici: string; aciklama: string
  vendorId: string; productId: string; cihazTipi: string; pixhawkMu: boolean
}

const elektronModu = computed(() => !!(window as any).toygunAPI?.portListele)
const baudRatelar = [9600, 57600, 115200, 230400, 460800]
const portListesi = ref<PortBilgisi[]>([])
let portDegisikligiHandler: ((p: PortBilgisi[]) => void) | null = null

const usb = reactive({ port: '', baud: 57600, bagliMi: false, yukleniyor: false })

const portBilgisiAl = (yol: string) => portListesi.value.find(p => p.yol === yol)

const usbBaglantiToggle = async () => {
  const api = (window as any).toygunAPI
  if (!api) { bildirim('Electron modu gerekli', 'uyari'); return }

  if (usb.bagliMi) {
    await api.serialKes().catch(() => {})
    usb.bagliMi = false
    aracStore.baglantiyiKes()
    bildirim('USB bağlantısı kesildi', 'uyari')
    termLog('USB/MAVLink bağlantısı kesildi', 'warn')
  } else {
    if (!usb.port) { bildirim('Lütfen bir COM port seçin', 'uyari'); return }
    usb.yukleniyor = true
    termLog(`USB bağlanıyor: ${usb.port} @ ${usb.baud}`, 'info')
    try {
      const sonuc = await api.serialBaglan(usb.port, usb.baud)
      if (sonuc.basarili) {
        usb.bagliMi = true
        aracStore.baglantiProtokolu = 'serial'
        const cihaz = portBilgisiAl(usb.port)
        bildirim(`${usb.port} bağlandı (${usb.baud} baud)`, 'basari')
        termLog(`USB bağlandı: ${usb.port} — ${cihaz?.cihazTipi ?? ''}`, 'ok')
      } else {
        bildirim(`Bağlantı hatası: ${sonuc.hata ?? 'Bilinmeyen hata'}`, 'hata')
        termLog(`USB bağlantı hatası: ${sonuc.hata ?? ''}`, 'error')
      }
    } catch (e: any) {
      bildirim(`Bağlantı başarısız: ${e.message}`, 'hata')
    } finally {
      usb.yukleniyor = false
    }
  }
}

/* ── Video ── */
const kameralar = ['Webcam 0', 'Webcam 1', 'USB Kamera']
const video = reactive({ seciliKamera: 'Webcam 0', aktif: false })

const videoToggle = () => {
  video.aktif = !video.aktif
  if (video.aktif) {
    bildirim(`${video.seciliKamera} başlatıldı`, 'basari')
    termLog(`Video başlatıldı: ${video.seciliKamera}`, 'ok')
  } else {
    bildirim('Video durduruldu', 'uyari')
    termLog('Video akışı durduruldu', 'warn')
  }
}

/* ── Simülasyon ── */
const simuleBaslat = () => {
  // simuleModuBaslat: 1.5sn sonra otomatik simülasyonu tetikler (gerçek bağlantı yoksa)
  aracStore.simuleModuBaslat()
  bildirim('Simülasyon modu başlatıldı', 'basari')
  termLog('── Simülasyon modu başlatıldı ──', 'sys')
}

const simuleDurdur = () => {
  aracStore.simuleDurdur()
  bildirim('Simülasyon modu durduruldu', 'uyari')
}

/* ── Kamikaze ── */
const kamikazeOnayGoster = ref(false)
const kamikazeQrMetni    = ref('')
let kamikazeBaslangicZamani: Date | null = null

const kamikazeOnayla = () => {
  kamikazeBaslangicZamani = new Date()
  kamikazeOnayGoster.value = true
}

const kamikazeBaslat = async () => {
  kamikazeOnayGoster.value = false
  const bitis = new Date()
  bildirim('KAMİKAZE MODU AKTİF!', 'hata')
  termLog('Kamikaze komutu gönderildi!', 'error')

  if (sunucuStore.bagliMi) {
    const baslangic = kamikazeBaslangicZamani ?? bitis
    const basarili = await sunucuStore.kamikazeBilgisiGonder(baslangic, bitis, kamikazeQrMetni.value)
    if (basarili) {
      bildirim('Kamikaze bilgisi sunucuya gönderildi', 'basari')
      termLog(`Kamikaze bilgisi gönderildi — QR: "${kamikazeQrMetni.value}"`, 'ok')
    } else {
      bildirim('Kamikaze bilgisi gönderilemedi', 'uyari')
      termLog('Kamikaze bilgisi sunucuya gönderilemedi', 'warn')
    }
  }

  kamikazeQrMetni.value = ''
  kamikazeBaslangicZamani = null
}

onMounted(async () => {
  saatiGuncelle()
  saatZamanlayici = setInterval(saatiGuncelle, 1000)

  // Electron modunda port listesini yükle + hot-plug dinleyici kur
  if (elektronModu.value) {
    const api = (window as any).toygunAPI
    portListesi.value = await api.portListele().catch(() => [])

    // İlk yüklemede Pixhawk varsa otomatik seç
    const px = portListesi.value.find(p => p.pixhawkMu)
    if (px) usb.port = px.yol

    if (api.onPortDegisikligi) {
      portDegisikligiHandler = (gelen: PortBilgisi[]) => {
        portListesi.value = gelen
        // Seçili port çıkarıldıysa bağlantıyı temizle
        if (usb.port && !gelen.some(p => p.yol === usb.port)) {
          usb.port = ''
          if (usb.bagliMi) {
            usb.bagliMi = false
            bildirim('USB cihaz çıkarıldı', 'uyari')
            termLog('USB cihaz bağlantısı kesildi (cihaz çıkarıldı)', 'warn')
          }
        }
      }
      api.onPortDegisikligi(portDegisikligiHandler)
    }

    // Store bağlantı durumu değişince USB state'ini senkronize et
    watch(() => aracStore.baglantiDurumu, (d) => {
      if (d === 'baglantiKesik') usb.bagliMi = false
      else if (d === 'baglandi' && aracStore.baglantiProtokolu === 'serial') usb.bagliMi = true
    })
  }
})

onUnmounted(() => {
  clearInterval(saatZamanlayici)
  if (portDegisikligiHandler) {
    ;(window as any).toygunAPI?.offPortDegisikligi(portDegisikligiHandler)
    portDegisikligiHandler = null
  }
})
</script>

<style scoped>
.diyalog-arka {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  z-index: 3000;
  padding: var(--tg-ust-bar-yukseklik) 0 var(--tg-alt-bar-yukseklik) 48px;
}

.bag-panel {
  width: 340px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.bag-ust {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--tg-divider);
}

.bag-baslik {
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--tg-metin);
}

.bag-icerik {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.bag-bolum { padding: 10px 0; }

.bag-bolum-baslik {
  display: flex;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: var(--tg-metin-soluk);
  text-transform: uppercase;
  margin-bottom: 10px;
}

.bag-ayirici {
  height: 1px;
  background: var(--tg-divider);
  margin: 0 -16px;
}

.bag-satirlar-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 8px;
}

.bag-alan { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }

.bag-etiket {
  font-size: 10px;
  font-weight: 600;
  color: var(--tg-metin-soluk);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.bag-giris {
  width: 100%;
  padding: 6px 10px;
  background: var(--tg-input-bg);
  border: 1px solid var(--tg-input-border);
  border-radius: 6px;
  color: var(--tg-metin);
  font-size: 12px;
  font-family: 'Inter', sans-serif;
  outline: none;
  transition: border-color 0.15s;
}
.bag-giris:focus    { border-color: var(--tg-turuncu); }
.bag-giris-kisa     { max-width: 100px; }
.bag-secim          {
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='rgba(0,0,0,0.4)'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  padding-right: 24px;
  cursor: pointer;
}
.bag-secim option { background: var(--tg-arka-plan); color: var(--tg-metin); }

.bag-durum-satir {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}

.bag-durum {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
}

.durum-led {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.durum-tamam .durum-led { background: var(--tg-basari); box-shadow: 0 0 5px var(--tg-basari); }
.durum-tamam { color: var(--tg-basari); }
.durum-yok   .durum-led { background: rgba(0,0,0,0.2); }
.durum-yok   { color: var(--tg-metin-soluk); }
.durum-hata  .durum-led { background: var(--tg-tehlike); }
.durum-hata  { color: var(--tg-tehlike); }

.latency-metin {
  font-size: 10px;
  color: var(--tg-metin-soluk);
  font-weight: 400;
  margin-left: 4px;
}

.bag-buton {
  padding: 5px 12px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 6px;
  border: 1px solid;
  cursor: pointer;
  white-space: nowrap;
  font-family: 'Inter', sans-serif;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.bag-buton:disabled { opacity: 0.4; cursor: not-allowed; }

.bag-buton-baglan {
  background: rgba(14, 165, 233, 0.1);
  border-color: rgba(14, 165, 233, 0.3);
  color: var(--tg-cyan);
}
.bag-buton-baglan:hover:not(:disabled) { background: rgba(14, 165, 233, 0.2); }

.bag-buton-kes {
  background: rgba(220, 38, 38, 0.1);
  border-color: rgba(220, 38, 38, 0.3);
  color: var(--tg-tehlike);
}
.bag-buton-kes:hover:not(:disabled) { background: rgba(220, 38, 38, 0.2); }

.bag-buton-mavi {
  background: rgba(14, 165, 233, 0.1);
  border-color: rgba(14, 165, 233, 0.3);
  color: var(--tg-cyan);
}
.bag-buton-mavi:hover:not(:disabled) { background: rgba(14, 165, 233, 0.2); }

.bag-buton-tehlike {
  background: rgba(220, 38, 38, 0.1);
  border-color: rgba(220, 38, 38, 0.3);
  color: var(--tg-tehlike);
}
.bag-buton-tehlike:hover:not(:disabled) { background: rgba(220, 38, 38, 0.2); }

.bag-buton-cam {
  background: var(--tg-input-bg);
  border-color: var(--tg-input-border);
  color: var(--tg-metin);
}
.bag-buton-cam:hover:not(:disabled) { background: var(--tg-hover-bg-2); }

.bag-buton-tam {
  width: 100%;
  justify-content: center;
  padding: 7px 12px;
}

/* Zaman tablosu */
.zaman-tablo {
  background: var(--tg-subtle-bg);
  border: 1px solid var(--tg-divider);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 10px;
}

.zaman-satir {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 1px solid var(--tg-divider);
  font-size: 11px;
}
.zaman-satir:last-child { border-bottom: none; }

.zaman-etiket { color: var(--tg-metin-soluk); }
.zaman-deger  { font-weight: 600; color: var(--tg-metin); font-variant-numeric: tabular-nums; }
.deger-uyari  { color: var(--tg-uyari); }

/* Simülasyon */
.sim-durum-satir { margin-bottom: 4px; }

.sim-bilgi {
  display: flex;
  align-items: center;
  margin-top: 8px;
  font-size: 10px;
  color: var(--tg-metin-soluk);
  background: rgba(255, 128, 0, 0.07);
  border: 1px solid rgba(255, 128, 0, 0.15);
  border-radius: 6px;
  padding: 5px 8px;
  line-height: 1.4;
}

/* Kamikaze onay kutusu */
.diyalog-arka-ic {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 4000;
}

.onay-kutu {
  width: 340px;
  padding: 28px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.onay-kutu h3 { font-size: 16px; font-weight: 700; color: var(--tg-metin); }
.onay-kutu p  { font-size: 13px; color: var(--tg-metin-soluk); line-height: 1.5; }

.onay-butonlar { display: flex; gap: 10px; margin-top: 6px; }

/* USB cihaz chip */
.usb-cihaz-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--tg-badge-bg, rgba(0,0,0,0.06));
  border: 1px solid var(--tg-divider);
  color: var(--tg-metin-soluk);
  margin-bottom: 8px;
  font-weight: 600;
}

.usb-chip-pixhawk {
  background: rgba(255, 128, 0, 0.08);
  border-color: rgba(255, 128, 0, 0.25);
  color: var(--tg-turuncu);
}

.usb-chip-vid {
  font-family: monospace;
  font-size: 9px;
  opacity: 0.6;
  margin-left: 2px;
}

.usb-bos-uyari {
  font-size: 11px;
  color: var(--tg-metin-soluk);
  font-style: italic;
  padding: 6px 0;
}
</style>
