# Toygun GCS

<p align="center">
  <img src="resources/toygun-logo.png" alt="Toygun GCS Logo" width="120" />
</p>

<p align="center">
  PX4 tabanlı sabit kanatlı insansız hava araçları için özelleştirilmiş Yer Kontrol İstasyonu
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-29-47C7FC?logo=electron" />
  <img src="https://img.shields.io/badge/Vue-3-42b883?logo=vue.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript" />
  <img src="https://img.shields.io/badge/PX4-MAVLink-FF8000" />
</p>

---

## Özellikler

- **Çoklu MAVLink bağlantısı** — Serial (COM / ttyUSB), UDP, TCP, WebSocket (mavlink2rest)
- **Web Serial API fallback** — Native build tools gerektirmeden seri port bağlantısı
- **Canlı HUD** — Yapay ufuk, pusula, telemetri göstergeleri
- **Leaflet harita** — Waypoint planlama, uçuş sınırı, HSS zonları, rakip araç takibi
- **Yarışma sunucusu entegrasyonu** — Gerçek zamanlı rakip konumları ve HSS bölgeleri
- **MAVLink komut gönderme** — Uçuş modu değiştirme, ARM/DISARM, RTL, iniş
- **ROS2 köprüsü** — rosbridge üzerinden topic aboneliği ve servis çağrısı
- **Video akışı** — Kamera görüntüsü (planlandı)
- **Otomatik güncelleme** — electron-updater ile uygulama içi güncelleme

## Teknoloji Stack

| Katman | Teknoloji |
|--------|-----------|
| UI Framework | Vue 3 + Composition API |
| Dil | TypeScript 5 |
| Build | Vite |
| Masaüstü | Electron 29 |
| UI Bileşenleri | Vuetify 3 |
| State | Pinia |
| Harita | Leaflet |
| İkonlar | Material Design Icons |

## Başlarken

### Ön Koşullar

- Node.js ≥ 20
- npm ≥ 9

### Kurulum

```bash
git clone https://github.com/<KULLANICI>/toygun-gcs.git
cd toygun-gcs
npm install
```

### Geliştirme

```bash
# Web modu (tarayıcı)
npm run dev

# Electron masaüstü modu
npm run dev:electron

# TypeScript tip kontrolü
npm run typecheck
```

### Build

```bash
# Electron için üretim build
npm run build

# Windows .exe paketi
npm run dist:win
```

## Bağlantı Protokolleri

| Protokol | Kullanım | Notlar |
|----------|----------|--------|
| Serial | COM port, /dev/ttyUSB0 | Web Serial API fallback dahil |
| UDP | Port dinleme (ör: 14550) | Otomatik hedef algılamalı |
| TCP | Host:Port bağlantısı | |
| WebSocket | mavlink2rest bridge | ws://IP:6040/ws/mavlink |

## Yarışma Sunucusu

```
IP Adresi  → sunucu_ip
Port       → 8000
Endpoint   → /api/giris, /api/telemetri_gonder, /api/hss_koordinatlari
```

## Jetson Kurulumu (Opsiyonel)

```bash
# MAVLink → WebSocket köprüsü
mavlink2rest --connect serial:/dev/ttyTHS0:57600 --server 0.0.0.0:6040

# ROS2 WebSocket köprüsü
ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090
```

## Proje Yapısı

```
src/
├── stores/          # Pinia store'ları (arac, gorev, sunucu)
├── libs/mavlink/    # MAVLink bağlantı, parser, komutlar
├── libs/ros2/       # rosbridge istemcisi
├── components/      # Vue bileşenleri
├── views/           # Sayfa görünümleri
└── electron/        # Electron main process + IPC servisleri
```

## Lisans

Bu proje özel kullanım içindir.
