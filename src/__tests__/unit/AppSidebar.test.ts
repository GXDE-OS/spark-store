import { render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import AppSidebar from "@/components/AppSidebar.vue";

const renderSidebar = (
  overrides: Partial<InstanceType<typeof AppSidebar>["$props"]> = {},
) => {
  return render(AppSidebar, {
    props: {
      categories: {},
      activeCategory: "all",
      categoryCounts: { all: 0 },
      themeMode: "auto",
      storeFilter: "both",
      sparkAvailable: true,
      apmAvailable: true,
      ...overrides,
    },
  });
};

describe("AppSidebar", () => {
  it("shows management and update entries when at least one source is usable", () => {
    renderSidebar({ sparkAvailable: true, apmAvailable: false });

    expect(screen.getByText("应用管理")).toBeTruthy();
    expect(screen.getByText("软件更新")).toBeTruthy();
  });

  it("hides management and update entries when both sources are unavailable", () => {
    renderSidebar({ sparkAvailable: false, apmAvailable: false });

    expect(screen.queryByText("应用管理")).toBeNull();
    expect(screen.queryByText("软件更新")).toBeNull();
  });
});
