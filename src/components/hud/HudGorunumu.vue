<template>
  <div class="hud-kapsayici cam-panel-koyu">
    <div class="hud-baslik">
      <span>HUD</span>
      <span class="hud-deger">P:{{ aracStore.pitch.toFixed(1) }}° R:{{ aracStore.roll.toFixed(1) }}°</span>
    </div>
    <canvas ref="canvasRef" width="200" height="120" class="hud-canvas" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useAracStore } from '@/stores/arac'

const aracStore = useAracStore()
const canvasRef = ref<HTMLCanvasElement>()

const desenCiz = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const W = canvas.width   // 200
  const H = canvas.height  // 120
  const cx = W / 2
  const cy = H / 2

  ctx.clearRect(0, 0, W, H)

  // Clip to canvas bounds
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, W, H)
  ctx.clip()

  // Rotate for roll
  ctx.translate(cx, cy)
  ctx.rotate((aracStore.roll * Math.PI) / 180)
  ctx.translate(-cx, -cy)

  // Horizon offset from pitch (1.5px per degree, clamped to ±50)
  const pitchOffset = Math.max(-50, Math.min(50, aracStore.pitch * 1.5))
  const horizY = cy + pitchOffset

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, horizY - H, 0, horizY)
  skyGrad.addColorStop(0, '#0d2137')
  skyGrad.addColorStop(1, '#1e4976')
  ctx.fillStyle = skyGrad
  ctx.fillRect(-W, -H, W * 3, horizY + H)

  // Ground gradient
  const gndGrad = ctx.createLinearGradient(0, horizY, 0, horizY + H)
  gndGrad.addColorStop(0, '#4a2e0a')
  gndGrad.addColorStop(1, '#2a1a05')
  ctx.fillStyle = gndGrad
  ctx.fillRect(-W, horizY, W * 3, H * 2)

  // Horizon line
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-W, horizY)
  ctx.lineTo(W * 2, horizY)
  ctx.stroke()

  // Pitch lines (every 10°, ±30° range)
  ctx.font = '8px Inter, sans-serif'
  ctx.lineWidth = 1
  for (let deg = -30; deg <= 30; deg += 10) {
    if (deg === 0) continue
    const y = horizY - deg * 1.5
    const lineW = Math.abs(deg) === 20 || Math.abs(deg) === 30 ? 36 : 22
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath()
    ctx.moveTo(cx - lineW, y)
    ctx.lineTo(cx + lineW, y)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.textAlign = 'left'
    ctx.fillText(`${deg}`, cx + lineW + 3, y + 3)
    ctx.textAlign = 'right'
    ctx.fillText(`${deg}`, cx - lineW - 3, y + 3)
  }

  // Roll arc at top (semicircle)
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, 52, Math.PI, 0)
  ctx.stroke()

  // Roll tick marks on the arc
  const tickAngles = [-90, -60, -30, -20, -10, 0, 10, 20, 30, 60, 90]
  for (const deg of tickAngles) {
    const rad = (deg - 90) * Math.PI / 180
    const innerR = deg % 30 === 0 ? 46 : 49
    const outerR = 52
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'
    ctx.lineWidth = deg % 30 === 0 ? 1.5 : 1
    ctx.beginPath()
    ctx.moveTo(cx + innerR * Math.cos(rad), cy + innerR * Math.sin(rad))
    ctx.lineTo(cx + outerR * Math.cos(rad), cy + outerR * Math.sin(rad))
    ctx.stroke()
  }

  // Roll pointer triangle (rotates with roll, points toward roll arc)
  const rollRad = (aracStore.roll - 90) * Math.PI / 180
  const tipR = 44
  const baseR = 38
  const halfBase = 4
  const tipX = cx + tipR * Math.cos(rollRad)
  const tipY = cy + tipR * Math.sin(rollRad)
  const perpRad = rollRad + Math.PI / 2
  const b1x = cx + baseR * Math.cos(rollRad) + halfBase * Math.cos(perpRad)
  const b1y = cy + baseR * Math.sin(rollRad) + halfBase * Math.sin(perpRad)
  const b2x = cx + baseR * Math.cos(rollRad) - halfBase * Math.cos(perpRad)
  const b2y = cy + baseR * Math.sin(rollRad) - halfBase * Math.sin(perpRad)
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(b1x, b1y)
  ctx.lineTo(b2x, b2y)
  ctx.closePath()
  ctx.fill()

  ctx.restore()

  // Fixed aircraft reference (drawn after restore — no rotation)
  ctx.strokeStyle = '#FF8000'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  // Left wing
  ctx.beginPath()
  ctx.moveTo(cx - 50, cy)
  ctx.lineTo(cx - 16, cy)
  ctx.stroke()
  // Right wing
  ctx.beginPath()
  ctx.moveTo(cx + 16, cy)
  ctx.lineTo(cx + 50, cy)
  ctx.stroke()
  // Center dot
  ctx.beginPath()
  ctx.arc(cx, cy, 3, 0, Math.PI * 2)
  ctx.fillStyle = '#FF8000'
  ctx.fill()
  // Small center bars
  ctx.strokeStyle = '#FF8000'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx - 6, cy)
  ctx.lineTo(cx + 6, cy)
  ctx.stroke()
}

watch([() => aracStore.pitch, () => aracStore.roll], desenCiz)
onMounted(desenCiz)
</script>

<style scoped>
.hud-kapsayici {
  width: 200px;
  padding: 6px;
  pointer-events: auto;
}

.hud-baslik {
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

.hud-deger {
  font-variant-numeric: tabular-nums;
  color: var(--tg-metin-cok-soluk);
  font-weight: 500;
  letter-spacing: 0;
}

.hud-canvas {
  display: block;
  border-radius: 4px;
  width: 100%;
}
</style>
