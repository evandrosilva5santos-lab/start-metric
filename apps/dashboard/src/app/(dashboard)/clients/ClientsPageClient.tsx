"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Users, Plus } from "lucide-react";
import { ClientModal } from "@/components/clients/ClientModal";
import { ClientCard, type ClientCardData } from "@/components/clients/ClientCard";

type Client = ClientCardData;

export function ClientsPageClient() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const fetchClients = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/clients");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao buscar clientes");
      }

      setClients(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleCreate = () => {
    setEditingClient(null);
    setModalOpen(true);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setModalOpen(true);
  };

  const handleArchive = async (clientId: string) => {
    if (!confirm("Tem certeza que deseja arquivar este cliente?")) return;

    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Erro ao arquivar cliente");
      }

      await fetchClients();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao arquivar");
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingClient(null);
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditingClient(null);
    fetchClients();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">
              Clientes
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Gerencie seus clientes e contas de anúncio
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 bg-slate-900/50 border border-slate-800 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">
              Clientes
            </h1>
          </div>
          <button
            onClick={fetchClients}
            className="px-4 py-2 bg-cyan-400 text-slate-950 font-bold rounded-xl hover:bg-cyan-300 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
        <div className="bg-red-400/10 border border-red-400/20 rounded-2xl p-6">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-slate-600" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          Nenhum cliente ainda
        </h2>
        <p className="text-slate-400 text-center max-w-md mb-6">
          Crie seu primeiro cliente para organizar as contas de anúncio
        </p>
        <button
          onClick={handleCreate}
          className="px-6 py-3 bg-cyan-400 text-slate-950 font-bold rounded-xl hover:bg-cyan-300 transition-colors inline-flex items-center gap-2"
        >
          <Plus size={20} />
          Criar primeiro cliente
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">
              Clientes
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {clients.length} {clients.length === 1 ? "cliente" : "clientes"}
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-cyan-400 text-slate-950 font-bold rounded-xl hover:bg-cyan-300 transition-colors inline-flex items-center gap-2"
          >
            <Plus size={18} />
            Novo Cliente
          </button>
        </div>

        {/* Grid de Clientes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {clients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                getInitials={getInitials}
                onEdit={handleEdit}
                onArchive={handleArchive}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <ClientModal
            isOpen={modalOpen}
            onClose={handleModalClose}
            client={editingClient}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>
    </>
  );
}
