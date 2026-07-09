import Markdown from "react-markdown";

function MarkdownSection({ title, content }: { title: string; content: string | null }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-mono text-xs uppercase tracking-wide text-factory-dim">{title}</h3>
      {content === null ? (
        <p className="font-mono text-xs text-factory-dim">No {title.toLowerCase()} yet.</p>
      ) : (
        <div className="markdown-body border border-factory-border bg-factory-panel p-3 font-sans text-sm">
          <Markdown>{content}</Markdown>
        </div>
      )}
    </div>
  );
}

export function BriefReport({ brief, report }: { brief: string | null; report: string | null }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <MarkdownSection title="Brief" content={brief} />
      <MarkdownSection title="Report" content={report} />
    </div>
  );
}
