/* eslint-disable */
/// <reference types="vite/client" />

import type { SystemInfo, UpdateCenterBridge } from "@/global/typedefinition";

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare global {
  interface ImportMetaEnv {
    readonly VITE_SPARK_BACKEND_BASE_URL?: string;
  }

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
  "get-system-info": () => Promise<SystemInfo>;
  "request-flarum-token": (payload: {
    identification: string;
    password: string;
  }) => Promise<{ token: string; userId: string }>;
}

declare const __APP_VERSION__: string;

export {};
