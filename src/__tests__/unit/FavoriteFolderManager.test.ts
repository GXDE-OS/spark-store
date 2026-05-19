import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import FavoriteFolderManager from "@/components/FavoriteFolderManager.vue";
import type {
  App,
  FavoriteFolder,
  ResolvedFavoriteItem,
} from "@/global/typedefinition";

const folder: FavoriteFolder = {
  id: 1,
  name: "默认收藏夹",
  itemCount: 1,
  createdAt: "2026-05-18T00:00:00Z",
  updatedAt: "2026-05-18T00:00:00Z",
};

const item: ResolvedFavoriteItem = {
  item: {
    id: 2,
    appKey: "app:office:wps",
    pkgname: "wps",
    name: "WPS",
    category: "office",
    iconUrl: "",
    createdAt: "2026-05-18T00:00:00Z",
  },
  status: "downlisted",
  reason: "已下架",
  selectedApp: null,
};

const selectedApp: App = {
  name: "WPS",
  pkgname: "wps",
  version: "1.0.0",
  filename: "wps_1.0.0_amd64.deb",
  torrent_address: "",
  author: "",
  contributor: "",
  website: "",
  update: "",
  size: "110M",
  more: "Office suite",
  tags: "office",
  img_urls: [],
  icons: "",
  category: "office",
  origin: "apm",
  currentStatus: "not-installed",
};

describe("FavoriteFolderManager", () => {
  it("shows downlisted favorites and emits bulk delete", async () => {
    const rendered = render(FavoriteFolderManager, {
      props: {
        folders: [folder],
        activeFolderId: 1,
        items: [item],
        loading: false,
        error: "",
      },
    });

    expect(screen.getByText("已下架")).toBeTruthy();
    await fireEvent.click(screen.getByLabelText("选择 WPS"));
    await fireEvent.click(screen.getByRole("button", { name: "移除选中" }));

    expect(rendered.emitted("remove-selected")?.[0]?.[0]).toEqual([2]);
  });

  it("opens a favorite item's app detail from the row content", async () => {
    const rendered = render(FavoriteFolderManager, {
      props: {
        folders: [folder],
        activeFolderId: 1,
        items: [{ ...item, status: "installable", selectedApp }],
        loading: false,
        error: "",
      },
    });

    await fireEvent.click(
      screen.getByRole("button", { name: "打开 WPS 详情" }),
    );

    expect(rendered.emitted("open-detail")?.[0]?.[0]).toEqual(selectedApp);
    expect(rendered.emitted("remove-selected")).toBeUndefined();
  });
});
