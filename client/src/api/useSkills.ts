import { useQuery } from "@tanstack/react-query";
import type { SkillEntry } from "@fm-web/shared";

async function fetchSkills(): Promise<SkillEntry[]> {
  const res = await fetch("/api/skills");
  if (!res.ok) return [];
  return (await res.json()) as SkillEntry[];
}

export function useSkills() {
  return useQuery({ queryKey: ["skills"], queryFn: fetchSkills });
}
