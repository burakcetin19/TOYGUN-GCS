<template>
  <div class="harita-wrapper">
    <div ref="haritaRef" class="harita-container" />

    <!-- Tile Tipi Seçici -->
    <div class="tile-secici">
      <button
        v-for="t in tileTipleri"
        :key="t.id"
        class="tile-btn"
        :class="{ 'tile-btn-aktif': aktifTile === t.id }"
        @click="tileDegistir(t.id)"
      >
        {{ t.etiket }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'
import { useAracStore } from '@/stores/arac'
import { useGorevStore } from '@/stores/gorev'
import { useSunucuStore } from '@/stores/sunucu'

const props = withDefaults(defineProps<{
  noktaEkleModu?: boolean
  varsayilanYukseklik?: number
}>(), {
  noktaEkleModu: false,
  varsayilanYukseklik: 100,
})

const aracStore   = useAracStore()
const gorevStore  = useGorevStore()
const sunucuStore = useSunucuStore()
const haritaRef   = ref<HTMLElement>()

let harita: L.Map | null = null
let aracMarker: L.Marker | null = null
let noktaMarkerlar: L.Marker[] = []
let yolCizgisi: L.Polyline | null = null
let evMarker: L.Marker | null = null
let kilitlemeMarker: L.Marker | null = null
let qrMarker: L.Marker | null = null

/* ── Tile katmanları ── */
const aktifTile = ref('hibrit')
let mevcutTile: L.TileLayer | null = null
let mevcutLabelTile: L.TileLayer | null = null

const tileTipleri = [
  { id: 'hibrit', etiket: '🛰 Hibrit' },
  { id: 'sokak',  etiket: '🗺 Sokak'  },
  { id: 'koyu',   etiket: '🌙 Koyu'   },
]

const tileBilgileri: Record<string, { url: string; attribution: string; labels?: string }> = {
  hibrit: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labels: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a> World Imagery',
  },
  sokak: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
  },
  koyu: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  },
}

