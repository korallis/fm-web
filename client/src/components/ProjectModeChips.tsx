import type { ProjectEntry } from "@fm-web/shared";
import { StateChip } from "./StateChip";

export function ProjectModeChips({ projects }: { projects: readonly ProjectEntry[] }) {
  if (projects.length === 0) {
    return <p className="font-mono text-sm text-factory-dim">No projects registered.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {projects.map((project) => (
        <div
          key={project.name}
          className="flex items-center gap-1 border border-factory-border bg-factory-panel px-2 py-1"
        >
          <span className="font-mono text-xs text-factory-text">{project.name}</span>
          <StateChip label={project.mode} tone="neutral" />
          {project.yolo && <StateChip label="yolo" tone="warn" />}
        </div>
      ))}
    </div>
  );
}
