import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Disc3,
  Search,
  PlusCircle,
  FileAudio,
  Youtube,
  Trash2,
  CheckCircle2,
  Loader2,
  Clock,
  Music2
} from 'lucide-react';
import { Analysis } from '../types';
import { formatTime } from '../utils/format';
import { useToast } from '../components/ToastContext';

export const AnalysesList: React.FC = () => {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [genreFilter, setGenreFilter] = useState('Todos');
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchAnalyses = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (genreFilter !== 'Todos') params.set('genre', genreFilter);

      const res = await fetch(`/api/analyses?${params.toString()}`);
      if (res.ok) {
        setAnalyses(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyses();
  }, [genreFilter]);

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/analyses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAnalyses((prev) => prev.filter((a) => a.id !== id));
        toast('Análise excluída', `"${name}" foi removida do catálogo.`, 'info');
      }
    } catch {
      toast('Erro ao excluir', 'Não foi possível remover a análise.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Disc3 className="w-7 h-7 text-[#6366F1]" />
            Catálogo de Análises
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-1">
            Histórico completo de CDs, coletâneas e vídeos musicais processados pelo FAIXORA
          </p>
        </div>

        <button
          onClick={() => navigate('/new')}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white font-semibold text-sm shadow-lg shadow-[#6366F1]/25 flex items-center gap-2 self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4 text-[#22D3EE]" />
          <span>Nova Análise</span>
        </button>
      </div>

      {/* Search & Genre Filters */}
      <div className="p-4 rounded-2xl bg-[#182233] border border-white/[0.07] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchAnalyses()}
            placeholder="Buscar por nome do CD, arquivo ou gênero..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#111827] border border-white/10 text-xs text-white placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#6366F1]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['Todos', 'Forró', 'Piseiro', 'Sertanejo', 'Eletrônica', 'MPB', 'Rock'].map((g) => (
            <button
              key={g}
              onClick={() => setGenreFilter(g)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                genreFilter === g
                  ? 'bg-[#6366F1] text-white'
                  : 'bg-[#111827] text-[#9CA3AF] hover:text-white border border-white/10'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Analyses */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-[#182233]" />
          ))}
        </div>
      ) : analyses.length === 0 ? (
        /* Rich Empty State */
        <div className="p-12 rounded-2xl bg-[#182233] border border-white/[0.07] text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#6366F1]/15 border border-[#6366F1]/30 flex items-center justify-center mx-auto text-[#6366F1]">
            <Disc3 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Nenhuma análise encontrada</h3>
            <p className="text-xs text-[#9CA3AF] mt-1 max-w-md mx-auto">
              Envie seu primeiro arquivo de áudio ou informe um link do YouTube para extrair a lista completa de músicas.
            </p>
          </div>
          <button
            onClick={() => navigate('/new')}
            className="px-5 py-2.5 rounded-xl bg-[#6366F1] text-white text-xs font-bold inline-flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" /> Criar Nova Análise
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {analyses.map((item) => (
            <div
              key={item.id}
              onClick={() =>
                navigate(
                  item.status === 'processing'
                    ? `/analyses/${item.id}/processing`
                    : `/analyses/${item.id}`
                )
              }
              className="group cursor-pointer p-5 rounded-2xl bg-[#182233] hover:bg-[#1C283C] border border-white/[0.07] hover:border-[#6366F1]/50 transition-all flex flex-col justify-between gap-4 shadow-lg"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-[#111827] border border-white/10 flex items-center justify-center shrink-0">
                    {item.source_type === 'youtube' ? (
                      <Youtube className="w-5 h-5 text-[#22D3EE]" />
                    ) : (
                      <FileAudio className="w-5 h-5 text-[#6366F1]" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#111827] text-[#22D3EE] border border-white/10">
                      {item.genre || 'Geral'}
                    </span>
                    <button
                      onClick={(e) => handleDelete(e, item.id, item.name)}
                      className="p-1.5 rounded-lg bg-[#111827] text-[#9CA3AF] hover:text-rose-400 transition-colors"
                      title="Excluir análise"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-[#22D3EE] transition-colors line-clamp-1">
                    {item.name}
                  </h3>
                  <p className="text-xs text-[#9CA3AF] truncate mt-0.5">{item.file_name}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-white/[0.06] grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-[#9CA3AF] flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Duração
                  </span>
                  <span className="font-mono font-bold text-white">
                    {formatTime(item.duration_seconds, true)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#9CA3AF] flex items-center gap-1">
                    <Music2 className="w-3 h-3" /> Faixas
                  </span>
                  <span className="font-bold text-emerald-400">
                    {item.identified_tracks_count} ident.
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#9CA3AF] block">Confiança</span>
                  <span className="font-mono font-bold text-[#22D3EE]">
                    {item.avg_confidence}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                {item.status === 'completed' ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Catálogo pronto
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[#22D3EE] font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando ({item.progress}%)
                  </span>
                )}
                <span className="text-[#6366F1] group-hover:translate-x-0.5 transition-transform font-semibold">
                  Ver Relatório →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
