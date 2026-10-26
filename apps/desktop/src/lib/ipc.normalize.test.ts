/**
 * Domain normalization for the desktop blocklist/whitelist flows: whatever the
 * user pastes (full URL, www host, path, query string, hash, port) is reduced to
 * the bare domain the service stores, and unusable input is rejected.
 */

import { describe, expect, it } from "vitest";
import { normalizeDomain } from "./ipc";

describe("normalizeDomain", () => {
  it("reduces a pasted URL to the bare domain", () => {
    expect(normalizeDomain("https://news.example.com/world/story?a=1#top")).toBe(
      "news.example.com"
    );
    expect(normalizeDomain("http://news.example.com")).toBe("news.example.com");
    expect(normalizeDomain("news.example.com/world/story")).toBe("news.example.com");
    expect(normalizeDomain("news.example.com?q=1")).toBe("news.example.com");
    expect(normalizeDomain("news.example.com#top")).toBe("news.example.com");
  });

  it("drops the www prefix and normalizes case and surrounding space", () => {
    expect(normalizeDomain("https://www.example.com/path")).toBe("example.com");
    expect(normalizeDomain("WWW.Example.COM")).toBe("example.com");
    expect(normalizeDomain("  Example.com  ")).toBe("example.com");
  });

  it("drops a port and keeps the host", () => {
    expect(normalizeDomain("example.com:8080")).toBe("example.com");
    expect(normalizeDomain("http://example.com:443/")).toBe("example.com");
  });

  it("keeps subdomains that are not www", () => {
    expect(normalizeDomain("mail.example.com")).toBe("mail.example.com");
    expect(normalizeDomain("https://deep.sub.example.co.uk/a")).toBe("deep.sub.example.co.uk");
  });

  it("rejects input that is not a usable domain", () => {
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain("   ")).toBeNull();
    expect(normalizeDomain("localhost")).toBeNull();
    expect(normalizeDomain("two words.com")).toBeNull();
    expect(normalizeDomain("javascript:alert(1)")).toBeNull();
  });
});
