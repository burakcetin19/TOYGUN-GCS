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

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'toygunKoyu',
    themes: {
      toygunKoyu: {
        dark: true,
        colors: {
          background: '#0a0a0a',
          surface: '#1a1a2e',
          primary: '#FF8000',
          secondary: '#47C7FC',
          error: '#dc2626',
          success: '#22c55e',
          warning: '#f59e0b',
          info: '#47C7FC',
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
