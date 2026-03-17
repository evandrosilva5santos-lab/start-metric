"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageCircle,
  QrCode,
  RefreshCw,
  Send,
  WifiOff,
} from "lucide-react";

type ConnectionStatus =
  | "idle"
  | "creating"
  | "qr_pending"
  | "connected"
  | "disconnected"
  | "error";

type InstanceData = {
  id: string;
  client_id: string | null;
  instance_name: string;
  phone_number: string | null;
  status: string;
  qr_code: string | null;
  last_connected_at: string | null;
  updated_at: string;
};

type StatusPayload = {
  status: string;
  qr_code: string | null;
  phone_number: string | null;
  last_connected_at: string | null;
  updated_at: string;
};

type WhatsAppConnectionPanelProps = {
  clientId: string;
  clientName: string;
};

const POLL_INTERVAL_MS = 3000;
const CONNECTION_TIMEOUT_SECONDS = 120;

function mapBackendStatus(status: string | null | undefined): ConnectionStatus {
  if (status === "connected") return "connected";
  if (status === "connecting" || status === "pending") return "qr_pending";
  if (status === "disconnected") return "disconnected";
  if (status === "error") return "error";
  return "idle";
}

function formatConnectionDate(value: string | null): string {
  if (!value) return "Conectado recentemente";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Conectado recentemente";
  return parsed.toLocaleString("pt-BR");
}

