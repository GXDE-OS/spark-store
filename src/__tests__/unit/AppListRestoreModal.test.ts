import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import AppListRestoreModal from "@/components/AppListRestoreModal.vue";
import type { SyncedAppListItem } from "@/global/typedefinition";

const createItem = (
  overrides: Partial<SyncedAppListItem> = {},
): SyncedAppListItem => ({
  pkgname: "spark-notes",
  origin: "spark",
  category: "office",
  version: "1.0.0",
  packageArch: "amd64",
  appName: "Spark Notes",
  iconUrl: "",
  ...overrides,
});

describe("AppListRestoreModal", () => {
  it("emits selected installable cloud items", async () => {
    const rendered = render(AppListRestoreModal, {
      props: {
        show: true,
        loading: false,
        error: "",
        items: [
          createItem(),
          createItem({ pkgname: "amber-ce", appName: "Amber CE" }),
        ],
        installedKeys: new Set<string>(),
      },
    });

    await fireEvent.click(screen.getByLabelText("Spark Notes"));
    await fireEvent.click(screen.getByRole("button", { name: "加入安装队列" }));

    expect(rendered.emitted("install-selected")?.[0]?.[0]).toEqual([
      expect.objectContaining({ pkgname: "spark-notes" }),
    ]);
  });

  it("disables already installed cloud items", () => {
    render(AppListRestoreModal, {
      props: {
        show: true,
        loading: false,
        error: "",
        items: [createItem()],
        installedKeys: new Set(["spark:spark-notes"]),
      },
    });

    expect(screen.getByLabelText("Spark Notes")).toBeDisabled();
    expect(screen.getByText("已安装")).toBeTruthy();
  });
});
