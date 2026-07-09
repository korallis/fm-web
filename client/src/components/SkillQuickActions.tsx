import type { SkillEntry } from "@fm-web/shared";

export interface SkillQuickActionsProps {
  skills: SkillEntry[];
  skillInvocationPrefix: "/" | "$";
  onSelect: (skill: SkillEntry) => void;
}

/** Runtime-discovered, user-invocable skills as one-click composer prefills — never hardcoded. */
export function SkillQuickActions({ skills, skillInvocationPrefix, onSelect }: SkillQuickActionsProps) {
  const invocable = skills.filter((skill) => skill.userInvocable);
  if (invocable.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {invocable.map((skill) => (
        <button
          key={skill.id}
          type="button"
          title={skill.description}
          onClick={() => onSelect(skill)}
          className="border border-factory-border px-2 py-1 font-mono text-[11px] text-factory-dim hover:border-factory-accent hover:text-factory-accent"
        >
          {skillInvocationPrefix}
          {skill.id}
        </button>
      ))}
    </div>
  );
}
