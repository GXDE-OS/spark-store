import { computed, ref } from "vue";
import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it, vi } from "vitest";

import UpdateCenterModal from "@/components/UpdateCenterModal.vue";
import type {
  UpdateCenterItem,
  UpdateCenterSnapshot,
  UpdateCenterTaskState,
} from "@/global/typedefinition";
import type { UpdateCenterStore } from "@/modules/updateCenter";

const createItem = (
  overrides: Partial<UpdateCenterItem> = {},
): UpdateCenterItem => ({
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

const createStore = (
  overrides: Partial<UpdateCenterSnapshot> = {},
): UpdateCenterStore => {
  const snapshot = ref<UpdateCenterSnapshot>({
    items: [
      createItem({
        taskKey: "aptss:spark-weather",
        source: "aptss",
      }),
      createItem({
        taskKey: "apm:spark-clock",
        packageName: "spark-clock",
        displayName: "Spark Clock",
        source: "apm",
        isMigration: true,
        migrationTarget: "apm",
      }),
    ],
    tasks: [createTask()],
    warnings: ["更新过程中请勿关闭商店"],
    hasRunningTasks: true,
    ...overrides,
  });

  const selectedTaskKeys = ref(new Set<string>(["aptss:spark-weather"]));

  return {
    isOpen: ref(true),
    showCloseConfirm: ref(true),
    showMigrationConfirm: ref(false),
    searchQuery: ref(""),
    selectedTaskKeys,
    snapshot,
    filteredItems: computed(() => snapshot.value.items),
    allSelected: computed(() => false),
    someSelected: computed(() => selectedTaskKeys.value.size > 0),
    bind: vi.fn(),
    unbind: vi.fn(),
    open: vi.fn(),
    refresh: vi.fn(),
    ignoreItem: vi.fn(),
    unignoreItem: vi.fn(),
    toggleSelection: vi.fn(),
    getSelectedItems: vi.fn(() =>
      snapshot.value.items.filter(
        (item) =>
          selectedTaskKeys.value.has(item.taskKey) && item.ignored !== true,
      ),
    ),
    closeNow: vi.fn(),
    startSelected: vi.fn(),
    requestClose: vi.fn(),
  };
};

describe("UpdateCenterModal", () => {
  it("renders source tags, running state, warnings, and migration marker", () => {
    const store = createStore();

    render(UpdateCenterModal, {
      props: {
        show: true,
        store,
      },
    });

    expect(screen.getByText("软件更新")).toBeTruthy();
    expect(screen.getByText("传统deb")).toBeTruthy();
    expect(screen.getByText("APM")).toBeTruthy();
    expect(screen.getByText("将迁移到 APM")).toBeTruthy();
    expect(screen.getByText("更新过程中请勿关闭商店")).toBeTruthy();
    expect(screen.getByText("下载中")).toBeTruthy();
    expect(screen.getByText("42%")).toBeTruthy();
  });

  it("renders ignored items as disabled instead of normal selectable actions", () => {
    const store = createStore({
      items: [
        createItem({
          taskKey: "aptss:spark-weather",
          packageName: "spark-weather",
          displayName: "Spark Weather",
          source: "aptss",
          ignored: true,
        }),
      ],
      tasks: [],
      warnings: [],
      hasRunningTasks: false,
    });

    render(UpdateCenterModal, {
      props: {
        show: true,
        store,
      },
    });

    expect(screen.getByText("已忽略")).toBeTruthy();
    expect(screen.getAllByRole("checkbox").at(-1)).toBeDisabled();
    expect(screen.getByRole("button", { name: "取消忽略" })).toBeTruthy();
  });

  it("renders ignore action for normal items", () => {
    const store = createStore({
      items: [
        createItem({
          taskKey: "aptss:spark-weather",
          packageName: "spark-weather",
          displayName: "Spark Weather",
          source: "aptss",
          ignored: false,
        }),
      ],
      tasks: [],
      warnings: [],
      hasRunningTasks: false,
    });

    render(UpdateCenterModal, {
      props: {
        show: true,
        store,
      },
    });

    expect(screen.getByRole("button", { name: "忽略更新" })).toBeTruthy();
  });

  it("renders migration confirmation when requested", () => {
    const store = createStore({ hasRunningTasks: false });
    store.showMigrationConfirm.value = true;

    render(UpdateCenterModal, {
      props: {
        show: true,
        store,
      },
    });

    expect(screen.getByText("迁移确认")).toBeTruthy();
  });

  it("close button triggers request-close flow", async () => {
    const store = createStore({ hasRunningTasks: false });

    render(UpdateCenterModal, {
      props: {
        show: true,
        store,
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: "关闭" }));

    expect(store.requestClose).toHaveBeenCalledTimes(1);
  });
});
