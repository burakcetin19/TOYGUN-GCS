<template>
  <v-app>
    <UstBar />
    <YanBar @secim="sayfaDegistir" />
    <v-main class="ana-icerik">
      <router-view v-slot="{ Component }">
        <transition name="sayfa-gecis" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </v-main>
    <AltBar />
    <BildirimCubugu />
    <GuncellemeBildirimi />
  </v-app>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import { useTemaStore } from '@/stores/tema'
import UstBar from '@/components/layout/UstBar.vue'
import AltBar from '@/components/layout/AltBar.vue'
import YanBar from '@/components/layout/YanBar.vue'
import BildirimCubugu from '@/components/ortak/BildirimCubugu.vue'
import GuncellemeBildirimi from '@/components/ortak/GuncellemeBildirimi.vue'

const router = useRouter()

// Vuetify bileşen temasını uygulama temasına bağla
const vuetifyTema = useTheme()
const temaStore = useTemaStore()
watch(
  () => temaStore.tema,
  (tema) => { vuetifyTema.global.name.value = tema === 'koyu' ? 'toygunKoyu' : 'toygunAcik' },
  { immediate: true },
)

const sayfaDegistir = (yol: string) => {
  router.push(yol)
}
</script>

<style scoped>
.ana-icerik {
  padding-top: var(--tg-ust-bar-yukseklik) !important;
  padding-bottom: var(--tg-alt-bar-yukseklik) !important;
  padding-left: 48px !important;
  height: 100vh;
  overflow: hidden;
}
</style>
