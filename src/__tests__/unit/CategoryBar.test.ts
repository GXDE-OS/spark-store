import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const categoryBarSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../components/CategoryBar.vue",
  ),
  "utf-8",
);

describe("CategoryBar", () => {
  it("uses the requested blue for the selected category pill", () => {
    expect(categoryBarSource.toLowerCase()).toContain("background: #2b7fff;");
  });
});
