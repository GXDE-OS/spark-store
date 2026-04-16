import { fireEvent, render, screen } from "@testing-library/vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "@/App.vue";

const invoke = vi.fn();
const updateCenterOpen = vi.fn();

vi.mock("axios", () => {
  const get = vi.fn(async () => ({ data: [] }));

  return {
    default: {
      create: () => ({ get }),
    },
  };
});

describe("App update center runtime", () => {
  beforeEach(() => {
    invoke.mockReset();
    updateCenterOpen.mockReset();

    invoke.mockImplementation(async (channel: string) => {
      if (channel === "get-store-filter") return "both";
      if (channel === "check-spark-available") return true;
      if (channel === "check-apm-available") return true;
      if (channel === "get-app-version") return "5.0.0";
      return [];
    });

    Object.assign(window.ipcRenderer, {
      invoke,
      on: vi.fn(),
      off: vi.fn(),
      send: vi.fn(),
    });

    Object.assign(window, {
      updateCenter: {
        open: updateCenterOpen.mockResolvedValue({
          items: [],
          tasks: [],
          warnings: [],
          hasRunningTasks: false,
        }),
        refresh: vi.fn(),
        ignore: vi.fn(),
        unignore: vi.fn(),
        start: vi.fn(),
        cancel: vi.fn(),
        getState: vi.fn(),
        onState: vi.fn(),
        offState: vi.fn(),
      },
    });

    window.apm_store.arch = "amd64";

    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  it("opens update center with an empty snapshot without throwing", async () => {
    render(App);

    await fireEvent.click(await screen.findByText("软件更新"));

    expect(updateCenterOpen).toHaveBeenCalledWith("both");
    expect(await screen.findByText("暂无可展示的更新任务")).toBeTruthy();
  });
});
