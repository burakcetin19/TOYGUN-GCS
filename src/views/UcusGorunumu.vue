<template>
  <div class="ucus-gorunumu">
    <!-- Harita (tam ekran) -->
    <div class="harita-alani">
      <GorevHaritasi />
    </div>

    <!-- Sol üst: Uçuş Bilgi Paneli -->
    <div class="ucus-bilgi-overlay cam-panel-koyu">
      <div class="bilgi-baslik">
        <v-icon size="11" color="var(--tg-turuncu)" class="mr-1">mdi-airplane</v-icon>
        <span>UÇUŞ BİLGİSİ</span>
        <!-- Mod badge -->
        <span class="mod-badge" :class="modBadgeClass">{{ aracStore.ucusModu }}</span>
      </div>

      <div v-if="aracStore.aracCevrimici" class="bilgi-satirlar">
        <!-- Hız -->
        <div class="bilgi-kart">
          <div class="bilgi-ikon-alan" style="color: var(--tg-cyan)">
            <v-icon size="14">mdi-speedometer</v-icon>
          </div>
          <div class="bilgi-deger-alan">
            <span class="bilgi-ana">{{ aracStore.yerHizi.toFixed(1) }}</span>
            <span class="bilgi-birim">m/s</span>
            <span class="bilgi-ikincil">{{ (aracStore.yerHizi * 3.6).toFixed(0) }} km/h</span>
          </div>
        </div>

        <!-- Yükseklik -->
        <div class="bilgi-kart">
          <div class="bilgi-ikon-alan" style="color: var(--tg-turuncu)">
            <v-icon size="14">mdi-altimeter</v-icon>
          </div>
          <div class="bilgi-deger-alan">
            <span class="bilgi-ana">{{ aracStore.yukseklik.toFixed(0) }}</span>
            <span class="bilgi-birim">m</span>
            <span class="bilgi-ikincil">AGL: {{ aracStore.yapiYukseklik.toFixed(0) }}m</span>
          </div>
        </div>

        <!-- GPS -->
        <div class="bilgi-kart">
          <div class="bilgi-ikon-alan" :style="{ color: gpsRenk }">
            <v-icon size="14">mdi-satellite-variant</v-icon>
          </div>
          <div class="bilgi-deger-alan">
            <span class="bilgi-ana">{{ aracStore.gpsSayisi }}</span>
            <span class="bilgi-birim">uydu</span>
            <span class="bilgi-ikincil">{{ aracStore.gpsFixMetni }}</span>
          </div>
        </div>

        <!-- Heading -->
        <div class="bilgi-kart">
          <div class="bilgi-ikon-alan" style="color: var(--tg-metin-soluk)">
            <v-icon size="14">mdi-compass</v-icon>
          </div>
          <div class="bilgi-deger-alan">
            <span class="bilgi-ana">{{ aracStore.heading.toFixed(0) }}</span>
            <span class="bilgi-birim">°</span>
            <span class="bilgi-ikincil">{{ aracStore.bataryaVoltaj > 0 ? aracStore.bataryaVoltaj.toFixed(1) + 'V' : '—' }}</span>
          </div>
        </div>
      </div>

      <div v-else class="bilgi-baglanti-yok">
        <v-icon size="20" color="var(--tg-metin-cok-soluk)">mdi-airplane-off</v-icon>
        <span>Araç bağlı değil</span>
      </div>

      <!-- ARM durumu -->
      <div class="arm-satir">
        <div class="arm-led" :class="aracStore.armed ? 'arm-led-aktif' : 'arm-led-pasif'" />
        <span class="arm-metin">{{ aracStore.armed ? 'ARMED' : 'DISARMED' }}</span>
        <span class="arm-konum">{{ aracStore.enlem !== 0 ? aracStore.enlem.toFixed(4) + ', ' + aracStore.boylam.toFixed(4) : '—' }}</span>
      </div>

      <!-- Kilitlenme butonu -->
      <button class="kilit-buton" :class="{ 'kilit-aktif': kilitliMode }" @click="kilitliMode = !kilitliMode">
        <v-icon size="13">{{ kilitliMode ? 'mdi-crosshairs-gps' : 'mdi-crosshairs' }}</v-icon>
        {{ kilitliMode ? 'KİLİT AÇIK' : 'KİLİTLE' }}
      </button>
    </div>

    <!-- Sağ üst: HUD + Pusula — yalnızca bağlı/simülasyon -->
    <div v-if="aracStore.aracCevrimici" class="hud-overlay">
      <HudGorunumu />
      <PusulaCihazi />
    </div>

    <!-- Sol alt: Terminal Paneli -->
    <div class="terminal-overlay">
      <TerminalPanel />
    </div>

    <!-- Mod değişim bildirimi -->
    <transition name="mod-gecis">
      <div v-if="modBildirimGoster" class="mod-bildirimi">
        <v-icon size="16" color="var(--tg-turuncu)" class="mr-2">mdi-airplane-cog</v-icon>
        <span>MOD: </span>
        <strong>{{ sonMod }}</strong>
      </div>
    </transition>

    <!-- Tehdit uyarısı (hava savunma alanına girildiğinde) -->
    <transition name="mod-gecis">
      <div v-if="tehditUyarisi" class="tehdit-uyari">
        <v-icon size="16" color="#dc2626" class="mr-2">mdi-alert-octagon</v-icon>
        <span>HAVA SAVUNMA MENZILINDE!</span>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import GorevHaritasi from '@/components/harita/GorevHaritasi.vue'
