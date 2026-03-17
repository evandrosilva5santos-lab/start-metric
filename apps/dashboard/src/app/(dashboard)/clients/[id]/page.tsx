import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Building2, Mail, Phone, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { WhatsAppConnectionPanel } from "@/components/whatsapp/WhatsAppConnectionPanel";

type Params = Promise<{ id: string }>;

export const metadata: Metadata = {
  title: "Cliente | Start Metric",
  description: "Detalhes do cliente e conexão de WhatsApp.",
};

export default async function ClientDetailsPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) {
    redirect("/clients");
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name, email, phone, whatsapp, logo_url, notes, created_at")
    .eq("id", id)
    .eq("org_id", profile.org_id)
    .is("archived_at", null)
    .single();

  if (clientError || !client) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href="/clients"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft size={16} />
            Voltar para clientes
          </Link>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight mt-2">
            {client.name}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure a conexão WhatsApp para automações e relatórios.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-400/20 to-indigo-600/20 border border-cyan-400/20 flex items-center justify-center mb-4">
              {client.logo_url ? (
                <img
                  src={client.logo_url}
                  alt={client.name}
                  className="w-full h-full rounded-xl object-cover"
                />
              ) : (
                <Building2 className="w-7 h-7 text-cyan-300" />
              )}
            </div>

            <h2 className="text-lg font-bold text-white">{client.name}</h2>
            <p className="text-slate-400 text-sm mt-1">
              Cliente criado em {new Date(client.created_at).toLocaleDateString("pt-BR")}
            </p>

            <div className="mt-5 space-y-3">
              {client.email && (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Mail size={14} className="text-slate-500" />
                  {client.email}
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Phone size={14} className="text-slate-500" />
                  {client.phone}
                </div>
              )}
              {client.whatsapp && (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <MessageCircle size={14} className="text-slate-500" />
                  {client.whatsapp}
                </div>
              )}
            </div>

            {client.notes && (
              <div className="mt-5 pt-5 border-t border-slate-800">
                <p className="text-sm font-medium text-slate-300 mb-1">Observações</p>
                <p className="text-sm text-slate-400 whitespace-pre-wrap">{client.notes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-2 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">WhatsApp</h2>
            <p className="text-sm text-slate-400">
              Conecte a instância do cliente para habilitar envio de mensagens e notificações.
            </p>
          </div>
          <WhatsAppConnectionPanel clientId={client.id} clientName={client.name} />
        </div>
      </div>
    </div>
  );
}

