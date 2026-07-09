import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { discoverHomes, resolveHomeId } from "../../src/adapter/homes.js";

const FIXTURE_HOME = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "fm-home");

describe("discoverHomes", () => {
  it("lists the booted primary plus every registered secondmate home", () => {
    const homes = discoverHomes(FIXTURE_HOME);

    expect(homes).toEqual([
      { id: "primary", path: resolve(FIXTURE_HOME), label: "primary" },
      { id: "demo-secondmate", path: "/tmp/fixture-home-secondmate", label: "demo-secondmate" },
    ]);
  });

  it("returns only the primary when secondmates.md is absent", () => {
    expect(discoverHomes("/tmp/no-such-home")).toEqual([
      { id: "primary", path: "/tmp/no-such-home", label: "primary" },
    ]);
  });
});

describe("resolveHomeId", () => {
  it("resolves undefined and 'primary' to the booted home", () => {
    expect(resolveHomeId(FIXTURE_HOME, undefined)).toBe(FIXTURE_HOME);
    expect(resolveHomeId(FIXTURE_HOME, "primary")).toBe(FIXTURE_HOME);
  });

  it("resolves a registered secondmate id to its home path", () => {
    expect(resolveHomeId(FIXTURE_HOME, "demo-secondmate")).toBe("/tmp/fixture-home-secondmate");
  });

  it("returns null for an unknown home id", () => {
    expect(resolveHomeId(FIXTURE_HOME, "no-such-home")).toBeNull();
  });
});
