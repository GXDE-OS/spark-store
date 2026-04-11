import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import { defineComponent, nextTick, reactive, ref } from "vue";

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
  it("renders localIcon first when both icon sources exist", () => {
    render(UpdateCenterItem, {
      props: {
        item: createItem({
          localIcon: "/usr/share/pixmaps/spark-weather.png",
          remoteIcon: "https://example.com/spark-weather.png",
        }),
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

  it("falls back to remoteIcon when localIcon fails", async () => {
    render(UpdateCenterItem, {
      props: {
        item: createItem({
          localIcon: "/usr/share/pixmaps/spark-weather.png",
          remoteIcon: "https://example.com/spark-weather.png",
        }),
        task: createTask(),
        selected: false,
      },
    });

    const icon = screen.getByRole("img", { name: "Spark Weather 图标" });

    await fireEvent.error(icon);

    expect(icon).toHaveAttribute(
      "src",
      "https://example.com/spark-weather.png",
    );
  });

  it("falls back to the placeholder after localIcon and remoteIcon both fail", async () => {
    render(UpdateCenterItem, {
      props: {
        item: createItem({
          localIcon: "/usr/share/pixmaps/spark-weather.png",
          remoteIcon: "https://example.com/spark-weather.png",
        }),
        task: createTask(),
        selected: false,
      },
    });

    const icon = screen.getByRole("img", { name: "Spark Weather 图标" });

    await fireEvent.error(icon);
    await fireEvent.error(icon);

    expect(icon.getAttribute("src")).toContain("data:image/svg+xml");
    expect(icon.getAttribute("src")).not.toContain(
      "https://example.com/spark-weather.png",
    );
  });

  it("restarts from localIcon when a new item is rendered", async () => {
    const { rerender } = render(UpdateCenterItem, {
      props: {
        item: createItem({
          localIcon: "/usr/share/pixmaps/spark-weather.png",
          remoteIcon: "https://example.com/spark-weather.png",
        }),
        task: createTask(),
        selected: false,
      },
    });

    const firstIcon = screen.getByRole("img", { name: "Spark Weather 图标" });

    await fireEvent.error(firstIcon);

    expect(firstIcon).toHaveAttribute(
      "src",
      "https://example.com/spark-weather.png",
    );

    await rerender({
      item: createItem({
        displayName: "Spark Clock",
        localIcon: "/usr/share/pixmaps/spark-clock.png",
        remoteIcon: "https://example.com/spark-clock.png",
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

  it("restarts from localIcon when icon sources change on the same item object", async () => {
    const item = reactive(
      createItem({
        localIcon: "/usr/share/pixmaps/spark-weather.png",
        remoteIcon: "https://example.com/spark-weather.png",
      }),
    );
    render(UpdateCenterItem, {
      props: {
        item,
        task: createTask(),
        selected: false,
      },
    });

    const firstIcon = screen.getByRole("img", { name: "Spark Weather 图标" });

    await fireEvent.error(firstIcon);
    await fireEvent.error(firstIcon);

    expect(firstIcon.getAttribute("src")).toContain("data:image/svg+xml");

    item.localIcon = "/usr/share/pixmaps/spark-weather-refreshed.png";
    item.remoteIcon = "https://example.com/spark-weather-refreshed.png";

    await nextTick();

    const retriedIcon = screen.getByRole("img", { name: "Spark Weather 图标" });

    expect(retriedIcon).toHaveAttribute(
      "src",
      "file:///usr/share/pixmaps/spark-weather-refreshed.png",
    );
  });

  it("restarts from localIcon for a fresh item object with the same icon sources", async () => {
    const item = ref(
      createItem({
        localIcon: "/usr/share/pixmaps/spark-weather.png",
        remoteIcon: "https://example.com/spark-weather.png",
      }),
    );
    const Wrapper = defineComponent({
      components: { UpdateCenterItem },
      setup() {
        return {
          item,
          task: createTask(),
        };
      },
      template:
        '<UpdateCenterItem :item="item" :task="task" :selected="false" />',
    });

    render(Wrapper);

    const firstIcon = screen.getByRole("img", { name: "Spark Weather 图标" });

    await fireEvent.error(firstIcon);
    await fireEvent.error(firstIcon);

    expect(firstIcon.getAttribute("src")).toContain("data:image/svg+xml");

    item.value = createItem({
      localIcon: "/usr/share/pixmaps/spark-weather.png",
      remoteIcon: "https://example.com/spark-weather.png",
    });
    await nextTick();

    const retriedIcon = screen.getByRole("img", { name: "Spark Weather 图标" });

    expect(retriedIcon).toHaveAttribute(
      "src",
      "file:///usr/share/pixmaps/spark-weather.png",
    );
  });
});
