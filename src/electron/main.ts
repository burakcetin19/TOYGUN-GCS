import { app, BrowserWindow, screen, ipcMain, shell, session } from 'electron'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
import { ros2KoprusuKur } from './services/ros2-kopru'
import { donanımBaglantiKur, portIzleyiciBaslat, portIzleyiciDurdur } from './services/donanim-baglanti'

const ROOT_PATH = { dist: join(__dirname, '..') }

let mainWindow: BrowserWindow | null = null

// ── Otomatik Güncelleme ──────────────────────────────────────────────────────
function guncellemeKurulumu(): void {
  // Geliştirme ortamında güncelleme kontrolü yapma
  // @ts-ignore
  if (import.meta.env.DEV) return

  autoUpdater.autoDownload = false        // Otomatik indirme kapalı — kullanıcı onaylasın
  autoUpdater.autoInstallOnAppQuit = true // Onaylanan güncellemeleri çıkışta kur

  autoUpdater.on('checking-for-update', () => {
    console.log('[Güncelleme] Kontrol ediliyor...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log(`[Güncelleme] Yeni sürüm mevcut: v${info.version}`)
    mainWindow?.webContents.send('guncelleme-mevcut', {
      mevcutSurum: app.getVersion(),
      yeniSurum: info.version,
      notlar: info.releaseNotes ?? '',
    })
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[Güncelleme] Uygulama güncel.')
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('guncelleme-indirme', {
      yuzde: Math.round(progress.percent),
      hiz: Math.round(progress.bytesPerSecond / 1024), // KB/s
    })
  })

  autoUpdater.on('update-downloaded', () => {
    console.log('[Güncelleme] İndirildi, kurulum bekleniyor.')
    mainWindow?.webContents.send('guncelleme-hazir')
  })

  autoUpdater.on('error', (err) => {
    console.warn('[Güncelleme] Hata (önemsiz):', err.message)
    // Güncelleme sunucusu yapılandırılmamışsa sessizce atla
  })

  // Uygulama açıldıktan 5 saniye sonra kontrol et
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // publish yapılandırılmamışsa hata verir — sessizce geç
    })
  }, 5000)
}

// IPC: Renderer'dan güncelleme indirme isteği
ipcMain.on('guncelleme-indir', () => {
  autoUpdater.downloadUpdate()
})

// IPC: Renderer'dan güncelleme kurma isteği
ipcMain.on('guncelleme-kur', () => {
  autoUpdater.quitAndInstall(false, true)
})

// IPC: Dışarıda URL aç (güncelleme sayfası)
ipcMain.on('disarida-ac', (_event, url: string) => {
  shell.openExternal(url)
})

// ── Pencere ──────────────────────────────────────────────────────────────────
function createWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width,
    height,
    title: `Toygun GCS v${app.getVersion()}`,
    icon: join(ROOT_PATH.dist, 'toygun-logo.png'),
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(ROOT_PATH.dist, 'electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('page-title-updated', (event) => event.preventDefault())

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(ROOT_PATH.dist, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  mainWindow = null
  app.quit()
})

app.whenReady().then(() => {
  console.log(`Toygun GCS v${app.getVersion()} başlatılıyor...`)

  // Kamera, mikrofon ve seri port izinlerini otomatik onayla
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const izinli = ['media', 'camera', 'microphone', 'geolocation', 'notifications', 'serial']
    callback(izinli.includes(permission))
  })

  // Web Serial API: seri port seçimini otomatik onayla (Renderer requestPort() çağrısı)
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    if (permission === 'serial') return true
    return null
  })

  session.defaultSession.setDevicePermissionHandler((details) => {
    if (details.deviceType === 'serial') return true
    return false
  })

  ros2KoprusuKur()
  createWindow()

  // select-serial-port: requestPort() çağrısında Electron portu otomatik seç
  session.defaultSession.on('select-serial-port', (event, portList, _webContents, callback) => {
    event.preventDefault()
    callback(portList[0]?.portId ?? '')
  })
  // mainWindow createWindow içinde set ediliyor, donanım servisi pencere oluştuktan sonra kurulur
  if (mainWindow) {
    donanımBaglantiKur(mainWindow)
    portIzleyiciBaslat(mainWindow)
  }
  guncellemeKurulumu()
})

app.on('before-quit', () => {
  portIzleyiciDurdur()
  // @ts-ignore
  if (import.meta.env.DEV) app.exit()
})
