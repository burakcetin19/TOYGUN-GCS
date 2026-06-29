<template>
  <div class="terminal-panel" :class="{ 'terminal-kapali': kapali }">
    <!-- Başlık -->
    <div class="terminal-baslik" @click="kapaliToggle">
      <div class="terminal-baslik-sol">
        <span class="terminal-led" :class="canliLed" />
        <span>TERMINAL</span>
        <span v-if="filtreAktif" class="terminal-filtre-badge">HATA</span>
        <span class="terminal-sayac">{{ gorunenMesajlar.length }}</span>
      </div>
      <div class="terminal-butonlar" @click.stop>
        <button
          class="term-btn"
          :class="{ 'term-btn-aktif': filtreAktif }"
          title="Sadece hataları göster"
          @click="filtreToggle"
        >
          <v-icon size="11">mdi-alert-circle-outline</v-icon>
        </button>
        <button class="term-btn" title="Temizle" @click="temizle">
          <v-icon size="11">mdi-delete-sweep</v-icon>
        </button>
        <button class="term-btn" title="Durdur/Devam" @click="duraksatToggle">
          <v-icon size="11">{{ durakli ? 'mdi-play' : 'mdi-pause' }}</v-icon>
        </button>
        <button class="term-btn" :title="kapali ? 'Genişlet' : 'Daralt'" @click="kapaliToggle">
          <v-icon size="11">{{ kapali ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
        </button>
      </div>
    </div>

    <!-- İçerik (daraltılmışsa gizlenir) -->
    <div v-show="!kapali" ref="logRef" class="terminal-icerik">
      <div
        v-for="msg in gorunenMesajlar"
        :key="msg.id"
        class="terminal-satir"
        :class="'satir-' + msg.tip"
      >
        <span class="term-nokta" :class="'nokta-' + msg.tip" />
        <span class="term-zaman">{{ msg.zaman }}</span>
        <span class="term-metin">{{ msg.metin }}</span>
      </div>

      <div v-if="gorunenMesajlar.length === 0" class="terminal-bos">
        <span>{{ filtreAktif ? 'Hata kaydı yok' : 'Bekleniyor...' }}</span>
      </div>
    </div>

    <!-- Yeni mesaj bildirimi (yukarı kaydırılmışsa) -->
    <button
      v-if="!kapali && yeniMesajVar"
      class="yeni-mesaj-btn"
      @click="asagiKadir"
    >
      <v-icon size="11" class="mr-1">mdi-chevron-double-down</v-icon>
      yeni
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'

interface TermMesaj {
  id: number
  zaman: string
  tip: 'info' | 'ok' | 'warn' | 'error' | 'mod' | 'sys'
  metin: string
}

let sayac = 0
const mesajlar    = ref<TermMesaj[]>([])
const logRef      = ref<HTMLElement>()
const durakli     = ref(false)
const kapali      = ref(false)
const filtreAktif = ref(false)
const yeniMesajVar = ref(false)
let kullaniKaydirdi = false

const simdi = () =>
  new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

const gorunenMesajlar = computed(() =>
  filtreAktif.value
    ? mesajlar.value.filter((m) => m.tip === 'error' || m.tip === 'warn')
    : mesajlar.value,
)

// LED rengi — son mesaj tipine göre
const canliLed = computed(() => {
  const son = mesajlar.value[mesajlar.value.length - 1]
  if (!son) return 'led-sys'
  if (son.tip === 'error') return 'led-error'
  if (son.tip === 'warn')  return 'led-warn'
  if (son.tip === 'ok')    return 'led-ok'
  return 'led-sys'
})

const ekle = (metin: string, tip: TermMesaj['tip'] = 'info') => {
  if (durakli.value) return
  mesajlar.value.push({ id: sayac++, zaman: simdi(), tip, metin })
  if (mesajlar.value.length > 300) mesajlar.value.splice(0, 50)
}

const temizle       = () => { mesajlar.value = []; yeniMesajVar.value = false }
const duraksatToggle = () => { durakli.value = !durakli.value }
const kapaliToggle  = () => { kapali.value = !kapali.value }
const filtreToggle  = () => { filtreAktif.value = !filtreAktif.value }

const asagiKadir = async () => {
  await nextTick()
  if (logRef.value) {
    logRef.value.scrollTop = logRef.value.scrollHeight
    yeniMesajVar.value = false
    kullaniKaydirdi = false
  }
}

// Kullanıcı yukarı kaydırınca otomatik scroll durur
const scrollTakip = () => {
  if (!logRef.value) return
  const { scrollTop, scrollHeight, clientHeight } = logRef.value
  kullaniKaydirdi = scrollHeight - scrollTop - clientHeight > 40
  if (!kullaniKaydirdi) yeniMesajVar.value = false
}

watch(gorunenMesajlar, async () => {
  if (kapali.value) return
  if (kullaniKaydirdi) {
    yeniMesajVar.value = true
    return
  }
  await nextTick()
  if (logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight
}, { deep: true })

onMounted(() => {
  ekle('Toygun GCS başlatıldı', 'sys')
  ekle('Bağlantı bekleniyor...', 'warn')
  ;(window as any).__toygunTerminal = ekle

  logRef.value?.addEventListener('scroll', scrollTakip)
})

onUnmounted(() => {
  delete (window as any).__toygunTerminal
  logRef.value?.removeEventListener('scroll', scrollTakip)
})
</script>

<style scoped>
.terminal-panel {
  display: flex;
  flex-direction: column;
  background: rgba(8, 10, 16, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  backdrop-filter: blur(6px);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
  transition: height 0.2s ease;
  position: relative;
}

/* ── Başlık ── */
.terminal-baslik {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 10px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
}
.terminal-baslik:hover { background: rgba(255, 255, 255, 0.07); }

.terminal-kapali .terminal-baslik {
  border-bottom: none;
}

.terminal-baslik-sol {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: rgba(255, 255, 255, 0.6);
  font-family: 'Inter', sans-serif;
  text-transform: uppercase;
}

/* LED */
.terminal-led {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.led-ok    { background: #22c55e; box-shadow: 0 0 5px #22c55e; }
.led-warn  { background: #fb923c; box-shadow: 0 0 5px #fb923c; }
.led-error { background: #f87171; box-shadow: 0 0 5px #f87171; animation: led-yanip 0.8s infinite; }
.led-sys   { background: rgba(255,255,255,0.2); }

@keyframes led-yanip {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}

.terminal-filtre-badge {
  background: rgba(248, 113, 113, 0.2);
  border: 1px solid rgba(248, 113, 113, 0.4);
  color: #f87171;
  border-radius: 4px;
  padding: 0 5px;
  font-size: 8px;
  letter-spacing: 0.5px;
}

.terminal-sayac {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 1px 6px;
  font-size: 8px;
  color: rgba(255, 255, 255, 0.4);
}

/* Butonlar */
.terminal-butonlar {
  display: flex;
  gap: 2px;
}

.term-btn {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.term-btn:hover     { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.75); }
.term-btn-aktif     { background: rgba(248,113,113,0.15) !important; color: #f87171 !important; }

/* ── İçerik ── */
.terminal-icerik {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  scroll-behavior: smooth;
}

.terminal-icerik::-webkit-scrollbar       { width: 4px; }
.terminal-icerik::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
.terminal-icerik::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

/* ── Satırlar ── */
.terminal-satir {
  display: flex;
  align-items: baseline;
  gap: 7px;
  line-height: 1.55;
  padding: 1px 0;
}

/* Satır arka plan renkleri */
.satir-error { background: rgba(248, 113, 113, 0.05); border-radius: 3px; padding: 1px 4px; margin: 0 -4px; }
.satir-warn  { background: rgba(251, 146, 60, 0.04);  border-radius: 3px; padding: 1px 4px; margin: 0 -4px; }

/* Renkli nokta */
.term-nokta {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
}
.nokta-info  { background: #60a5fa; }
.nokta-ok    { background: #22c55e; }
.nokta-warn  { background: #fb923c; }
.nokta-error { background: #f87171; }
.nokta-mod   { background: #c084fc; }
.nokta-sys   { background: rgba(255,255,255,0.3); }

/* Zaman */
.term-zaman {
  color: rgba(255, 255, 255, 0.35);
  flex-shrink: 0;
  font-size: 10px;
  letter-spacing: 0.2px;
}

/* Mesaj metni */
.term-metin {
  color: rgba(255, 255, 255, 0.88);
  word-break: break-word;
  flex: 1;
  font-size: 12px;
  line-height: 1.5;
}

/* Tip bazlı metin renkleri */
.satir-ok    .term-metin { color: #86efac; }
.satir-error .term-metin { color: #fca5a5; }
.satir-warn  .term-metin { color: #fdba74; }
.satir-sys   .term-metin { color: rgba(255,255,255,0.45); font-style: italic; }
.satir-mod   .term-metin { color: #d8b4fe; }

/* Boş durum */
.terminal-bos {
  color: rgba(255,255,255,0.2);
  font-size: 11px;
  text-align: center;
  padding: 16px 0;
  font-family: 'Inter', sans-serif;
}

/* ── Yeni mesaj bildirimi ── */
.yeni-mesaj-btn {
  position: absolute;
  bottom: 6px;
  right: 8px;
  padding: 3px 8px;
  background: rgba(255,128,0,0.85);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  font-family: 'Inter', sans-serif;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  letter-spacing: 0.3px;
  z-index: 10;
  transition: all 0.15s;
}
.yeni-mesaj-btn:hover { background: rgba(255,128,0,1); }
</style>
