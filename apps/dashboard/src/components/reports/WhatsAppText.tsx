import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const TOKEN = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`)/g;

function renderInline(line: string, lineIndex: number): ReactNode[] {
  return line.split(TOKEN).map((piece, i) => {
    const key = `${lineIndex}-${i}`;
    if (piece.length < 3) return <Fragment key={key}>{piece}</Fragment>;
    const inner = piece.slice(1, -1);
    switch (piece[0]) {
      case "*":
        if (piece.endsWith("*")) return <strong key={key} className="font-semibold">{inner}</strong>;
        break;
      case "_":
        if (piece.endsWith("_")) return <em key={key}>{inner}</em>;
        break;
      case "~":
        if (piece.endsWith("~")) return <s key={key}>{inner}</s>;
        break;
      case "`":
        if (piece.endsWith("`")) return <code key={key} className="rounded-control bg-subtle px-1 font-mono text-[0.92em]">{inner}</code>;
        break;
    }
    return <Fragment key={key}>{piece}</Fragment>;
  });
}

export function WhatsAppText({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  return (
    <div className={cn("whitespace-pre-wrap break-words text-[13px] leading-[1.55] text-fg", className)}>
      {lines.map((line, index) => (
        <Fragment key={index}>
          {renderInline(line, index)}
          {index < lines.length - 1 && "\n"}
        </Fragment>
      ))}
    </div>
  );
}

export function MessageBubble({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  return (
    <div className="rounded-panel rounded-tr-control border border-border bg-surface px-3.5 py-3 shadow-card">
      {children}
      {meta && <div className="mt-2 flex justify-end text-[12px] text-fg-muted tabular-nums">{meta}</div>}
    </div>
  );
}
