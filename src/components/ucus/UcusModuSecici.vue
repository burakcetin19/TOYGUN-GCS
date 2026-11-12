<template>
  <div class="mod-secici">
    <h3 class="modlar-baslik">
      <v-icon size="16" class="mr-1">mdi-airplane-cog</v-icon>
      UÇUŞ MODU
      <span v-if="aracStore.aracCevrimici" class="otopilot-rozeti" :title="`HEARTBEAT: ${aracStore.otopilot}`">
        {{ otopilotEtiketi(aracStore.otopilot, aracStore.aracSinifi) }}
      </span>
    </h3>

    <div class="aktif-mod-satir">
      <span class="aktif-mod-etiket">Aktif:</span>
      <span class="aktif-mod-deger">{{ aracStore.ucusModu }}</span>
    </div>

    <template v-for="grup in gruplar" :key="grup.anahtar">
      <div class="mod-grup-baslik">{{ grup.baslik }}</div>
      <div class="mod-izgara">
        <button
          v-for="mod in grup.modlar"
          :key="mod.ad"
          class="mod-izgara-buton"
          :class="{ 'mod-aktif': aktifMi(mod.ad) }"
          :disabled="!aracStore.aracCevrimici || gonderiliyor !== null"
          :title="mod.ad"
          @click="modSec(mod)"
        >
          <v-icon size="12">{{ gonderiliyor === mod.ad ? 'mdi-loading mdi-spin' : mod.ikon }}</v-icon>
          <span>{{ mod.ad }}</span>
        </button>
      </div>
    </template>

    <div v-if="!aracStore.aracCevrimici" class="mod-uyari">
      <v-icon size="14">mdi-alert-circle-outline</v-icon>
      <span>Araç bağlı değil</span>
    </div>
    <div v-else-if="modlar.length === 0" class="mod-uyari">
      <v-icon size="14">mdi-help-circle-outline</v-icon>
      <span>Otopilot tanınmadı — yanlış mod göndermemek için mod seçimi kapalı</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAracStore } from '@/stores/arac'
import { modDegistirGonder } from '@/libs/mavlink/komutlar'
import { modListesi, otopilotEtiketi, type UcusModuTanimi } from '@/libs/mavlink/otopilot'

const aracStore = useAracStore()

/** Bağlı aracın otopilotuna (PX4 / ArduPilot) ve sınıfına göre mod listesi */
const modlar = computed(() => modListesi(aracStore.otopilot, aracStore.aracSinifi))

const GRUP_BASLIKLARI: Record<UcusModuTanimi['grup'], string> = {
  temel: 'Temel',
  otonom: 'Otonom',
  vtol: 'VTOL',
}

const gruplar = computed(() =>
  (['temel', 'otonom', 'vtol'] as const)
    .map((anahtar) => ({ anahtar, baslik: GRUP_BASLIKLARI[anahtar], modlar: modlar.value.filter((m) => m.grup === anahtar) }))
    .filter((g) => g.modlar.length > 0),
)

// Store'daki ucusModu aynı tablodan çözülmüş ad — doğrudan karşılaştır
const aktifMi = (ad: string): boolean => ad === aracStore.ucusModu

const gonderiliyor = ref<string | null>(null)

const modSec = async (mod: UcusModuTanimi) => {
  if (aracStore.simuleAktif) {
    aracStore.ucusModu = mod.ad
    return
  }
  const terminal = (window as any).__toygunTerminal
  const bildirim = (window as any).__toygunBildirim
  terminal?.(`Uçuş modu → ${mod.ad} gönderiliyor…`, 'sys')
  gonderiliyor.value = mod.ad
  try {
    const sonuc = await modDegistirGonder(mod)
    if (sonuc.durum === 'kabul') {
      terminal?.(sonuc.mesaj, 'ok')
    } else if (sonuc.durum === 'yanitYok') {
      terminal?.(sonuc.mesaj, 'warn')
      bildirim?.(sonuc.mesaj, 'uyari')
    } else {
      terminal?.(sonuc.mesaj, 'error')
      bildirim?.(sonuc.mesaj, 'hata')
    }
  } finally {
    gonderiliyor.value = null
  }
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

.otopilot-rozeti {
  margin-left: auto;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--tg-badge-bg);
  border: 1px solid var(--tg-divider);
  font-size: 9px;
  letter-spacing: 0.5px;
  color: var(--tg-metin-soluk);
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
