import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Loader2,
  AudioWaveform,
  FileAudio,
  Clock,
  Layers,
  Music2,
  HelpCircle,
  ArrowRight,
  Sparkles,
  Radio
} from 'lucide-react';
import { Analysis } from '../types';
import { formatTime } from '../utils/format';
import { useToast } from '../components/ToastContext';

const VISUAL_STEPS = [
  { step: 1, title: 'Recebendo arquivo', desc: 'Validação de formato, integridade e metadados' },
  { step: 2, title: 'Preparando áudio', desc: 'Normalização acústica e conversão via FFmpeg' },
  { step: 3, title: 'Dividindo segmentos', desc: 'Geração de janelas temporais com sobreposição' },
  { step: 4, title: 'Reconhecendo músicas', desc: 'Extração Chromaprint e consulta AcoustID / MusicBrainz' },
  { step: 5, title: 'Consolidando resultados', desc: 'Unificação de faixas consecutivas e cálculo de transições' },
  { step: 6, title: 'Gerando relatório', desc: 'Organização cronológica e indicadores de confiança' }
];

export const ProcessingView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Elapsed timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Connect to Server-Sent Events (SSE) for real-time updates + fallback polling
  useEffect(() => {
    if (!id) return;

    // Initial fetch
    fetch(`/api/analyses/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.analysis) {
          setAnalysis(data.analysis);
          if (data.analysis.status === 'completed') {
            setTimeout(() => navigate(`/analyses/${id}`), 1000);
          }
        }
      })
      .catch(console.error);

    const es = new EventSource(`/api/analyses/${id}/stream`);
    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.analysis) {
          setAnalysis(payload.analysis);
        }
        if (payload.type === 'completed' || payload.analysis?.status === 'completed') {
          toast(
            'Processamento concluído!',
            'O catálogo musical cronológico está pronto para visualização.',
            'success'
          );
          setTimeout(() => {
            navigate(`/analyses/${id}`);
          }, 900);
        }
      } catch (e) {
        console.error(e);
      }
    };

    return () => {
      es.close();
    };
  }, [id, navigate, toast]);

  if (!analysis) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#6366F1]" />
        <p className="text-sm text-[#9CA3AF]">Conectando ao motor de processamento em tempo real...</p>
      </div>
    );
  }

  const totalSegments = analysis.total_segments || 24;
  const analyzedSegments = analysis.analyzed_segments || 0;
  const pendingSegments = Math.max(0, totalSegments - analyzedSegments);
  const currentStep = analysis.current_step || 1;
  const progress = analysis.progress || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Top Status Banner */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#182233] via-[#141D2E] to-[#111827] border border-[#6366F1]/40 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-60 h-60 rounded-full bg-[#6366F1]/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#22D3EE] flex items-center justify-center shadow-lg shadow-[#6366F1]/30 shrink-0">
              <div className="flex items-end gap-1 h-6">
                <span className="w-1 bg-white rounded-full animate-eq-1" />
                <span className="w-1 bg-white rounded-full animate-eq-2" />
                <span className="w-1 bg-white rounded-full animate-eq-3" />
                <span className="w-1 bg-white rounded-full animate-eq-4" />
              </div>
            </div>
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#22D3EE] mb-1">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>Processamento em Tempo Real (SSE Ativo)</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">{analysis.name}</h1>
              <p className="text-xs text-[#9CA3AF] mt-0.5 flex items-center gap-2">
                <FileAudio className="w-3.5 h-3.5 text-[#6366F1]" />
                <span>Arquivo: {analysis.file_name}</span>
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-3xl sm:text-4xl font-extrabold font-mono text-transparent bg-clip-text bg-gradient-to-r from-[#6366F1] to-[#22D3EE]">
              {progress}%
            </span>
            <p className="text-xs text-[#9CA3AF] mt-0.5">{analysis.step_label}</p>
          </div>
        </div>

        {/* Main Progress Bar */}
        <div className="mt-6 space-y-2">
          <div className="w-full h-3 rounded-full bg-[#0B0F19] p-0.5 overflow-hidden border border-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#6366F1] via-[#818CF8] to-[#22D3EE] transition-all duration-300"
              style={{ width: `${Math.max(4, progress)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
            <span>
              Etapa {currentStep} de 6: <strong className="text-white">{analysis.step_label}</strong>
            </span>
            <span>O processamento continua em segundo plano mesmo se fechar o navegador</span>
          </div>
        </div>

        {/* 5 Real-time Telemetry Counters required in Section 5 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
          <div className="p-3.5 rounded-xl bg-[#111827]/90 border border-white/[0.06]">
            <span className="text-[11px] text-[#9CA3AF] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#6366F1]" /> Duração total
            </span>
            <p className="text-lg font-bold font-mono text-white mt-1">
              {formatTime(analysis.duration_seconds, true)}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#111827]/90 border border-white/[0.06]">
            <span className="text-[11px] text-[#9CA3AF] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#22D3EE]" /> Tempo decorrido
            </span>
            <p className="text-lg font-bold font-mono text-[#22D3EE] mt-1">
              {formatTime(elapsedSeconds)}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#111827]/90 border border-white/[0.06]">
            <span className="text-[11px] text-[#9CA3AF] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" /> Segmentos analisados
            </span>
            <p className="text-lg font-bold font-mono text-white mt-1">
              {analyzedSegments} <span className="text-xs text-[#9CA3AF]">/ {totalSegments}</span>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#111827]/90 border border-white/[0.06]">
            <span className="text-[11px] text-[#9CA3AF] flex items-center gap-1.5">
              <Music2 className="w-3.5 h-3.5 text-emerald-400" /> Identificadas
            </span>
            <p className="text-lg font-bold font-mono text-emerald-400 mt-1">
              {analysis.identified_tracks_count}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#111827]/90 border border-white/[0.06] col-span-2 sm:col-span-1">
            <span className="text-[11px] text-[#9CA3AF] flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" /> Pendentes
            </span>
            <p className="text-lg font-bold font-mono text-amber-300 mt-1">
              {pendingSegments}
            </p>
          </div>
        </div>
      </div>

      {/* 6 Visual Steps Checklist (Section 5) */}
      <div className="p-6 rounded-2xl bg-[#182233] border border-white/[0.07] space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <AudioWaveform className="w-5 h-5 text-[#6366F1]" />
            Etapas do Pipeline de Reconhecimento
          </h2>
          {analysis.status === 'completed' && (
            <button
              onClick={() => navigate(`/analyses/${analysis.id}`)}
              className="px-4 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <span>Ver Relatório Final</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {VISUAL_STEPS.map((item) => {
            const isDone =
              currentStep > item.step || analysis.status === 'completed';
            const isCurrent =
              currentStep === item.step && analysis.status !== 'completed';

            return (
              <div
                key={item.step}
                className={`p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
                  isCurrent
                    ? 'bg-[#111827] border-[#22D3EE] shadow-lg shadow-[#22D3EE]/10'
                    : isDone
                    ? 'bg-[#111827]/70 border-emerald-500/30'
                    : 'bg-[#111827]/30 border-white/[0.05] opacity-60'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  ) : isCurrent ? (
                    <div className="w-7 h-7 rounded-lg bg-[#22D3EE]/20 border border-[#22D3EE]/40 flex items-center justify-center text-[#22D3EE]">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-[#182233] border border-white/10 flex items-center justify-center text-xs font-mono text-[#9CA3AF]">
                      {item.step}
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#9CA3AF]">
                    Etapa 0{item.step}
                  </span>
                  <h3 className="text-sm font-bold text-white mt-0.5">{item.title}</h3>
                  <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
