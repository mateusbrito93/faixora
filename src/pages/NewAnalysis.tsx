import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  UploadCloud,
  Youtube,
  FileAudio,
  X,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Sparkles,
  Clock,
  ShieldCheck,
  Loader2,
  Play,
  Info
} from 'lucide-react';
import { formatFileSize, formatTime } from '../utils/format';
import { useToast } from '../components/ToastContext';

const SUGGESTED_GENRES = [
  'Automático (Detectar pelo áudio)',
  'Forró',
  'Piseiro',
  'Sertanejo',
  'Pagode',
  'Samba',
  'Rock',
  'Pop',
  'Funk',
  'Eletrônica',
  'Gospel',
  'MPB',
  'Outros'
];

const LANGUAGES = ['Automático', 'Português', 'Inglês', 'Espanhol', 'Instrumental / Misto', 'Outro'];

function inferGenreFromText(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes('rock') || t.includes('metal') || t.includes('classic rock') || t.includes('flashback')) return 'Rock';
  if (t.includes('piseiro') || t.includes('pisadinha') || t.includes('vaquejada')) return 'Piseiro';
  if (t.includes('forró') || t.includes('forro') || t.includes('xote') || t.includes('arrasta')) return 'Forró';
  if (t.includes('sertanejo') || t.includes('modão') || t.includes('modao') || t.includes('arrocha')) return 'Sertanejo';
  if (t.includes('pagode')) return 'Pagode';
  if (t.includes('samba')) return 'Samba';
  if (t.includes('funk') || t.includes('baile') || t.includes('mandelão')) return 'Funk';
  if (t.includes('eletrônica') || t.includes('eletronica') || t.includes('house') || t.includes('techno') || t.includes('trance') || t.includes('alok')) return 'Eletrônica';
  if (t.includes('gospel') || t.includes('louvor') || t.includes('adoração')) return 'Gospel';
  if (t.includes('mpb') || t.includes('bossa')) return 'MPB';
  if (t.includes('pop')) return 'Pop';
  return null;
}

const ALLOWED_EXTENSIONS = ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'mp4'];

