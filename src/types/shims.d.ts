/** vite.config.ts → define: package.json sürümü */
declare const __UYGULAMA_SURUMU__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.avif' {
  const src: string
  export default src
}
