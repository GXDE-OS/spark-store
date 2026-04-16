import { describe, expect, it } from "vitest";

import {
  getEffectiveStoreFilter,
  getAllowedInstalledOrigin,
  getDefaultInstalledOrigin,
  isOriginEnabled,
  isOriginUsable,
} from "@/modules/storeFilter";

describe("storeFilter helpers", () => {
  it("reports whether an origin is enabled by the current store filter", () => {
    expect(isOriginEnabled("both", "spark")).toBe(true);
    expect(isOriginEnabled("both", "apm")).toBe(true);
    expect(isOriginEnabled("spark", "spark")).toBe(true);
    expect(isOriginEnabled("spark", "apm")).toBe(false);
    expect(isOriginEnabled("apm", "apm")).toBe(true);
    expect(isOriginEnabled("apm", "spark")).toBe(false);
  });

  it("chooses the default installed origin from the active store filter", () => {
    expect(getDefaultInstalledOrigin("spark", { spark: true, apm: true })).toBe(
      "spark",
    );
    expect(getDefaultInstalledOrigin("apm", { spark: true, apm: true })).toBe(
      "apm",
    );
    expect(getDefaultInstalledOrigin("both", { spark: true, apm: true })).toBe(
      "apm",
    );
    expect(getDefaultInstalledOrigin("both", { spark: true, apm: false })).toBe(
      "spark",
    );
    expect(
      getDefaultInstalledOrigin("both", { spark: false, apm: false }),
    ).toBe(null);
  });

  it("redirects disallowed installed origins to an allowed one", () => {
    expect(
      getAllowedInstalledOrigin("spark", "apm", { spark: true, apm: true }),
    ).toBe("spark");
    expect(
      getAllowedInstalledOrigin("apm", "spark", { spark: true, apm: true }),
    ).toBe("apm");
    expect(
      getAllowedInstalledOrigin("both", "apm", { spark: true, apm: false }),
    ).toBe("spark");
    expect(
      getAllowedInstalledOrigin("both", "spark", { spark: false, apm: false }),
    ).toBeNull();
  });

  it("computes the effective runtime store filter from source availability", () => {
    expect(getEffectiveStoreFilter("both", { spark: true, apm: true })).toBe(
      "both",
    );
    expect(getEffectiveStoreFilter("both", { spark: true, apm: false })).toBe(
      "spark",
    );
    expect(getEffectiveStoreFilter("both", { spark: false, apm: true })).toBe(
      "apm",
    );
    expect(getEffectiveStoreFilter("both", { spark: false, apm: false })).toBe(
      null,
    );
  });

  it("only treats enabled and installed origins as usable", () => {
    expect(isOriginUsable("both", "spark", { spark: true, apm: false })).toBe(
      true,
    );
    expect(isOriginUsable("both", "apm", { spark: true, apm: false })).toBe(
      false,
    );
    expect(isOriginUsable("spark", "apm", { spark: true, apm: true })).toBe(
      false,
    );
  });
});
