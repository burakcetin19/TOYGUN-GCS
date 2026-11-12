/**
 * Toygun GCS — MAVLink Mesaj Olay Yolu (renderer)
 *
 * Donanım (Electron IPC) ve Web Serial yollarından gelen çözülmüş mesajlar buraya yayınlanır.
 * COMMAND_ACK / MISSION_REQUEST_INT / MISSION_ACK gibi yanıt bekleyen akışlar
 * (ARM, görev yükleme) bu yolu dinler.
 */

type Dinleyici = (veri: Record<string, any>) => void

const dinleyiciler = new Map<string, Set<Dinleyici>>()

export function mesajYayinla(tip: string, veri: Record<string, any>): void {
  const kume = dinleyiciler.get(tip)
  if (!kume) return
  for (const cb of [...kume]) {
    try { cb(veri) } catch (e) { console.warn(`[MAVLink] ${tip} dinleyici hatası:`, e) }
  }
}

/** Dinleyici ekler; aboneliği kaldıran fonksiyonu döner. */
export function mesajDinle(tip: string, cb: Dinleyici): () => void {
  let kume = dinleyiciler.get(tip)
  if (!kume) { kume = new Set(); dinleyiciler.set(tip, kume) }
  kume.add(cb)
  return () => { kume!.delete(cb) }
}

/**
 * Koşulu sağlayan ilk mesajı bekler. Süre dolarsa null döner.
 */
export function mesajBekle(
  tip: string,
  kosul: (veri: Record<string, any>) => boolean,
  sureMs: number,
): Promise<Record<string, any> | null> {
  return new Promise((coz) => {
    const zamanlayici = setTimeout(() => { birak(); coz(null) }, sureMs)
    const birak = mesajDinle(tip, (veri) => {
      if (!kosul(veri)) return
      clearTimeout(zamanlayici)
      birak()
      coz(veri)
    })
  })
}
