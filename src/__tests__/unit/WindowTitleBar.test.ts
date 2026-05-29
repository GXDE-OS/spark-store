import { fireEvent, render, screen } from "@testing-library/vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WindowTitleBar from "@/components/WindowTitleBar.vue";

const windowControls = {
  minimize: vi.fn(),
  toggleMaximize: vi.fn(),
  close: vi.fn(),
};

describe("WindowTitleBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "windowControls", {
      value: windowControls,
      configurable: true,
    });
  });

  it("sends window control requests", async () => {
    render(WindowTitleBar);

    await fireEvent.click(screen.getByRole("button", { name: "最小化" }));
    await fireEvent.click(screen.getByRole("button", { name: "最大化或还原" }));
    await fireEvent.click(screen.getByRole("button", { name: "关闭" }));

    expect(windowControls.minimize).toHaveBeenCalledTimes(1);
    expect(windowControls.toggleMaximize).toHaveBeenCalledTimes(1);
    expect(windowControls.close).toHaveBeenCalledTimes(1);
  });

  it("stays below modal overlays in the stacking order", () => {
    const { container } = render(WindowTitleBar);

    expect(container.firstElementChild?.className).toContain("z-20");
    expect(container.firstElementChild?.className).not.toContain("z-[60]");
  });
});
