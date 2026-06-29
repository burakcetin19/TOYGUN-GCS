# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proje Özeti
PX4 tabanlı sabit kanatlı insansız hava araçları için geliştirilmiş özelleşmiş bir Yer Kontrol İstasyonu (GCS). Hem **Electron masaüstü uygulaması** hem de **web uygulaması** olarak çalışabilir. Referans proje: `../cockpit/` (BlueRobotics Cockpit, sadece okuma).

## Teknoloji Stack
| Katman | Teknoloji |
|---|---|
| UI Framework | Vue 3 (Composition API, `<script setup>`) |
| Dil | TypeScript |
| Build | Vite |
| Masaüstü | Electron 29 |
| UI Kütüphanesi | Vuetify 3 |
| State Yönetimi | Pinia |
| Harita | Leaflet |
| İkon | @mdi/font |

## Komutlar
```bash
npm run dev              # Web — tarayıcı geliştirme modu (http://localhost:5173)
npm run dev:electron     # Electron — masaüstü geliştirme modu
npm run build            # Electron için üretim build'i
npm run dist:win         # Windows klasör çıktısı (build + electron-packager)
npm run dist:win:installer  # Windows NSIS kurulum dosyası (electron-builder)
npm run typecheck        # TypeScript tip kontrolü
```

> `npm install` gerekebilir — uzak ortamda `node_modules` mevcut olmayabilir. Node.js kurulu olmalı.
> Linting yapılandırması (ESLint vb.) mevcut değil — tip kontrolü için yalnızca `typecheck` kullanılır.

## Dosya Yapısı
```
src/
├── App.vue                         # Kök bileşen (UstBar + YanBar + AltBar + router-view)
├── main.ts                         # Uygulama başlangıcı, Vuetify/Pinia kurulumu
├── router/index.ts                 # Hash history ile 3 route: /, /gorev, /ayarlar
│
├── views/
│   ├── UcusGorunumu.vue            # Ana uçuş ekranı (harita + HUD + terminal + bilgi paneli)
│   ├── GorevPlanlama.vue           # Waypoint planlama ekranı
│   └── Ayarlar.vue                 # Uygulama ayarları
│
├── stores/
│   ├── arac.ts                     # ANA STORE — tüm araç durumu, telemetri, ARM, simülasyon
│   ├── gorev.ts                    # Görev noktaları (Nokta interface), kaydet/yükle
│   └── ucusLogu.ts                 # Uçuş log kayıtları
│
├── components/
│   ├── layout/                     # UstBar, YanBar, AltBar
│   ├── harita/GorevHaritasi.vue    # Leaflet harita bileşeni
│   ├── hud/                        # HudGorunumu (yapay ufuk), PusulaCihazi
│   ├── arm/ArmKaydirici.vue        # ARM/DISARM kaydırıcısı
│   ├── baglanti/                   # BaglantiPaneli, BaglantilarPaneli
│   ├── telemetri/TelemetriPaneli   # Telemetri gösterge paneli
│   ├── gorev/                      # GorevKontrolListesi, OzelModlar (özel görev butonları)
│   ├── ucus/TerminalPanel.vue      # MAVLink terminal çıktısı
│   ├── video/VideoOynatici.vue     # Video akışı (planlandı)
│   ├── araclar/                    # MavlinkDenetci, TelemetriVeriGoruntule, Ros2TopicListesi
│   └── ortak/                      # BildirimCubugu, GuncellemeBildirimi
│
├── libs/mavlink/
│   ├── baglanti.ts                 # WebSocket bağlantı yöneticisi (mavlink2rest)
│   ├── donanim-dinleyici.ts        # Electron IPC MAVLink mesajlarını store'a yazar
│   ├── mesajlar.ts                 # MAVLink mesaj tipleri + PX4 uçuş modları haritası
│   └── komutlar.ts                 # MAVLink komut fonksiyonları (aşağıya bakınız)
│
├── libs/ros2/
│   └── rosbridge-baglanti.ts       # rosbridge WebSocket istemcisi (topic aboneliği, servis çağrısı)
│
├── electron/
│   ├── main.ts                     # Electron ana process
│   ├── preload.ts                  # Güvenli IPC köprüsü (portListele, serial/UDP/TCP bağlantı, donanımKes, onMavlinkMesaj, onBaglantiDurumu)
│   └── services/
│       ├── donanim-baglanti.ts     # Serial/UDP/TCP MAVLink bağlantı servisi (Electron ana process)
│       └── ros2-kopru.ts           # ROS2 topic/servis köprüsü (rclnodejs)
│
└── styles/global.css               # CSS değişkenleri (--tg-* prefix)
```

