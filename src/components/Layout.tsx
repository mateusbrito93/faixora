import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  Disc3,
  Settings,
  Menu,
  X,
  AudioWaveform,
  Sparkles,
  Radio,
  ChevronRight
} from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/new', label: 'Nova Análise', icon: PlusCircle, highlight: true },
    { to: '/analyses', label: 'Catálogo de Análises', icon: Disc3 },
    { to: '/settings', label: 'Configurações & API', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#F9FAFB] flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3.5 bg-[#111827]/90 backdrop-blur-md border-b border-white/[0.07] sticky top-0 z-40">
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#22D3EE] flex items-center justify-center shadow-lg shadow-[#6366F1]/25">
            <AudioWaveform className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold tracking-tight text-lg text-white">FAIXORA</span>
            <span className="block text-[10px] text-[#22D3EE] font-medium tracking-wider uppercase -mt-1">
              Audio Intelligence
            </span>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg bg-[#182233] text-[#F9FAFB] border border-white/10"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-72 bg-[#111827] border-r border-white/[0.07] flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Brand Logo */}
          <div className="p-6 border-b border-white/[0.06]">
            <div
              onClick={() => {
                navigate('/');
                setMobileOpen(false);
              }}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366F1] via-[#4F46E5] to-[#22D3EE] flex items-center justify-center shadow-lg shadow-[#6366F1]/25 group-hover:scale-105 transition-transform">
                <AudioWaveform className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold tracking-tight text-xl text-white">
                    FAIXORA
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#6366F1]/20 text-[#22D3EE] border border-[#6366F1]/30">
                    PRO
                  </span>
                </div>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                  Every song has an identity.
                </p>
              </div>
            </div>
          </div>

          {/* Primary CTA in Sidebar */}
          <div className="px-4 pt-5 pb-2">
            <button
              onClick={() => {
                navigate('/new');
                setMobileOpen(false);
              }}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:from-[#5558E6] hover:to-[#4338CA] text-white font-semibold text-sm shadow-lg shadow-[#6366F1]/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <PlusCircle className="w-4 h-4 text-[#22D3EE]" />
              <span>Nova Análise Musical</span>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]/70">
              Plataforma
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-[#182233] text-white border border-[#6366F1]/40 shadow-sm'
                        : 'text-[#9CA3AF] hover:text-white hover:bg-[#182233]/50 border border-transparent'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        <Icon
                          className={`w-4 h-4 ${
                            isActive ? 'text-[#22D3EE]' : 'text-[#9CA3AF]'
                          }`}
                        />
                        <span>{item.label}</span>
                      </div>
                      {isActive && <ChevronRight className="w-4 h-4 text-[#6366F1]" />}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer Engine Status Card */}
        <div className="p-4 m-4 rounded-2xl bg-[#182233]/90 border border-white/[0.07] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-[#F9FAFB]">
                Motor Acústico Ativo
              </span>
            </div>
            <Radio className="w-4 h-4 text-[#22D3EE]" />
          </div>
          <div className="text-[11px] text-[#9CA3AF] leading-relaxed">
            FFmpeg 9.0 Chromaprint + AcoustID & MusicBrainz conectados. Suporte a áudios de até 1h30.
          </div>
          <div className="pt-1 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-[#9CA3AF]">
            <span className="flex items-center gap-1 text-[#22D3EE]">
              <Sparkles className="w-3 h-3" /> Precisão Temporal
            </span>
            <span className="font-mono text-white">v1.0 Pro</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
};
