import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import FavoriteFolderSelector from "@/components/FavoriteFolderSelector.vue";
import type { FavoriteFolder } from "@/global/typedefinition";

const defaultFolder: FavoriteFolder = {
  id: 1,
  name: "默认收藏夹",
  itemCount: 1,
  createdAt: "2026-05-18T00:00:00Z",
  updatedAt: "2026-05-18T00:00:00Z",
};

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

  it("does not duplicate the default folder returned by the backend", () => {
    render(FavoriteFolderSelector, {
      props: {
        show: true,
        folders: [defaultFolder],
      },
    });

    expect(screen.getAllByRole("button", { name: "默认收藏夹" })).toHaveLength(
      1,
    );
  });

  it("offers creating a folder while selecting favorites", async () => {
    const rendered = render(FavoriteFolderSelector, {
      props: {
        show: true,
        folders: [defaultFolder],
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: "新建收藏夹" }));

    expect(rendered.emitted("create-folder")).toHaveLength(1);
  });
});
