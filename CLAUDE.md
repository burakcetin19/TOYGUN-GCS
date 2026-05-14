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
npm run dist:win         # Windows .exe üretimi (build + paket)
npm run typecheck        # TypeScript tip kontrolü
```

> `node_modules` mevcut, tekrar `npm install` gerekmez. Node.js kurulu olmalı.

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

## Kodlama Kuralları
- **Türkçe isimlendirme** her yerde — değişken, fonksiyon, component, store alanı
- MAVLink/teknik terimler İngilizce kalır: `HEARTBEAT`, `armed`, `GPS`, `pitch`, `roll`, `yaw`
- Vue Composition API, `<script setup>` — Options API kullanılmaz
- `vite.config.ts`: Electron plugin yalnızca `ELECTRON=true` ile aktif; `npm run dev` saf web modudur
- Router `createWebHashHistory` kullanır — Electron `file://` protokolüyle uyumlu