## State Mimarisi

### `useAracStore` (src/stores/arac.ts) — En kritik store
Tüm araç durumu, telemetri ve bağlantı burada yönetilir.

**Bağlantı durumları:** `'baglandi' | 'baglaniliyor' | 'baglantiKesik'`

**Telemetri alanları:**
- `yerHizi`, `havaHizi` (m/s)
- `yukseklik` (MSL metre), `yapiYukseklik` (AGL metre)
- `bataryaVoltaj` (V), `bataryaYuzde` (%), `bataryaAkim` (A)
- `gpsFixTipi` (0-6), `gpsSayisi`, `gpsHdop`
- `heading`, `enlem`, `boylam` — `pitch`, `roll`, `yaw` (derece)
- `armed` (bool), `ucusModu` (string)

**Bağlantı protokolü:** `baglantiProtokolu` ref → `'serial' | 'udp' | 'tcp' | 'websocket'`

**Simülasyon davranışı:** Simülasyon artık otomatik başlamaz; `simuleModuBaslat()` ile manuel tetiklenir (Ankara üzeri dairesel uçuş, 5 Hz). `simuleBaslat()` / `simuleDurdur()`.

**Global window köprüleri** (bileşenler arası event bus yerine):
- `window.__toygunTerminal(mesaj, tip)` → TerminalPanel'e log yazar
- `window.__toygunBildirim(mesaj, tip)` → BildirimCubugu snackbar tetikler
- `window.__toygunKilit` → harita kilitlenme boolean durumu

### `useGorevStore` (src/stores/gorev.ts)
`Nokta` interface: `{ id, enlem, boylam, yukseklik, sira }`. Görev JSON olarak dışa/içe aktarılır (`gorevDosyasiKaydet`, `gorevDosyasiYukle`).

## MAVLink Katmanı

### Bağlantı (src/libs/mavlink/baglanti.ts)
Varsayılan endpoint: `ws://192.168.1.1:6040/ws/mavlink` (mavlink2rest bridge).
Bağlantı kesilirse 3 sn sonra otomatik yeniden bağlanır.

**Dinlenen mesajlar ve store mapping:**
| Mesaj | Store alanları |
|---|---|
| `HEARTBEAT` | `armed`, `ucusModu` |
| `VFR_HUD` | `yerHizi`, `havaHizi`, `yukseklik`, `heading` |
| `SYS_STATUS` | `bataryaVoltaj` (mV→V), `bataryaAkim` (cA→A), `bataryaYuzde` |
| `ATTITUDE` | `pitch`, `roll`, `yaw` (rad→derece) |
| `GLOBAL_POSITION_INT` | `enlem`, `boylam` (×1e7), `yukseklik` (mm→m), `yapiYukseklik` |
| `GPS_RAW_INT` | `gpsFixTipi`, `gpsSayisi`, `gpsHdop` (×100) |

### Komutlar (src/libs/mavlink/komutlar.ts)
```ts
aracArmDisarm(arm: boolean)          // MAV_CMD_COMPONENT_ARM_DISARM
ucusModuDegistir(customMode: number) // SET_MODE
eveDon()                             // AUTO.RTL (mod 5)
inisYap()                            // AUTO.LAND (mod 11)
gorevBaslat()                        // MAV_CMD_MISSION_START
evNoktasiAyarla(enlem, boylam, alt)  // MAV_CMD_DO_SET_HOME
gorevYukle(noktalar[])               // MISSION_COUNT + MISSION_ITEM_INT (50ms aralıklı)
```

