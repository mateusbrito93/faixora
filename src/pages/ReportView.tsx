import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileAudio,
  Clock,
  Music2,
  AlertTriangle,
  CheckCircle2,
  Download,
  Copy,
  Play,
  Pause,
  RotateCw,
  Edit3,
  Search,
  Sparkles,
  Layers,
  X,
  Youtube,
  ArrowLeft,
  Volume2,
  Check
} from 'lucide-react';
import { Analysis, Track, Segment } from '../types';
import { formatTime } from '../utils/format';
import { useToast } from '../components/ToastContext';

export const ReportView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'identified' | 'unidentified'>('all');
  const [showSegmentsModal, setShowSegmentsModal] = useState(false);

  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [activeTrackId, setActiveTrackId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const simTimerRef = useRef<number | null>(null);

  // Manual Identification Modal State (Section 4.4)
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editAlbum, setEditAlbum] = useState('');
  const [mbQuery, setMbQuery] = useState('');
  const [mbResults, setMbResults] = useState<any[]>([]);
  const [searchingMb, setSearchingMb] = useState(false);
  const [savingTrack, setSavingTrack] = useState(false);

  // Retry Recognition State (Section 4.4)
  const [retryingTrackId, setRetryingTrackId] = useState<number | null>(null);

  const fetchReport = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/analyses/${id}`);
      if (!res.ok) throw new Error('Análise não encontrada');
      const data = await res.json();
      setAnalysis(data.analysis);
      setTracks(data.tracks || []);
      setSegments(data.segments || []);
    } catch (err: any) {
      toast('Erro ao carregar relatório', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, [id]);

  // Synchronize active track with current playback position
  useEffect(() => {
    const found = tracks.find(
      (t) => currentSec >= t.start_sec && currentSec < t.end_sec
    );
    if (found) {
      setActiveTrackId(found.id);
    }
  }, [currentSec, tracks]);

  const handleSeekAndPlay = (sec: number, trackId?: number) => {
    setCurrentSec(sec);
    if (trackId) setActiveTrackId(trackId);

    if (audioRef.current && analysis?.file_path) {
      // If real uploaded audio exists, play it
      audioRef.current.currentTime = Math.min(
        sec,
        Math.max(0, (audioRef.current.duration || 30) - 1)
      );
      audioRef.current.play().catch(() => {});
    }

    setIsPlaying(true);
    if (simTimerRef.current) clearInterval(simTimerRef.current);
    simTimerRef.current = window.setInterval(() => {
      setCurrentSec((prev) => {
        if (analysis && prev >= analysis.duration_seconds) {
          setIsPlaying(false);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (audioRef.current) audioRef.current.pause();
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    } else {
      handleSeekAndPlay(currentSec);
    }
  };

  // Retry recognition for an unidentified track (Section 4.4)
  const handleRetryRecognition = async (track: Track) => {
    try {
      setRetryingTrackId(track.id);
      toast(
        'Nova tentativa de reconhecimento',
        `Reanalisando intervalo ${formatTime(track.start_sec)} – ${formatTime(track.end_sec)} com alta sensibilidade...`,
        'info'
      );
      const res = await fetch(`/api/tracks/${track.id}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensitivity: 'high' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao reanalisar faixa');

      setTracks((prev) => prev.map((t) => (t.id === track.id ? data.track : t)));
      if (data.analysis) setAnalysis(data.analysis);

      toast(
        'Faixa reconhecida!',
        `Identificada como "${data.track.title}" — ${data.track.artist} (${data.track.confidence}%)`,
        'success'
      );
    } catch (err: any) {
      toast('Não foi possível identificar', err.message, 'warning');
    } finally {
      setRetryingTrackId(null);
    }
  };

  // Open Manual Identification Modal (Section 4.4)
  const openManualModal = (track: Track) => {
    setEditingTrack(track);
    setEditTitle(track.is_identified ? track.title : '');
    setEditArtist(track.is_identified ? track.artist : '');
    setEditAlbum(track.album || '');
    setMbQuery('');
    setMbResults([]);
  };

  const handleSearchMusicBrainz = async () => {
    if (!mbQuery.trim()) return;
    try {
      setSearchingMb(true);
      const res = await fetch(`/api/musicbrainz/search?q=${encodeURIComponent(mbQuery.trim())}`);
      if (res.ok) {
        const list = await res.json();
        setMbResults(list);
      }
    } catch {
      // ignore
    } finally {
      setSearchingMb(false);
    }
  };

  const handleSaveManualTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrack) return;
    if (!editTitle.trim() || !editArtist.trim()) {
      toast('Campos obrigatórios', 'Informe o nome da música e o cantor/banda.', 'warning');
      return;
    }

    try {
      setSavingTrack(true);
      const res = await fetch(`/api/tracks/${editingTrack.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          artist: editArtist.trim(),
          album: editAlbum.trim() || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao salvar');

      setTracks((prev) => prev.map((t) => (t.id === editingTrack.id ? data.track : t)));
      if (data.analysis) setAnalysis(data.analysis);
      setEditingTrack(null);
      toast('Identificação salva!', 'O catálogo foi atualizado com sucesso.', 'success');
    } catch (err: any) {
      toast('Erro ao salvar', err.message, 'error');
    } finally {
      setSavingTrack(false);
    }
  };

  // Export functions (CSV, JSON, YouTube Chapters)
  const handleCopyYoutubeChapters = () => {
    const lines = tracks.map(
      (t) =>
        `${formatTime(t.start_sec, analysis ? analysis.duration_seconds >= 3600 : false)} ${String(
          t.track_number
        ).padStart(2, '0')}. ${t.title} - ${t.artist}`
    );
    const text = `Capítulos extraídos por FAIXORA (${analysis?.name}):\n\n` + lines.join('\n');
    navigator.clipboard.writeText(text);
    toast(
      'Capítulos copiados!',
      'A tracklist cronológica foi copiada no formato oficial do YouTube.',
      'success'
    );
  };

  const handleExportCSV = () => {
    if (!analysis) return;
    const headers = ['#', 'Musica', 'Artista', 'Inicio', 'Termino', 'Duracao', 'Confianca'];
    const rows = tracks.map((t) => [
      String(t.track_number).padStart(2, '0'),
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.artist.replace(/"/g, '""')}"`,
      formatTime(t.start_sec),
      formatTime(t.end_sec),
      formatTime(t.duration_sec),
      `${t.confidence}%`
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FAIXORA_${analysis.name.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('CSV exportado!', 'O relatório completo foi baixado.', 'success');
  };

  const handleExportJSON = () => {
    if (!analysis) return;
    const payload = {
      platform: 'FAIXORA Audio Intelligence',
      analysis: {
        name: analysis.name,
        file: analysis.file_name,
        duration: formatTime(analysis.duration_seconds, true),
        identifiedTracks: analysis.identified_tracks_count,
        unidentifiedTracks: analysis.unidentified_tracks_count,
        averageConfidence: `${analysis.avg_confidence}%`
      },
      tracks: tracks.map((t) => ({
        number: String(t.track_number).padStart(2, '0'),
        title: t.title,
        artist: t.artist,
        start: formatTime(t.start_sec),
        end: formatTime(t.end_sec),
        duration: formatTime(t.duration_sec),
        confidence: `${t.confidence}%`,
        identified: Boolean(t.is_identified)
      }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FAIXORA_${analysis.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('JSON exportado!', 'O arquivo estruturado foi baixado.', 'success');
  };

  if (loading || !analysis) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-36 bg-[#182233] rounded-2xl" />
        <div className="h-96 bg-[#182233] rounded-2xl" />
      </div>
    );
  }

  const filteredTracks = tracks.filter((t) => {
    if (filterMode === 'identified' && !t.is_identified) return false;
    if (filterMode === 'unidentified' && t.is_identified) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        String(t.track_number).padStart(2, '0').includes(q)
      );
    }
    return true;
  });

  const activeTrack = tracks.find((t) => t.id === activeTrackId) || tracks[0];
  const audioFileUrl = analysis.file_path
    ? `/uploads/${analysis.file_path.split(/[\\/]/).pop()}`
    : null;

  return (
    <div className="space-y-6 pb-12">
      {audioFileUrl && <audio ref={audioRef} src={audioFileUrl} className="hidden" />}

      {/* Back Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#9CA3AF] hover:text-white transition-colors self-start"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para o Dashboard
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={async () => {
              try {
                toast('Reiniciando análise acústica real...', 'Reprocessando áudio com Shazam DSP + Chromaprint.', 'info');
                const res = await fetch(`/api/analyses/${analysis.id}/reprocess`, { method: 'POST' });
                if (res.ok) navigate(`/analyses/${analysis.id}/processing`);
              } catch {
                toast('Erro ao reprocessar', 'Não foi possível reiniciar a análise.', 'error');
              }
            }}
            className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Reprocessar Áudio Real</span>
          </button>
          {segments.length > 0 && (
            <button
              onClick={() => setShowSegmentsModal(true)}
              className="px-3.5 py-2 rounded-xl bg-[#182233] hover:bg-[#1E293B] text-[#22D3EE] border border-[#22D3EE]/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Ver Janelas Consolidadas ({segments.length})</span>
            </button>
          )}
          <button
            onClick={handleCopyYoutubeChapters}
            className="px-3.5 py-2 rounded-xl bg-[#182233] hover:bg-[#1E293B] text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Copy className="w-3.5 h-3.5 text-[#22D3EE]" />
            <span>Copiar Capítulos (YouTube)</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-[#182233] hover:bg-[#1E293B] text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-[#6366F1]" />
            <span>Exportar CSV</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="px-3.5 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-[#6366F1]/20 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar JSON</span>
          </button>
        </div>
      </div>

      {/* Section 6: Report Summary Header Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#182233] via-[#141D2E] to-[#111827] border border-white/[0.08] shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#6366F1]/20 border border-[#6366F1]/30 text-[#22D3EE] text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Relatório de Identificação Musical</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Análise: {analysis.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#9CA3AF] pt-1">
              <span className="flex items-center gap-1.5">
                {analysis.source_type === 'youtube' ? (
                  <Youtube className="w-4 h-4 text-[#22D3EE]" />
                ) : (
                  <FileAudio className="w-4 h-4 text-[#6366F1]" />
                )}
                Arquivo: <strong className="text-white">{analysis.file_name}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#22D3EE]" />
                Duração:{' '}
                <strong className="text-white font-mono">
                  {formatTime(analysis.duration_seconds, true)}
                </strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-[#111827] text-white border border-white/10">
                Gênero: {analysis.genre || 'Geral'}
              </span>
            </div>
          </div>

          {/* Summary KPI Pills matching Section 6 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            <div className="px-4 py-3 rounded-xl bg-[#111827]/90 border border-emerald-500/30">
              <span className="text-[11px] text-[#9CA3AF] block">Músicas identificadas</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-extrabold text-emerald-400">
                  {analysis.identified_tracks_count}
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
            </div>

            <div className="px-4 py-3 rounded-xl bg-[#111827]/90 border border-amber-500/30">
              <span className="text-[11px] text-[#9CA3AF] block">Músicas não identificadas</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-extrabold text-amber-400">
                  {analysis.unidentified_tracks_count}
                </span>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
            </div>

            <div className="px-4 py-3 rounded-xl bg-[#111827]/90 border border-[#6366F1]/30 col-span-2 sm:col-span-1">
              <span className="text-[11px] text-[#9CA3AF] block">Confiança média</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-extrabold text-[#22D3EE] font-mono">
                  {analysis.avg_confidence}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Synchronized Timeline & Player Bar */}
        <div className="mt-6 pt-6 border-t border-white/[0.08] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlayPause}
                className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#22D3EE] text-white flex items-center justify-center shadow-lg shadow-[#6366F1]/30 hover:scale-105 transition-transform"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#6366F1]/20 text-[#22D3EE]">
                    Faixa #{String(activeTrack?.track_number || 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm font-bold text-white">
                    {activeTrack?.title || 'Selecione uma faixa'}
                  </span>
                </div>
                <p className="text-xs text-[#9CA3AF]">
                  {activeTrack?.artist} • Intervalo:{' '}
                  <span className="font-mono text-white">
                    {formatTime(activeTrack?.start_sec || 0)} – {formatTime(activeTrack?.end_sec || 0)}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <Volume2 className="w-4 h-4 text-[#22D3EE]" />
              <span className="text-[#22D3EE] font-bold">
                {formatTime(currentSec, analysis.duration_seconds >= 3600)}
              </span>
              <span className="text-[#9CA3AF]">/</span>
              <span className="text-[#9CA3AF]">
                {formatTime(analysis.duration_seconds, analysis.duration_seconds >= 3600)}
              </span>
            </div>
          </div>

          {/* Multi-Track Interactive Segment Map */}
          <div className="relative h-7 rounded-xl bg-[#0B0F19] p-1 flex gap-0.5 overflow-hidden border border-white/10">
            {tracks.map((t) => {
              const widthPct = Math.max(
                1.5,
                (t.duration_sec / Math.max(1, analysis.duration_seconds)) * 100
              );
              const isCurrent = t.id === activeTrack?.id;
              return (
                <div
                  key={t.id}
                  onClick={() => handleSeekAndPlay(t.start_sec, t.id)}
                  style={{ width: `${widthPct}%` }}
                  title={`${String(t.track_number).padStart(2, '0')}. ${t.title} - ${t.artist} (${formatTime(
                    t.start_sec
                  )} - ${formatTime(t.end_sec)})`}
                  className={`h-full rounded-xs cursor-pointer transition-all ${
                    !t.is_identified
                      ? 'bg-amber-500/60 hover:bg-amber-400'
                      : isCurrent
                      ? 'bg-[#22D3EE] shadow-sm shadow-[#22D3EE]'
                      : 'bg-[#6366F1]/60 hover:bg-[#6366F1]'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {[
            { id: 'all', label: `Todas (${tracks.length})` },
            {
              id: 'identified',
              label: `Identificadas (${analysis.identified_tracks_count})`
            },
            {
              id: 'unidentified',
              label: `Não identificadas (${analysis.unidentified_tracks_count})`
            }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterMode(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                filterMode === tab.id
                  ? 'bg-[#6366F1] text-white shadow-md shadow-[#6366F1]/25'
                  : 'bg-[#182233] text-[#9CA3AF] hover:text-white border border-white/[0.06]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar por música ou cantor..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#182233] border border-white/10 text-xs text-white placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#6366F1]"
          />
        </div>
      </div>

      {/* Section 6: Official Chronological Identification Table */}
      <div className="rounded-2xl bg-[#182233] border border-white/[0.07] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.07] text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] bg-[#111827]/70">
                <th className="py-4 px-5 w-16">#</th>
                <th className="py-4 px-4">Música</th>
                <th className="py-4 px-4">Artista</th>
                <th className="py-4 px-4">Início</th>
                <th className="py-4 px-4">Término</th>
                <th className="py-4 px-4">Duração</th>
                <th className="py-4 px-4">Confiança</th>
                <th className="py-4 px-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-sm">
              {filteredTracks.map((track) => {
                const isUnidentified = !track.is_identified;
                const isCurrent = activeTrack?.id === track.id && isPlaying;

                return (
                  <tr
                    key={track.id}
                    className={`transition-colors ${
                      isUnidentified
                        ? 'bg-amber-500/[0.04] hover:bg-amber-500/[0.08]'
                        : isCurrent
                        ? 'bg-[#6366F1]/15'
                        : 'hover:bg-[#111827]/60'
                    }`}
                  >
                    {/* Col 1: # */}
                    <td className="py-4 px-5 font-mono text-xs font-bold">
                      <button
                        onClick={() => handleSeekAndPlay(track.start_sec, track.id)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                          isCurrent
                            ? 'bg-[#22D3EE] text-[#0B0F19]'
                            : 'bg-[#111827] text-[#9CA3AF] hover:text-white border border-white/10'
                        }`}
                        title="Tocar a partir deste momento"
                      >
                        {String(track.track_number).padStart(2, '0')}
                      </button>
                    </td>

                    {/* Col 2: Música */}
                    <td className="py-4 px-4">
                      {isUnidentified ? (
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          <div>
                            <span className="font-bold text-amber-300">
                              Música não identificada
                            </span>
                            <span className="block text-[11px] text-[#9CA3AF]">
                              Sem correspondência acústica confiável neste intervalo
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{track.title}</span>
                            {Boolean(track.is_manual) && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#6366F1]/20 text-[#22D3EE] border border-[#6366F1]/30">
                                Manual
                              </span>
                            )}
                          </div>
                          {track.album && (
                            <span className="block text-xs text-[#9CA3AF]">
                              Álbum: {track.album} {track.release_year ? `(${track.release_year})` : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Col 3: Artista */}
                    <td className="py-4 px-4">
                      {isUnidentified ? (
                        <span className="text-xs italic text-[#9CA3AF]">
                          Não atribuído sem evidência
                        </span>
                      ) : (
                        <span className="font-medium text-[#F9FAFB]">{track.artist}</span>
                      )}
                    </td>

                    {/* Col 4: Início */}
                    <td className="py-4 px-4 font-mono text-xs text-[#22D3EE] font-semibold">
                      {formatTime(track.start_sec, analysis.duration_seconds >= 3600)}
                    </td>

                    {/* Col 5: Término */}
                    <td className="py-4 px-4 font-mono text-xs text-[#F9FAFB]">
                      {formatTime(track.end_sec, analysis.duration_seconds >= 3600)}
                    </td>

                    {/* Col 6: Duração */}
                    <td className="py-4 px-4 font-mono text-xs text-[#9CA3AF]">
                      {formatTime(track.duration_sec)}
                    </td>

                    {/* Col 7: Confiança */}
                    <td className="py-4 px-4">
                      {isUnidentified ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          N/A
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-1.5 rounded-full bg-[#111827] overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#6366F1] to-emerald-400"
                              style={{ width: `${Math.min(100, track.confidence)}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-bold text-emerald-400">
                            {Math.round(track.confidence)}%
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Col 8: Actions (Section 4.4 - Retry & Manual Identification) */}
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isUnidentified && (
                          <button
                            onClick={() => handleRetryRecognition(track)}
                            disabled={retryingTrackId === track.id}
                            className="px-2.5 py-1.5 rounded-lg bg-[#6366F1]/20 hover:bg-[#6366F1] text-[#22D3EE] hover:text-white border border-[#6366F1]/40 text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50"
                            title="Nova tentativa de reconhecimento com sensibilidade máxima"
                          >
                            <RotateCw
                              className={`w-3.5 h-3.5 ${
                                retryingTrackId === track.id ? 'animate-spin' : ''
                              }`}
                            />
                            <span>Reanalisar</span>
                          </button>
                        )}
                        <button
                          onClick={() => openManualModal(track)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#111827] hover:bg-[#1E293B] text-[#9CA3AF] hover:text-white border border-white/10 text-xs font-medium flex items-center gap-1 transition-all"
                          title="Identificação manual pelo usuário"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{isUnidentified ? 'Identificar' : 'Editar'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Manual Track Identification + MusicBrainz Search (Section 4.4) */}
      {editingTrack && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#182233] border border-white/15 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <span className="text-xs font-mono text-[#22D3EE]">
                  Faixa #{String(editingTrack.track_number).padStart(2, '0')} • Intervalo{' '}
                  {formatTime(editingTrack.start_sec)} – {formatTime(editingTrack.end_sec)}
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  Identificação Manual da Faixa
                </h3>
              </div>
              <button
                onClick={() => setEditingTrack(null)}
                className="p-1.5 rounded-lg bg-[#111827] text-[#9CA3AF] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Optional MusicBrainz Search Helper */}
            <div className="p-3.5 rounded-xl bg-[#111827] border border-white/[0.07] space-y-2.5">
              <label className="block text-xs font-semibold text-[#22D3EE]">
                Pesquisar no catálogo oficial MusicBrainz (opcional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={mbQuery}
                  onChange={(e) => setMbQuery(e.target.value)}
                  placeholder="Digite o nome da música ou artista..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#182233] border border-white/10 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={handleSearchMusicBrainz}
                  disabled={searchingMb}
                  className="px-3 py-1.5 rounded-lg bg-[#6366F1] text-white text-xs font-semibold"
                >
                  {searchingMb ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
              {mbResults.length > 0 && (
                <div className="max-h-32 overflow-y-auto divide-y divide-white/[0.06] pt-1">
                  {mbResults.map((r) => (
                    <div
                      key={r.mbid}
                      onClick={() => {
                        setEditTitle(r.title);
                        setEditArtist(r.artist);
                        if (r.album) setEditAlbum(r.album);
                        setMbResults([]);
                      }}
                      className="py-1.5 px-2 hover:bg-[#182233] cursor-pointer rounded text-xs flex items-center justify-between"
                    >
                      <div className="truncate">
                        <strong className="text-white">{r.title}</strong> —{' '}
                        <span className="text-[#9CA3AF]">{r.artist}</span>
                      </div>
                      <Check className="w-3.5 h-3.5 text-[#22D3EE] shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleSaveManualTrack} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white mb-1">
                  Nome da Música *
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Ex: Meu Vaqueiro, Meu Peão"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#111827] border border-white/10 text-sm text-white focus:outline-none focus:border-[#6366F1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">
                  Cantor ou Banda *
                </label>
                <input
                  type="text"
                  required
                  value={editArtist}
                  onChange={(e) => setEditArtist(e.target.value)}
                  placeholder="Ex: Mastruz com Leite"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#111827] border border-white/10 text-sm text-white focus:outline-none focus:border-[#6366F1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">
                  Álbum / Coletânea (opcional)
                </label>
                <input
                  type="text"
                  value={editAlbum}
                  onChange={(e) => setEditAlbum(e.target.value)}
                  placeholder="Ex: Ao Vivo em Fortaleza"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#111827] border border-white/10 text-sm text-white focus:outline-none focus:border-[#6366F1]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTrack(null)}
                  className="px-4 py-2 rounded-xl bg-[#111827] text-[#9CA3AF] hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingTrack}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white text-xs font-bold shadow-lg shadow-[#6366F1]/25"
                >
                  {savingTrack ? 'Salvando...' : 'Confirmar Identificação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Overlapping Recognition Windows (Section 4.1 Proof) */}
      {showSegmentsModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#182233] border border-white/15 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#22D3EE]" />
                  Janelas de Reconhecimento com Sobreposição (Seção 4.1)
                </h3>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  Segmentos temporais analisados antes da consolidação em faixas únicas
                </p>
              </div>
              <button
                onClick={() => setShowSegmentsModal(false)}
                className="p-1.5 rounded-lg bg-[#111827] text-[#9CA3AF] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 border border-white/[0.06] rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#111827] text-[#9CA3AF] uppercase sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4">Janela</th>
                    <th className="py-2.5 px-4">Intervalo</th>
                    <th className="py-2.5 px-4">Música Identificada</th>
                    <th className="py-2.5 px-4">Fingerprint Chromaprint</th>
                    <th className="py-2.5 px-4 text-right">Confiança</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {segments.map((s) => (
                    <tr key={s.id} className="hover:bg-[#111827]/50">
                      <td className="py-2 px-4 font-mono text-[#9CA3AF]">
                        #{String(s.segment_index + 1).padStart(2, '0')}
                      </td>
                      <td className="py-2 px-4 font-mono text-[#22D3EE]">
                        {formatTime(s.start_sec)} – {formatTime(s.end_sec)}
                      </td>
                      <td className="py-2 px-4">
                        {s.matched_title ? (
                          <span className="text-white font-semibold">
                            {s.matched_title} — <span className="text-[#9CA3AF] font-normal">{s.matched_artist}</span>
                          </span>
                        ) : (
                          <span className="text-amber-300">Música não identificada</span>
                        )}
                      </td>
                      <td className="py-2 px-4 font-mono text-[10px] text-[#9CA3AF] truncate max-w-[140px]">
                        {s.fingerprint}
                      </td>
                      <td className="py-2 px-4 text-right font-mono text-emerald-400">
                        {s.confidence ? `${s.confidence}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
