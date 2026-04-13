import { describe, it, expect, beforeEach } from "vitest";
import {
  downloads,
  getNextDownloadId,
  removeDownloadItem,
} from "@/global/downloadStatus";
import type { DownloadItem } from "@/global/typedefinition";

describe("downloadStatus", () => {
  beforeEach(() => {
    downloads.value = [];
  });

  const createMockDownload = (id: number, pkgname: string): DownloadItem => ({
    id,
    name: `Test App ${id}`,
    pkgname,
    version: "1.0.0",
    icon: "",
    status: "queued",
    progress: 0,
    downloadedSize: 0,
    totalSize: 1000000,
    speed: 0,
    timeRemaining: 0,
    startTime: Date.now(),
    logs: [],
    source: "Test",
    origin: "apm",
    retry: false,
  });

  describe("addDownload", () => {
    it("should add a new download item", () => {
      const mockDownload = createMockDownload(1, "test-app");

      downloads.value.push(mockDownload);

      expect(downloads.value).toHaveLength(1);
      expect(downloads.value[0].pkgname).toBe("test-app");
    });
  });

  describe("removeDownloadItem", () => {
    it("should remove download by pkgname", () => {
      downloads.value.push(createMockDownload(1, "test-app"));
      removeDownloadItem("test-app");

      expect(downloads.value).toHaveLength(0);
    });

    it("should remove all items with matching pkgname when multiple exist", () => {
      downloads.value.push(createMockDownload(1, "test-app"));
      downloads.value.push(createMockDownload(2, "other-app"));
      downloads.value.push(createMockDownload(3, "test-app"));

      removeDownloadItem("test-app");

      expect(downloads.value).toHaveLength(1);
      expect(downloads.value[0].pkgname).toBe("other-app");
    });

    it("should not remove items that do not match the pkgname", () => {
      downloads.value.push(createMockDownload(1, "app-1"));
      downloads.value.push(createMockDownload(2, "app-2"));

      removeDownloadItem("non-existent");

      expect(downloads.value).toHaveLength(2);
      expect(downloads.value.map((d) => d.pkgname)).toEqual(["app-1", "app-2"]);
    });

    it("should handle removing from an empty list", () => {
      expect(() => removeDownloadItem("test-app")).not.toThrow();
      expect(downloads.value).toHaveLength(0);
    });

    it("should only remove items with the exact pkgname match", () => {
      downloads.value.push(createMockDownload(1, "test-app"));
      downloads.value.push(createMockDownload(2, "test-app-pro"));

      removeDownloadItem("test-app");

      expect(downloads.value).toHaveLength(1);
      expect(downloads.value[0].pkgname).toBe("test-app-pro");
    });

    it("should correctly handle removing items at the start, middle, and end", () => {
      downloads.value.push(createMockDownload(1, "app-1"));
      downloads.value.push(createMockDownload(2, "to-remove"));
      downloads.value.push(createMockDownload(3, "app-2"));
      downloads.value.push(createMockDownload(4, "to-remove"));
      downloads.value.push(createMockDownload(5, "app-3"));
      downloads.value.push(createMockDownload(6, "to-remove"));

      removeDownloadItem("to-remove");

      expect(downloads.value).toHaveLength(3);
      expect(downloads.value.map((d) => d.pkgname)).toEqual([
        "app-1",
        "app-2",
        "app-3",
      ]);
    });

    it("should not reuse ids after earlier tasks are removed", () => {
      downloads.value.push(createMockDownload(1, "app-1"));

      const secondId = getNextDownloadId();
      downloads.value.push(createMockDownload(secondId, "app-2"));

      downloads.value = [];

      expect(getNextDownloadId()).toBe(secondId + 1);
    });
  });
});
