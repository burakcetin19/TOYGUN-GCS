<template>
  <div class="terminal-panel">
    <div class="terminal-baslik">
      <div class="terminal-baslik-sol">
        <v-icon size="12" color="#22c55e" class="mr-1">mdi-console</v-icon>
        <span>TERMINAL</span>
        <span class="terminal-sayac">{{ mesajlar.length }}</span>
      </div>
      <div class="terminal-butonlar">
        <button class="term-btn" title="Temizle" @click="temizle">
          <v-icon size="11">mdi-delete-sweep</v-icon>
        </button>
        <button class="term-btn" title="Durdur/Devam" @click="duraksatToggle">
          <v-icon size="11">{{ durakli ? 'mdi-play' : 'mdi-pause' }}</v-icon>
        </button>
      </div>
    </div>

    <div ref="logRef" class="terminal-icerik">
      <div
        v-for="msg in mesajlar"
        :key="msg.id"
        class="terminal-satir"
      >
        <span class="term-zaman">{{ msg.zaman }}</span>
        <span :class="'term-tip term-' + msg.tip">[{{ msg.tip.toUpperCase() }}]</span>
        <span class="term-metin">{{ msg.metin }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'

interface TermMesaj {
  id: number
  zaman: string
  tip: 'info' | 'ok' | 'warn' | 'error' | 'mod' | 'sys'
  metin: string
}

let sayac = 0
const mesajlar = ref<TermMesaj[]>([])
const logRef = ref<HTMLElement>()
const durakli = ref(false)

const simdi = () => new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

const ekle = (metin: string, tip: TermMesaj['tip'] = 'info') => {
  if (durakli.value) return
  mesajlar.value.push({ id: sayac++, zaman: simdi(), tip, metin })
  if (mesajlar.value.length > 200) mesajlar.value.splice(0, 50)
}

const temizle = () => { mesajlar.value = [] }
const duraksatToggle = () => { durakli.value = !durakli.value }

/* Demo başlangıç mesajları */
const demoMesajlar: Array<[string, TermMesaj['tip']]> = [
  ['Toygun GCS başlatıldı', 'sys'],
  ['Sistem bileşenleri yükleniyor...', 'info'],
  ['Harita katmanı hazır', 'ok'],
  ['MAVLink servis dinlemede', 'info'],
  ['Telemetri modülü aktif', 'ok'],
  ['Hava savunma katmanı yüklendi', 'sys'],
  ['Uçuş sınır poligonu tanımlandı', 'info'],
  ['Bağlantı bekleniyor...', 'warn'],
]

let demoZamanlayici: ReturnType<typeof setInterval>

/* Log scroll */
watch(mesajlar, async () => {
  await nextTick()
  if (logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight
}, { deep: true })

/* Global terminal hook */
const globalLog = (metin: string, tip: TermMesaj['tip'] = 'info') => ekle(metin, tip)

onMounted(() => {
  /* Demo mesajları sırayla göster */
  demoMesajlar.forEach(([metin, tip], i) => {
    setTimeout(() => ekle(metin, tip), i * 280)
  })

  /* Global hook'u kaydet */
  ;(window as any).__toygunTerminal = globalLog

  /* Periyodik durum mesajları (simülasyon) */
  demoZamanlayici = setInterval(() => {
    const secilenler: Array<[string, TermMesaj['tip']]> = [
      ['Kalp atışı: sistem sağlıklı', 'sys'],
      ['GPS fix korunuyor — 12 uydu', 'info'],
      ['Telemetri gecikmesi: 8 ms', 'ok'],
      ['Batarya: 87% — nominal', 'ok'],
      ['Rüzgar tahmini: 3.2 m/s KD', 'info'],
    ]
    const r = secilenler[Math.floor(Math.random() * secilenler.length)]
    ekle(r[0], r[1])
  }, 7000)
})

onUnmounted(() => {
  clearInterval(demoZamanlayici)
  delete (window as any).__toygunTerminal
})
</script>

<style scoped>
.terminal-panel {
  display: flex;
  flex-direction: column;
  background: rgba(10, 12, 18, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  overflow: hidden;
  font-family: 'Courier New', 'Consolas', monospace;
  font-size: 10px;
}

.terminal-baslik {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 10px;
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.terminal-baslik-sol {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: #22c55e;
  font-family: 'Inter', sans-serif;
}

.terminal-sayac {
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.25);
  border-radius: 8px;
  padding: 1px 5px;
  font-size: 8px;
  color: #22c55e;
}

.terminal-butonlar {
  display: flex;
  gap: 2px;
}

.term-btn {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255,255,255,0.35);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.term-btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); }

.terminal-icerik {
  flex: 1;
  overflow-y: auto;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.terminal-satir {
  display: flex;
  gap: 6px;
  align-items: baseline;
  line-height: 1.5;
}

.term-zaman {
  color: rgba(255,255,255,0.25);
  flex-shrink: 0;
  font-size: 9px;
}

.term-tip {
  flex-shrink: 0;
  font-weight: 700;
  font-size: 9px;
}

.term-info  { color: #60a5fa; }
.term-ok    { color: #22c55e; }
.term-warn  { color: #fb923c; }
.term-error { color: #f87171; }
.term-mod   { color: #c084fc; }
.term-sys   { color: #94a3b8; }

.term-metin {
  color: rgba(255,255,255,0.72);
  word-break: break-all;
}

.terminal-icerik::-webkit-scrollbar { width: 4px; }
.terminal-icerik::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
</style>
