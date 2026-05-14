<template>
  <div class="pusula-kapsayici cam-panel-koyu">
    <div class="pusula-baslik">
      <span>HDG</span>
      <span class="pusula-deger">{{ aracStore.heading.toFixed(0) }}°</span>
    </div>
    <canvas ref="canvasRef" width="188" height="100" class="pusula-canvas" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useAracStore } from '@/stores/arac'

const aracStore = useAracStore()
const canvasRef = ref<HTMLCanvasElement>()

const cardinals = [
  { deg: 0, label: 'N' },
  { deg: 22.5, label: '' },
  { deg: 45, label: 'KD' },
  { deg: 67.5, label: '' },
  { deg: 90, label: 'D' },
  { deg: 112.5, label: '' },
  { deg: 135, label: 'GD' },
  { deg: 157.5, label: '' },
  { deg: 180, label: 'G' },
  { deg: 202.5, label: '' },
  { deg: 225, label: 'GB' },
  { deg: 247.5, label: '' },
  { deg: 270, label: 'B' },
  { deg: 292.5, label: '' },
  { deg: 315, label: 'KB' },
  { deg: 337.5, label: '' },
]

const desenCiz = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const W = canvas.width   // 188
  const H = canvas.height  // 100
  const cx = W / 2
  const cy = H / 2 + 6

  ctx.clearRect(0, 0, W, H)

  const r = 42  // compass ring radius

  // Outer ring
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  // Inner fill
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  const heading = aracStore.heading

  // Tick marks every 5°
  for (let deg = 0; deg < 360; deg += 5) {
    const angle = ((deg - heading - 90) * Math.PI) / 180
    const isCardinal = deg % 90 === 0
    const isInter = deg % 45 === 0
    const outerR = r
    const innerR = isCardinal ? r - 10 : isInter ? r - 7 : r - 4
    ctx.strokeStyle = isCardinal ? 'rgba(255,255,255,0.7)' : isInter ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.2)'
    ctx.lineWidth = isCardinal ? 1.5 : 1
    ctx.beginPath()
    ctx.moveTo(cx + innerR * Math.cos(angle), cy + innerR * Math.sin(angle))
    ctx.lineTo(cx + outerR * Math.cos(angle), cy + outerR * Math.sin(angle))
    ctx.stroke()
  }

  // Cardinal labels
  ctx.font = 'bold 9px Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const c of cardinals) {
    if (!c.label) continue
    const angle = ((c.deg - heading - 90) * Math.PI) / 180
    const labelR = r - 16
    const x = cx + labelR * Math.cos(angle)
    const y = cy + labelR * Math.sin(angle)
    ctx.fillStyle = c.label === 'N' ? '#FF8000' : 'rgba(255,255,255,0.65)'
    ctx.fillText(c.label, x, y)
  }

  // Fixed heading pointer (triangle at top center, pointing down into compass)
  ctx.fillStyle = '#FF8000'
  ctx.beginPath()
  ctx.moveTo(cx, cy - r + 2)
  ctx.lineTo(cx - 5, cy - r - 8)
  ctx.lineTo(cx + 5, cy - r - 8)
  ctx.closePath()
  ctx.fill()

  // Center dot
  ctx.beginPath()
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.fill()

  // Degree labels at cardinal positions
  ctx.font = '7px Inter, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('360', cx - r - 10 < 0 ? cx : cx, H - 4)
}

watch(() => aracStore.heading, desenCiz)
onMounted(desenCiz)
</script>

<style scoped>
.pusula-kapsayici {
  width: 200px;
  padding: 6px;
  pointer-events: auto;
}

.pusula-baslik {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--tg-metin-soluk);
  text-transform: uppercase;
  margin-bottom: 4px;
  padding: 0 2px;
}

.pusula-deger {
  font-variant-numeric: tabular-nums;
  color: var(--tg-turuncu);
  font-weight: 600;
  letter-spacing: 0;
}

.pusula-canvas {
  display: block;
  width: 100%;
}
</style>
