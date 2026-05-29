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

    expect(
      screen.getAllByRole("checkbox", { name: "收藏到 默认收藏夹" }),
    ).toHaveLength(1);
  });

  it("normalizes backend default folder names before adding fallback default", () => {
    render(FavoriteFolderSelector, {
      props: {
        show: true,
        folders: [{ ...defaultFolder, name: " 默认收藏夹 " }],
      },
    });

    expect(
      screen.getAllByRole("checkbox", { name: /收藏到\s*默认收藏夹/ }),
    ).toHaveLength(1);
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

  it("emits the current draft selection when creating a folder", async () => {
    const rendered = render(FavoriteFolderSelector, {
      props: {
        show: true,
        folders: [defaultFolder],
      },
    });

    await fireEvent.click(screen.getByLabelText("收藏到 默认收藏夹"));
    await fireEvent.click(screen.getByRole("button", { name: "新建收藏夹" }));

    expect(rendered.emitted("create-folder")?.[0]?.[0]).toEqual([1]);
  });

  it("emits checked folder ids only after confirmation", async () => {
    const rendered = render(FavoriteFolderSelector, {
      props: {
        show: true,
        folders: [
          defaultFolder,
          { ...defaultFolder, id: 2, name: "办公收藏", itemCount: 0 },
        ],
        selectedFolderIds: [defaultFolder.id],
      },
    });

    await fireEvent.click(screen.getByLabelText("收藏到 默认收藏夹"));
    await fireEvent.click(screen.getByLabelText("收藏到 办公收藏"));

    expect(rendered.emitted("save-selection")).toBeUndefined();
    await fireEvent.click(screen.getByRole("button", { name: "保存收藏夹" }));

    expect(rendered.emitted("save-selection")?.[0]?.[0]).toEqual([2]);
  });

  it("emits the fallback default folder selection after confirmation", async () => {
    const rendered = render(FavoriteFolderSelector, {
      props: {
        show: true,
        folders: [],
      },
    });

    await fireEvent.click(screen.getByLabelText("收藏到 默认收藏夹"));
    await fireEvent.click(screen.getByRole("button", { name: "保存收藏夹" }));

    expect(rendered.emitted("save-selection")?.[0]?.[0]).toEqual(["default"]);
  });

  it("preserves unsaved folder checks when the folder list changes", async () => {
    const rendered = render(FavoriteFolderSelector, {
      props: {
        show: true,
        folders: [defaultFolder],
        selectedFolderIds: [],
      },
    });

    await fireEvent.click(screen.getByLabelText("收藏到 默认收藏夹"));
    await rendered.rerender({
      folders: [
        defaultFolder,
        { ...defaultFolder, id: 2, name: "办公收藏", itemCount: 0 },
      ],
    });
    await fireEvent.click(screen.getByLabelText("收藏到 办公收藏"));
    await fireEvent.click(screen.getByRole("button", { name: "保存收藏夹" }));

    expect(rendered.emitted("save-selection")?.[0]?.[0]).toEqual([1, 2]);
  });
});
