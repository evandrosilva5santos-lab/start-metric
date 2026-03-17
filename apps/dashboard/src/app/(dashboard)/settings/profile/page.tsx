// app/settings/profile/page.tsx
// Página de perfil do usuário - Server Component wrapper

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import ProfileSettingsClient from "./ProfileSettingsClient";

export const metadata = {
  title: "Meu Perfil | Start Metric",
  description: "Gerencie suas informações pessoais e preferências.",
};

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  // Buscar perfil do usuário
  const { data: profile } = await supabase
    .from("profiles")
    .select(`
      id,
      name,
      phone,
      cpf,
      country,
      language,
      timezone,
      avatar_url,
      role,
      org_id,
      created_at,
      updated_at
    `)
    .eq("id", user.id)
    .single();

  const profileForClient = profile
    ? {
        id: profile.id,
        name: profile.name,
        email: user.email ?? "",
        phone: profile.phone,
        cpf: profile.cpf,
        country: profile.country,
        language: profile.language,
        timezone: profile.timezone,
        avatar_url: profile.avatar_url,
        role: profile.role,
        org_id: profile.org_id,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      }
    : null;

  return (
    <main className="flex-1 p-8 overflow-y-auto min-w-0">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <p className="text-[11px] text-cyan-400/70 uppercase tracking-[0.2em] font-semibold mb-1">
            Configurações
          </p>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none">
                Meu Perfil
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Gerencie suas informações pessoais
              </p>
            </div>
          </div>
        </div>

        <ProfileSettingsClient profile={profileForClient} />
      </div>
    </main>
  );
}
