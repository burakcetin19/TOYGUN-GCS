import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'
import electron, { startup, treeKillSync } from 'vite-plugin-electron'
import vuetify from 'vite-plugin-vuetify'

const isElectron = process.env.ELECTRON === 'true'
const isBuilding = process.argv.includes('build')

export default defineConfig({
  plugins: [
    (isElectron || isBuilding) &&
      electron([
        {
          entry: 'src/electron/main.ts',
          vite: {
            build: { outDir: 'dist/electron' },
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
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
  },
})
