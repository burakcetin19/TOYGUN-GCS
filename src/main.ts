import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import 'leaflet/dist/leaflet.css'

import App from './App.vue'
import router from './router'
import './styles/global.css'
import { kayitliTemaOku, temayiBelgeyeUygula } from './stores/tema'

// Tema ilk boyamadan önce uygulanır — açılışta yanlış renk parlaması olmasın
const baslangicTemasi = kayitliTemaOku()
temayiBelgeyeUygula(baslangicTemasi)

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: baslangicTemasi === 'koyu' ? 'toygunKoyu' : 'toygunAcik',
    themes: {
      toygunAcik: {
        dark: false,
        colors: {
          background: '#f4f0e8',
          surface: '#fffbf2',
          primary: '#FF8000',
          secondary: '#0ea5e9',
          error: '#dc2626',
          success: '#16a34a',
          warning: '#d97706',
          info: '#0ea5e9',
        },
      },
      toygunKoyu: {
        dark: true,
        colors: {
          background: '#0e1014',
          surface: '#161a21',
          primary: '#FF8000',
          secondary: '#38bdf8',
          error: '#ef4444',
          success: '#22c55e',
          warning: '#f59e0b',
          info: '#38bdf8',
        },
      },
    },
  },
})

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(vuetify)
app.mount('#app')

// Uçuş log izleyicisini başlat (armed değişimini dinler)
import { useUcusLoguStore } from './stores/ucusLogu'
useUcusLoguStore().armiIzle()

// Yükleyiciyi kaldır
const loader = document.getElementById('app-loader')
if (loader) loader.style.display = 'none'