### PX4 Uçuş Modları (src/libs/mavlink/mesajlar.ts — PX4_UCM_MODLARI)
`0:MANUAL, 1:ALTCTL, 2:POSCTL, 3:AUTO.MISSION, 4:AUTO.LOITER, 5:AUTO.RTL, 6:ACRO, 8:STABILIZED, 9:OFFBOARD, 10:AUTO.TAKEOFF, 11:AUTO.LAND, 12:AUTO.FOLLOW, 14:AUTO.PRECLAND`

## Çok Protokol Bağlantı Mimarisi

### MAVLink Bağlantı Türleri
`BaglantiPaneli.vue` üç protokolü destekler:
| Protokol | Kullanım | Servis |
|---|---|---|
| **Serial** | COM port otomatik algılama dropdown | `donanim-baglanti.ts` → serialport |
| **UDP** | host + port giriş | `donanim-baglanti.ts` → dgram |
| **TCP** | host + port giriş | `donanim-baglanti.ts` → net.Socket |
| **WebSocket** | mavlink2rest REST köprüsü | `baglanti.ts` (mevcut) |

**Electron IPC akışı:** `BaglantiPaneli` → `window.electronAPI.*` → `preload.ts` → `donanim-baglanti.ts` → donanım → IPC → `donanim-dinleyici.ts` → `useAracStore`

**Yeni IPC kanalları (preload.ts):**
```
portListele()              → SerialPort.list()
serialBaglan(port, baud)   udpBaglan(host, port)   tcpBaglan(host, port)
serialKes()                udpKes()                tcpKes()
donanımKes()               → protokol bağımsız bağlantı kesme
onMavlinkMesaj(cb)         → ham MAVLink frame dinleyici
onBaglantiDurumu(cb)       → bağlantı durum olayları
```

### Jetson Kurulum Gereksinimleri
```bash
# MAVLink köprüsü (serial → WebSocket)
mavlink2rest --connect serial:/dev/ttyTHS0:57600 --server 0.0.0.0:6040
# ROS2 WebSocket köprüsü
ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090
```
Ağ adresleri: `ws://192.168.1.1:6040` (MAVLink) · `ws://192.168.1.1:9090` (ROS2)

## ROS2 Çift Katman Mimarisi

MAVLink ve ROS2 çakışmayan iki ayrı katman olarak birlikte çalışır:
- **MAVLink** (Serial/UDP/TCP veya `mavlink2rest` WebSocket) → Telemetri ve standart komutlar
- **ROS2** (`rosbridge` WebSocket — `rosbridge-baglanti.ts`) → Özel görev modları, topic aboneliği

### ROS2 Bağlantısı (src/libs/ros2/rosbridge-baglanti.ts)
`Ayarlar.vue` üzerinden rosbridge URL girilir, bağlan/kes butonu ve anlık durum göstergesi mevcuttur.
`Ros2TopicListesi.vue` → gerçek topic aboneliği ile canlı veri akışı.

### Özel Görev Modları (src/components/gorev/OzelModlar.vue)
| Buton | ROS2 Servisi | Renk |
|---|---|---|
| Kamikaze Modu | `/toygun/kamikaze_modu` | `#FF8000` turuncu |
| İt Dalaşı Modu | `/toygun/it_dalasi_modu` | `#47C7FC` cyan |
| Acil İniş | `/toygun/acil_inis` (onay gerekli) | `#dc2626` kırmızı |

ROS2 servisleri `std_srvs/Trigger` tipinde. `rosbridge-baglanti.ts` → rosbridge WebSocket zinciri.

## ARM Kontrol Mantığı
ARM için 3 koşul: araç bağlı + GPS fix ≥ 3 + batarya ≥ %20.
`armHataKontrol()` → hata listesi, `armEt()` → `{ basarili, hatalar }`.

## CSS Tasarım Sistemi
Renk paleti (`src/styles/global.css`, `--tg-*` prefix):

