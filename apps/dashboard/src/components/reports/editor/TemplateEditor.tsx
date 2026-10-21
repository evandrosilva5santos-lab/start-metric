"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Bold, Braces, Code, Italic, Strikethrough, X } from "lucide-react";
import { VARIABLE_BY_SLUG } from "@/lib/reports/engine/catalog";
import { REPORT_PRESETS } from "@/lib/reports/engine/presets";
import { cn } from "@/lib/utils";
import { MAX_BODY, slugsIn } from "./draft";
import { VariablePicker } from "./VariablePicker";

const META_PRESETS = REPORT_PRESETS.filter((p) => p.channel === "meta");

const FORMATS = [
  { mark: "*", label: "Negrito", icon: Bold },
  { mark: "_", label: "Itálico", icon: Italic },
  { mark: "~", label: "Tachado", icon: Strikethrough },
  { mark: "`", label: "Código", icon: Code },
] as const;

interface TemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

interface PickerState {
  slashAt: number | null;
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function TemplateEditor({ value, onChange, label }: TemplateEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const caretRef = useRef({ start: value.length, end: value.length });
  const slashRef = useRef<number | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [undoBody, setUndoBody] = useState<string | null>(null);
  const textareaId = useId();
  const hintId = useId();
  const slugs = slugsIn(value);
  const isPickerOpen = picker !== null;

  useEffect(() => {
    if (!isPickerOpen) return;
    const handlePointer = (event: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setPicker(null);
    };
    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
  }, [isPickerOpen]);

  const rememberCaret = () => {
    const el = textareaRef.current;
    if (el) caretRef.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  const placeCaret = (position: number, end = position) => {
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(position, end);
      caretRef.current = { start: position, end };
    });
  };

  const insertVariable = (slug: string) => {
    const token = `{{${slug}}}`;
    const slashAt = picker?.slashAt ?? null;
    const hasSlash = slashAt !== null && value[slashAt] === "/";
    const start = hasSlash ? slashAt : caretRef.current.start;
    const end = hasSlash ? slashAt + 1 : caretRef.current.end;
    onChange(value.slice(0, start) + token + value.slice(end));
    setPicker(null);
    placeCaret(start + token.length);
  };

  const applyFormat = (mark: string) => {
    rememberCaret();
    const { start, end } = caretRef.current;
    const selected = value.slice(start, end) || "texto";
    onChange(value.slice(0, start) + mark + selected + mark + value.slice(end));
    placeCaret(start + mark.length, start + mark.length + selected.length);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
    const el = event.currentTarget;
    const before = value[el.selectionStart - 1];
    slashRef.current = before === undefined || /\s/.test(before) ? el.selectionStart : null;
  };

  const applyPreset = (presetId: string) => {
    const preset = META_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setUndoBody(value.trim() ? value : null);
    onChange(preset.content);
  };

  const removeSlug = (slug: string) => {
    onChange(value.replace(new RegExp(`\\{\\{\\s*${escapeRegExp(slug)}\\s*\\}\\}`, "g"), ""));
  };

  const closePicker = () => {
    setPicker(null);
    placeCaret(caretRef.current.start);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <label htmlFor={textareaId} className="text-[13px] font-medium text-fg">{label}</label>
        <label className="flex items-center gap-2 text-[13px] text-fg-muted">
          <span>Modelo</span>
          <select
            value=""
            onChange={(e) => applyPreset(e.target.value)}
            className="h-11 max-w-[220px] rounded-control border border-border-strong bg-surface px-2 text-[13px] text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-8"
          >
            <option value="">Aplicar modelo Meta…</option>
            {META_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.name.replace(" — Meta Ads", "")}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="relative rounded-panel border border-border-strong bg-surface focus-within:ring-2 focus-within:ring-ring">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1" role="toolbar" aria-label="Formatação">
          {FORMATS.map(({ mark, label: formatLabel, icon: Icon }) => (
            <button
              key={mark}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormat(mark)}
              aria-label={`${formatLabel} (${mark}texto${mark})`}
              title={`${formatLabel}: ${mark}texto${mark}`}
              className="flex size-11 items-center justify-center rounded-md text-fg-muted hover:bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:size-8"
            >
              <Icon className="size-4" aria-hidden="true" />
            </button>
          ))}
          <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              rememberCaret();
              setPicker({ slashAt: null });
            }}
            className="inline-flex h-11 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-primary hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-8"
          >
            <Braces className="size-4" aria-hidden="true" />
            Inserir variável
          </button>
        </div>

        <textarea
          ref={textareaRef}
          id={textareaId}
          value={value}
          maxLength={MAX_BODY}
          aria-describedby={hintId}
          onChange={(e) => {
            const next = e.target.value;
            const slashAt = slashRef.current;
            slashRef.current = null;
            onChange(next);
            caretRef.current = { start: e.target.selectionStart, end: e.target.selectionEnd };
            if (slashAt !== null && next[slashAt] === "/") setPicker({ slashAt });
          }}
          onKeyDown={handleKeyDown}
          onSelect={rememberCaret}
          onBlur={rememberCaret}
          rows={9}
          placeholder="Escreva a mensagem. Digite / para inserir uma variável."
          className="block min-h-[180px] w-full resize-y bg-transparent px-3 py-2.5 font-mono text-[13px] leading-[1.6] text-fg focus:outline-none"
        />

        {picker && (
          <div ref={pickerRef} className="absolute inset-x-2 top-[52px] z-20 lg:top-11">
            <VariablePicker onSelect={insertVariable} onClose={closePicker} />
          </div>
        )}
      </div>

      <div id={hintId} className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-fg-muted">
        <span>
          Digite <kbd className="rounded-control border border-border bg-subtle px-1 font-mono">/</kbd> para variáveis ·{" "}
          <span className="tabular-nums">{value.length.toLocaleString("pt-BR")}</span> caracteres
        </span>
        {undoBody !== null && (
          <button
            type="button"
            onClick={() => {
              onChange(undoBody);
              setUndoBody(null);
            }}
            className="min-h-11 font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-0"
          >
            Modelo aplicado · desfazer
          </button>
        )}
      </div>

      {slugs.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Variáveis usadas nesta parte">
          {slugs.map((slug) => {
            const def = VARIABLE_BY_SLUG.get(slug);
            return (
              <li
                key={slug}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-full pl-2.5 pr-1 text-[12px]",
                  def ? "bg-primary-tint text-primary" : "bg-warning-tint text-warning",
                )}
              >
                <span>{def ? def.label : `Desconhecida: ${slug}`}</span>
                <button
                  type="button"
                  onClick={() => removeSlug(slug)}
                  aria-label={`Remover ${def?.label ?? slug} do texto`}
                  className="flex size-5 items-center justify-center rounded-full hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