import HudGorunumu from '@/components/hud/HudGorunumu.vue'
import PusulaCihazi from '@/components/hud/PusulaCihazi.vue'
import TerminalPanel from '@/components/ucus/TerminalPanel.vue'
import { useAracStore } from '@/stores/arac'

const aracStore = useAracStore()
const kilitliMode = ref(false)
const modBildirimGoster = ref(false)
const tehditUyarisi = ref(false)
const sonMod = ref('')

const gpsRenk = computed(() => {
  if (aracStore.gpsSayisi >= 8) return 'var(--tg-basari)'
  if (aracStore.gpsSayisi >= 5) return 'var(--tg-uyari)'
  return 'var(--tg-tehlike)'
})

const modBadgeClass = computed(() => {
  const mod = aracStore.ucusModu?.toLowerCase() ?? ''
  if (mod.includes('auto') || mod.includes('mission')) return 'mod-otomatik'
  if (mod.includes('guided')) return 'mod-guided'
  if (mod.includes('rtl') || mod.includes('land')) return 'mod-donus'
  if (mod.includes('loiter') || mod.includes('hold')) return 'mod-bekleme'
  return 'mod-varsayilan'
})

/* Mod değişim bildirimi */
watch(() => aracStore.ucusModu, (yeni, eski) => {
  if (eski && yeni && yeni !== '—' && yeni !== eski) {
    sonMod.value = yeni
    modBildirimGoster.value = true
    const log = (window as any).__toygunTerminal
    log?.(`Uçuş modu değişti: ${eski} → ${yeni}`, 'mod')
    setTimeout(() => { modBildirimGoster.value = false }, 3000)
  }
})

/* Harita kilitlenme bilgisini dışarıya aktar */
watch(kilitliMode, (v) => {
  (window as any).__toygunKilit = v
})
</script>

<style scoped>
.ucus-gorunumu {
  width: 100%;
  height: 100%;
  position: relative;
}

.harita-alani {
  width: 100%;
  height: 100%;
}

/* ── Sol üst: Uçuş Bilgi Paneli ── */
.ucus-bilgi-overlay {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 500;
  width: 178px;
  padding: 10px;
  pointer-events: auto;
}

.bilgi-baslik {
  display: flex;
  align-items: center;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.2px;
  color: var(--tg-metin-soluk);
  text-transform: uppercase;
  margin-bottom: 8px;
  gap: 4px;
}