```
--tg-turuncu    #FF8000   Ana vurgu (butonlar, aktif)
--tg-cyan       #47C7FC   İkincil vurgu
--tg-basari               Yeşil — OK
--tg-uyari                Sarı — dikkat
--tg-tehlike    #dc2626   Kırmızı — hata/acil
--tg-metin / --tg-metin-soluk / --tg-metin-cok-soluk
--tg-panel-border / --tg-subtle-bg / --tg-input-bg / --tg-input-border
--tg-ust-bar-yukseklik / --tg-alt-bar-yukseklik   (layout sabit yükseklikleri)
```

`.cam-panel-koyu` → glassmorphism panel stili (backdrop-blur + şeffaf arka plan).

## Yarışma Sunucusu (`src/stores/sunucu.ts`)

Yarışma sırasında kendi telemetrisini sunucuya gönderir, rakip konumları ve HSS bölgelerini alır. `BaglantilarPaneli.vue` üzerinden yapılandırılır. **SIHA Haberleşme Dokümanı 2026** ile uyumludur.

**Varsayılan adres:** `http://127.0.0.25:5000`  
**Auth:** Oturum çerezi (`credentials: 'include'`) — token tabanlı değil.

**Veri tipleri:** `Rakip` (id, takimNo, enlem, boylam, irtifa, baslik, hiz, ihaKilitlendi) · `HssZon` (id, enlem, boylam, yaricap) · `UcusSiniri` (noktalar[][])

**REST API uç noktaları:**
| Endpoint | Yöntem | Açıklama |
|---|---|---|
| `/api/giris` | POST | `{ kadi, sifre, takim_numarasi }` → 200 OK + takım no |
| `/api/telemetri_gonder` | POST | Kendi telemetrisini gönder (1 Hz) → `{ sunucusaati, konumBilgileri[] }` |
| `/api/sunucusaati` | GET | `{ gun, saat, dakika, saniye, milisaniye }` — `zamanFarkKritik` 500 ms üzeri uyarır |
| `/api/hss_koordinatlari` | GET | `{ hss_koordinat_bilgileri: [{ id, hssEnlem, hssBoylam, hssYaricap }] }` |
| `/api/kilitlenme_bilgisi` | POST | `{ kilitlenmeBitisZamani, otonom_kilitlenme }` — her başarılı kilitlenme sonrası |
| `/api/kamikaze_bilgisi` | POST | `{ kamikazeBaslangicZamani, kamikazeBitisZamani, qrMetni }` |
| `/api/qr_koordinati` | GET | `{ qrEnlem, qrBoylam }` — kamikaze hedef QR konumu |
| `/api/ucus_alani` | GET | Uçuş sınır poligonu (opsiyonel, belgede yok) |

**Telemetri paketi alanları (POST /api/telemetri_gonder):**
`takim_numarasi`, `iha_enlem`, `iha_boylam`, `iha_irtifa` (AGL), `iha_dikilme` (pitch), `iha_yonelme` (heading 0-360), `iha_yatis` (roll), `iha_hiz`, `iha_batarya`, `iha_otonom` (AUTO mod ise 1), `iha_kilitlenme`, `hedef_merkez_X/Y`, `hedef_genislik/yukseklik`, `gps_saati`

**Polling döngüleri:** Telemetri 1 Hz (ayrı interval) · HSS + QR 3 sn (ayrı interval)

**Store metodları:**
```ts
baglan()                                          // giris → zaman sync → telemetri → HSS → interval başlat
kes()                                             // interval temizle, tüm veri sıfırla
zamanSenkronla()                                  // /api/sunucusaati → sunucuZamani, zamanFarki
kilitlenmeBilgisiGonder(otonom: boolean)          // POST /api/kilitlenme_bilgisi
kamikazeBilgisiGonder(bas, bitis, qrMetni)        // POST /api/kamikaze_bilgisi
qrKoordinatiAl()                                  // GET /api/qr_koordinati → qrKoordinati ref günceller
```

**Kilitlenme parametreleri (telemetri ile otomatik gönderilir):**
`ihaKilitlenme`, `hedefMerkezX`, `hedefMerkezY`, `hedefGenislik`, `hedefYukseklik` ref'leri store'da tutulur.