const tileDegistir = (tileId: string) => {
  if (!harita) return
  aktifTile.value = tileId
  if (mevcutTile)      { harita.removeLayer(mevcutTile);      mevcutTile = null }
  if (mevcutLabelTile) { harita.removeLayer(mevcutLabelTile); mevcutLabelTile = null }

  const bilgi = tileBilgileri[tileId]
  mevcutTile = L.tileLayer(bilgi.url, {
    attribution: bilgi.attribution,
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(harita)

  if (bilgi.labels) {
    mevcutLabelTile = L.tileLayer(bilgi.labels, {
      maxZoom: 19,
      opacity: 0.9,
    }).addTo(harita)
  }
}

/* ── Katman grupları ── */
let hssKatman: L.LayerGroup | null = null
let ucusSinirKatman: L.LayerGroup | null = null
let rakipKatman: L.LayerGroup | null = null

/* ── Uçuş sınırı köşe koordinatları (sunucudan gelir) ── */
const sinirKoseleri = ref<L.LatLngTuple[]>([])
let sinirPolygon: L.Polygon | null = null
let sinirKoseMarkerlar: L.Marker[] = []

/* ── İkonlar ── */
const aracIkonu = L.divIcon({
  html: `<div style="width:24px;height:24px;background:#FF8000;border:2px solid #fff;border-radius:50%;
    box-shadow:0 0 10px rgba(255,128,0,0.5);display:flex;align-items:center;justify-content:center;">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
      <path d="M21,16V14L13,9V3.5A1.5,1.5,0,0,0,11.5,2A1.5,1.5,0,0,0,10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z"/>
    </svg></div>`,
  iconSize: [24, 24], iconAnchor: [12, 12], className: 'arac-marker',
})

const noktaIkonu = (sira: number) => L.divIcon({
  html: `<div style="width:26px;height:26px;background:#FF8000;border:2px solid rgba(255,255,255,0.8);
    border-radius:50%;display:flex;align-items:center;justify-content:center;
    font-size:11px;font-weight:700;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${sira}</div>`,
  iconSize: [26, 26], iconAnchor: [13, 13], className: 'nokta-marker',
})

const evIkonu = L.divIcon({
  html: `<div style="width:28px;height:28px;background:#22c55e;border:2px solid #fff;border-radius:50%;
    display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z"/></svg>
    </div>`,
  iconSize: [28, 28], iconAnchor: [14, 14], className: 'ev-marker',
})

const rakipIkonu = (takimNo: number, kilitlendi: boolean) => L.divIcon({
  html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
    <div style="width:20px;height:20px;background:${kilitlendi ? '#FF8000' : '#dc2626'};border:2px solid rgba(255,255,255,0.9);
      border-radius:3px;display:flex;align-items:center;justify-content:center;
      box-shadow:0 0 8px ${kilitlendi ? 'rgba(255,128,0,0.6)' : 'rgba(220,38,38,0.6)'};transform:rotate(45deg);">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="white" style="transform:rotate(-45deg)">
        <path d="M21,16V14L13,9V3.5A1.5,1.5,0,0,0,11.5,2A1.5,1.5,0,0,0,10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z"/>
      </svg></div>
    <span style="background:rgba(${kilitlendi ? '255,128,0' : '220,38,38'},0.85);color:#fff;font-size:7px;font-weight:700;
      padding:1px 4px;border-radius:2px;white-space:nowrap;font-family:Inter,sans-serif;">T-${takimNo}</span>
  </div>`,
  iconSize: [52, 34], iconAnchor: [26, 10], className: 'rakip-marker',
})

const kilitlemeIkonu = () => L.divIcon({
  html: `<div style="width:40px;height:40px;position:relative;">
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect x="4" y="4" width="32" height="32" rx="2" stroke="#FF8000" stroke-width="1.5"
            stroke-dasharray="4 3" fill="none" opacity="0.9"/>
      <line x1="20" y1="0" x2="20" y2="10" stroke="#FF8000" stroke-width="1.5" opacity="0.8"/>
      <line x1="20" y1="30" x2="20" y2="40" stroke="#FF8000" stroke-width="1.5" opacity="0.8"/>
      <line x1="0" y1="20" x2="10" y2="20" stroke="#FF8000" stroke-width="1.5" opacity="0.8"/>
      <line x1="30" y1="20" x2="40" y2="20" stroke="#FF8000" stroke-width="1.5" opacity="0.8"/>
      <circle cx="20" cy="20" r="3" fill="#FF8000" opacity="0.9"/>
      <path d="M6 10 L6 6 L10 6" stroke="#FF8000" stroke-width="2" fill="none"/>
      <path d="M30 6 L34 6 L34 10" stroke="#FF8000" stroke-width="2" fill="none"/>
      <path d="M6 30 L6 34 L10 34" stroke="#FF8000" stroke-width="2" fill="none"/>
      <path d="M30 34 L34 34 L34 30" stroke="#FF8000" stroke-width="2" fill="none"/>
    </svg></div>`,
  iconSize: [40, 40], iconAnchor: [20, 20], className: 'kilit-marker',
})

const sinirKoseIkonu = () => L.divIcon({
  html: `<div title="Sürükle" style="width:10px;height:10px;background:#22c55e;
    border:2px solid #fff;border-radius:2px;cursor:move;
    box-shadow:0 0 4px rgba(34,197,94,0.6);"></div>`,
  iconSize: [10, 10], iconAnchor: [5, 5], className: 'sinir-kose',
})

const qrIkonu = L.divIcon({
  html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
    <div style="width:28px;height:28px;background:#facc15;border:2px solid rgba(0,0,0,0.6);
      border-radius:6px;display:flex;align-items:center;justify-content:center;
      box-shadow:0 0 10px rgba(250,204,21,0.7);">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#1a1a1a">
        <path d="M3,3H10V10H3M11,3H18V10H11M3,11H10V18H3M11,13H13V11H11M13,11H15V13H13M11,13V15H13M13,15H11V18H13M13,15H15V18H15V15M15,13H18V15H15M15,18V18H18V15H16V18M5,5V8H8V5M12,5V8H15V5M5,12V15H8V12Z"/>
      </svg>
    </div>
    <span style="background:rgba(250,204,21,0.9);color:#1a1a1a;font-size:7px;font-weight:700;
      padding:1px 4px;border-radius:2px;white-space:nowrap;font-family:Inter,sans-serif;">QR</span>
  </div>`,
  iconSize: [52, 36], iconAnchor: [26, 14], className: 'qr-marker',
})

/* ── Harita oluşturma ── */
const haritaOlustur = () => {
  if (!haritaRef.value) return

  harita = L.map(haritaRef.value, {
    center: [39.9334, 32.8597],
    zoom: 13,
    zoomControl: true,
    attributionControl: true,
  })

  tileDegistir('hibrit')

  hssKatman       = L.layerGroup().addTo(harita)
  ucusSinirKatman = L.layerGroup().addTo(harita)
  rakipKatman     = L.layerGroup().addTo(harita)

  hssCiz()
  ucusSiniriCiz()
  rakipCiz()

  harita.on('click', (e: L.LeafletMouseEvent) => {
    if (props.noktaEkleModu)
      gorevStore.noktaEkle(e.latlng.lat, e.latlng.lng, props.varsayilanYukseklik)
  })

  harita.on('contextmenu', (e: L.LeafletMouseEvent) => {
    gorevStore.evNokBelirle(e.latlng.lat, e.latlng.lng)
    noktalarGuncelle()
  })
}

/* ── HSS bölgeleri çizimi (sunucudan — salt okunur) ── */
const hssCiz = () => {
  if (!harita || !hssKatman) return
  hssKatman.clearLayers()

  sunucuStore.hssZonelari.forEach((z) => {
    L.circle([z.enlem, z.boylam], {
      radius: z.yaricap,
      color: '#dc2626', weight: 1.5, opacity: 0.8,
      fillColor: '#dc2626', fillOpacity: 0.08, dashArray: '8 5',
    }).addTo(hssKatman!)
      .bindTooltip(`<b>HSS-${z.id}</b><br>Menzil: ${z.yaricap} m`, { direction: 'top' })
  })
}

/* ── Uçuş sınırı çizimi (sunucudan gelen köşeler) ── */
const ucusSiniriCiz = () => {
  if (!harita || !ucusSinirKatman) return
  ucusSinirKatman.clearLayers()
  sinirKoseMarkerlar = []

  if (sinirKoseleri.value.length < 3) return

  sinirPolygon = L.polygon(sinirKoseleri.value, {
    color: '#22c55e', weight: 2, opacity: 0.75,
    fillColor: '#22c55e', fillOpacity: 0.04, dashArray: '10 6',
  }).addTo(ucusSinirKatman!)
    .bindTooltip('Uçuş Sınırı', { direction: 'top', sticky: true })

  sinirKoseleri.value.forEach((kose, i) => {
    const m = L.marker(kose, {
      icon: sinirKoseIkonu(),
      draggable: true,
      title: `Köşe ${i + 1} — taşı`,
    }).addTo(ucusSinirKatman!)

    m.on('drag', () => {
      const pos = m.getLatLng()
      sinirKoseleri.value[i] = [pos.lat, pos.lng]
      sinirPolygon?.setLatLngs(sinirKoseleri.value)
    })

    sinirKoseMarkerlar.push(m)
  })
}

/* ── Rakip araç marker çizimi (sunucudan — salt okunur) ── */
const rakipCiz = () => {
  if (!harita || !rakipKatman) return
  rakipKatman.clearLayers()

  sunucuStore.rakiplar.forEach((r) => {
    L.marker([r.enlem, r.boylam], {
      icon: rakipIkonu(r.takimNo, r.ihaKilitlendi),
      interactive: true,
    }).addTo(rakipKatman!)
      .bindTooltip(
        `<b>Takım ${r.takimNo}</b><br>İrtifa: ${r.irtifa.toFixed(0)} m<br>Hız: ${r.hiz.toFixed(1)} m/s`,
        { direction: 'top' },
      )
  })
}

/* ── QR koordinatı pin ── */
const qrCiz = () => {
  if (!harita) return
  if (qrMarker) { harita.removeLayer(qrMarker); qrMarker = null }

  const qr = sunucuStore.qrKoordinati
  if (!qr || (qr.enlem === 0 && qr.boylam === 0)) return

  qrMarker = L.marker([qr.enlem, qr.boylam], {
    icon: qrIkonu, zIndexOffset: 500,
  }).addTo(harita)
    .bindTooltip(
      `<b>QR Kodu Konumu</b><br>${qr.enlem.toFixed(6)}, ${qr.boylam.toFixed(6)}`,
      { direction: 'top', offset: [0, -18] },
    )
}

/* ── Kilitlenme retiküllü ── */
const kilitlemeGuncelle = (kilitli: boolean) => {
  if (!harita) return
  if (kilitlemeMarker) { harita.removeLayer(kilitlemeMarker); kilitlemeMarker = null }
  if (kilitli && aracStore.enlem !== 0) {
    kilitlemeMarker = L.marker([aracStore.enlem, aracStore.boylam], {
      icon: kilitlemeIkonu(), zIndexOffset: 1000,
    }).addTo(harita)
  }
}

/* ── Waypoint güncelleme ── */
const noktalarGuncelle = () => {
  if (!harita) return
  noktaMarkerlar.forEach((m) => harita!.removeLayer(m))
  noktaMarkerlar = []
  if (yolCizgisi) harita.removeLayer(yolCizgisi)
  if (evMarker)   harita.removeLayer(evMarker)

  if (gorevStore.evNoktasi) {
    evMarker = L.marker([gorevStore.evNoktasi.enlem, gorevStore.evNoktasi.boylam], { icon: evIkonu })
      .addTo(harita)
      .bindTooltip('Ev Noktası', { direction: 'top', offset: [0, -16] })
  }

  const koordinatlar: L.LatLngTuple[] = []
  gorevStore.noktalar.forEach((nokta) => {
    const marker = L.marker([nokta.enlem, nokta.boylam], {
      icon: noktaIkonu(nokta.sira), draggable: true,
    }).addTo(harita!)
      .bindTooltip(`WP${nokta.sira}: ${nokta.yukseklik}m`, { direction: 'top', offset: [0, -16] })

    marker.on('dragend', () => {
      const pos = marker.getLatLng()
      gorevStore.noktaGuncelle(nokta.id, { enlem: pos.lat, boylam: pos.lng })
    })
    noktaMarkerlar.push(marker)
    koordinatlar.push([nokta.enlem, nokta.boylam])
  })

  if (koordinatlar.length >= 2) {
    yolCizgisi = L.polyline(koordinatlar, {
      color: '#FF8000', weight: 2, opacity: 0.8, dashArray: '8, 6',
    }).addTo(harita)
  }
}

/* ── Araç marker yönetimi (yalnızca bağlı/simülasyon) ── */
const aracMarkerEkle = () => {
  if (!harita || aracMarker) return
  aracMarker = L.marker([aracStore.enlem, aracStore.boylam], { icon: aracIkonu })
    .addTo(harita)
    .bindTooltip('Kendi Aracın', { direction: 'top', offset: [0, -14] })
}

const aracMarkerKaldir = () => {
  if (!harita || !aracMarker) return
  harita.removeLayer(aracMarker)
  aracMarker = null
}

/* ── Lifecycle ── */
let aracGuncZamanlayici: ReturnType<typeof setInterval>

onMounted(() => {
  haritaOlustur()

  aracGuncZamanlayici = setInterval(() => {
    if (aracMarker) {
      aracMarker.setLatLng([aracStore.enlem, aracStore.boylam])
    }
    const kilitli = !!(window as any).__toygunKilit
    if (kilitli && !kilitlemeMarker)  kilitlemeGuncelle(true)
    else if (!kilitli && kilitlemeMarker) kilitlemeGuncelle(false)
    else if (kilitli && kilitlemeMarker && aracStore.enlem !== 0) {
      kilitlemeMarker.setLatLng([aracStore.enlem, aracStore.boylam])
    }
  }, 500)
})

onUnmounted(() => {
  clearInterval(aracGuncZamanlayici)
  harita?.remove()
})

watch(() => gorevStore.noktalar,  noktalarGuncelle, { deep: true })
watch(() => gorevStore.evNoktasi, noktalarGuncelle, { deep: true })

// Araç marker — yalnızca bağlı ve konum geldiğinde göster
watch(() => aracStore.aracCevrimici, (cevrimici) => {
  if (!cevrimici) { aracMarkerKaldir(); return }
  if (aracStore.enlem !== 0) aracMarkerEkle()
})
watch(() => aracStore.enlem, (enlem) => {
  if (aracStore.aracCevrimici && enlem !== 0 && !aracMarker) aracMarkerEkle()
})

// Sunucu verisi değiştiğinde haritayı güncelle
watch(() => sunucuStore.hssZonelari, hssCiz, { deep: true })
watch(() => sunucuStore.rakiplar, rakipCiz, { deep: true })
watch(() => sunucuStore.qrKoordinati, qrCiz, { deep: true })

// Sunucu uçuş sınırı geldiğinde polygon'u güncelle
watch(() => sunucuStore.ucusSiniri, (sinir) => {
  if (sinir && sinir.noktalar.length >= 3) {
    sinirKoseleri.value = sinir.noktalar as L.LatLngTuple[]
    ucusSiniriCiz()
  }
})
</script>

<style scoped>
.harita-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.harita-container {
  width: 100%;
  height: 100%;
}

/* Tile seçici */
.tile-secici {
  position: absolute;
  bottom: 28px;
  left: 12px;
  z-index: 500;
  display: flex;
  gap: 3px;
  pointer-events: auto;
}

.tile-btn {
  padding: 4px 10px;
  font-size: 10px;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 6px;
  background: rgba(20, 20, 28, 0.75);
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: all 0.15s;
  font-family: 'Inter', sans-serif;
}

.tile-btn:hover { background: rgba(40, 40, 55, 0.85); color: #fff; }

.tile-btn-aktif {
  background: rgba(255, 128, 0, 0.25) !important;
  border-color: rgba(255, 128, 0, 0.5) !important;
  color: #FF8000 !important;
}

/* Marker temizleme */
:deep(.arac-marker),
:deep(.nokta-marker),
:deep(.ev-marker),
:deep(.rakip-marker),
:deep(.kilit-marker),
:deep(.qr-marker),
:deep(.sinir-kose) {
  background: none !important;
  border: none !important;
}

:deep(.kilit-marker div) {
  animation: kilit-nabiz 1.5s infinite;
}

@keyframes kilit-nabiz {
  0%, 100% { opacity: 1; filter: drop-shadow(0 0 3px rgba(255,128,0,0.5)); }
  50%       { opacity: 0.7; filter: drop-shadow(0 0 9px rgba(255,128,0,0.95)); }
}
</style>
