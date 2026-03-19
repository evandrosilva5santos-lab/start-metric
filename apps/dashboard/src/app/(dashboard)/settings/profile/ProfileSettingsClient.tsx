"use client";

// app/settings/profile/ProfileSettingsClient.tsx
// Componente client para edição de perfil do usuário

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Languages,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Camera,
  Info,
} from "lucide-react";

// Opções de países
const COUNTRIES = [
  { value: "BR", label: "Brasil" },
  { value: "PT", label: "Portugal" },
  { value: "AO", label: "Angola" },
  { value: "MZ", label: "Moçambique" },
  { value: "US", label: "Estados Unidos" },
  { value: "AR", label: "Argentina" },
  { value: "CL", label: "Chile" },
  { value: "CO", label: "Colômbia" },
  { value: "MX", label: "México" },
  { value: "ES", label: "Espanha" },
  { value: "FR", label: "França" },
  { value: "DE", label: "Alemanha" },
  { value: "IT", label: "Itália" },
  { value: "GB", label: "Reino Unido" },
  { value: "CA", label: "Canadá" },
  { value: "AU", label: "Austrália" },
  { value: "JP", label: "Japão" },
  { value: "CN", label: "China" },
  { value: "IN", label: "Índia" },
  { value: "OTHER", label: "Outro" },
];

// Opções de idiomas
const LANGUAGES = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English (US)" },
  { value: "es", label: "Español" },
];

// Opções de fuso horário
const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (UTC-3)" },
  { value: "America/Manaus", label: "Manaus (UTC-4)" },
  { value: "America/Belem", label: "Belém (UTC-3)" },
  { value: "America/Fortaleza", label: "Fortaleza (UTC-3)" },
  { value: "America/Recife", label: "Recife (UTC-3)" },
  { value: "America/Noronha", label: "Fernando de Noronha (UTC-2)" },
  { value: "America/Rio_Branco", label: "Rio Branco (UTC-5)" },
  { value: "America/Boa_Vista", label: "Boa Vista (UTC-4)" },
  { value: "America/New_York", label: "New York (UTC-5/-4)" },
  { value: "America/Los_Angeles", label: "Los Angeles (UTC-8/-7)" },
  { value: "Europe/London", label: "Londres (UTC+0/+1)" },
  { value: "Europe/Paris", label: "Paris (UTC+1/+2)" },
  { value: "Europe/Berlin", label: "Berlim (UTC+1/+2)" },
  { value: "Asia/Tokyo", label: "Tóquio (UTC+9)" },
  { value: "Asia/Shanghai", label: "Xangai (UTC+8)" },
  { value: "Asia/Dubai", label: "Dubai (UTC+4)" },
  { value: "UTC", label: "UTC" },
];

interface Profile {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  cpf: string | null;
  country: string | null;
  language: string | null;
  timezone: string | null;
  avatar_url: string | null;
  role: string;
  org_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface Props {
  profile: Profile | null;
}

interface FormError {
  field: string;
  message: string;
}

export default function ProfileSettingsClient({ profile }: Props) {
  const router = useRouter();

  // Form state
  const [formData, setFormData] = useState({
    name: profile?.name ?? "",
    phone: profile?.phone ?? "",
    cpf: profile?.cpf ?? "",
    country: profile?.country ?? "BR",
    language: profile?.language ?? "pt-BR",
    timezone: profile?.timezone ?? "America/Sao_Paulo",
  });

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [errors, setErrors] = useState<FormError[]>([]);

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Gerar iniciais para avatar placeholder
  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  // Máscara de CPF
  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  // Máscara de telefone
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  // Handle input change
  const handleInputChange = (field: string, value: string) => {
    let formattedValue = value;

    // Aplicar máscaras
    if (field === "cpf") {
      const numbers = value.replace(/\D/g, "");
      if (numbers.length > 11) return; // Limitar a 11 dígitos
      formattedValue = formatCPF(numbers);
    } else if (field === "phone") {
      const numbers = value.replace(/\D/g, "");
      if (numbers.length > 11) return; // Limitar a 11 dígitos
      formattedValue = formatPhone(numbers);
    }

    setFormData((prev) => ({ ...prev, [field]: formattedValue }));
    // Limpar erro do campo quando o usuário começa a digitar
    setErrors((prev) => prev.filter((e) => e.field !== field));
  };

  // Handle avatar upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setFeedback({ type: "error", message: "Avatar deve ter no máximo 2MB" });
      return;
    }

