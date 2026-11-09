import React, { useEffect, useState } from 'react';
import {
  Settings,
  Key,
  Clock,
  Sliders,
  CheckCircle2,
  Save,
  AudioWaveform,
  ExternalLink
} from 'lucide-react';
import { useToast } from '../components/ToastContext';

export const SettingsView: React.FC = () => {
  const [acoustidKey, setAcoustidKey] = useState('cSpUJKpD');
  const [maxDuration, setMaxDuration] = useState('90');
  const [maxFileSize, setMaxFileSize] = useState('500');
  const [windowSec, setWindowSec] = useState('20');
  const [stepSec, setStepSec] = useState('10');
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.acoustid_api_key) setAcoustidKey(data.acoustid_api_key);
        if (data.max_duration_minutes) setMaxDuration(data.max_duration_minutes);
        if (data.max_file_size_mb) setMaxFileSize(data.max_file_size_mb);
        if (data.segment_window_sec) setWindowSec(data.segment_window_sec);
        if (data.segment_step_sec) setStepSec(data.segment_step_sec);
      })
      .catch(console.error);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acoustid_api_key: acoustidKey,
          max_duration_minutes: maxDuration,
          max_file_size_mb: maxFileSize,
          segment_window_sec: windowSec,
          segment_step_sec: stepSec
        })
      });
      if (!res.ok) throw new Error('Falha ao salvar configurações');
      toast(
        'Configurações atualizadas',
        'Os parâmetros do motor acústico e limites operacionais foram salvos.',
        'success'
      );
    } catch (err: any) {
      toast('Erro ao salvar', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-[#6366F1]" />
          Configurações & Integrações
        </h1>
        <p className="text-sm text-[#9CA3AF] mt-1">
          Configure as credenciais do AcoustID / MusicBrainz, limites de upload e parâmetros de janelas de reconhecimento.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* AcoustID & Chromaprint Integration */}
        <div className="p-6 rounded-2xl bg-[#182233] border border-white/[0.07] space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#6366F1]/15 text-[#6366F1]">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  Provedor de Reconhecimento Musical (AcoustID + MusicBrainz)
                </h2>
                <p className="text-xs text-[#9CA3AF]">
                  Fingerprinting acústico via FFmpeg Chromaprint nativo
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">
              AcoustID Client API Key
            </label>
            <input
              type="text"
              value={acoustidKey}
              onChange={(e) => setAcoustidKey(e.target.value)}
              placeholder="Insira sua chave de cliente AcoustID"
              className="w-full px-4 py-2.5 rounded-xl bg-[#111827] border border-white/10 text-sm font-mono text-white focus:outline-none focus:border-[#6366F1]"
            />
            <p className="text-xs text-[#9CA3AF] mt-2 flex items-center justify-between">
              <span>
                Utilizada para consultar fingerprints gerados por <code className="text-[#22D3EE]">ffmpeg -f chromaprint</code>.
              </span>
              <a
                href="https://acoustid.org/api-key"
                target="_blank"
                rel="noreferrer"
                className="text-[#22D3EE] hover:underline inline-flex items-center gap-1"
              >
                Obter chave gratuita <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        </div>

        {/* Limits & Sliding Window Parameters */}
        <div className="p-6 rounded-2xl bg-[#182233] border border-white/[0.07] space-y-5">
          <div className="flex items-center gap-3 border-b border-white/[0.06] pb-4">
            <div className="p-2.5 rounded-xl bg-[#22D3EE]/15 text-[#22D3EE]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Limites Operacionais e Janelas Deslizantes
              </h2>
              <p className="text-xs text-[#9CA3AF]">
                Configuração de duração máxima e sobreposição temporal (Seção 3.2 e 4.1)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#6366F1]" />
                Duração máxima permitida (minutos)
              </label>
              <input
                type="number"
                value={maxDuration}
                onChange={(e) => setMaxDuration(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#111827] border border-white/10 text-sm font-mono text-white"
              />
              <span className="text-[11px] text-[#9CA3AF] mt-1 block">
                Padrão recomendado: 90 minutos (1h30)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1.5">
                Tamanho máximo de arquivo (MB)
              </label>
              <input
                type="number"
                value={maxFileSize}
                onChange={(e) => setMaxFileSize(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#111827] border border-white/10 text-sm font-mono text-white"
              />
              <span className="text-[11px] text-[#9CA3AF] mt-1 block">
                Suporta arquivos FLAC/WAV sem compressão
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1.5 flex items-center gap-1.5">
                <AudioWaveform className="w-3.5 h-3.5 text-[#22D3EE]" />
                Tamanho da janela de reconhecimento (seg)
              </label>
              <input
                type="number"
                value={windowSec}
                onChange={(e) => setWindowSec(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#111827] border border-white/10 text-sm font-mono text-white"
              />
              <span className="text-[11px] text-[#9CA3AF] mt-1 block">
                Exemplo da especificação: 20 segundos
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1.5">
                Passo de avanço / sobreposição (seg)
              </label>
              <input
                type="number"
                value={stepSec}
                onChange={(e) => setStepSec(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#111827] border border-white/10 text-sm font-mono text-white"
              />
              <span className="text-[11px] text-[#9CA3AF] mt-1 block">
                Exemplo da especificação: avanço a cada 10s (sobreposição de 50%)
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:from-[#5558E6] hover:to-[#4338CA] text-white font-bold text-sm shadow-xl shadow-[#6366F1]/25 flex items-center gap-2"
          >
            <Save className="w-4 h-4 text-[#22D3EE]" />
            <span>{saving ? 'Salvando...' : 'Salvar Configurações'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
