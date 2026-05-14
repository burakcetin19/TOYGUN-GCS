<template>
  <div class="mod-secici">
    <h3 class="modlar-baslik">
      <v-icon size="16" class="mr-1">mdi-airplane-cog</v-icon>
      UÇUŞ MODU
    </h3>

    <div class="aktif-mod-satir">
      <span class="aktif-mod-etiket">Aktif:</span>
      <span class="aktif-mod-deger">{{ aracStore.ucusModu }}</span>
    </div>

    <!-- Temel modlar -->
    <div class="mod-grup-baslik">Temel</div>
    <div class="mod-izgara">
      <button
        v-for="mod in TEMEL_MODLAR"
        :key="mod.customMode"
        class="mod-izgara-buton"
        :class="{ 'mod-aktif': aktifMi(mod.ad) }"
        :disabled="!aracStore.aracCevrimici"
        :title="mod.ad"
        @click="modSec(mod.customMode, mod.ad)"
      >
        <v-icon size="12">{{ mod.ikon }}</v-icon>
        <span>{{ mod.ad }}</span>
      </button>
    </div>

    <!-- Otonom modlar -->
    <div class="mod-grup-baslik">Otonom</div>
    <div class="mod-izgara">
      <button
        v-for="mod in OTO_MODLAR"
        :key="mod.customMode"
        class="mod-izgara-buton"
        :class="{ 'mod-aktif': aktifMi(mod.ad) }"
        :disabled="!aracStore.aracCevrimici"
        :title="mod.ad"
        @click="modSec(mod.customMode, mod.ad)"
      >
        <v-icon size="12">{{ mod.ikon }}</v-icon>
        <span>{{ mod.ad }}</span>
      </button>
    </div>

    <div v-if="!aracStore.aracCevrimici" class="mod-uyari">
      <v-icon size="14">mdi-alert-circle-outline</v-icon>
      <span>Araç bağlı değil</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAracStore } from '@/stores/arac'
import { ucusModuDegistir } from '@/libs/mavlink/komutlar'

const aracStore = useAracStore()

/**
 * Modern PX4 (v1.10+) custom_mode encode:
 *   bit16-23 = main_mode, bit24-31 = sub_mode
 *   Yalnızca AUTO (main=4) modlarında sub_mode kullanılır.
 */
const px4Mod = (main: number, sub = 0): number => (sub << 24) | (main << 16)

interface Mod {
  customMode: number  // SET_MODE komutuna gönderilecek değer
  ad: string          // HEARTBEAT'ten decode edilen isim (aktif mod karşılaştırması için)
  ikon: string
}

// main_mode referansı: 1=MANUAL, 2=ALTCTL, 3=POSCTL, 4=AUTO, 5=ACRO, 6=OFFBOARD, 7=STABILIZED
const TEMEL_MODLAR: Mod[] = [
  { customMode: px4Mod(1), ad: 'MANUAL',     ikon: 'mdi-hand-back-right'   },
  { customMode: px4Mod(7), ad: 'STABILIZED', ikon: 'mdi-airplane-check'    },
  { customMode: px4Mod(2), ad: 'ALTCTL',     ikon: 'mdi-altimeter'         },
  { customMode: px4Mod(3), ad: 'POSCTL',     ikon: 'mdi-crosshairs-gps'    },
  { customMode: px4Mod(5), ad: 'ACRO',       ikon: 'mdi-rotate-3d-variant' },
  { customMode: px4Mod(6), ad: 'OFFBOARD',   ikon: 'mdi-remote'            },
]

// sub_mode referansı (main=4/AUTO): 2=TAKEOFF, 3=LOITER, 4=MISSION, 5=RTL, 6=LAND
const OTO_MODLAR: Mod[] = [
  { customMode: px4Mod(4, 3), ad: 'AUTO.LOITER',  ikon: 'mdi-motion-pause'        },
  { customMode: px4Mod(4, 4), ad: 'AUTO.MISSION',  ikon: 'mdi-map-marker-path'     },
  { customMode: px4Mod(4, 5), ad: 'AUTO.RTL',      ikon: 'mdi-home-import-outline' },
  { customMode: px4Mod(4, 2), ad: 'AUTO.TAKEOFF',  ikon: 'mdi-airplane-takeoff'    },
  { customMode: px4Mod(4, 6), ad: 'AUTO.LAND',     ikon: 'mdi-airplane-landing'    },
]

// Store'daki ucusModu zaten decode edilmiş string — doğrudan karşılaştır
const aktifMi = (ad: string): boolean => ad === aracStore.ucusModu

const modSec = (customMode: number, ad: string) => {
  ucusModuDegistir(customMode)
  const terminal = (window as any).__toygunTerminal
  const bildirim = (window as any).__toygunBildirim
  if (terminal) terminal(`[MAVLink] Uçuş modu → ${ad}`, 'info')
  if (bildirim) bildirim(`Mod değiştiriliyor: ${ad}`, 'bilgi')
}
</script>

<style scoped>
.mod-secici {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* OzelModlar.vue ile aynı başlık stili */
.modlar-baslik {
  display: flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.5px;
  color: var(--tg-metin-soluk);
  margin-bottom: 2px;
}

.aktif-mod-satir {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(14, 165, 233, 0.08);
  border: 1px solid rgba(14, 165, 233, 0.18);
  border-radius: 6px;
}

.aktif-mod-etiket {
  font-size: 10px;
  color: var(--tg-metin-cok-soluk);
  font-weight: 500;
}

.aktif-mod-deger {
  font-size: 11px;
  font-weight: 600;
  color: var(--tg-cyan);
  letter-spacing: 0.5px;
}

.mod-grup-baslik {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 1.2px;
  color: var(--tg-metin-cok-soluk);
  text-transform: uppercase;
  margin-top: 2px;
}

.mod-izgara {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.mod-izgara-buton {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.3px;
  color: var(--tg-metin-soluk);
  background: var(--tg-input-bg);
  border: 1px solid var(--tg-input-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.mod-izgara-buton:hover:not(:disabled) {
  background: var(--tg-hover-bg-2);
  color: var(--tg-metin);
  border-color: rgba(0, 0, 0, 0.2);
}

.mod-izgara-buton:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.mod-aktif {
  background: rgba(255, 128, 0, 0.15) !important;
  border-color: rgba(255, 128, 0, 0.35) !important;
  color: var(--tg-turuncu) !important;
}

/* OzelModlar.vue ile aynı uyarı stili */
.mod-uyari {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--tg-metin-cok-soluk);
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--tg-subtle-bg);
  margin-top: 2px;
}
</style>
