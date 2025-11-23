/// <reference types="vite/client" />

declare const __E2E__: boolean;
declare const __DEV__: boolean;
declare const __APP_VERSION__: string;

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