    // Validar tipo
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFeedback({ type: "error", message: "Formato inválido. Use JPG, PNG ou WebP" });
      return;
    }

    setIsUploadingAvatar(true);
    setFeedback(null);

    try {
      // TODO: Implementar upload para Supabase Storage bucket "avatars"
      // Por ora, vamos usar uma URL temporária
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
        setFeedback({ type: "success", message: "Avatar atualizado com sucesso" });
        setIsUploadingAvatar(false);
      };
      reader.onerror = () => {
        setFeedback({ type: "error", message: "Erro ao ler o arquivo" });
        setIsUploadingAvatar(false);
      };
      void reader.readAsDataURL(file);
    } catch (error) {
      console.error("[profile] Erro ao fazer upload:", error);
      setFeedback({ type: "error", message: "Erro ao fazer upload do avatar" });
      setIsUploadingAvatar(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);
    setErrors([]);

    // Validação básica
    const newErrors: FormError[] = [];
    if (!formData.name || formData.name.length < 2) {
      newErrors.push({ field: "name", message: "Nome deve ter pelo menos 2 caracteres" });
    }
    if (formData.cpf && !/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(formData.cpf)) {
      newErrors.push({ field: "cpf", message: "CPF inválido" });
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      setIsSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details) {
          setErrors(data.details);
        } else {
          throw new Error(data.error || "Erro ao salvar perfil");
        }
      } else {
        setFeedback({ type: "success", message: "Perfil atualizado com sucesso!" });
        // Refresh para atualizar dados do Server Component
        setTimeout(() => router.refresh(), 1000);
      }
    } catch (error) {
      console.error("[profile] Erro ao salvar:", error);
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Erro ao salvar perfil",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Feedback de sucesso/erro */}
      <AnimatePresence mode="wait">
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            className={`rounded-2xl p-4 text-sm flex items-center gap-3 shadow-2xl ${
              feedback.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : "bg-red-500/10 border border-red-500/20 text-red-400"
            }`}
          >
            {feedback.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span className="font-semibold">{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              className="ml-auto text-xs opacity-50 hover:opacity-100 transition-opacity uppercase tracking-tighter font-black"
            >
              Fechar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6"
      >
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Avatar</h2>
        <div className="flex items-center gap-6">
          {/* Avatar preview */}
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover border-2 border-slate-700"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-500/20 border-2 border-slate-700 flex items-center justify-center">
                <span className="text-2xl font-black text-cyan-400">
                  {getInitials(formData.name || "User")}
                </span>
              </div>
            )}
            {isUploadingAvatar && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-white" />
              </div>
            )}
          </div>

          {/* Upload button */}
          <div className="flex-1">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors cursor-pointer border border-slate-700">
              <Camera size={16} />
              {avatarUrl ? "Alterar foto" : "Enviar foto"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={isUploadingAvatar}
              />
            </label>
            <p className="text-xs text-slate-500 mt-2">JPG, PNG ou WebP. Máximo 2MB</p>
          </div>
        </div>
      </motion.div>

      {/* Dados Pessoais Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6"
      >
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Dados Pessoais</h2>
        <div className="space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
              Nome Completo *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="Seu nome completo"
              className={`w-full px-4 py-3 rounded-xl bg-slate-900 border text-slate-200 text-sm focus:outline-none focus:ring-1 transition-all duration-200 ${
                errors.some((e) => e.field === "name")
                  ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/30"
                  : "border-slate-700 focus:border-cyan-400/50 focus:ring-cyan-400/30"
              }`}
            />
            {errors.some((e) => e.field === "name") && (
              <p className="text-xs text-red-400 mt-1">{errors.find((e) => e.field === "name")?.message}</p>
            )}
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
              E-mail
            </label>
            <input
              type="email"
              value={profile?.email ?? ""}
              readOnly
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm opacity-50 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <Info size={12} />
              O e-mail não pode ser alterado aqui
            </p>
          </div>

          {/* CPF */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
              CPF
            </label>
            <input
              type="text"
              value={formData.cpf}
              onChange={(e) => handleInputChange("cpf", e.target.value)}
              placeholder="000.000.000-00"
              maxLength={14}
              className={`w-full px-4 py-3 rounded-xl bg-slate-900 border text-slate-200 text-sm focus:outline-none focus:ring-1 transition-all duration-200 ${
                errors.some((e) => e.field === "cpf")
                  ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/30"
                  : "border-slate-700 focus:border-cyan-400/50 focus:ring-cyan-400/30"
              }`}
            />
            {errors.some((e) => e.field === "cpf") && (
              <p className="text-xs text-red-400 mt-1">{errors.find((e) => e.field === "cpf")?.message}</p>
            )}
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
              Telefone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange("phone", e.target.value)}
              placeholder="(11) 99999-9999"
              maxLength={15}
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200"
            />
          </div>
        </div>
      </motion.div>

      {/* Localização Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6"
      >
        <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <Globe size={16} />
          Localização e Idioma
        </h2>
        <div className="space-y-4">
          {/* País */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
              País
            </label>
            <div className="relative">
              <select
                value={formData.country}
                onChange={(e) => handleInputChange("country", e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200 appearance-none cursor-pointer"
              >
                {COUNTRIES.map((country) => (
                  <option key={country.value} value={country.value}>
                    {country.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Idioma */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
              <Languages size={12} />
              Idioma
            </label>
            <div className="relative">
              <select
                value={formData.language}
                onChange={(e) => handleInputChange("language", e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200 appearance-none cursor-pointer"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Fuso Horário */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
              <Clock size={12} />
              Fuso Horário
            </label>
            <div className="relative">
              <select
                value={formData.timezone}
                onChange={(e) => handleInputChange("timezone", e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200 appearance-none cursor-pointer"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Botão Salvar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <button
          onClick={handleSave}
          disabled={isSaving || isUploadingAvatar}
          className="w-full py-3.5 rounded-xl bg-cyan-400 text-slate-950 font-bold text-sm hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <CheckCircle2 size={16} />
              Salvar Alterações
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
}
