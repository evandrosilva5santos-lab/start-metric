"use client";

import { motion } from "framer-motion";
import { Image as ImageIcon, Zap } from "lucide-react";

export default function CriativosPage() {
  return (
    <main className="p-4 lg:p-8 space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 font-black text-[10px] tracking-[0.2em] uppercase">
            <Zap size={12} fill="currentColor" />
            <span>Biblioteca de Ativos</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tight">
            Gestão de <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">Criativos</span>
          </h1>
          <p className="text-slate-400 font-medium max-w-2xl">
            Visualize e analise a performance individual de cada criativo em todas as suas campanhas.
          </p>
        </div>
      </header>

      <section className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 rounded-[2.5rem] blur-2xl opacity-50 group-hover:opacity-100 transition duration-1000" />
        
        <div className="relative glass glass-1 rounded-[2.5rem] border-white/5 p-12 lg:p-24 overflow-hidden">
          <div className="relative z-10 flex flex-col items-center text-center space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-cyan-400 shadow-[0_0_50px_rgba(6,182,212,0.15)]">
              <ImageIcon size={40} />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Próximo Marco: Análise de Criativos</h2>
              <p className="text-slate-400 max-w-md mx-auto">
                Esta funcionalidade está em desenvolvimento e permitirá rastrear o ROI direto de cada imagem e vídeo.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              <div className="px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                Em Breve
              </div>
              <div className="px-4 py-2 rounded-full bg-slate-800/50 border border-white/5 text-slate-400 text-xs font-bold uppercase tracking-wider">
                Q2 2024
              </div>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px]" />
        </div>
      </section>
    </main>
  );
}