export const NewAnalysis: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'youtube' ? 'youtube' : 'file';

  const [activeTab, setActiveTab] = useState<'file' | 'youtube'>(initialTab);
  const [dragActive, setDragActive] = useState(false);

  // Option A — File State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState<number>(0);
  const [probingDuration, setProbingDuration] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Option B — YouTube State
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [validatingYt, setValidatingYt] = useState(false);
  const [ytMetadata, setYtMetadata] = useState<{
    videoId: string;
    title: string;
    authorName: string;
    thumbnailUrl: string;
    officialOembed: boolean;
    copyrightNotice: string;
  } | null>(null);
  const [ytDurationMinutes, setYtDurationMinutes] = useState<number>(45);

  // Section 3.3 — Analysis Settings
  const [analysisName, setAnalysisName] = useState('');
  const [genre, setGenre] = useState('Automático (Detectar pelo áudio)');
  const [language, setLanguage] = useState('Automático');
  const [sensitivity, setSensitivity] = useState<'low' | 'normal' | 'high'>('high');
  const [detectUnknown, setDetectUnknown] = useState(true);
  const [detailedIntervals, setDetailedIntervals] = useState(true);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'youtube' || t === 'file') {
      setActiveTab(t);
    }
  }, [searchParams]);

  const validateAndSelectFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast(
        'Formato de arquivo inválido',
        `O formato .${ext} não é suportado. Utilize MP3, WAV, FLAC, M4A, AAC, OGG ou MP4.`,
        'error'
      );
      return;
    }

    if (file.size > 800 * 1024 * 1024) {
      toast('Arquivo muito grande', 'O limite máximo é de 800 MB por arquivo.', 'error');
      return;
    }

    setSelectedFile(file);
    const cleanedName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    if (!analysisName) {
      setAnalysisName(cleanedName);
    }
    const inferred = inferGenreFromText(cleanedName);
    if (inferred && genre.startsWith('Automático')) {
      setGenre(inferred);
    }

    // Probe real audio duration in browser using HTML5 Audio/Video element
    setProbingDuration(true);
    const objectUrl = URL.createObjectURL(file);
    const media = document.createElement(ext === 'mp4' ? 'video' : 'audio');
    media.preload = 'metadata';

    media.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      setProbingDuration(false);
      const dur = Math.round(media.duration || 0);
      if (dur > 90 * 60) {
        toast(
          'Limite de 90 minutos excedido',
          `Este arquivo possui ${Math.round(dur / 60)} minutos. O limite inicial do FAIXORA é de 90 minutos (1h30).`,
          'warning'
        );
      }
      setEstimatedDuration(dur > 0 && isFinite(dur) ? dur : 1800);
    };

    media.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setProbingDuration(false);
      // Estimate based on 192kbps bitrate if browser codec can't read header
      const est = Math.min(5400, Math.max(120, Math.round(file.size / 24000)));
      setEstimatedDuration(est);
    };

    media.src = objectUrl;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleCancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setIsUploading(false);
    setUploadProgress(0);
    toast('Envio cancelado', 'O upload foi interrompido antes do início do processamento.', 'info');
  };

  const handleStartFileAnalysis = () => {
    if (!selectedFile) {
      toast('Selecione um arquivo', 'Envie um arquivo de áudio ou vídeo antes de iniciar.', 'warning');
      return;
    }
    if (estimatedDuration > 5400) {
      toast(
        'Duração acima do limite',
        'O sistema aceita arquivos de até 90 minutos (01:30:00).',
        'error'
      );
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('name', analysisName || selectedFile.name);
    formData.append('genre', genre);
    formData.append('language', language);
    formData.append('sensitivity', sensitivity);
    formData.append('detect_unknown', String(detectUnknown));
    formData.append('detailed_intervals', String(detailedIntervals));
    formData.append('estimated_duration', String(estimatedDuration || 1800));

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(pct);
      }
    };

    xhr.onload = () => {
      setIsUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        const response = JSON.parse(xhr.responseText);
        toast(
          'Arquivo recebido!',
          'Iniciando segmentação e reconhecimento musical em segundo plano.',
          'success'
        );
        navigate(`/analyses/${response.analysis.id}/processing`);
      } else {
        let errMsg = 'Falha ao enviar arquivo';
        try {
          errMsg = JSON.parse(xhr.responseText).error || errMsg;
        } catch {}
        toast('Erro na validação', errMsg, 'error');
      }
    };

    xhr.onerror = () => {
      setIsUploading(false);
      toast('Erro de conexão', 'Não foi possível enviar o arquivo ao servidor.', 'error');
    };

    xhr.open('POST', '/api/analyses/upload', true);
    xhr.send(formData);
  };

  const handleValidateYoutube = async () => {
    if (!youtubeUrl.trim()) {
      toast('Informe a URL', 'Digite ou cole um link válido do YouTube.', 'warning');
      return;
    }
    try {
      setValidatingYt(true);
      const res = await fetch('/api/youtube/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'URL inválida');
      }
      setYtMetadata(data.metadata);
      if (!analysisName) {
        setAnalysisName(data.metadata.title);
      }
      const inferred = inferGenreFromText(data.metadata.title);
      if (inferred && genre.startsWith('Automático')) {
        setGenre(inferred);
      }
      toast('Metadados obtidos com sucesso', `Vídeo identificado: ${data.metadata.title}`, 'success');
    } catch (err: any) {
      setYtMetadata(null);
      toast('URL do YouTube inválida', err.message, 'error');
    } finally {
      setValidatingYt(false);
    }
  };

  const handleStartYoutubeAnalysis = async () => {
    if (!ytMetadata) {
      toast('Valide o link primeiro', 'Clique em "Validar Link" para obter os metadados oficiais.', 'warning');
      return;
    }
    try {
      setIsUploading(true);
      const res = await fetch('/api/analyses/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: youtubeUrl.trim(),
          youtube_title: ytMetadata.title,
          youtube_thumbnail: ytMetadata.thumbnailUrl,
          name: analysisName || ytMetadata.title,
          genre,
          language,
          sensitivity,
          detect_unknown: detectUnknown,
          detailed_intervals: detailedIntervals,
          duration_seconds: Math.min(5400, ytDurationMinutes * 60)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao iniciar análise');
      toast('Análise iniciada!', 'Processando capítulos e segmentos musicais em segundo plano.', 'success');
      navigate(`/analyses/${data.analysis.id}/processing`);
    } catch (err: any) {
      toast('Erro ao iniciar análise', err.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6366F1]/15 border border-[#6366F1]/30 text-[#22D3EE] text-xs font-medium mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Pipeline de Identificação Multi-Faixas</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Nova Análise Musical
        </h1>
        <p className="text-sm text-[#9CA3AF] mt-1">
          Envie uma gravação contínua de até 1h30 (90 minutos) ou informe um link do YouTube para extrair todas as faixas cronologicamente.
        </p>
      </div>

      {/* Source Selector Tabs (Option A vs Option B) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('file')}
          className={`p-5 rounded-2xl border text-left transition-all flex items-start gap-4 ${
            activeTab === 'file'
              ? 'bg-[#182233] border-[#6366F1] shadow-lg shadow-[#6366F1]/15'
              : 'bg-[#111827] border-white/[0.07] hover:bg-[#182233]/60'
          }`}
        >
          <div
            className={`p-3 rounded-xl ${
              activeTab === 'file'
                ? 'bg-[#6366F1] text-white'
                : 'bg-[#182233] text-[#9CA3AF]'
            }`}
          >
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#22D3EE]">
                Opção A
              </span>
              {activeTab === 'file' && (
                <span className="w-2 h-2 rounded-full bg-[#22D3EE]" />
              )}
            </div>
            <h3 className="text-base font-bold text-white mt-0.5">Enviar Arquivo de Áudio / Vídeo</h3>
            <p className="text-xs text-[#9CA3AF] mt-1">
              MP3, WAV, FLAC, M4A, AAC, OGG ou MP4 (até 90 min)
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('youtube')}
          className={`p-5 rounded-2xl border text-left transition-all flex items-start gap-4 ${
            activeTab === 'youtube'
              ? 'bg-[#182233] border-[#22D3EE] shadow-lg shadow-[#22D3EE]/10'
              : 'bg-[#111827] border-white/[0.07] hover:bg-[#182233]/60'
          }`}
        >
          <div
            className={`p-3 rounded-xl ${
              activeTab === 'youtube'
                ? 'bg-[#22D3EE] text-[#0B0F19]'
                : 'bg-[#182233] text-[#9CA3AF]'
            }`}
          >
            <Youtube className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#22D3EE]">
                Opção B
              </span>
              {activeTab === 'youtube' && (
                <span className="w-2 h-2 rounded-full bg-[#22D3EE]" />
              )}
            </div>
            <h3 className="text-base font-bold text-white mt-0.5">Link do YouTube</h3>
            <p className="text-xs text-[#9CA3AF] mt-1">
              Validação oficial de metadados respeitando direitos autorais
            </p>
          </div>
        </button>
      </div>

      {/* Main Content Grid: Upload/Link on Left, Settings on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Option A or Option B Input */}
        <div className="lg:col-span-7 space-y-6">
          {activeTab === 'file' ? (
            <div className="p-6 rounded-2xl bg-[#182233] border border-white/[0.07] space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <FileAudio className="w-5 h-5 text-[#6366F1]" />
                  Upload de Arquivo Musical
                </h2>
                <span className="text-xs text-[#9CA3AF] font-mono">Limite: 90 min / 800 MB</span>
              </div>

              {!selectedFile ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`cursor-pointer border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
                    dragActive
                      ? 'border-[#22D3EE] bg-[#6366F1]/10'
                      : 'border-white/15 hover:border-[#6366F1] bg-[#111827]/60'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp3,.wav,.flac,.m4a,.aac,.ogg,.mp4,audio/*,video/mp4"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        validateAndSelectFile(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="w-16 h-16 rounded-2xl bg-[#6366F1]/15 border border-[#6366F1]/30 flex items-center justify-center mx-auto text-[#6366F1] mb-4">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <p className="text-base font-semibold text-white">
                    Arraste e solte seu arquivo aqui ou <span className="text-[#22D3EE] underline">selecione do computador</span>
                  </p>
                  <p className="text-xs text-[#9CA3AF] mt-2 max-w-md mx-auto">
                    Suporta CDs completos, coletâneas, medleys e shows ao vivo nos formatos MP3, WAV, FLAC, M4A, AAC, OGG e MP4.
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                    {['MP3', 'WAV', 'FLAC', 'M4A', 'AAC', 'OGG', 'MP4'].map((fmt) => (
                      <span
                        key={fmt}
                        className="px-2.5 py-1 rounded-md bg-[#182233] border border-white/10 text-[11px] font-mono text-[#9CA3AF]"
                      >
                        .{fmt.toLowerCase()}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-xl bg-[#111827] border border-[#6366F1]/40 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#22D3EE] flex items-center justify-center text-white shrink-0">
                        <FileAudio className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">
                          {selectedFile.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#9CA3AF] mt-1">
                          <span>Tamanho: <strong className="text-white">{formatFileSize(selectedFile.size)}</strong></span>
                          <span>•</span>
                          <span>
                            Duração estimada:{' '}
                            <strong className="text-[#22D3EE] font-mono">
                              {probingDuration ? 'Calculando...' : formatTime(estimatedDuration, true)}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {!isUploading && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          setEstimatedDuration(0);
                          setUploadProgress(0);
                        }}
                        className="p-1.5 rounded-lg bg-[#182233] text-[#9CA3AF] hover:text-rose-400 transition-colors"
                        title="Remover arquivo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Format Validation Status */}
                  <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      Formato validado e compatível com pipeline FFmpeg Chromaprint
                    </span>
                    <span className="font-mono uppercase">
                      {selectedFile.name.split('.').pop()}
                    </span>
                  </div>

                  {/* Upload Progress Bar & Cancel Button */}
                  {isUploading && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#22D3EE] font-medium flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Enviando arquivo para o servidor...
                        </span>
                        <span className="font-mono font-bold text-white">{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-[#182233] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#6366F1] to-[#22D3EE] transition-all duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleCancelUpload}
                          className="text-xs text-rose-400 hover:underline flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" /> Cancelar envio antes do processamento
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Demo Generator Helper for instant testing */}
              <div className="p-4 rounded-xl bg-[#111827]/70 border border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-xs text-[#9CA3AF]">
                  <strong className="text-white block">Não tem um arquivo de CD longo agora?</strong>
                  Gere e analise instantaneamente uma gravação multi-faixas de demonstração via FFmpeg.
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setIsUploading(true);
                      const res = await fetch('/api/analyses/demo-sample', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          name: analysisName || `CD ${genre} — Coletânea Completa`,
                          genre,
                          language,
                          sensitivity,
                          duration_seconds: 2400
                        })
                      });
                      const data = await res.json();
                      navigate(`/analyses/${data.analysis.id}/processing`);
                    } catch {
                      setIsUploading(false);
                    }
                  }}
                  className="shrink-0 px-3.5 py-2 rounded-lg bg-[#182233] hover:bg-[#6366F1]/20 text-[#22D3EE] border border-[#6366F1]/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Play className="w-3.5 h-3.5" /> Simular CD Completo
                </button>
              </div>
            </div>
          ) : (
            /* Option B: YouTube Link */
            <div className="p-6 rounded-2xl bg-[#182233] border border-white/[0.07] space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Youtube className="w-5 h-5 text-[#22D3EE]" />
                  Análise por Link do YouTube
                </h2>
                <span className="text-xs text-[#22D3EE] font-medium">API Oficial oEmbed</span>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-medium text-[#9CA3AF]">
                  URL do vídeo ou coletânea no YouTube
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[#111827] border border-white/10 text-sm text-white placeholder-[#9CA3AF]/50 focus:outline-none focus:border-[#22D3EE]"
                  />
                  <button
                    type="button"
                    onClick={handleValidateYoutube}
                    disabled={validatingYt}
                    className="px-5 py-2.5 rounded-xl bg-[#22D3EE] hover:bg-[#06B6D4] text-[#0B0F19] font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {validatingYt ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>Validar Link</span>
                  </button>
                </div>
              </div>

              {/* Copyright & Terms Compliance Box (Explicitly required in Section 3.2 Option B) */}
              <div className="p-4 rounded-xl bg-[#111827] border border-amber-500/25 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-[#9CA3AF] leading-relaxed space-y-1">
                  <p className="font-semibold text-amber-300">
                    Conformidade com Direitos Autorais e Termos da Plataforma
                  </p>
                  <p>
                    O FAIXORA obtém metadados exclusivamente por meios oficiais e <strong>não realiza contorno de DRM ou restrições de acesso</strong>. Quando um vídeo possuir restrição de extração direta de áudio, recomendamos enviar o arquivo de áudio correspondente na <strong>Opção A</strong> que você detenha direito de uso.
                  </p>
                </div>
              </div>

              {ytMetadata && (
                <div className="p-4 rounded-xl bg-[#111827] border border-[#22D3EE]/40 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <img
                      src={ytMetadata.thumbnailUrl}
                      alt={ytMetadata.title}
                      className="w-32 h-20 object-cover rounded-lg border border-white/10 shrink-0 bg-[#182233]"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        Metadados Validados
                      </span>
                      <h4 className="text-sm font-bold text-white mt-1 truncate">
                        {ytMetadata.title}
                      </h4>
                      <p className="text-xs text-[#9CA3AF]">Canal: {ytMetadata.authorName}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                      Duração estimada da coletânea/vídeo (minutos, máx 90 min):
                    </label>
                    <input
                      type="number"
                      min={3}
                      max={90}
                      value={ytDurationMinutes}
                      onChange={(e) =>
                        setYtDurationMinutes(Math.min(90, Math.max(1, Number(e.target.value))))
                      }
                      className="w-32 px-3 py-1.5 rounded-lg bg-[#182233] border border-white/10 text-sm font-mono text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Section 3.3 — Analysis Settings */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl bg-[#182233] border border-white/[0.07] space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#6366F1]" />
                  Configurações da Análise
                </h2>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  Contexto auxiliar para calibrar o motor de reconhecimento
                </p>
              </div>
            </div>

            {/* Custom Name */}
            <div>
              <label className="block text-xs font-semibold text-[#F9FAFB] mb-1.5">
                Nome personalizado da análise
              </label>
              <input
                type="text"
                value={analysisName}
                onChange={(e) => setAnalysisName(e.target.value)}
                placeholder="Ex: CD Forró das Antigas — Ao Vivo 2026"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#111827] border border-white/10 text-sm text-white placeholder-[#9CA3AF]/50 focus:outline-none focus:border-[#6366F1]"
              />
            </div>

            {/* Genre & Language */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#F9FAFB] mb-1.5">
                  Gênero predominante (opcional)
                </label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#111827] border border-white/10 text-sm text-white focus:outline-none focus:border-[#6366F1]"
                >
                  {SUGGESTED_GENRES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F9FAFB] mb-1.5">
                  Idioma predominante (opcional)
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#111827] border border-white/10 text-sm text-white focus:outline-none focus:border-[#6366F1]"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Recognition Sensitivity */}
            <div>
              <label className="block text-xs font-semibold text-[#F9FAFB] mb-2">
                Sensibilidade do reconhecimento
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'low', label: 'Conservadora', desc: '> 92% conf.' },
                  { id: 'normal', label: 'Equilibrada', desc: '> 85% conf.' },
                  { id: 'high', label: 'Alta Precisão', desc: 'Janelas densas' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSensitivity(opt.id as any)}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      sensitivity === opt.id
                        ? 'bg-[#6366F1]/20 border-[#6366F1] text-white'
                        : 'bg-[#111827] border-white/10 text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    <span className="block text-xs font-bold">{opt.label}</span>
                    <span className="block text-[10px] text-[#9CA3AF] mt-0.5">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle switches */}
            <div className="space-y-3 pt-1">
              <label className="flex items-start justify-between gap-3 p-3 rounded-xl bg-[#111827] border border-white/[0.06] cursor-pointer">
                <div>
                  <span className="block text-xs font-semibold text-white">
                    Identificação de músicas desconhecidas
                  </span>
                  <span className="block text-[11px] text-[#9CA3AF] mt-0.5">
                    Marcar intervalos sem correspondência como "Música não identificada" sem inventar nomes.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={detectUnknown}
                  onChange={(e) => setDetectUnknown(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-[#6366F1] rounded"
                />
              </label>

              <label className="flex items-start justify-between gap-3 p-3 rounded-xl bg-[#111827] border border-white/[0.06] cursor-pointer">
                <div>
                  <span className="block text-xs font-semibold text-white">
                    Análise detalhada dos intervalos musicais
                  </span>
                  <span className="block text-[11px] text-[#9CA3AF] mt-0.5">
                    Refinar transições entre faixas com janelas sobrepostas (overlapping windows).
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={detailedIntervals}
                  onChange={(e) => setDetailedIntervals(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-[#6366F1] rounded"
                />
              </label>
            </div>

            <div className="p-3 rounded-xl bg-[#6366F1]/10 border border-[#6366F1]/25 flex items-start gap-2.5 text-[11px] text-[#9CA3AF]">
              <Info className="w-4 h-4 text-[#22D3EE] shrink-0 mt-0.5" />
              <span>
                Essas informações servem exclusivamente como contexto auxiliar e nunca como confirmação automática de identidade musical.
              </span>
            </div>

            {/* Primary Submit Action */}
            <button
              type="button"
              disabled={isUploading}
              onClick={
                activeTab === 'file' ? handleStartFileAnalysis : handleStartYoutubeAnalysis
              }
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:from-[#5558E6] hover:to-[#4338CA] text-white font-bold text-sm shadow-xl shadow-[#6366F1]/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#22D3EE]" />
                  <span>Processando envio...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#22D3EE]" />
                  <span>Iniciar Reconhecimento Musical</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
