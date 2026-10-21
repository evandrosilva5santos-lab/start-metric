"use client"

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, QrCode, CheckCircle, WifiOff, Send, AlertCircle, Loader2, Smartphone, Shield, Zap, Users, Search
} from 'lucide-react'
import { ComingSoonBadge } from '@/components/ui/ComingSoonBadge'
import { Button } from '@/components/ui/button'

const FIELD_CLASS = 'h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-[16px] text-fg outline-none transition-colors placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-ring/30 md:text-[14px]'
const LABEL_CLASS = 'mb-1.5 block text-[12px] font-medium text-fg-muted'

interface WhatsAppConnectionPanelProps {
  clientId: string
  clientName: string
}

type ConnectionStatus = 'idle' | 'creating' | 'qr_pending' | 'connected' | 'error'

interface WhatsAppInstance {
  id: string
  client_id: string
  status: string
  phone_number?: string
  name?: string
  is_primary: boolean
  target_group_id?: string
  target_group_name?: string
}

interface WhatsAppGroup {
  id: string
  name: string
}

export function WhatsAppConnectionPanel({ clientId, clientName }: WhatsAppConnectionPanelProps) {
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null)
  const [instanceNameDisplay, setInstanceNameDisplay] = useState<string | null>(null)
  const [isPrimary, setIsPrimary] = useState<boolean>(true)
  const [countdown, setCountdown] = useState<number>(120)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [targetGroup, setTargetGroup] = useState<{ id: string, name: string } | null>(null)
  const [groupSearch, setGroupSearch] = useState('')
  const [groups, setGroups] = useState<WhatsAppGroup[]>([])
  const [isSearchingGroups, setIsSearchingGroups] = useState(false)
  const [formData, setFormData] = useState({ name: '', phone: '', isPrimary: true })

  // Busca inicial para verificar se o cliente já possui conexão ativa
  useEffect(() => {
    async function checkInitialStatus() {
      try {
        const res = await fetch('/api/whatsapp/instances')
        if (res.ok) {
          const { data } = await res.json()
          const clientInstance = data.find((i: WhatsAppInstance) => i.client_id === clientId)

          if (clientInstance) {
            setInstanceId(clientInstance.id)
            if (clientInstance.status === 'connected') {
              setStatus('connected')
              setPhoneNumber(clientInstance.phone_number)
              setInstanceNameDisplay(clientInstance.name)
              setIsPrimary(clientInstance.is_primary)
              if (clientInstance.target_group_id) {
                setTargetGroup({ id: clientInstance.target_group_id, name: clientInstance.target_group_name })
              }
            } else if (clientInstance.status === 'connecting' || clientInstance.status === 'pending') {
              setStatus('qr_pending')
            }
          }
        }
      } catch (e) {
        console.error('Falha ao verificar status inicial do WhatsApp:', e)
      }
    }
    checkInitialStatus()
  }, [clientId])

  // Polling para checar o status e timer de expiração do QR Code
  useEffect(() => {
    let interval: NodeJS.Timeout
    let timer: NodeJS.Timeout

    if (status === 'qr_pending' && instanceId) {
      // Polling de 3 em 3 segundos
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/whatsapp/instances/${instanceId}/status`)
          if (res.ok) {
            const { data } = await res.json()
            if (data.status === 'connected') {
              setStatus('connected')
              setPhoneNumber(data.phone_number)
              clearInterval(interval)
            } else if (data.qr_code && data.qr_code !== qrCode) {
              setQrCode(data.qr_code)
              setCountdown(120) // Reseta o timer ao receber um QR novo
            }
          }
        } catch (err) {
          console.error('Erro no polling:', err)
        }
      }, 3000)

      // Timer visual de expiração (120s)
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setStatus('error')
            setErrorMessage('O QR Code expirou. Tente conectar novamente.')
            clearInterval(interval)
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
      if (timer) clearInterval(timer)
    }
  }, [status, instanceId, qrCode])

  const handleConnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    if (!formData.name || !formData.phone) {
      setErrorMessage('Por favor, preencha o nome da instância e o telefone.')
      return
    }

    setStatus('creating')
    setErrorMessage(null)
    try {
      const res = await fetch('/api/whatsapp/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          name: formData.name,
          phone_number: formData.phone.replace(/\D/g, ''),
          is_primary: formData.isPrimary
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Falha ao iniciar a conexão')
      }

      const { data } = await res.json()
      setInstanceId(data.id)
      setQrCode(data.qr_code)
      setInstanceNameDisplay(data.name)
      setIsPrimary(data.is_primary)
      setCountdown(120)
      setStatus('qr_pending')
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Erro desconhecido')
    }
  }

  const handleDisconnect = async () => {
    if (!instanceId) return
    if (!confirm(`Tem certeza que deseja desconectar o WhatsApp de ${clientName}?`)) return

    setStatus('idle')
    try {
      await fetch(`/api/whatsapp/instances/${instanceId}`, { method: 'DELETE' })
      setInstanceId(null)
      setQrCode(null)
      setPhoneNumber(null)
    } catch (error) {
      console.error(error)
      alert('Ocorreu um erro ao desconectar o aparelho.')
    }
  }

  const handleTestMessage = async () => {
    if (!instanceId) return
    try {
      const res = await fetch(`/api/whatsapp/instances/${instanceId}/test`, { method: 'POST' })
      if (res.ok) {
        alert('✅ Mensagem de teste enviada com sucesso!')
      } else {
        alert('❌ Falha ao enviar mensagem de teste.')
      }
    } catch (error) {
      console.error(error)
      alert('❌ Ocorreu um erro de rede ao tentar enviar.')
    }
  }

  const handleSearchGroups = async () => {
    if (!instanceId) return
    setIsSearchingGroups(true)
    try {
      const res = await fetch(`/api/whatsapp/instances/${instanceId}/groups?q=${encodeURIComponent(groupSearch)}`)
      if (res.ok) {
        const { data } = await res.json()
        setGroups(data || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsSearchingGroups(false)
    }
  }

  const handleSelectGroup = async (group: WhatsAppGroup) => {
    if (!instanceId) return
    try {
      const res = await fetch(`/api/whatsapp/instances/${instanceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_group_id: group.id, target_group_name: group.name })
      })
      if (res.ok) setTargetGroup({ id: group.id, name: group.name })
    } catch (e) {
      console.error(e)
    }
  }

  const renderContent = () => {
    switch (status) {
      case 'idle':
        if (showForm) {
          return (
            <motion.form key="form" onSubmit={handleConnect} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col p-6 space-y-5">
              <div className="flex items-center gap-3 border-b border-border pb-4 mb-2">
                <Smartphone className="w-6 h-6 text-primary" />
                <h3 className="text-lg font-semibold text-fg">Nova instância do WhatsApp</h3>
              </div>

              {errorMessage && <div className="text-sm text-danger bg-danger-tint p-3 rounded-lg">{errorMessage}</div>}

              <div className="space-y-4">
                <div>
                  <label className={LABEL_CLASS}>Nome da instância</label>
                  <input type="text" placeholder="Ex: Atendimento Comercial" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={FIELD_CLASS} required />
                </div>

                <div>
                  <label className={LABEL_CLASS}>Número do WhatsApp</label>
                  <input type="tel" placeholder="Ex: 5511999999999" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={FIELD_CLASS} required />
                </div>

                <div>
                  <label className={LABEL_CLASS}>Tipo de conexão</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setFormData({ ...formData, isPrimary: true })} className={`flex flex-col items-center p-3 rounded-md border transition-colors ${formData.isPrimary ? 'bg-primary-tint border-primary/40 text-primary' : 'bg-surface border-border text-fg-muted hover:border-border-strong'}`}>
                      <Shield className="w-5 h-5 mb-1" />
                      <span className="text-sm font-semibold">Principal</span>
                      <span className="text-[10px] text-center mt-1 opacity-80">Oficial da campanha</span>
                    </button>
                    <button type="button" onClick={() => setFormData({ ...formData, isPrimary: false })} className={`flex flex-col items-center p-3 rounded-md border transition-colors ${!formData.isPrimary ? 'bg-client-tint border-client/40 text-client' : 'bg-surface border-border text-fg-muted hover:border-border-strong'}`}>
                      <Zap className="w-5 h-5 mb-1" />
                      <span className="text-sm font-semibold">Auxiliar</span>
                      <span className="text-[10px] text-center mt-1 opacity-80">Envios / contingência</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <Button type="button" variant="ghost" size="lg" onClick={() => setShowForm(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" size="lg" className="flex-[2]">
                  <QrCode className="w-4 h-4" /> Gerar QR Code
                </Button>
              </div>
            </motion.form>
          )
        }

        return (
          <motion.div key="idle" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col items-center text-center p-8 space-y-4">
            <MessageCircle className="w-16 h-16 text-fg-muted" />
            <div>
              <h3 className="text-xl font-semibold text-fg">Conectar WhatsApp</h3>
              <p className="text-fg-muted mt-1 max-w-sm text-sm">
                Conecte o WhatsApp do cliente para receber relatórios automáticos e alertas.
              </p>
            </div>
            <Button size="lg" onClick={() => setShowForm(true)} className="mt-2">
              <Smartphone className="w-5 h-5" /> Configurar aparelho
            </Button>
          </motion.div>
        )
      case 'creating':
        return (
          <motion.div key="creating" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col items-center justify-center p-16 space-y-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-fg font-medium">Iniciando ambiente seguro…</p>
          </motion.div>
        )
      case 'qr_pending':
        return (
          <motion.div key="qr_pending" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col items-center text-center p-8 space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-fg">Escaneie o QR Code</h3>
              <p className="text-fg-muted mt-1 max-w-sm text-sm">
                No celular: <b>WhatsApp</b> → Configurações → Dispositivos vinculados → Adicionar dispositivo
              </p>
            </div>
            <div className="relative flex justify-center items-center w-48 h-48 bg-subtle rounded-panel border border-border overflow-hidden">
              {qrCode ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- QR code é data URI base64, incompatível com next/image */}
                  <img src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code WhatsApp" className="w-full h-full object-cover" />
                </>
              ) : (
                <div className="flex flex-col items-center space-y-2"><Loader2 className="w-8 h-8 text-fg-muted animate-spin" /><span className="text-xs text-fg-muted">Gerando…</span></div>
              )}
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div className="flex items-center gap-2 text-primary"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm font-medium">Aguardando escaneamento…</span></div>
              <span className={`text-sm font-medium ${countdown < 30 ? 'text-warning' : 'text-fg-muted'}`}>Expira em {countdown}s</span>
            </div>
            <button onClick={() => setStatus('idle')} className="text-sm text-fg-muted hover:text-fg transition-colors">Cancelar conexão</button>
          </motion.div>
        )
      case 'connected':
        return (
          <motion.div key="connected" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col items-center text-center p-8 space-y-6">
            <div className="flex items-center justify-center w-16 h-16 bg-success-tint border border-success/20 rounded-full"><CheckCircle className="w-8 h-8 text-success" /></div>
            <div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <h3 className="text-xl font-semibold text-fg">{instanceNameDisplay || 'WhatsApp conectado'}</h3>
                {isPrimary ? (
                  <span className="rounded-full bg-primary-tint px-2 py-0.5 text-[12px] font-medium text-primary">Principal</span>
                ) : (
                  <span className="rounded-full bg-client-tint px-2 py-0.5 text-[12px] font-medium text-client">Auxiliar</span>
                )}
              </div>
              <p className="text-fg-muted text-sm mt-1">{phoneNumber ? `Número: +${phoneNumber}` : 'Dispositivo ativo e sincronizado'}</p>
            </div>

            {/* Seção de Busca e Seleção de Grupo */}
            <div className="w-full mt-4 bg-surface border border-border rounded-panel p-4 text-left">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-fg-muted" />
                <h4 className="text-sm font-semibold text-fg">Grupo de destino <span className="text-xs font-normal text-fg-muted">(é preciso ser admin)</span></h4>
              </div>
              {targetGroup ? (
                <div className="flex items-center justify-between p-3 bg-success-tint border border-success/20 rounded-lg">
                  <span className="text-sm font-medium text-success truncate">{targetGroup.name}</span>
                  <button onClick={() => setTargetGroup(null)} className="text-xs text-danger hover:underline">Remover</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
                      <input type="text" placeholder="Nome ou emoji do grupo…" value={groupSearch} onChange={(e) => setGroupSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchGroups()} className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-sm text-fg focus:border-primary/40 outline-none" />
                    </div>
                    <button onClick={handleSearchGroups} disabled={isSearchingGroups} className="px-4 py-2 bg-subtle text-primary font-medium text-sm rounded-lg hover:bg-border-strong transition-colors disabled:opacity-50 flex items-center gap-2">
                      {isSearchingGroups ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
                    </button>
                  </div>
                  {groups.length > 0 && (
                    <div className="max-h-32 overflow-y-auto space-y-1 bg-surface rounded-lg border border-border p-1">
                      {groups.map(g => (
                        <button key={g.id} onClick={() => handleSelectGroup(g)} className="w-full text-left p-2 hover:bg-surface rounded border border-transparent hover:border-border transition-colors text-sm text-fg truncate">
                          {g.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Seção de Configurações Avançadas / Pro */}
            <div className="w-full mt-4 bg-surface border border-border rounded-panel p-4 text-left space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-semibold text-fg">Blindagem e presença avançada</h4>
                </div>
                <ComingSoonBadge variant="pro" label="Pro" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-fg-muted pt-1">
                <div className="p-2.5 rounded-lg bg-surface border border-border flex items-center justify-between">
                  <span>Simulação &quot;digitando…&quot;</span>
                  <span className="text-success font-medium">Ativo</span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface border border-border flex items-center justify-between">
                  <span>Proxy dedicado anti-ban</span>
                  <ComingSoonBadge variant="roadmap" label="Em breve" />
                </div>
              </div>
            </div>

            <div className="flex w-full max-w-sm gap-3 pt-6 border-t border-border">
              <Button variant="secondary" onClick={handleTestMessage} className="flex-1"><Send className="w-4 h-4" /> Testar</Button>
              <Button variant="danger" onClick={handleDisconnect} className="flex-1"><WifiOff className="w-4 h-4" /> Desconectar</Button>
            </div>
          </motion.div>
        )
      case 'error':
        return (
          <motion.div key="error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col items-center text-center p-8 space-y-5">
            <div className="flex items-center justify-center w-16 h-16 bg-danger-tint border border-danger/20 rounded-full"><AlertCircle className="w-8 h-8 text-danger" /></div>
            <div><h3 className="text-xl font-semibold text-fg">Erro na conexão</h3><p className="text-fg-muted mt-1 max-w-sm text-sm">{errorMessage}</p></div>
            <Button size="lg" onClick={handleConnect} className="mt-2"><QrCode className="w-5 h-5" /> Tentar novamente</Button>
          </motion.div>
        )
    }
  }

  return (
    <div className="w-full overflow-hidden rounded-panel border border-border bg-surface shadow-card">
      <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
    </div>
  )
}