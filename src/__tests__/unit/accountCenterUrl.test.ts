import { describe, expect, it } from "vitest";

import { buildAccountFrameUrl } from "@/modules/accountCenterUrl";

describe("accountCenterUrl", () => {
  it("falls back to the production account URL when configured URL is malformed", () => {
    const url = buildAccountFrameUrl("not a url", "momen");

    expect(url).toContain("https://account.spark-app.store/account");
    expect(url).toContain("view=management");
    expect(url).toContain("user=momen");
    expect(url).not.toMatch(/token|jwt|password|access/i);
  });

  it("falls back when configured URL uses an unsafe protocol", () => {
    const url = buildAccountFrameUrl("javascript:alert(1)", "momen");

    expect(url).toContain("https://account.spark-app.store/account");
    expect(url).toContain("view=management");
    expect(url).toContain("user=momen");
    expect(url).not.toMatch(/^javascript:/i);
  });
});
