"use client";

import React from "react";
import Link from "next/link";
import { Monitor, Sliders, ClipboardList, Sparkles } from "lucide-react";

export default function HomeLauncher() {
  return (
    <div className="min-h-screen bg-[#070809] text-white flex flex-col justify-between relative overflow-hidden selection:bg-neutral-800">
      
      {/* Premium background design */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[radial-gradient(circle_at_center,rgba(29,78,216,0.15)_0,transparent_60%)] pointer-events-none filter blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.1)_0,transparent_60%)] pointer-events-none filter blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_center,rgba(255,255,255,0.015),transparent)] pointer-events-none" />

      {/* Header */}
      <header className="w-full flex justify-between items-center py-6 px-8 md:px-16 border-b border-white/[0.04] backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
          <span className="text-[13px] font-mono tracking-[0.2em] font-semibold text-neutral-300 uppercase">
            Optiq Studio Enterprise
          </span>
        </div>
        <span className="text-xs font-mono text-neutral-500">
          v2.1.0 // ACTIVE
        </span>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center py-16 px-6 relative z-10 max-w-6xl mx-auto w-full">
        
        {/* Title and Intro */}
        <div className="text-center mb-16 max-w-3xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-[10px] font-semibold text-purple-300 tracking-wider uppercase mb-5 font-mono">
            UNICEF Dinner Gala Integration
          </span>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.1] mb-6 font-sans">
            AI Virtual Teacher <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-500">Rohey</span>
          </h1>
          <p className="text-neutral-400 text-sm md:text-base leading-relaxed max-w-2xl mx-auto">
            Experience our real-time interactive avatar presentation system. Designed to orchestrate and synchronize pre-recorded animated scenes with a live operator control dashboard.
          </p>
        </div>

        {/* 3-Column Choice Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full items-stretch">
          
          {/* Card 1: Stage Screen View */}
          <Link 
            href="/stage"
            className="group flex flex-col justify-between p-8 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-blue-500/50 hover:bg-white/[0.04] transition-all duration-300 relative overflow-hidden"
          >
            {/* Hover card glow aura */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.05),transparent_50%)] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-8 text-blue-400 group-hover:scale-110 transition-transform">
                <Monitor className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-semibold mb-3 tracking-tight">Stage Screen</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                The grand theater view meant for the main dinner projector. Listens to Firestore state events in real time to trigger seamless, cinematic full-screen videos and dynamic subtitles.
              </p>
            </div>

            <div className="border-t border-white/[0.04] pt-5 mt-10 flex items-center justify-between text-xs font-mono text-neutral-500">
              <span className="group-hover:text-blue-400 transition-colors">LAUNCH VIEWER →</span>
              <span>1080P / 4K READY</span>
            </div>
          </Link>

          {/* Card 2: Operator Panel */}
          <Link 
            href="/operator"
            className="group flex flex-col justify-between p-8 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-purple-500/50 hover:bg-white/[0.04] transition-all duration-300 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.05),transparent_50%)] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-8 text-purple-400 group-hover:scale-110 transition-transform">
                <Sliders className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-semibold mb-3 tracking-tight">Operator Panel</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                A fully responsive, tactile dashboard optimized for mobile or tablet operators. Override the presentation flow, trigger custom gestures, send real-time subtitles, and drive live conversations.
              </p>
            </div>

            <div className="border-t border-white/[0.04] pt-5 mt-10 flex items-center justify-between text-xs font-mono text-neutral-500">
              <span className="group-hover:text-purple-400 transition-colors">ENTER CONSOLE →</span>
              <span>MOBILE FRIENDLY</span>
            </div>
          </Link>

          {/* Card 3: Project Plan */}
          <Link 
            href="/plan"
            className="group flex flex-col justify-between p-8 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-pink-500/50 hover:bg-white/[0.04] transition-all duration-300 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(236,72,153,0.05),transparent_50%)] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div>
              <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mb-8 text-pink-400 group-hover:scale-110 transition-transform">
                <ClipboardList className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-semibold mb-3 tracking-tight">Project Plan</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Review the modular script outline, browse the synthesized voice library, inspect the cost-benefit budget analysis ledger, and analyze our state-telemetry architecture blueprint.
              </p>
            </div>

            <div className="border-t border-white/[0.04] pt-5 mt-10 flex items-center justify-between text-xs font-mono text-neutral-500">
              <span className="group-hover:text-pink-400 transition-colors">VIEW PLAN & COSTS →</span>
              <span>LEDGER INSIGHTS</span>
            </div>
          </Link>

        </div>

      </main>

      {/* Footer */}
      <footer className="w-full bg-black/40 border-t border-white/[0.04] py-8 text-center relative z-10 px-8">
        <p className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase">
          Supported by Kids Edutainment Labs & UNICEF The Gambia © 2026
        </p>
      </footer>

    </div>
  );
}
