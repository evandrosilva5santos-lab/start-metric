"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui";
import { clientFieldsSchema, formatWhatsapp } from "@/lib/clients/schema";

export type EditableClient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  niche?: string | null;
  logo_url: string | null;
  notes: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  client?: EditableClient | null;
  onSaved: (client: { id: string }) => void;
};

type FormState = {
  name: string;
  niche: string;
  whatsapp: string;
  phone: string;
  email: string;
  logo_url: string;
  notes: string;
};

const NICHE_SUGGESTIONS = [
  "Imobiliário",
  "Estética",
  "Saúde",
  "Odontologia",
  "Educação",
  "E-commerce",
  "Infoproduto",
  "Advocacia",
  "Restaurante",
  "Serviços locais",
];

function toForm(client?: EditableClient | null): FormState {
  return {
    name: client?.name ?? "",
    niche: client?.niche ?? "",
    whatsapp: client?.whatsapp ? formatWhatsapp(client.whatsapp) : "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    logo_url: client?.logo_url ?? "",
    notes: client?.notes ?? "",
  };
}

// Máscara leve enquanto digita: (11) 98765-4321.
function maskWhatsapp(raw: string): string {
  if (raw.trim().startsWith("+")) return raw;
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-input px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted hover:border-white-hairline-strong focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-danger";

export function ClientModal({ isOpen, onClose, client, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() => toForm(client));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | "form", string>>>({});
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const baseId = useId();
  const isEditing = Boolean(client);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = clientFieldsSchema.safeParse(form);
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormState;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(isEditing ? `/api/clients/${client!.id}` : "/api/clients", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { id: string };
        error?: string;
        details?: { path: (string | number)[]; message: string }[];
      };
      if (!res.ok || !json.data) {
        const next: typeof errors = { form: json.error ?? "Não deu para salvar o cliente." };
        for (const issue of json.details ?? []) {
          const key = issue.path[0] as keyof FormState;
          next[key] ??= issue.message;
        }
        setErrors(next);
        return;
      }
      onSaved(json.data);
    } catch {
      setErrors({ form: "Falha de conexão. Tente de novo." });
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof FormState) => ({
    id: `${baseId}-${key}`,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${baseId}-${key}-error` : undefined,
  });

  const errorText = (key: keyof FormState) =>
    errors[key] ? (
      <p id={`${baseId}-${key}-error`} className="mt-1 text-xs text-danger">
        {errors[key]}
      </p>
    ) : null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby={`${baseId}-title`}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-border bg-popover p-0 text-foreground backdrop:bg-black/70"
    >
      <form onSubmit={handleSubmit} noValidate className="flex max-h-[90vh] flex-col">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id={`${baseId}-title`} className="font-display text-lg font-semibold">
            {isEditing ? "Editar cliente" : "Novo cliente"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-2 hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-5">
          <div>
            <label htmlFor={`${baseId}-name`} className="mb-1.5 block text-sm font-medium text-text-primary">
              Nome do cliente <span className="text-danger">*</span>
            </label>
            <input
              {...field("name")}
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Ex.: Megainvest Porto Alegre"
              autoFocus
              className={inputClass}
            />
            {errorText("name")}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${baseId}-niche`} className="mb-1.5 block text-sm font-medium text-text-primary">
                Nicho
              </label>
              <input
                {...field("niche")}
                value={form.niche}
                onChange={(e) => update("niche", e.target.value)}
                list={`${baseId}-niches`}
                placeholder="Ex.: Imobiliário"
                className={inputClass}
              />
              <datalist id={`${baseId}-niches`}>
                {NICHE_SUGGESTIONS.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              {errorText("niche")}
            </div>

            <div>
              <label htmlFor={`${baseId}-whatsapp`} className="mb-1.5 block text-sm font-medium text-text-primary">
                WhatsApp
              </label>
              <input
                {...field("whatsapp")}
                value={form.whatsapp}
                onChange={(e) => update("whatsapp", maskWhatsapp(e.target.value))}
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 98765-4321"
                className={`${inputClass} tabular-nums`}
              />
              {errorText("whatsapp")}
            </div>

            <div>
              <label htmlFor={`${baseId}-phone`} className="mb-1.5 block text-sm font-medium text-text-primary">
                Telefone
              </label>
              <input
                {...field("phone")}
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                inputMode="tel"
                className={`${inputClass} tabular-nums`}
              />
              {errorText("phone")}
            </div>

            <div>
              <label htmlFor={`${baseId}-email`} className="mb-1.5 block text-sm font-medium text-text-primary">
                E-mail
              </label>
              <input
                {...field("email")}
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                autoComplete="email"
                className={inputClass}
              />
              {errorText("email")}
            </div>
          </div>

          <div>
            <label htmlFor={`${baseId}-logo_url`} className="mb-1.5 block text-sm font-medium text-text-primary">
              Logo (URL)
            </label>
            <input
              {...field("logo_url")}
              type="url"
              value={form.logo_url}
              onChange={(e) => update("logo_url", e.target.value)}
              placeholder="https://…"
              className={inputClass}
            />
            {errorText("logo_url")}
          </div>

          <div>
            <label htmlFor={`${baseId}-notes`} className="mb-1.5 block text-sm font-medium text-text-primary">
              Informações e observações
            </label>
            <textarea
              {...field("notes")}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={4}
              placeholder="Produto, público, oferta, combinados com o cliente…"
              className={`${inputClass} h-auto py-2.5`}
            />
            {errorText("notes")}
          </div>

          {!isEditing && (
            <p className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-text-secondary">
              Depois de salvar, abra o cliente e use <span className="font-semibold text-text-primary">Buscar contas de anúncio</span>{" "}
              para ligar as contas dele.
            </p>
          )}

          {errors.form && (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger-dim p-3 text-sm text-danger">
              {errors.form}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose} className="h-11">
            Cancelar
          </Button>
          <Button type="submit" loading={saving} className="h-11">
            {isEditing ? "Salvar" : "Criar cliente"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
