import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "../../src/http/origin.js";

describe("isSameOriginRequest", () => {
  it("allows requests with no Origin header", () => {
    expect(isSameOriginRequest(new Headers({ host: "127.0.0.1:3000" }))).toBe(true);
  });

  it("allows a present Origin matching the request Host", () => {
    expect(
      isSameOriginRequest(new Headers({ host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" })),
    ).toBe(true);
  });

  it("rejects a present Origin with a different host", () => {
    expect(isSameOriginRequest(new Headers({ host: "127.0.0.1:3000", origin: "http://evil.example" }))).toBe(
      false,
    );
  });

  it("allows a same-origin browser request forwarded by a dev proxy", () => {
    expect(
      isSameOriginRequest(
        new Headers({
          host: "127.0.0.1:4987",
          origin: "http://127.0.0.1:5197",
          "sec-fetch-site": "same-origin",
        }),
      ),
    ).toBe(true);
  });

  it("rejects a cross-site browser request with a different host", () => {
    expect(
      isSameOriginRequest(
        new Headers({
          host: "127.0.0.1:4987",
          origin: "http://evil.example",
          "sec-fetch-site": "cross-site",
        }),
      ),
    ).toBe(false);
  });

  it("rejects invalid Origin headers", () => {
    expect(isSameOriginRequest(new Headers({ host: "127.0.0.1:3000", origin: "null" }))).toBe(false);
  });
});
