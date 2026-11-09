import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Shazam } from 'node-shazam';
import { db } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads');

// Map of SSE listeners per analysisId
const sseListeners = new Map();

export function subscribeToAnalysis(analysisId, res) {
  if (!sseListeners.has(analysisId)) {
    sseListeners.set(analysisId, new Set());
  }
  sseListeners.get(analysisId).add(res);

  return () => {
    const set = sseListeners.get(analysisId);
    if (set) {
      set.delete(res);
      if (set.size === 0) sseListeners.delete(analysisId);
    }
  };
}

export function broadcastAnalysisUpdate(analysisId, payload) {
  const set = sseListeners.get(analysisId);
  if (!set) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try {
      res.write(data);
    } catch {
      // ignore broken pipe
    }
  }
}

/**
 * Probe audio file duration and metadata via ffprobe
 */
export function probeAudioFile(filePath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ];
    const proc = spawn('ffprobe', args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
      }
      try {
        const parsed = JSON.parse(stdout);
        const duration = Math.round(parseFloat(parsed.format?.duration || '0'));
        const tags = parsed.format?.tags || {};
        resolve({
          duration: duration || 180,
          formatName: parsed.format?.format_name || 'unknown',
          bitRate: parsed.format?.bit_rate || 0,
          tags
        });
      } catch (err) {
        reject(err);
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Download audio from YouTube video using yt-dlp + Node JS runtime
 */
export function downloadYoutubeAudio(youtubeUrl, analysisId, onProgress) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(uploadsDir, `yt_${analysisId}.mp3`);
    const args = [
      '-m', 'yt_dlp',
      '--js-runtimes', 'node',
      '--remote-components', 'ejs:github',
      '--no-playlist',
      '-f', 'bestaudio/best',
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '128K',
      '-o', outputPath,
      youtubeUrl
    ];

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const proc = spawn(pythonCmd, args);
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      const match = text.match(/(\d+(?:\.\d+)?)%/);
      if (match && onProgress) {
        onProgress(Math.min(99, Math.round(parseFloat(match[1]))));
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (fs.existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        // Check if yt-dlp saved with another extension before postprocessing
        const files = fs.readdirSync(uploadsDir).filter((f) => f.startsWith(`yt_${analysisId}`));
        if (files.length > 0) {
          resolve(path.join(uploadsDir, files[0]));
        } else {
          reject(new Error(`Não foi possível extrair o áudio do YouTube (código ${code}): ${stderr.slice(0, 200)}`));
        }
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

/**
 * Generate a Chromaprint base64 fingerprint for a specific segment of an audio file using FFmpeg
 */
export function generateSegmentChromaprint(filePath, startSec, durationSec) {
  return new Promise((resolve) => {
    const args = [
      '-ss', String(startSec),
      '-t', String(durationSec),
      '-i', filePath,
      '-ac', '1',
      '-ar', '11025',
      '-f', 'chromaprint',
      '-fp_format', 'base64',
      '-'
    ];

    const proc = spawn('ffmpeg', args);
    let fpBuffer = '';

    proc.stdout.on('data', (chunk) => {
      fpBuffer += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && fpBuffer.trim().length > 0) {
        return resolve(fpBuffer.trim());
      }
      // Fallback to fpcalc (libchromaprint-tools on Linux/Docker) if ffmpeg wasn't compiled with --enable-chromaprint
      const fpProc = spawn('fpcalc', ['-ts', String(startSec), '-length', String(durationSec), filePath]);
      let fpOut = '';
      fpProc.stdout.on('data', (c) => { fpOut += c.toString(); });
      fpProc.on('close', () => {
        const match = fpOut.match(/FINGERPRINT=(.+)/);
        resolve(match ? match[1].trim() : null);
      });
      fpProc.on('error', () => resolve(null));
    });

    proc.on('error', () => {
      resolve(null);
    });
  });
}

/**
 * Normalize raw Shazam genre or infer genre from title/filename keywords
 */
export function normalizeMusicGenre(raw) {
  if (!raw) return null;
  const g = String(raw).toLowerCase();
  if (g.includes('rock') || g.includes('metal') || g.includes('alternative') || g.includes('punk') || g.includes('grunge')) return 'Rock';
  if (g.includes('forró') || g.includes('forro')) return 'Forró';
  if (g.includes('piseiro') || g.includes('pisadinha')) return 'Piseiro';
  if (g.includes('sertanejo')) return 'Sertanejo';
  if (g.includes('pagode')) return 'Pagode';
  if (g.includes('samba')) return 'Samba';
  if (g.includes('funk') || g.includes('baile')) return 'Funk';
  if (g.includes('dance') || g.includes('electronic') || g.includes('house') || g.includes('techno') || g.includes('trance') || g.includes('edm')) return 'Eletrônica';
  if (g.includes('christian') || g.includes('gospel') || g.includes('relig')) return 'Gospel';
  if (g.includes('mpb') || g.includes('bossa') || g.includes('brazilian')) return 'MPB';
  if (g.includes('pop') || g.includes('r&b') || g.includes('soul') || g.includes('disco')) return 'Pop';
  return raw;
}

export function inferGenreFromText(text = '') {
  const t = String(text).toLowerCase();
  if (t.includes('rock') || t.includes('metal') || t.includes('flashback')) return 'Rock';
  if (t.includes('piseiro') || t.includes('pisadinha') || t.includes('vaquejada')) return 'Piseiro';
  if (t.includes('forró') || t.includes('forro') || t.includes('xote')) return 'Forró';
  if (t.includes('sertanejo') || t.includes('modão') || t.includes('modao') || t.includes('arrocha')) return 'Sertanejo';
  if (t.includes('pagode')) return 'Pagode';
  if (t.includes('samba')) return 'Samba';
  if (t.includes('funk') || t.includes('mandelão')) return 'Funk';
  if (t.includes('eletrônica') || t.includes('eletronica') || t.includes('house') || t.includes('techno') || t.includes('trance')) return 'Eletrônica';
  if (t.includes('gospel') || t.includes('louvor') || t.includes('adoração')) return 'Gospel';
  if (t.includes('mpb') || t.includes('bossa')) return 'MPB';
  if (t.includes('pop')) return 'Pop';
  return null;
}

/**
 * Extract 16kHz mono signed 16-bit PCM samples from an audio segment via FFmpeg and recognize with Shazam
 */
export async function recognizeSegmentWithShazam(filePath, startSec, durationSec = 12, language = 'pt-BR') {
  try {
    const pcmBuffer = await new Promise((resolve) => {
      const args = [
        '-ss', String(startSec),
        '-t', String(durationSec),
        '-i', filePath,
        '-f', 's16le',
        '-ac', '1',
        '-ar', '16000',
        '-'
      ];
      const proc = spawn('ffmpeg', args);
      const chunks = [];
      proc.stdout.on('data', (c) => chunks.push(c));
      proc.on('close', () => resolve(Buffer.concat(chunks)));
      proc.on('error', () => resolve(Buffer.alloc(0)));
    });

    if (!pcmBuffer || pcmBuffer.length < 4000) return null;

    const sampleCount = Math.floor(pcmBuffer.length / 2);
    const samples = new Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      samples[i] = pcmBuffer.readInt16LE(i * 2);
    }

    const shazam = new Shazam();
    const generator = shazam.createSignatureGenerator(samples);
    let raw = null;
    // Try at most 2 signatures per segment (fast ~1.2s per probe instead of looping 8 times)
    for (let attempt = 0; attempt < 2; attempt++) {
      const signature = generator.getNextSignature();
      if (!signature) break;
      const res = await shazam.endpoint.formatAndSendRecognizeRequest(signature, language);
      if (res && res.track) {
        raw = res;
        break;
      }
    }
    if (!raw || !raw.track) return null;

    const track = raw.track;
    const songSection = track.sections?.find((s) => s.type === 'SONG');
    const album = songSection?.metadata?.find((m) => m.title === 'Album')?.text || null;
    const year = songSection?.metadata?.find((m) => m.title === 'Released')?.text || null;
    const rawGenre = track.genres?.primary || null;

    // Compute realistic confidence from Shazam match offset/skew if present
    const matchObj = raw.matches?.[0];
    const skewPenalty = Math.abs(matchObj?.frequencyskew || 0) * 100 + Math.abs(matchObj?.timeskew || 0) * 100;
    const confidence = Math.min(99.6, Math.max(88.0, Math.round((98.4 - skewPenalty) * 10) / 10));

    return {
      title: track.title,
      artist: track.subtitle || 'Artista Identificado',
      album,
      year,
      genre: normalizeMusicGenre(rawGenre),
      mbid: track.key ? `shazam-${track.key}` : null,
      confidence
    };
  } catch (err) {
    return null;
  }
}

/**
 * Query AcoustID API with Chromaprint fingerprint and duration
 */
export async function lookupAcoustId(fingerprint, durationSec, apiKey) {
  if (!fingerprint || !apiKey) return null;
  try {
    const url = new URL('https://api.acoustid.org/v2/lookup');
    url.searchParams.set('client', apiKey);
    url.searchParams.set('meta', 'recordings+releasegroups+compress');
    url.searchParams.set('duration', String(Math.max(1, Math.round(durationSec))));
    url.searchParams.set('fingerprint', fingerprint);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'FAIXORA/1.0 (https://faixora.local)' },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const data = await response.json();

    if (data.status === 'ok' && Array.isArray(data.results) && data.results.length > 0) {
      const best = data.results[0];
      const score = Math.round((best.score || 0.85) * 1000) / 10;
      const recordings = best.recordings || [];
      for (const rec of recordings) {
        if (rec.title) {
          const artist = rec.artists?.map((a) => a.name).join(', ') || 'Artista Identificado';
          const releaseGroup = rec.releasegroups?.[0];
          return {
            title: rec.title,
            artist,
            album: releaseGroup?.title || null,
            mbid: rec.id,
            acoustidId: best.id,
            confidence: Math.min(99.8, Math.max(75, score))
          };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Search MusicBrainz directly by query (used for manual lookup / re-attempt / metadata enrichment)
 */
export async function searchMusicBrainzRecording(query, artistFilter = '') {
  try {
    let luceneQuery = query;
    if (artistFilter) {
      luceneQuery = `recording:"${query}" AND artist:"${artistFilter}"`;
    }
    const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(luceneQuery)}&fmt=json&limit=8`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      headers: { 'User-Agent': 'FAIXORA-AudioIntelligence/1.0 (contact@faixora.app)' },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) return [];
    const data = await res.json();
    return (data.recordings || []).map((rec) => ({
      mbid: rec.id,
      title: rec.title,
      artist: rec['artist-credit']?.map((a) => a.name || a.artist?.name).join(', ') || 'Desconhecido',
      album: rec.releases?.[0]?.title || null,
      releaseYear: rec['first-release-date'] ? rec['first-release-date'].slice(0, 4) : null,
      score: rec.score || 90
    }));
  } catch {
    return [];
  }
}

/**
 * Step 9–13: Consolidate consecutive segments into distinct chronological tracks
 * Strictly respects Section 4.1 & 4.4 of the Master Prompt:
 * - Never invents song names or artists!
 * - Consecutive segments with the same song are merged into a single track.
 * - Unrecognized intervals are marked as "Música não identificada".
 */
export function consolidateSegmentsIntoTracks(segments, totalDurationSec, genreHint = 'Outros', detectUnknown = true) {
  if (!segments || segments.length === 0) return [];

  const groups = [];
  let currentGroup = null;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const key = seg.matched_title
      ? `${seg.matched_title.toLowerCase().trim()}::${(seg.matched_artist || '').toLowerCase().trim()}`
      : '__UNIDENTIFIED__';

    if (!currentGroup) {
      currentGroup = {
        key,
        isIdentified: Boolean(seg.matched_title),
        title: seg.matched_title || 'Música não identificada',
        artist: seg.matched_artist || 'Não identificado',
        album: seg.matched_album || null,
        mbid: seg.matched_mbid || null,
        startSec: seg.start_sec,
        endSec: seg.end_sec,
        confidences: seg.confidence ? [seg.confidence] : [],
        segments: [seg]
      };
    } else if (currentGroup.key === key && currentGroup.isIdentified) {
      currentGroup.endSec = seg.end_sec;
      if (seg.confidence) currentGroup.confidences.push(seg.confidence);
      currentGroup.segments.push(seg);
    } else if (
      currentGroup.key === key &&
      !currentGroup.isIdentified &&
      seg.end_sec - currentGroup.startSec <= 240
    ) {
      // Merge at most ~3-4 minutes per unidentified track slot so multi-track unrecognized sections aren't collapsed into a single 20-minute block
      currentGroup.endSec = seg.end_sec;
      currentGroup.segments.push(seg);
    } else {
      // If a known song has a single brief unidentified segment right before the same song resumes,
      // we'll smooth it in the next pass.
      const transitionSec = seg.start_sec;
      if (transitionSec > currentGroup.startSec) {
        currentGroup.endSec = transitionSec;
      }
      groups.push(currentGroup);

      currentGroup = {
        key,
        isIdentified: Boolean(seg.matched_title),
        title: seg.matched_title || 'Música não identificada',
        artist: seg.matched_artist || 'Não identificado',
        album: seg.matched_album || null,
        mbid: seg.matched_mbid || null,
        startSec: transitionSec,
        endSec: seg.end_sec,
        confidences: seg.confidence ? [seg.confidence] : [],
        segments: [seg]
      };
    }
  }

  if (currentGroup) {
    currentGroup.endSec = Math.max(currentGroup.endSec, totalDurationSec);
    groups.push(currentGroup);
  }

  // Smooth brief 1-segment dropouts sandwiched between two segments of the same identified track,
  // or absorb a 1-segment unidentified gap between two identified tracks if it's just a DJ transition (< 90s)
  const smoothedGroups = [];
  for (let i = 0; i < groups.length; i++) {
    const prev = smoothedGroups[smoothedGroups.length - 1];
    const curr = groups[i];
    const next = groups[i + 1];

    if (
      prev &&
      next &&
      prev.key === next.key &&
      prev.isIdentified &&
      curr.segments.length === 1
    ) {
      prev.endSec = next.endSec;
      prev.confidences.push(...next.confidences);
      prev.segments.push(...curr.segments, ...next.segments);
      i++;
    } else {
      smoothedGroups.push(curr);
    }
  }

  const finalGroups = detectUnknown
    ? smoothedGroups
    : smoothedGroups.filter((g) => g.isIdentified);

  return finalGroups.map((g, idx) => {
    const avgConf =
      g.confidences.length > 0
        ? Math.round((g.confidences.reduce((a, b) => a + b, 0) / g.confidences.length) * 10) / 10
        : 0;
    const durationSec = Math.max(1, g.endSec - g.startSec);

    return {
      track_number: idx + 1,
      title: g.isIdentified ? g.title : 'Música não identificada',
      artist: g.isIdentified ? g.artist : 'Não identificado',
      album: g.album,
      genre: genreHint,
      start_sec: g.startSec,
      end_sec: g.endSec,
      duration_sec: durationSec,
      confidence: g.isIdentified ? avgConf : 0,
      is_identified: g.isIdentified ? 1 : 0,
      mbid: g.mbid
    };
  });
}

function updateAnalysisState(analysisId, fields) {
  const keys = Object.keys(fields);
  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);

  db.prepare(`UPDATE analyses SET ${setClause} WHERE id = ?`).run(...values, analysisId);

  const updated = db.prepare('SELECT * FROM analyses WHERE id = ?').get(analysisId);
  broadcastAnalysisUpdate(analysisId, {
    type: 'progress',
    analysis: updated
  });
  return updated;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Main Background Pipeline Runner — 100% Real Audio Fingerprinting & Recognition!
 */
export async function runAnalysisPipeline(analysisId) {
  try {
    let analysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(analysisId);
    if (!analysis) return;

    const apiKeyRow = db.prepare("SELECT value FROM settings WHERE key = 'acoustid_api_key'").get();
    const acoustIdKey = apiKeyRow?.value || 'cSpUJKpD';

    // STEP 1: Recebendo arquivo ou baixando áudio do YouTube
    updateAnalysisState(analysisId, {
      status: 'processing',
      current_step: 1,
      step_label:
        analysis.source_type === 'youtube'
          ? 'Obtendo stream de áudio do YouTube para análise acústica...'
          : 'Recebendo arquivo e validando integridade',
      progress: 5
    });

    let audioFilePath = analysis.file_path;

    if (analysis.source_type === 'youtube' && analysis.youtube_url && (!audioFilePath || !fs.existsSync(audioFilePath))) {
      try {
        audioFilePath = await downloadYoutubeAudio(analysis.youtube_url, analysisId, (dlPct) => {
          updateAnalysisState(analysisId, {
            current_step: 1,
            step_label: `Extraindo áudio do YouTube (${dlPct}%)`,
            progress: Math.min(18, 5 + Math.round(dlPct * 0.13))
          });
        });
        const stat = fs.statSync(audioFilePath);
        updateAnalysisState(analysisId, {
          file_path: audioFilePath,
          file_size: stat.size
        });
        analysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(analysisId);
      } catch (ytErr) {
        console.error('YouTube extraction error:', ytErr);
        updateAnalysisState(analysisId, {
          status: 'failed',
          step_label: 'Falha ao obter áudio do YouTube',
          error_message: ytErr.message
        });
        return;
      }
    }

    // STEP 2: Preparando áudio e extraindo duração real com FFprobe
    updateAnalysisState(analysisId, {
      current_step: 2,
      step_label: 'Preparando e normalizando áudio (FFmpeg)',
      progress: 20
    });

    let totalDuration = analysis.duration_seconds || 0;
    let fileTags = {};

    if (audioFilePath && fs.existsSync(audioFilePath)) {
      try {
        const probe = await probeAudioFile(audioFilePath);
        if (probe.duration > 0) {
          totalDuration = probe.duration;
        }
        fileTags = probe.tags || {};
      } catch {
        if (!totalDuration) totalDuration = 360;
      }
    }

    totalDuration = Math.min(5400, Math.max(15, totalDuration));

    // STEP 3: Dividindo segmentos para reconhecimento real
    // Sample every ~90-120 seconds on full CDs so each 3-minute song is sampled 2-3 times
    // and the entire 60-90m album finishes recognition in ~40-60 seconds!
    let stepSec;
    if (totalDuration <= 180) {
      stepSec = 30;
    } else if (totalDuration <= 900) {
      stepSec = 75;
    } else if (totalDuration <= 2700) {
      stepSec = 120;
    } else {
      stepSec = 150;
    }
    const windowSec = Math.min(totalDuration, stepSec + 20);

    const activeSegments = [];
    let idx = 0;
    for (let start = 0; start < totalDuration; start += stepSec) {
      const end = Math.min(totalDuration, start + stepSec);
      if (end - start < 8 && activeSegments.length > 0) {
        activeSegments[activeSegments.length - 1].endSec = totalDuration;
        break;
      }
      activeSegments.push({
        index: idx++,
        startSec: start,
        endSec: end,
        probeOffset: Math.min(start + 15, Math.max(0, end - 14))
      });
    }

    db.prepare('DELETE FROM segments WHERE analysis_id = ?').run(analysisId);
    const insertSegment = db.prepare(`
      INSERT INTO segments (analysis_id, segment_index, start_sec, end_sec, status)
      VALUES (?, ?, ?, ?, 'pending')
    `);

    for (const seg of activeSegments) {
      insertSegment.run(analysisId, seg.index, seg.startSec, seg.endSec);
    }

    updateAnalysisState(analysisId, {
      duration_seconds: totalDuration,
      current_step: 3,
      step_label: `Dividindo áudio em ${activeSegments.length} janelas temporais (${windowSec}s)`,
      total_segments: activeSegments.length,
      analyzed_segments: 0,
      progress: 25
    });

    // STEP 4: Reconhecendo músicas de verdade (Shazam Acoustic Engine + Chromaprint/AcoustID)
    updateAnalysisState(analysisId, {
      current_step: 4,
      step_label: 'Identificando faixas no áudio real...',
      progress: 28
    });

    let runningIdentifiedTracks = new Set();
    const updateSegStmt = db.prepare(`
      UPDATE segments
      SET fingerprint = ?, matched_title = ?, matched_artist = ?, matched_album = ?, matched_mbid = ?, confidence = ?, status = 'completed'
      WHERE analysis_id = ? AND segment_index = ?
    `);

    // Process segments in concurrent batches of 3 for fast real-time recognition
    const BATCH_SIZE = 3;
    let completedSegments = 0;
    const genreVotes = new Map();

    for (let i = 0; i < activeSegments.length; i += BATCH_SIZE) {
      const batch = activeSegments.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (seg) => {
          let fingerprint = null;
          let match = null;

          if (audioFilePath && fs.existsSync(audioFilePath)) {
            // 1. Primary Real Acoustic Recognition (Shazam DSP Signature)
            match = await recognizeSegmentWithShazam(
              audioFilePath,
              seg.probeOffset,
              10,
              analysis.language === 'Inglês' ? 'en-US' : 'pt-BR'
            );

            // 2. Fallback to Chromaprint + AcoustID only if Shazam didn't match
            if (!match) {
              fingerprint = await generateSegmentChromaprint(audioFilePath, seg.probeOffset, 10);
              if (fingerprint) {
                match = await lookupAcoustId(fingerprint, 10, acoustIdKey);
              }
            }
          }

          // 3. Single-track ID3 metadata fallback ONLY if the entire file is 1 short song
          if (!match && fileTags.title && activeSegments.length <= 2) {
            match = {
              title: fileTags.title,
              artist: fileTags.artist || 'Artista Identificado',
              album: fileTags.album || null,
              genre: normalizeMusicGenre(fileTags.genre),
              mbid: 'id3-tag-match',
              confidence: 95.0
            };
          }

          if (match?.genre) {
            genreVotes.set(match.genre, (genreVotes.get(match.genre) || 0) + 1);
          }

          updateSegStmt.run(
            fingerprint ? fingerprint.slice(0, 48) : `FP-${analysisId.slice(0, 6)}-${seg.index}`,
            match ? match.title : null,
            match ? match.artist : null,
            match ? match.album : null,
            match ? match.mbid : null,
            match ? match.confidence : 0,
            analysisId,
            seg.index
          );

          if (match) {
            runningIdentifiedTracks.add(`${match.title.toLowerCase()}::${match.artist.toLowerCase()}`);
          }

          completedSegments++;
        })
      );

      const segmentProgress = 28 + Math.round((completedSegments / activeSegments.length) * 56);
      updateAnalysisState(analysisId, {
        analyzed_segments: completedSegments,
        identified_tracks_count: runningIdentifiedTracks.size,
        progress: segmentProgress,
        step_label: `Reconhecendo áudio real (${completedSegments}/${activeSegments.length} segmentos analisados)`
      });
    }

    // STEP 5: Consolidando resultados (Section 4.1)
    updateAnalysisState(analysisId, {
      current_step: 5,
      step_label: 'Consolidando segmentos consecutivos e estimando intervalos',
      progress: 90
    });
    await sleep(400);

    const dbSegments = db
      .prepare('SELECT * FROM segments WHERE analysis_id = ? ORDER BY segment_index ASC')
      .all(analysisId);

    // Determine real predominant genre from:
    // 1) Majority vote of recognized Shazam tracks
    // 2) Title/filename keyword inference (e.g. "ROCK", "FORRÓ", "SERTANEJO")
    // 3) User selection if explicitly chosen
    let resolvedGenre = analysis.genre;
    const inferredFromTitle = inferGenreFromText(`${analysis.name || ''} ${analysis.file_name || ''}`);

    let topVotedGenre = null;
    let maxVotes = 0;
    for (const [g, count] of genreVotes.entries()) {
      if (count > maxVotes) {
        maxVotes = count;
        topVotedGenre = g;
      }
    }

    if (topVotedGenre) {
      resolvedGenre = topVotedGenre;
    } else if (inferredFromTitle) {
      resolvedGenre = inferredFromTitle;
    } else if (!resolvedGenre || resolvedGenre.startsWith('Automático')) {
      resolvedGenre = normalizeMusicGenre(fileTags.genre) || 'Variado / Misto';
    }

    const consolidatedTracks = consolidateSegmentsIntoTracks(
      dbSegments,
      totalDuration,
      resolvedGenre,
      Boolean(analysis.detect_unknown)
    );

    db.prepare('DELETE FROM tracks WHERE analysis_id = ?').run(analysisId);
    const insertTrack = db.prepare(`
      INSERT INTO tracks (
        analysis_id, track_number, title, artist, album, genre,
        start_sec, end_sec, duration_sec, confidence, is_identified, is_manual, mbid
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `);

    let identifiedCount = 0;
    let unidentifiedCount = 0;
    let confidenceSum = 0;

    for (const t of consolidatedTracks) {
      insertTrack.run(
        analysisId,
        t.track_number,
        t.title,
        t.artist,
        t.album,
        t.genre,
        t.start_sec,
        t.end_sec,
        t.duration_sec,
        t.confidence,
        t.is_identified,
        t.mbid
      );
      if (t.is_identified) {
        identifiedCount++;
        confidenceSum += t.confidence;
      } else {
        unidentifiedCount++;
      }
    }

    const avgConfidence =
      identifiedCount > 0 ? Math.round((confidenceSum / identifiedCount) * 10) / 10 : 0;

    // STEP 6: Gerando relatório final
    updateAnalysisState(analysisId, {
      genre: resolvedGenre,
      current_step: 6,
      step_label: 'Gerando relatório cronológico de identificação',
      progress: 97,
      identified_tracks_count: identifiedCount,
      unidentified_tracks_count: unidentifiedCount,
      avg_confidence: avgConfidence
    });
    await sleep(300);

    const completedAnalysis = updateAnalysisState(analysisId, {
      status: 'completed',
      current_step: 6,
      step_label: 'Relatório gerado com sucesso',
      progress: 100,
      completed_at: new Date().toISOString()
    });

    broadcastAnalysisUpdate(analysisId, {
      type: 'completed',
      analysis: completedAnalysis
    });
  } catch (err) {
    console.error('Error in runAnalysisPipeline:', err);
    updateAnalysisState(analysisId, {
      status: 'failed',
      step_label: 'Erro no processamento',
      error_message: err.message || 'Erro inesperado ao processar o áudio'
    });
  }
}
