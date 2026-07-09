import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { discoverSkills } from "../../src/adapter/skills.js";

const FIXTURE = join(import.meta.dirname, "..", "fixtures", "skills-home");

describe("discoverSkills", () => {
  it("discovers user-invocable skills from both .claude/skills and .agents/skills", () => {
    const skills = discoverSkills(FIXTURE);
    const ids = skills.map((s) => s.id);
    expect(ids).toContain("afk");
    expect(ids).toContain("stow");
    expect(ids).toContain("agents-only");
  });

  it("prefers .claude/skills over .agents/skills for the same id", () => {
    const skills = discoverSkills(FIXTURE);
    const afk = skills.find((s) => s.id === "afk");
    expect(afk?.source).toBe(".claude");
    expect(afk?.description).toMatch(/should win/);
  });

  it("joins a folded (>-) block-scalar description into one line", () => {
    const skills = discoverSkills(FIXTURE);
    const stow = skills.find((s) => s.id === "stow");
    expect(stow?.description).toBe(
      "Sweep the current session for uncaptured durable knowledge and file it to disk before a context reset.",
    );
  });

  it("flags user-invocable: false skills, sourced correctly", () => {
    const skills = discoverSkills(FIXTURE);
    const agentsOnly = skills.find((s) => s.id === "agents-only");
    expect(agentsOnly?.userInvocable).toBe(false);
    expect(agentsOnly?.source).toBe(".agents");
  });

  it("skips a skill directory with no SKILL.md", () => {
    const skills = discoverSkills(FIXTURE);
    expect(skills.some((s) => s.id === "no-skill-file")).toBe(false);
  });

  it("skips malformed frontmatter missing a required field", () => {
    const skills = discoverSkills(FIXTURE);
    expect(skills.some((s) => s.id === "broken")).toBe(false);
  });

  it("returns an empty list for a home with no skill directories", () => {
    expect(discoverSkills("/tmp/fm-web-test-no-such-home")).toEqual([]);
  });
});
