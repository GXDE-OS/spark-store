import { beforeEach, describe, expect, it, vi } from "vitest";

import { createUpdateCenterStore } from "@/modules/updateCenter";
import { downloads } from "@/global/downloadStatus";

const createSnapshot = (overrides = {}) => ({
  items: [
    {
      taskKey: "aptss:spark-weather",
      packageName: "spark-weather",
      displayName: "Spark Weather",
      currentVersion: "1.0.0",
      newVersion: "2.0.0",
      source: "aptss" as const,
      ignored: false,
    },
  ],
  tasks: [],
  warnings: [],
  hasRunningTasks: false,
  ...overrides,
});

describe("updateCenter store", () => {
  const open = vi.fn();
  const refresh = vi.fn();
  const ignore = vi.fn();
  const unignore = vi.fn();
  const start = vi.fn();
  const onState = vi.fn();
  const offState = vi.fn();

  beforeEach(() => {
    open.mockReset();
    refresh.mockReset();
    ignore.mockReset();
    unignore.mockReset();
    start.mockReset();
    onState.mockReset();
    offState.mockReset();
    downloads.value = [];

    Object.defineProperty(window, "updateCenter", {
      configurable: true,
      value: {
        open,
        refresh,
        ignore,
        unignore,
        start,
        cancel: vi.fn(),
        getState: vi.fn(),
        onState,
        offState,
      },
    });
  });

  it("opens the modal with the initial snapshot", async () => {
    const snapshot = createSnapshot();
    open.mockResolvedValue(snapshot);
    const store = createUpdateCenterStore();

    await store.open("apm");

    expect(open).toHaveBeenCalledWith("apm");
    expect(store.isOpen.value).toBe(true);
    expect(store.snapshot.value).toEqual(snapshot);
    expect(store.filteredItems.value).toEqual(snapshot.items);
  });

  it("reuses the last store filter when refreshing without an explicit filter", async () => {
    const snapshot = createSnapshot();
    open.mockResolvedValue(snapshot);
    refresh.mockResolvedValue(snapshot);
    const store = createUpdateCenterStore();

    await store.open("apm");
    await store.refresh();

    expect(refresh).toHaveBeenCalledWith("apm");
  });

  it("starts only the selected non-ignored items", async () => {
    const snapshot = createSnapshot({
      items: [
        {
          taskKey: "aptss:spark-weather",
          packageName: "spark-weather",
          displayName: "Spark Weather",
          currentVersion: "1.0.0",
          newVersion: "2.0.0",
          source: "aptss" as const,
          ignored: false,
        },
        {
          taskKey: "apm:spark-clock",
          packageName: "spark-clock",
          displayName: "Spark Clock",
          currentVersion: "1.0.0",
          newVersion: "2.0.0",
          source: "apm" as const,
          ignored: true,
        },
      ],
    });
    open.mockResolvedValue(snapshot);
    const store = createUpdateCenterStore();

    await store.open();
    store.toggleSelection("aptss:spark-weather");
    store.toggleSelection("apm:spark-clock");
    await store.startSelected();

    expect(start).toHaveBeenCalledWith([
      {
        taskKey: "aptss:spark-weather",
        id: downloads.value[0]?.id,
      },
    ]);
  });

  it("uses remoteIcon when adding update tasks to the download queue", async () => {
    const snapshot = createSnapshot({
      items: [
        {
          taskKey: "aptss:spark-weather",
          packageName: "spark-weather",
          displayName: "Spark Weather",
          currentVersion: "1.0.0",
          newVersion: "2.0.0",
          source: "aptss" as const,
          ignored: false,
          remoteIcon: "https://example.com/icons/spark-weather.png",
        },
      ],
    });
    open.mockResolvedValue(snapshot);
    const store = createUpdateCenterStore();

    await store.open();
    store.toggleSelection("aptss:spark-weather");
    await store.startSelected();

    expect(downloads.value).toHaveLength(1);
    expect(downloads.value[0]?.icon).toBe(
      "https://example.com/icons/spark-weather.png",
    );
  });

  it("forwards ignore and unignore actions with the package and target version", async () => {
    const snapshot = createSnapshot();
    open.mockResolvedValue(snapshot);
    const store = createUpdateCenterStore();

    await store.open();
    await store.ignoreItem("spark-weather", "2.0.0");
    await store.unignoreItem("spark-weather", "2.0.0");

    expect(ignore).toHaveBeenCalledWith({
      packageName: "spark-weather",
      newVersion: "2.0.0",
    });
    expect(unignore).toHaveBeenCalledWith({
      packageName: "spark-weather",
      newVersion: "2.0.0",
    });
  });

  it("assigns update-center download ids from a separate range", async () => {
    downloads.value = [
      {
        id: 5,
        name: "Spark Notes",
        pkgname: "spark-notes",
        version: "1.0.0",
        icon: "https://example.com/icons/spark-notes.png",
        origin: "spark",
        status: "queued",
        progress: 0,
        downloadedSize: 0,
        totalSize: 1024,
        speed: 0,
        timeRemaining: 0,
        startTime: Date.now(),
        logs: [],
        source: "APM Store",
        retry: false,
      },
    ];
    const snapshot = createSnapshot();
    open.mockResolvedValue(snapshot);
    const store = createUpdateCenterStore();

    await store.open();
    store.toggleSelection("aptss:spark-weather");
    await store.startSelected();

    expect(downloads.value).toHaveLength(2);
    expect(downloads.value[1]?.id).toBeLessThan(0);
    expect(start).toHaveBeenCalledWith([
      {
        taskKey: "aptss:spark-weather",
        id: downloads.value[1]?.id,
      },
    ]);
  });

  it("blocks close requests while the snapshot reports running tasks", () => {
    const store = createUpdateCenterStore();
    store.isOpen.value = true;
    store.snapshot.value = createSnapshot({ hasRunningTasks: true });

    store.requestClose();

    expect(store.isOpen.value).toBe(false);
    expect(store.showCloseConfirm.value).toBe(false);
  });

  it("applies pushed snapshots from the main process", () => {
    let listener:
      | ((snapshot: ReturnType<typeof createSnapshot>) => void)
      | null = null;
    onState.mockImplementation((nextListener) => {
      listener = nextListener;
    });
    const store = createUpdateCenterStore();

    store.bind();

    const pushedSnapshot = createSnapshot({
      items: [
        {
          taskKey: "aptss:spark-music",
          packageName: "spark-music",
          displayName: "Spark Music",
          currentVersion: "3.0.0",
          newVersion: "3.1.0",
          source: "aptss" as const,
          ignored: false,
        },
      ],
    });
    listener?.(pushedSnapshot);

    expect(onState).toHaveBeenCalledTimes(1);
    expect(store.snapshot.value).toEqual(pushedSnapshot);
    expect(store.filteredItems.value).toEqual(pushedSnapshot.items);

    store.unbind();
    expect(offState).toHaveBeenCalledTimes(1);
  });

  it("prunes stale selected task keys when snapshots change", async () => {
    open.mockResolvedValue(
      createSnapshot({
        items: [
          {
            taskKey: "aptss:spark-weather",
            packageName: "spark-weather",
            displayName: "Spark Weather",
            currentVersion: "1.0.0",
            newVersion: "2.0.0",
            source: "aptss" as const,
            ignored: false,
          },
          {
            taskKey: "apm:spark-clock",
            packageName: "spark-clock",
            displayName: "Spark Clock",
            currentVersion: "1.0.0",
            newVersion: "2.0.0",
            source: "apm" as const,
            ignored: false,
          },
        ],
      }),
    );
    refresh.mockResolvedValue(
      createSnapshot({
        items: [
          {
            taskKey: "aptss:spark-music",
            packageName: "spark-music",
            displayName: "Spark Music",
            currentVersion: "3.0.0",
            newVersion: "3.1.0",
            source: "aptss" as const,
            ignored: false,
          },
        ],
      }),
    );
    const store = createUpdateCenterStore();

    await store.open();
    store.toggleSelection("aptss:spark-weather");
    expect(store.selectedTaskKeys.value.has("aptss:spark-weather")).toBe(true);

    await store.refresh();

    expect(store.selectedTaskKeys.value.has("aptss:spark-weather")).toBe(false);

    await store.startSelected();

    expect(start).not.toHaveBeenCalled();
  });

  it("clears selection across a close and reopen cycle", async () => {
    const snapshot = createSnapshot({
      items: [
        {
          taskKey: "aptss:spark-weather",
          packageName: "spark-weather",
          displayName: "Spark Weather",
          currentVersion: "1.0.0",
          newVersion: "2.0.0",
          source: "aptss" as const,
          ignored: false,
        },
      ],
    });
    open.mockResolvedValue(snapshot);
    const store = createUpdateCenterStore();

    await store.open();
    store.toggleSelection("aptss:spark-weather");
    expect(store.selectedTaskKeys.value.has("aptss:spark-weather")).toBe(true);

    store.requestClose();
    expect(store.isOpen.value).toBe(false);

    await store.open();

    expect(store.selectedTaskKeys.value.has("aptss:spark-weather")).toBe(false);

    await store.startSelected();

    expect(start).not.toHaveBeenCalled();
  });
});
