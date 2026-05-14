<template>
  <div class="bildirim-container">
    <transition-group name="bildirim-gecis">
      <div
        v-for="bildirim in bildirimler"
        :key="bildirim.id"
        class="bildirim cam-panel"
        :class="`bildirim-${bildirim.tip}`"
      >
        <v-icon size="18" class="mr-2">{{ ikonlar[bildirim.tip] }}</v-icon>
        <span>{{ bildirim.mesaj }}</span>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Bildirim {
  id: number
  mesaj: string
  tip: 'basari' | 'hata' | 'uyari' | 'bilgi'
}

const bildirimler = ref<Bildirim[]>([])
let sayac = 0

const ikonlar: Record<string, string> = {
  basari: 'mdi-check-circle',
  hata: 'mdi-alert-circle',
  uyari: 'mdi-alert',
  bilgi: 'mdi-information',
}

const bildirimGoster = (mesaj: string, tip: Bildirim['tip'] = 'bilgi', sure = 3000) => {
  const id = ++sayac
  bildirimler.value.push({ id, mesaj, tip })
  setTimeout(() => {
    bildirimler.value = bildirimler.value.filter((b) => b.id !== id)
  }, sure)
}

defineExpose({ bildirimGoster })

// Global erişim için window'a ekle
;(window as any).__toygunBildirim = bildirimGoster
</script>

<style scoped>
.bildirim-container {
  position: fixed;
  top: 60px;
  right: 16px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.bildirim {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 500;
  pointer-events: auto;
  min-width: 250px;
  max-width: 400px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.bildirim-basari { border-left: 3px solid var(--tg-basari); }
.bildirim-hata { border-left: 3px solid var(--tg-tehlike); }
.bildirim-uyari { border-left: 3px solid var(--tg-uyari); }
.bildirim-bilgi { border-left: 3px solid var(--tg-cyan); }

.bildirim-gecis-enter-active { animation: bildirimGir 0.3s ease; }
.bildirim-gecis-leave-active { animation: bildirimCik 0.3s ease; }

@keyframes bildirimGir {
  from { opacity: 0; transform: translateX(40px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes bildirimCik {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(40px); }
}
</style>
