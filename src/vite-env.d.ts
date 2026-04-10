/* eslint-disable */
/// <reference types="vite/client" />

import type { UpdateCenterBridge } from "@/global/typedefinition";

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare global {
  interface Window {
    // expose in the `electron/preload/index.ts`
    ipcRenderer: IpcRendererFacade;
    apm_store: {
      arch: string;
    };
    updateCenter: UpdateCenterBridge;
  }
}

interface IpcRendererFacade {
  on: import("electron").IpcRenderer["on"];
  off: import("electron").IpcRenderer["off"];
  send: import("electron").IpcRenderer["send"];
  invoke: import("electron").IpcRenderer["invoke"];
}

// IPC channel type definitions
declare interface IpcChannels {
  "get-app-version": () => string;
}

declare const __APP_VERSION__: string;

export {};
