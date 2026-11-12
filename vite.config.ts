import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'
import electron, { startup, treeKillSync } from 'vite-plugin-electron'
import vuetify from 'vite-plugin-vuetify'
import { readFileSync } from 'fs'

const paketSurumu: string = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')).version

const isElectron = process.env.ELECTRON === 'true'
const isBuilding = process.argv.includes('build')

export default defineConfig({
  plugins: [
    (isElectron || isBuilding) &&
      electron([
        {
          entry: 'src/electron/main.ts',
          vite: {
            build: {
              outDir: 'dist/electron',
              rollupOptions: {
                // Native modüller paketlenmemeli: serialport kendi .node dosyasını
                // node_modules/@serialport/bindings-cpp/prebuilds altında arar.
                // Paket içine gömülünce bu yolu bulamaz ve hiç yüklenemez.
                external: ['serialport', 'rclnodejs'],
              },
            },
          },
          onstart: () => {
            // @ts-ignore
            if (process.electronApp) {
              // @ts-ignore
              treeKillSync(process.electronApp.pid)
            }
            startup()
          },
        },
        {
          entry: 'src/electron/preload.ts',
          vite: {
            build: { outDir: 'dist/electron' },
          },
        },
      ]),
    vue(),
    vuetify({ autoImport: true }),
  ].filter(Boolean),
  define: {
    // Arayüzde gösterilen sürüm — package.json ile tek kaynak
    __UYGULAMA_SURUMU__: JSON.stringify(paketSurumu),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
  },
})
