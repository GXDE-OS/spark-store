import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/vue";
import * as matchers from "@testing-library/jest-dom/matchers";

// 扩展 Vitest 的 expect
expect.extend(matchers);

// 每个测试后清理
afterEach(() => {
  cleanup();
});

// Mock window.ipcRenderer
global.window = Object.create(window);
Object.defineProperty(window, "ipcRenderer", {
  value: {
    send: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    invoke: vi.fn(),
    removeListener: vi.fn(),
  },
  writable: true,
});

// Mock window.apm_store
Object.defineProperty(window, "apm_store", {
  value: {
    arch: "amd64",
  },
  writable: true,
});