.mod-badge {
  margin-left: auto;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.mod-otomatik   { background: rgba(14,165,233,0.15); color: #0ea5e9; border: 1px solid rgba(14,165,233,0.3); }
.mod-guided     { background: rgba(34,197,94,0.12);  color: #16a34a; border: 1px solid rgba(34,197,94,0.25); }
.mod-donus      { background: rgba(220,38,38,0.12);  color: #dc2626; border: 1px solid rgba(220,38,38,0.25); }
.mod-bekleme    { background: rgba(217,119,6,0.12);  color: #d97706; border: 1px solid rgba(217,119,6,0.25); }
.mod-varsayilan { background: var(--tg-badge-bg);    color: var(--tg-metin-soluk); border: 1px solid var(--tg-divider); }

.bilgi-satirlar {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bilgi-baglanti-yok {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px 8px;
  color: var(--tg-metin-cok-soluk);
  font-size: 11px;
}

.bilgi-kart {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  background: var(--tg-subtle-bg);
  border-radius: 6px;
}

.bilgi-ikon-alan {
  flex-shrink: 0;
  width: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bilgi-deger-alan {
  display: flex;
  align-items: baseline;
  gap: 3px;
  flex: 1;
}

.bilgi-ana {
  font-size: 16px;
  font-weight: 700;
  color: var(--tg-metin);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.bilgi-birim {
  font-size: 9px;
  color: var(--tg-metin-cok-soluk);
  font-weight: 500;
}

.bilgi-ikincil {
  margin-left: auto;
  font-size: 9px;
  color: var(--tg-metin-cok-soluk);
  font-variant-numeric: tabular-nums;
}

.arm-satir {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--tg-divider);
  font-size: 9px;
}

.arm-led {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.arm-led-aktif  { background: var(--tg-basari); box-shadow: 0 0 5px var(--tg-basari); }
.arm-led-pasif  { background: rgba(0,0,0,0.25); }

.arm-metin {
  font-weight: 700;
  font-size: 9px;
  color: var(--tg-metin-soluk);
}

.arm-konum {
  margin-left: auto;
  font-size: 8px;
  color: var(--tg-metin-cok-soluk);
  font-variant-numeric: tabular-nums;
}

.kilit-buton {
  width: 100%;
  margin-top: 6px;
  padding: 5px 8px;
  border: 1px solid var(--tg-input-border);
  border-radius: 6px;
  background: var(--tg-input-bg);
  color: var(--tg-metin-soluk);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.15s;
  font-family: 'Inter', sans-serif;
}
.kilit-buton:hover { background: var(--tg-hover-bg-2); color: var(--tg-metin); }
.kilit-aktif {
  background: rgba(255,128,0,0.1) !important;
  border-color: rgba(255,128,0,0.35) !important;
  color: var(--tg-turuncu) !important;
}

/* ── Sağ üst: HUD ── */
.hud-overlay {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 500;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-end;
  pointer-events: none;
}
.hud-overlay > * { pointer-events: auto; }

/* ── Sol alt: Terminal ── */
.terminal-overlay {
  position: absolute;
  bottom: calc(var(--tg-alt-bar-yukseklik) + 10px);
  left: 12px;
  z-index: 500;
  width: 300px;
  height: 160px;
  pointer-events: auto;
}

/* ── Mod değişim bildirimi ── */
.mod-bildirimi {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 600;
  display: flex;
  align-items: center;
  padding: 8px 18px;
  background: rgba(255, 251, 242, 0.97);
  border: 1px solid var(--tg-panel-border);
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  color: var(--tg-metin);
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  pointer-events: none;
}

.tehdit-uyari {
  position: absolute;
  top: 48px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 600;
  display: flex;
  align-items: center;
  padding: 8px 18px;
  background: rgba(220, 38, 38, 0.92);
  border: 1px solid rgba(220, 38, 38, 0.5);
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.8px;
  box-shadow: 0 4px 20px rgba(220,38,38,0.3);
  animation: bildirim-yanip-sone 1s infinite;
  pointer-events: none;
}

@keyframes bildirim-yanip-sone {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.6; }
}

.mod-gecis-enter-active, .mod-gecis-leave-active { transition: opacity 0.3s, transform 0.3s; }
.mod-gecis-enter-from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
.mod-gecis-leave-to   { opacity: 0; transform: translateX(-50%) translateY(-8px); }
</style>
