/// <reference types="vite/client" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare const __APP_VERSION__: string

declare module 'spark-md5' {
  export default class SparkMD5 {
    static ArrayBuffer: new () => {
      append(data: ArrayBuffer): void
      end(): string
    }
  }
}

interface Window {
  __EARLY_INIT_PAYLOAD__: { token: string; config: Record<string, unknown> } | null
}
