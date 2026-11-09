import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  Disc3,
  Music2,
  Clock,
  Sparkles,
  UploadCloud,
  Youtube,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  BarChart3,
  Activity,
  FileAudio,
  Play
} from 'lucide-react';
import { DashboardData } from '../types';
import { formatDurationHuman, formatTime } from '../utils/format';
import { useToast } from '../components/ToastContext';

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingDemo, setCreatingDemo] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleQuickDemo = async () => {
    try {
      setCreatingDemo(true);
      toast(
        'Gerando CD de Demonstração',
        'Criando áudio multi-faixas com FFmpeg e iniciando reconhecimento em tempo real...',
        'info'
      );
      const res = await fetch('/api/analyses/demo-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'CD Promocional Forró & Piseiro 2026 (Ao Vivo)',
          genre: 'Forró',
          language: 'Português',
          sensitivity: 'high',
          duration_seconds: 2160 // 36 min mix
        })
      });
      if (!res.ok) throw new Error('Falha ao iniciar demonstração');
      const { analysis } = await res.json();
      navigate(`/analyses/${analysis.id}/processing`);
    } catch (err: any) {
      toast('Erro ao iniciar demonstração', err.message, 'error');
    } finally {
      setCreatingDemo(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 bg-[#111827] rounded-2xl border border-white/5" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-[#182233] rounded-2xl border border-white/5" />
          ))}
        </div>
        <div className="h-64 bg-[#182233] rounded-2xl border border-white/5" />
      </div>
    );
  }

  const stats = data?.stats || {
    totalAnalyses: 0,
    totalIdentifiedTracks: 0,
    totalDurationSeconds: 0,
    recognitionRate: 0,
    avgConfidence: 0
  };

  const maxTracksVal = Math.max(
    ...(data?.chartData.map((d) => d.tracks) || [1]),
    1
  );
  const maxAnalysesVal = Math.max(
    ...(data?.chartData.map((d) => d.analyses) || [1]),
    1
  );

  return (
    <div className="space-y-8">
      {/* Header Greeting & Primary Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6366F1]/15 border border-[#6366F1]/30 text-[#22D3EE] text-xs font-medium mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Inteligência Musical de Alta Precisão</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F9FAFB] tracking-tight">
            {getGreeting()}, Produtor Musical
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-1">
            Identifique cada música, artista e segundo exato dentro de CDs completos, sets e coletâneas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleQuickDemo}
            disabled={creatingDemo}
            className="px-4 py-2.5 rounded-xl bg-[#182233] hover:bg-[#1E293B] text-[#F9FAFB] border border-white/10 text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {creatingDemo ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#22D3EE]" />
            ) : (
              <Play className="w-4 h-4 text-[#22D3EE]" />
            )}
            <span>Testar Processamento Ao Vivo</span>
          </button>

          <button
            onClick={() => navigate('/new')}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:from-[#5558E6] hover:to-[#4338CA] text-white font-semibold text-sm shadow-lg shadow-[#6366F1]/25 flex items-center gap-2 transition-all"
          >
            <PlusCircle className="w-4 h-4 text-[#22D3EE]" />
            <span>Nova análise</span>
          </button>
        </div>
      </div>

      {/* Hero Invitation Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#182233] via-[#151E31] to-[#111827] border border-[#6366F1]/30 p-6 sm:p-8 shadow-2xl">
        <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-[#6366F1]/10 blur-3xl pointer-events-none" />
        <div className="absolute right-24 -bottom-20 w-60 h-60 rounded-full bg-[#22D3EE]/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#22D3EE]">
              Every song has an identity
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug">
              Extraia o catálogo completo de gravações contínuas de até 1h30
            </h2>
            <p className="text-sm text-[#9CA3AF] leading-relaxed max-w-2xl">
              Envie arquivos MP3, WAV, FLAC, M4A, AAC, OGG, MP4 ou insira um link oficial do YouTube.
              O motor do FAIXORA segmenta o áudio com janelas sobrepostas, gera fingerprints acústicos
              e consolida automaticamente início, término e confiança de cada faixa.
            </p>
          </div>

          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              onClick={() => navigate('/new?tab=file')}
              className="group cursor-pointer p-4 rounded-xl bg-[#111827]/90 hover:bg-[#111827] border border-white/10 hover:border-[#6366F1] transition-all flex flex-col justify-between gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-[#6366F1]/15 border border-[#6366F1]/30 flex items-center justify-center text-[#6366F1] group-hover:scale-110 transition-transform">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center justify-between">
                  Enviar Arquivo
                  <ArrowUpRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#22D3EE]" />
                </h3>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  MP3, WAV, FLAC, M4A, MP4 até 90 min
                </p>
              </div>
            </div>

            <div
              onClick={() => navigate('/new?tab=youtube')}
              className="group cursor-pointer p-4 rounded-xl bg-[#111827]/90 hover:bg-[#111827] border border-white/10 hover:border-[#22D3EE] transition-all flex flex-col justify-between gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-[#22D3EE]/15 border border-[#22D3EE]/30 flex items-center justify-center text-[#22D3EE] group-hover:scale-110 transition-transform">
                <Youtube className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center justify-between">
                  Link do YouTube
                  <ArrowUpRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#22D3EE]" />
                </h3>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  CDs completos, coletâneas e shows
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Main Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#182233] border border-white/[0.07] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#9CA3AF]">Total de análises realizadas</span>
            <div className="p-2 rounded-lg bg-[#6366F1]/15 text-[#6366F1]">
              <Disc3 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white">{stats.totalAnalyses}</span>
            <span className="text-xs text-emerald-400 font-medium">+100% catalogado</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#182233] border border-white/[0.07] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#9CA3AF]">Total de músicas identificadas</span>
            <div className="p-2 rounded-lg bg-[#22D3EE]/15 text-[#22D3EE]">
              <Music2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white">{stats.totalIdentifiedTracks}</span>
            <span className="text-xs text-[#22D3EE] font-medium">Faixas únicas</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#182233] border border-white/[0.07] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#9CA3AF]">Tempo de áudio processado</span>
            <div className="p-2 rounded-lg bg-indigo-500/15 text-indigo-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white">
              {formatDurationHuman(stats.totalDurationSeconds)}
            </span>
            <span className="text-xs text-[#9CA3AF] font-mono">
              {formatTime(stats.totalDurationSeconds, true)}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#182233] border border-white/[0.07] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#9CA3AF]">Taxa média de reconhecimento</span>
            <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white">{stats.recognitionRate}%</span>
            <span className="text-xs text-emerald-400 font-medium">
              Confiança ~{stats.avgConfidence}%
            </span>
          </div>
        </div>
      </div>

      {/* Middle Row: Chart + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart: Análises realizadas por período */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-[#182233] border border-white/[0.07] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#6366F1]" />
                Análises e Faixas Identificadas por Período
              </h3>
              <p className="text-xs text-[#9CA3AF] mt-0.5">
                Desempenho de processamento nos últimos 7 dias
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-[#9CA3AF]">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#6366F1]" /> Faixas
              </span>
              <span className="flex items-center gap-1.5 text-[#9CA3AF]">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#22D3EE]" /> Análises
              </span>
            </div>
          </div>

          <div className="h-52 flex items-end justify-between gap-2 sm:gap-3 pt-6 px-2 border-b border-white/[0.06]">
            {data?.chartData.map((item, idx) => {
              const heightPct =
                item.tracks > 0 ? Math.max(12, Math.round((item.tracks / maxTracksVal) * 100)) : 3;
              const analysisPct =
                item.analyses > 0 ? Math.max(12, Math.round((item.analyses / maxAnalysesVal) * 85)) : 3;
              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center gap-2 h-full justify-end group"
                >
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono bg-[#111827] px-2 py-1 rounded border border-white/10 text-white whitespace-nowrap -mb-1 z-10 shadow-lg">
                    {item.tracks} faixas ({item.analyses} {item.analyses === 1 ? 'análise' : 'análises'})
                  </div>
                  <div className="w-full max-w-[42px] flex items-end justify-center gap-1 h-32">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-1/2 rounded-t-md transition-all ${
                        item.tracks > 0
                          ? 'bg-gradient-to-t from-[#6366F1]/60 to-[#6366F1] group-hover:from-[#6366F1] group-hover:to-[#818CF8]'
                          : 'bg-white/10'
                      }`}
                    />
                    <div
                      style={{ height: `${analysisPct}%` }}
                      className={`w-1/2 rounded-t-md transition-all ${
                        item.analyses > 0
                          ? 'bg-gradient-to-t from-[#22D3EE]/50 to-[#22D3EE]'
                          : 'bg-white/10'
                      }`}
                    />
                  </div>
                  <div className="flex flex-col items-center pb-2">
                    <span className="text-[11px] font-mono font-bold text-white">
                      {item.analyses > 0 ? `${item.tracks}` : '0'}
                    </span>
                    <span className="text-[10px] text-[#9CA3AF] font-medium whitespace-nowrap">
                      {item.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 flex items-center justify-between text-xs text-[#9CA3AF]">
            <span>Consolidação automática por janela deslizante ativa</span>
            <span className="text-[#22D3EE] font-medium">Chromaprint + AcoustID API</span>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-[#182233] border border-white/[0.07] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#22D3EE]" />
                Atividade Recente
              </h3>
              <p className="text-xs text-[#9CA3AF] mt-0.5">
                Últimas faixas extraídas de gravações contínuas
              </p>
            </div>
          </div>

          <div className="space-y-3 flex-1">
            {data?.recentActivity.map((act) => (
              <div
                key={act.id}
                onClick={() => navigate(`/analyses/${act.analysis_id}`)}
                className="p-3 rounded-xl bg-[#111827]/70 hover:bg-[#111827] border border-white/[0.05] hover:border-[#6366F1]/30 cursor-pointer transition-all flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#6366F1]/15 border border-[#6366F1]/30 flex items-center justify-center text-xs font-mono font-bold text-[#22D3EE] shrink-0">
                    {String(act.track_number).padStart(2, '0')}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{act.title}</p>
                    <p className="text-[11px] text-[#9CA3AF] truncate">
                      {act.artist} • <span className="text-[#6366F1]">{act.analysis_name}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[11px] font-mono text-[#22D3EE] block">
                    {formatTime(act.start_sec)} – {formatTime(act.end_sec)}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    {act.confidence}% conf.
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Analyses Table */}
      <div className="rounded-2xl bg-[#182233] border border-white/[0.07] overflow-hidden">
        <div className="p-6 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">Últimas Análises Realizadas</h3>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              Clique em qualquer análise para abrir o relatório cronológico detalhado
            </p>
          </div>
          <button
            onClick={() => navigate('/analyses')}
            className="text-xs font-semibold text-[#22D3EE] hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Ver histórico completo</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] bg-[#111827]/50">
                <th className="py-3.5 px-6">Análise / Arquivo</th>
                <th className="py-3.5 px-4">Gênero</th>
                <th className="py-3.5 px-4">Duração</th>
                <th className="py-3.5 px-4">Identificadas</th>
                <th className="py-3.5 px-4">Confiança Média</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-6 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-sm">
              {data?.recentAnalyses.map((item) => (
                <tr
                  key={item.id}
                  onClick={() =>
                    navigate(
                      item.status === 'processing'
                        ? `/analyses/${item.id}/processing`
                        : `/analyses/${item.id}`
                    )
                  }
                  className="hover:bg-[#111827]/60 cursor-pointer transition-colors"
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#111827] border border-white/10 flex items-center justify-center text-[#6366F1] shrink-0">
                        {item.source_type === 'youtube' ? (
                          <Youtube className="w-4 h-4 text-[#22D3EE]" />
                        ) : (
                          <FileAudio className="w-4 h-4 text-[#6366F1]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate max-w-xs sm:max-w-md">
                          {item.name}
                        </p>
                        <p className="text-xs text-[#9CA3AF] truncate">{item.file_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#111827] text-[#F9FAFB] border border-white/10">
                      {item.genre || 'Geral'}
                    </span>
                  </td>
                  <td className="py-4 px-4 font-mono text-xs text-[#F9FAFB]">
                    {formatTime(item.duration_seconds, true)}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{item.identified_tracks_count}</span>
                      <span className="text-xs text-[#9CA3AF]">faixas</span>
                      {item.unidentified_tracks_count > 0 && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          +{item.unidentified_tracks_count} não ident.
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-[#111827] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#6366F1] to-[#22D3EE]"
                          style={{ width: `${Math.min(100, item.avg_confidence)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-semibold text-[#22D3EE]">
                        {item.avg_confidence}%
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    {item.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Concluído
                      </span>
                    ) : item.status === 'processing' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#6366F1]/20 text-[#22D3EE] border border-[#6366F1]/40">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> {item.progress}%
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        <AlertCircle className="w-3.5 h-3.5" /> Erro
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <span className="text-xs font-semibold text-[#6366F1] hover:text-[#22D3EE]">
                      Abrir Relatório →
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
