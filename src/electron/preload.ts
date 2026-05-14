import { contextBridge, ipcRenderer } from 'electron'

// Güvenli API köprüsü — renderer sürecine açılan arabirim
contextBridge.exposeInMainWorld('toygunAPI', {
  platform: process.platform,
  versiyon: process.env.npm_package_version ?? '1.0.0',

  // Güncelleme
  guncellemeIndir: () => ipcRenderer.send('guncelleme-indir'),
  guncellemeKur: () => ipcRenderer.send('guncelleme-kur'),
  disaridaAc: (url: string) => ipcRenderer.send('disarida-ac', url),

  onGuncellemeMevcut: (cb: (veri: { mevcutSurum: string; yeniSurum: string; notlar: string }) => void) => {
    ipcRenderer.on('guncelleme-mevcut', (_e, veri) => cb(veri))
  },
  onGuncellemeIndirme: (cb: (veri: { yuzde: number; hiz: number }) => void) => {
    ipcRenderer.on('guncelleme-indirme', (_e, veri) => cb(veri))
  },
  onGuncellemeHazir: (cb: () => void) => {
    ipcRenderer.on('guncelleme-hazir', () => cb())
  },

  // ── Donanım Bağlantısı (Serial / UDP / TCP) ──────────────────────────────
  /** Mevcut COM portlarını listeler (VID/PID tanıma dahil) */
  portListele: (): Promise<{
    yol: string; uretici: string; aciklama: string
    vendorId: string; productId: string; cihazTipi: string; pixhawkMu: boolean
  }[]> =>
    ipcRenderer.invoke('port-listele'),

  /** USB cihaz takılma/çıkarma olaylarını dinler */
  onPortDegisikligi: (cb: (portlar: {
    yol: string; uretici: string; aciklama: string
    vendorId: string; productId: string; cihazTipi: string; pixhawkMu: boolean
  }[]) => void) => {
    ipcRenderer.on('port-degisikligi', (_e, portlar) => cb(portlar))
  },

  /** Port değişikliği dinleyicisini kaldırır */
  offPortDegisikligi: (cb: (...args: any[]) => void) => {
    ipcRenderer.removeListener('port-degisikligi', cb)
  },

  /** Serial port üzerinden MAVLink bağlantısı başlatır */
  serialBaglan: (yol: string, baud: number): Promise<{ basarili: boolean; hata?: string }> =>
    ipcRenderer.invoke('serial-baglan', yol, baud),

  /** Serial bağlantıyı keser */
  serialKes: (): Promise<{ basarili: boolean }> =>
    ipcRenderer.invoke('serial-kes'),

  /** UDP socket açarak MAVLink paketlerini dinler */
  udpBaglan: (yerelPort: number): Promise<{ basarili: boolean; hata?: string }> =>
    ipcRenderer.invoke('udp-baglan', yerelPort),

  /** UDP bağlantıyı kapatır */
  udpKes: (): Promise<{ basarili: boolean }> =>
    ipcRenderer.invoke('udp-kes'),

  /** TCP üzerinden MAVLink bağlantısı kurar */
  tcpBaglan: (host: string, port: number): Promise<{ basarili: boolean; hata?: string }> =>
    ipcRenderer.invoke('tcp-baglan', host, port),

  /** TCP bağlantıyı keser */
  tcpKes: (): Promise<{ basarili: boolean }> =>
    ipcRenderer.invoke('tcp-kes'),

  /** Tüm donanım bağlantılarını keser */
  donanımKes: (): Promise<{ basarili: boolean }> =>
    ipcRenderer.invoke('donanim-kes'),

  /** Electron main'den gelen ham MAVLink mesajlarını dinler */
  onMavlinkMesaj: (cb: (veri: { tip: string; veri: Record<string, any> }) => void) => {
    ipcRenderer.on('mavlink-mesaj', (_e, veri) => cb(veri))
  },

  /** Donanım bağlantı durumu değişikliklerini dinler */
  onBaglantiDurumu: (cb: (durum: 'baglandi' | 'baglaniliyor' | 'baglantiKesik') => void) => {
    ipcRenderer.on('baglanti-durumu', (_e, durum) => cb(durum))
  },

  /**
   * MAVLink komutunu mavlink2rest REST API'sine gönderir.
   * Main process üzerinden çalışır — CORS kısıtlaması yoktur.
   */
  mavlinkKomutGonder: (
    komut: Record<string, any>,
    url: string,
  ): Promise<{ basarili: boolean; durum?: number; hata?: string }> =>
    ipcRenderer.invoke('mavlink-komut-gonder', komut, url),
})
