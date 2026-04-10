import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import UpdateCenterItem from "@/components/update-center/UpdateCenterItem.vue";
import type {
  UpdateCenterItem as UpdateCenterItemData,
  UpdateCenterTaskState,
} from "@/global/typedefinition";

const createItem = (
  overrides: Partial<UpdateCenterItemData> = {},
): UpdateCenterItemData => ({
  taskKey: "aptss:spark-weather",
  packageName: "spark-weather",
  displayName: "Spark Weather",
  currentVersion: "1.0.0",
  newVersion: "2.0.0",
  source: "aptss",
  ...overrides,
});

const createTask = (
  overrides: Partial<UpdateCenterTaskState> = {},
): UpdateCenterTaskState => ({
  taskKey: "aptss:spark-weather",
  packageName: "spark-weather",
  source: "aptss",
  status: "downloading",
  progress: 42,
  logs: [],
  errorMessage: "",
  ...overrides,
});

describe("UpdateCenterItem", () => {
  it("renders an icon image when item.icon exists", () => {
    render(UpdateCenterItem, {
      props: {
        item: createItem({ icon: "/usr/share/pixmaps/spark-weather.png" }),
        task: createTask(),
        selected: false,
      },
    });

    const icon = screen.getByRole("img", { name: "Spark Weather 图标" });

    expect(icon).toHaveAttribute(
      "src",
      "file:///usr/share/pixmaps/spark-weather.png",
    );
  });

  it("falls back to a placeholder icon when the image fails", async () => {
    render(UpdateCenterItem, {
      props: {
        item: createItem({ icon: "https://example.com/spark-weather.png" }),
        task: createTask(),
        selected: false,
      },
    });

    const icon = screen.getByRole("img", { name: "Spark Weather 图标" });

    await fireEvent.error(icon);

    expect(icon.getAttribute("src")).toContain("data:image/svg+xml");
    expect(icon.getAttribute("src")).not.toContain(
      "https://example.com/spark-weather.png",
    );
  });

  it("shows a new item icon again after a previous icon failure", async () => {
    const { rerender } = render(UpdateCenterItem, {
      props: {
        item: createItem({ icon: "https://example.com/spark-weather.png" }),
        task: createTask(),
        selected: false,
      },
    });

    const firstIcon = screen.getByRole("img", { name: "Spark Weather 图标" });

    await fireEvent.error(firstIcon);

    expect(firstIcon.getAttribute("src")).toContain("data:image/svg+xml");

    await rerender({
      item: createItem({
        displayName: "Spark Clock",
        icon: "/usr/share/pixmaps/spark-clock.png",
      }),
      task: createTask(),
      selected: false,
    });

    const nextIcon = screen.getByRole("img", { name: "Spark Clock 图标" });

    expect(nextIcon).toHaveAttribute(
      "src",
      "file:///usr/share/pixmaps/spark-clock.png",
    );
  });

  it("retries the same icon string when a fresh item object is rendered", async () => {
    const brokenIcon = "https://example.com/spark-weather.png";
    const { rerender } = render(UpdateCenterItem, {
      props: {
        item: createItem({ icon: brokenIcon }),
        task: createTask(),
        selected: false,
      },
    });

    const firstIcon = screen.getByRole("img", { name: "Spark Weather 图标" });

    await fireEvent.error(firstIcon);

    expect(firstIcon.getAttribute("src")).toContain("data:image/svg+xml");

    await rerender({
      item: createItem({
        currentVersion: "1.1.0",
        newVersion: "2.1.0",
        icon: brokenIcon,
      }),
      task: createTask({ progress: 75 }),
      selected: false,
    });

    const retriedIcon = screen.getByRole("img", { name: "Spark Weather 图标" });

    expect(retriedIcon).toHaveAttribute("src", brokenIcon);
  });
});
