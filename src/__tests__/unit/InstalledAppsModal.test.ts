import { render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import InstalledAppsModal from "@/components/InstalledAppsModal.vue";

describe("InstalledAppsModal", () => {
  it("keeps scroll chaining inside the modal list", () => {
    const { container } = render(InstalledAppsModal, {
      props: {
        show: true,
        apps: [],
        loading: false,
        error: "",
        activeOrigin: "spark",
        storeFilter: "both",
        apmAvailable: true,
      },
    });

    expect(screen.getByText("已安装应用")).toBeTruthy();
    const scrollContainer = container.querySelector(".overflow-y-auto");

    expect(scrollContainer?.className).toContain("overscroll-contain");
  });
});
