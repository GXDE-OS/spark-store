import { render } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import FavoriteFolderSelector from "@/components/FavoriteFolderSelector.vue";

describe("FavoriteFolderSelector", () => {
  it("renders above the app detail modal and its child popups", () => {
    const { container } = render(FavoriteFolderSelector, {
      props: {
        show: true,
        folders: [],
      },
    });

    const overlay = container.firstElementChild;

    expect(overlay?.className).toContain("z-[90]");
  });
});
