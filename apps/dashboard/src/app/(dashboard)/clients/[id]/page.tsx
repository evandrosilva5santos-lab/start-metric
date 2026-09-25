import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Mail, MessageCircle, Phone, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatWhatsapp } from "@/lib/clients/schema";
import { WhatsAppConnectionPanel } from "@/components/whatsapp/WhatsAppConnectionPanel";
import { ShareLinkButton } from "@/components/clients/ShareLinkButton";
import { ClientAccountsPanel } from "@/components/clients/ClientAccountsPanel";
import { ClientEditButton } from "@/components/clients/ClientEditButton";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ buscar?: string }>;

export const metadata: Metadata = {
  title: "Cliente | Start Metric",
  description: "Dados do cliente, contas de anúncio e conexão de WhatsApp.",
};

export default async function ClientDetailsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ id }, { buscar }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth");

  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
  if (!profile?.org_id) redirect("/clients");

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, email, phone, whatsapp, niche, logo_url, notes, created_at")
    .eq("id", id)
    .eq("org_id", profile.org_id)
    .is("archived_at", null)
    .single();

  if (!client) notFound();

  const rows = [
    { icon: Tag, label: "Nicho", value: client.niche },
    { icon: MessageCircle, label: "WhatsApp", value: client.whatsapp ? formatWhatsapp(client.whatsapp) : null },
    { icon: Phone, label: "Telefone", value: client.phone },
    { icon: Mail, label: "E-mail", value: client.email },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/clients"
            className="inline-flex h-11 items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={16} />
            Clientes
          </Link>
          <h1 className="truncate font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl" title={client.name}>
            {client.name}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Cliente desde {new Date(client.created_at).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ClientEditButton client={client} />
          <ShareLinkButton clientId={client.id} clientName={client.name} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <aside className="space-y-6 xl:col-span-1">
          <section className="rounded-lg border border-border bg-card p-4 md:p-5">
            <h2 className="font-display text-base font-semibold text-foreground">Dados do cliente</h2>
            <dl className="mt-4 space-y-3">
              {rows.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon size={15} className="mt-0.5 shrink-0 text-text-muted" />
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{label}</dt>
                    <dd className="truncate text-sm tabular-nums text-text-primary">{value || "—"}</dd>
                  </div>
                </div>
              ))}
            </dl>
            {client.notes && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Informações</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{client.notes}</p>
              </div>
            )}
          </section>
        </aside>

        <div className="min-w-0 space-y-6 xl:col-span-2">
          <ClientAccountsPanel clientId={client.id} clientName={client.name} startOpen={buscar === "1"} />

          <section className="space-y-3">
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">WhatsApp</h2>
              <p className="text-sm text-text-secondary">
                Conecte a instância do cliente para enviar mensagens e relatórios.
              </p>
            </div>
            <WhatsAppConnectionPanel clientId={client.id} clientName={client.name} />
          </section>
        </div>
      </div>
    </div>
  );
}