export function WhatsAppConnectionPanel({
  clientId,
  clientName,
}: WhatsAppConnectionPanelProps) {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [instance, setInstance] = useState<InstanceData | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(CONNECTION_TIMEOUT_SECONDS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState(false);

  const loadCurrentInstance = useCallback(async () => {
    try {
      const response = await fetch(`/api/whatsapp/instances?client_id=${clientId}`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Erro ao carregar instância do WhatsApp");
      }

      const data = Array.isArray(result.data) ? (result.data as InstanceData[]) : [];
      if (data.length === 0) {
        setInstance(null);
        setQrCode(null);
        setStatus("idle");
        return;
      }

      const connected = data.find((item) => item.status === "connected");
      const selected = connected ?? data[0];

      setInstance(selected);
      setQrCode(selected.qr_code);
      const mapped = mapBackendStatus(selected.status);
      setStatus(mapped);

      if (mapped === "qr_pending") {
        setCountdown(CONNECTION_TIMEOUT_SECONDS);
      }
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Erro ao carregar WhatsApp");
    }
  }, [clientId]);

  useEffect(() => {
    void loadCurrentInstance();
  }, [loadCurrentInstance]);

  useEffect(() => {
    if (status !== "qr_pending" || !instance?.id) return;

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/whatsapp/instances/${instance.id}/status`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Erro ao consultar status da conexão");
        }

        const payload = result.data as StatusPayload;
        setInstance((prev) =>
          prev
            ? {
                ...prev,
                status: payload.status,
                qr_code: payload.qr_code,
                phone_number: payload.phone_number ?? prev.phone_number,
                last_connected_at: payload.last_connected_at ?? prev.last_connected_at,
                updated_at: payload.updated_at,
              }
            : prev,
        );

        if (payload.qr_code) {
          setQrCode(payload.qr_code);
        }

        const mapped = mapBackendStatus(payload.status);
        if (mapped === "connected") {
          setStatus("connected");
          setErrorMessage(null);
          return;
        }

        if (mapped === "error") {
          setStatus("error");
          setErrorMessage("Falha ao conectar instância WhatsApp.");
        }
      } catch (error) {
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Erro de polling");
      }
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [instance?.id, status]);

  useEffect(() => {
    if (status !== "qr_pending") return;

    const timer = window.setInterval(() => {
      setCountdown((previous) => {
        if (previous <= 1) {
          setStatus("error");
          setErrorMessage("Tempo limite para leitura do QR expirou.");
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [status]);

  const handleConnect = useCallback(async () => {
    try {
      setStatus("creating");
      setErrorMessage(null);

      const response = await fetch("/api/whatsapp/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível criar a instância");
      }

      const created = result.data as InstanceData;
      setInstance(created);
      setQrCode(created.qr_code);
      setCountdown(CONNECTION_TIMEOUT_SECONDS);
      setStatus("qr_pending");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Erro ao iniciar conexão");
    }
  }, [clientId]);

  const handleDisconnect = useCallback(async () => {
    if (!instance?.id) {
      setStatus("idle");
      return;
    }

    const confirmed = window.confirm("Deseja desconectar esta instância do WhatsApp?");
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/whatsapp/instances/${instance.id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Erro ao desconectar instância");
      }

      setInstance(null);
      setQrCode(null);
      setErrorMessage(null);
      setCountdown(CONNECTION_TIMEOUT_SECONDS);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Erro ao desconectar");
    }
  }, [instance?.id]);

  const handleCancelConnecting = useCallback(async () => {
    if (instance?.id) {
      await fetch(`/api/whatsapp/instances/${instance.id}`, { method: "DELETE" }).catch(() => undefined);
    }

    setInstance(null);
    setQrCode(null);
    setStatus("idle");
    setCountdown(CONNECTION_TIMEOUT_SECONDS);
  }, [instance?.id]);

  const handleSendTest = useCallback(async () => {
    if (!instance?.id) return;

    const input = window.prompt(
      "Digite o número para teste (com DDI, somente números):",
      instance.phone_number ?? "",
    );

    if (input === null) return;
    const phone = input.trim();

    setSendingTest(true);
    try {
      const response = await fetch(`/api/whatsapp/instances/${instance.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(phone ? { phone } : {}),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Falha no envio da mensagem de teste");
      }

      if (phone) {
        setInstance((prev) => (prev ? { ...prev, phone_number: phone } : prev));
      }

      window.alert("Mensagem de teste enviada com sucesso.");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Falha ao enviar teste");
    } finally {
      setSendingTest(false);
    }
  }, [instance?.id, instance?.phone_number]);

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
      <AnimatePresence mode="wait">
        {(status === "idle" || status === "disconnected") && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Conectar WhatsApp</h3>
            <p className="text-slate-400 mb-6">
              Conecte o WhatsApp de <span className="text-slate-200">{clientName}</span> para receber relatórios automáticos.
            </p>

            <button
              onClick={handleConnect}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold bg-emerald-400 text-slate-950 hover:bg-emerald-300 transition-colors"
            >
              <QrCode size={18} />
              {status === "disconnected" ? "Reconectar WhatsApp" : "Conectar agora"}
            </button>
          </motion.div>
        )}

        {status === "creating" && (
          <motion.div
            key="creating"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center py-8"
          >
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-1">Criando instância</h3>
            <p className="text-slate-400">Preparando conexão do WhatsApp...</p>
          </motion.div>
        )}

        {status === "qr_pending" && (
          <motion.div
            key="qr_pending"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-5"
          >
            <div className="text-center">
              <h3 className="text-xl font-bold text-white mb-1">Escaneie o QR Code</h3>
              <p className="text-slate-400 text-sm max-w-xl mx-auto">
                No celular: WhatsApp → Configurações → Dispositivos vinculados → Adicionar dispositivo.
              </p>
            </div>

            <div className="flex justify-center">
              {qrCode ? (
                <img
                  src={qrCode}
                  alt="QR Code do WhatsApp"
                  className="w-48 h-48 rounded-xl border border-slate-700 bg-white p-2"
                />
              ) : (
                <div className="w-48 h-48 rounded-xl border border-slate-700 bg-slate-800/60 animate-pulse" />
              )}
            </div>

            <div className="text-center">
              <p className={`text-sm font-medium ${countdown <= 30 ? "text-amber-300" : "text-slate-400"}`}>
                QR expira em {countdown}s
              </p>
              <p className="mt-2 text-sm text-slate-400">Aguardando conexão...</p>
            </div>

            <div className="flex items-center justify-center">
              <button
                onClick={handleCancelConnecting}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        )}

        {status === "connected" && instance && (
          <motion.div
            key="connected"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-5"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-300">
                <CheckCircle2 size={14} />
                WhatsApp conectado
              </span>
              <span className="text-slate-300 text-sm">
                {instance.phone_number || "Conectado"}
              </span>
            </div>

            <div className="text-sm text-slate-400">
              Conectado desde {formatConnectionDate(instance.last_connected_at)}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSendTest}
                disabled={sendingTest}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-60"
              >
                {sendingTest ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Enviar mensagem de teste
              </button>

              <button
                onClick={handleDisconnect}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-colors"
              >
                <WifiOff size={16} />
                Desconectar
              </button>
            </div>
          </motion.div>
        )}

        {status === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center space-y-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7 text-red-300" />
            </div>
            <div>
              <p className="text-red-300 font-semibold mb-1">Erro na conexão</p>
              <p className="text-slate-400 text-sm">
                {errorMessage ?? "Não foi possível conectar a instância do WhatsApp."}
              </p>
            </div>
            <button
              onClick={handleConnect}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <RefreshCw size={16} />
              Tentar novamente
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