**baglan() terminal çıktısı:** Bağlantı denemesi sırasında her adım `window.__toygunTerminal` ile terminale yazılır. HTTP hata kodları Türkçe açıklama + düzeltme ipucuyla loglanır.

**Harita katmanları:** Rakipler kırmızı baklava ikonu (T-{no}), HSS bölgeleri kırmızı kesik çemberler, QR koordinatı sarı QR pini olarak `GorevHaritasi.vue` üzerinde gösterilir. Tüm katmanlar store watch'ları ile otomatik güncellenir.

## Terminal Paneli (`src/components/ucus/TerminalPanel.vue`)

Sol altta 420×240 px overlay olarak gösterilir (`UcusGorunumu.vue` → `.terminal-overlay`).

- **Font:** 12px monospace, yüksek kontrast
- **Satır formatı:** `● HH:MM:SS mesaj` — `[TYPE]` etiketi yerine renkli nokta (`●`)
- **Tip renkleri:** `ok`→yeşil · `warn`→turuncu · `error`→kırmızı + hafif arka plan · `sys`→gri italik · `mod`→mor
- **LED göstergesi:** Başlıkta son mesaj tipine göre renk değişir; hata gelince yanıp söner
- **Daralt/genişlet:** Başlığa tık veya `˅` butonuyla terminal sadece başlık çubuğuna iner
- **Filtre butonu:** `⚠` tıklanınca yalnızca `error`+`warn` mesajlar gösterilir
- **Yeni mesaj butonu:** Kullanıcı yukarı kaydırırken yeni mesaj gelirse turuncu `↓ yeni` butonu çıkar
- **Kapasite:** 300 mesaj saklar, dolunca en eski 50 silinir

**Global hook:** `window.__toygunTerminal(metin, tip)` — store dahil her yerden çağrılabilir.

## BaglantilarPaneli (`src/components/baglanti/BaglantilarPaneli.vue`)

Sunucu bağlantısı, USB/MAVLink, SITL, video ve simülasyon bölümlerini içerir.

**Sunucu bağlantısı:** IP (`127.0.0.25`), Port (`5000`), Kullanıcı Adı (`kadi`), Şifre, Takım Numarası alanları.

**Kamikaze bölümü:** "Kamikaze Onayla" butonu açılan diyalogda QR Metni giriş alanı vardır. Onay verilince:
1. `sunucuStore.kamikazeBilgisiGonder(baslangicZamani, bitis, qrMetni)` çağrılır
2. Sonuç terminale loglanır

## Web Serial API (`src/libs/mavlink/web-serial-baglanti.ts`)

`navigator.serial` üzerinden çalışan ikinci bir MAVLink bağlantı yolu. Electron'un `serialport` paketi yüklenemediğinde fallback olarak kullanılır; ayrıca Chrome/Edge web modunda da çalışır.

- `webSerialDestekleniyor()` → `navigator.serial` varlığını kontrol eder
- `webSerialBaglan(baud, vidHex?, pidHex?)` → daha önce izin verilmiş portlara otomatik bağlanır, yoksa `requestPort()` diyaloğu açar
- Kendi içinde MAVLink v1/v2 ayrıştırıcısı (`WebSerialMavlinkParser`) ve 5 sn heartbeat watchdog içerir
- `webSerialYaz(bytes)` → komut göndermek için (komutlar.ts ile birlikte kullanılır)

## Kodlama Kuralları
- **Türkçe isimlendirme** her yerde — değişken, fonksiyon, component, store alanı
- MAVLink/teknik terimler İngilizce kalır: `HEARTBEAT`, `armed`, `GPS`, `pitch`, `roll`, `yaw`
- Vue Composition API, `<script setup>` — Options API kullanılmaz
- `vite.config.ts`: Electron plugin yalnızca `ELECTRON=true` ile aktif; `npm run dev` saf web modudur
- Router `createWebHashHistory` kullanır — Electron `file://` protokolüyle uyumlu
