/**
 * Extension domain normalization: input accepted here is later turned into
 * DNR rules, so anything that would break `updateDynamicRules` must be
 * rejected before it is stored.
 */

import { describe, expect, it } from "vitest";
import { normalizeDomain } from "../ipc";

describe("normalizeDomain (extension)", () => {
  it("normalizes browser site input without desktop service", () => {
    expect(normalizeDomain("HTTPS://www.YouTube.com/watch?v=1")).toBe("youtube.com");
    expect(normalizeDomain("example.com:8080")).toBe("example.com");
  });

  it("accepts supported wildcard input and rejects invalid values", () => {
    expect(normalizeDomain("*game")).toBe("*game");
    expect(normalizeDomain("not a site")).toBeNull();
    expect(normalizeDomain("*game*")).toBeNull();
  });
});
