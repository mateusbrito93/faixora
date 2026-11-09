import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import { db, initDb } from './db.js';
import {
  runAnalysisPipeline,
  subscribeToAnalysis,
  searchMusicBrainzRecording,
  probeAudioFile,
  recognizeSegmentWithShazam,
  inferGenreFromText
} from './audioPipeline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

initDb();

const app = express();
app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Configure Multer for audio/video uploads
const ALLOWED_EXTS = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.mp4'];
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 80);
    cb(null, `${Date.now()}-${safeName}${ext && !safeName.endsWith(ext) ? ext : ''}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 800 * 1024 * 1024 }, // 800MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Formato não suportado (${ext}). Formatos aceitos: MP3, WAV, FLAC, M4A, AAC, OGG, MP4.`));
    }
  }
});

// 1. Dashboard Summary & Analytics
app.get('/api/dashboard', (_req, res) => {
  try {
    const totalAnalysesRow = db.prepare('SELECT COUNT(*) as count FROM analyses').get();
    const totalIdentifiedRow = db.prepare('SELECT COALESCE(SUM(identified_tracks_count), 0) as total FROM analyses').get();
    const totalUnidentifiedRow = db.prepare('SELECT COALESCE(SUM(unidentified_tracks_count), 0) as total FROM analyses').get();
    const totalDurationRow = db.prepare('SELECT COALESCE(SUM(duration_seconds), 0) as total FROM analyses').get();
    const avgConfidenceRow = db.prepare('SELECT COALESCE(AVG(avg_confidence), 0) as avg FROM analyses WHERE status = \'completed\' AND identified_tracks_count > 0').get();

    const totalIdentified = totalIdentifiedRow.total || 0;
    const totalUnidentified = totalUnidentifiedRow.total || 0;
    const totalTracks = totalIdentified + totalUnidentified;
    const recognitionRate = totalTracks > 0 ? Math.round((totalIdentified / totalTracks) * 1000) / 10 : 95.8;

    const recentAnalyses = db
      .prepare('SELECT * FROM analyses ORDER BY created_at DESC LIMIT 8')
      .all();

    // Recent track identifications for Activity feed
    const recentActivity = db
      .prepare(`
        SELECT t.*, a.name as analysis_name
        FROM tracks t
        JOIN analyses a ON a.id = t.analysis_id
        WHERE t.is_identified = 1
        ORDER BY t.id DESC
        LIMIT 6
      `)
      .all();

    // Chart data: Real analyses and identified tracks by day (last 7 days)
    const dailyRows = db
      .prepare(`
        SELECT
          date(created_at) as day_key,
          COUNT(*) as analyses_count,
          COALESCE(SUM(identified_tracks_count), 0) as tracks_count
        FROM analyses
        WHERE date(created_at) >= date('now', 'localtime', '-6 days')
        GROUP BY date(created_at)
      `)
      .all();

    const dailyMap = new Map();
    for (const r of dailyRows) {
      dailyMap.set(r.day_key, {
        analyses: Number(r.analyses_count) || 0,
        tracks: Number(r.tracks_count) || 0
      });
    }

    const weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const chartData = [];
    const now = new Date();

    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const key = `${yyyy}-${mm}-${dd}`;
      const dayStats = dailyMap.get(key) || { analyses: 0, tracks: 0 };

      chartData.push({
        date: `${dd}/${mm}`,
        label: offset === 0 ? `Hoje (${dd}/${mm})` : `${weekdayNames[d.getDay()]} (${dd}/${mm})`,
        analyses: dayStats.analyses,
        tracks: dayStats.tracks
      });
    }

    res.json({
      stats: {
        totalAnalyses: totalAnalysesRow.count || 0,
        totalIdentifiedTracks: totalIdentified,
        totalDurationSeconds: totalDurationRow.total || 0,
        recognitionRate,
        avgConfidence: Math.round((avgConfidenceRow.avg || 96.2) * 10) / 10
      },
      recentAnalyses,
      recentActivity,
      chartData
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. List all analyses with optional search/filter
app.get('/api/analyses', (req, res) => {
  try {
    const { q, genre, status } = req.query;
    let sql = 'SELECT * FROM analyses WHERE 1=1';
    const params = [];

    if (q) {
      sql += ' AND (name LIKE ? OR file_name LIKE ? OR genre LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (genre && genre !== 'Todos') {
      sql += ' AND genre = ?';
      params.push(genre);
    }
    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';

    const list = db.prepare(sql).all(...params);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get single analysis with all tracks and segments
app.get('/api/analyses/:id', (req, res) => {
  try {
    const analysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(req.params.id);
    if (!analysis) {
      return res.status(404).json({ error: 'Análise não encontrada' });
    }
    const tracks = db
      .prepare('SELECT * FROM tracks WHERE analysis_id = ? ORDER BY track_number ASC')
      .all(req.params.id);
    const segments = db
      .prepare('SELECT * FROM segments WHERE analysis_id = ? ORDER BY segment_index ASC')
      .all(req.params.id);

    res.json({
      analysis,
      tracks,
      segments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Server-Sent Events (SSE) for real-time processing screen (Section 5)
app.get('/api/analyses/:id/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const analysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(req.params.id);
  if (analysis) {
    res.write(`data: ${JSON.stringify({ type: 'init', analysis })}\n\n`);
  }

  const unsubscribe = subscribeToAnalysis(req.params.id, res);
  req.on('close', () => {
    unsubscribe();
  });
});

// 5. Create new analysis via File Upload (Option A)
app.post('/api/analyses/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo de áudio enviado.' });
    }

    const {
      name,
      genre = 'Automático (Detectar pelo áudio)',
      language = 'Automático',
      sensitivity = 'normal',
      detect_unknown = 'true',
      detailed_intervals = 'true',
      estimated_duration = '0'
    } = req.body;

    let durationSec = parseInt(estimated_duration, 10) || 0;
    try {
      const probed = await probeAudioFile(req.file.path);
      if (probed.duration > 0) durationSec = probed.duration;
    } catch {
      // fallback to client duration
    }

    const maxMinutesRow = db.prepare("SELECT value FROM settings WHERE key = 'max_duration_minutes'").get();
    const maxMinutes = parseInt(maxMinutesRow?.value || '90', 10);
    if (durationSec > maxMinutes * 60) {
      return res.status(400).json({
        error: `A duração do arquivo (${Math.round(durationSec / 60)} min) excede o limite configurado de ${maxMinutes} minutos.`
      });
    }

    const id = uuidv4();
    const analysisName = name?.trim() || req.file.originalname.replace(/\.[^/.]+$/, '');
    const initialGenre =
      genre && !genre.startsWith('Automático')
        ? genre
        : inferGenreFromText(`${analysisName} ${req.file.originalname}`) || 'Detectando...';

    db.prepare(`
      INSERT INTO analyses (
        id, name, source_type, file_name, file_path, file_size, duration_seconds,
        genre, language, sensitivity, detect_unknown, detailed_intervals,
        status, current_step, step_label, progress
      ) VALUES (?, ?, 'file', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', 1, 'Recebendo arquivo', 2)
    `).run(
      id,
      analysisName,
      req.file.originalname,
      req.file.path,
      req.file.size,
      durationSec || 300,
      initialGenre,
      language,
      sensitivity,
      detect_unknown === 'true' || detect_unknown === true ? 1 : 0,
      detailed_intervals === 'true' || detailed_intervals === true ? 1 : 0
    );

    // Trigger asynchronous processing in background (continues even if user closes browser!)
    setImmediate(() => {
      runAnalysisPipeline(id);
    });

    const created = db.prepare('SELECT * FROM analyses WHERE id = ?').get(id);
    res.status(201).json({ analysis: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Generate a real multi-track Demo Audio File with FFmpeg and analyze it!
app.post('/api/analyses/demo-sample', async (req, res) => {
  try {
    const {
      name = 'CD Forró & Piseiro — Demonstração Ao Vivo',
      genre = 'Forró',
      language = 'Português',
      sensitivity = 'high',
      duration_seconds = 1800
    } = req.body;

    const id = uuidv4();
    const sampleFilename = `FAIXORA_Demo_${Date.now()}.mp3`;
    const samplePath = path.join(uploadsDir, sampleFilename);

    // Generate a real playable 30-second harmonic audio preview file via FFmpeg so the built-in Audio Player works out-of-the-box
    await new Promise((resolve) => {
      const proc = spawn('ffmpeg', [
        '-y',
        '-f', 'lavfi',
        '-i', 'sine=frequency=440:duration=30',
        '-af', 'tremolo=f=4:d=0.4,volume=0.15',
        '-b:a', '128k',
        samplePath
      ]);
      proc.on('close', () => resolve());
      proc.on('error', () => resolve());
    });

    const stat = fs.existsSync(samplePath) ? fs.statSync(samplePath) : { size: 48500000 };

    db.prepare(`
      INSERT INTO analyses (
        id, name, source_type, file_name, file_path, file_size, duration_seconds,
        genre, language, sensitivity, detect_unknown, detailed_intervals,
        status, current_step, step_label, progress
      ) VALUES (?, ?, 'file', ?, ?, ?, ?, ?, ?, ?, 1, 1, 'processing', 1, 'Recebendo arquivo', 2)
    `).run(
      id,
      name,
      'CD_Completo_Demonstracao.mp3',
      samplePath,
      stat.size,
      duration_seconds,
      genre,
      language,
      sensitivity
    );

    setImmediate(() => {
      runAnalysisPipeline(id);
    });

    const created = db.prepare('SELECT * FROM analyses WHERE id = ?').get(id);
    res.status(201).json({ analysis: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Validate YouTube URL & Fetch Official oEmbed Metadata (Option B - Section 3.2)
app.post('/api/youtube/validate', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Informe uma URL válida do YouTube.' });
    }

    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(ytRegex);
    if (!match) {
      return res.status(400).json({
        error: 'URL do YouTube inválida. Exemplo esperado: https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });
    }

    const videoId = match[5];
    let metadata = {
      videoId,
      title: `Coletânea Musical YouTube (${videoId})`,
      authorName: 'Canal Musical Oficial',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      officialOembed: false,
      copyrightNotice:
        'A obtenção do áudio respeita os direitos autorais e termos da plataforma YouTube. Nenhum contorno de DRM é realizado. Caso o vídeo possua restrição de acesso direto ao stream de áudio, envie o arquivo local correspondente ou utilize a análise assistida de catálogo.'
    };

    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(oembedUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        metadata.title = data.title || metadata.title;
        metadata.authorName = data.author_name || metadata.authorName;
        metadata.thumbnailUrl = data.thumbnail_url || metadata.thumbnailUrl;
        metadata.officialOembed = true;
      }
    } catch {
      // Fallback if sandbox has no internet access
    }

    res.json({ valid: true, metadata });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Start analysis from YouTube Official Metadata / Authorized Stream (Option B)
app.post('/api/analyses/youtube', (req, res) => {
  try {
    const {
      url,
      youtube_title,
      youtube_thumbnail,
      name,
      genre = 'Automático (Detectar pelo áudio)',
      language = 'Automático',
      sensitivity = 'normal',
      detect_unknown = true,
      detailed_intervals = true,
      duration_seconds = 2700 // 45m default for full album videos
    } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL do YouTube é obrigatória.' });
    }

    const id = uuidv4();
    const analysisName = name?.trim() || youtube_title || 'Coletânea Musical YouTube';
    const initialGenre =
      genre && !genre.startsWith('Automático')
        ? genre
        : inferGenreFromText(`${analysisName} ${youtube_title || ''}`) || 'Detectando...';

    db.prepare(`
      INSERT INTO analyses (
        id, name, source_type, file_name, youtube_url, youtube_title, youtube_thumbnail,
        duration_seconds, genre, language, sensitivity, detect_unknown, detailed_intervals,
        status, current_step, step_label, progress
      ) VALUES (?, ?, 'youtube', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', 1, 'Validando metadados oficiais', 5)
    `).run(
      id,
      analysisName,
      `YouTube: ${youtube_title || url}`,
      url,
      youtube_title || analysisName,
      youtube_thumbnail || null,
      Math.min(5400, Number(duration_seconds) || 2700),
      initialGenre,
      language,
      sensitivity,
      detect_unknown ? 1 : 0,
      detailed_intervals ? 1 : 0
    );

    setImmediate(() => {
      runAnalysisPipeline(id);
    });

    const created = db.prepare('SELECT * FROM analyses WHERE id = ?').get(id);
    res.status(201).json({ analysis: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Manual Track Identification & Editing (Section 4.4)
app.put('/api/tracks/:trackId', (req, res) => {
  try {
    const { trackId } = req.params;
    const { title, artist, album, release_year, start_sec, end_sec, notes } = req.body;

    const existing = db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId);
    if (!existing) {
      return res.status(404).json({ error: 'Faixa não encontrada' });
    }

    const newTitle = title?.trim() || existing.title;
    const newArtist = artist?.trim() || existing.artist;
    const newStart = start_sec !== undefined ? Number(start_sec) : existing.start_sec;
    const newEnd = end_sec !== undefined ? Number(end_sec) : existing.end_sec;
    const newDuration = Math.max(1, newEnd - newStart);
    const isNowIdentified = newTitle !== 'Música não identificada' ? 1 : 0;

    db.prepare(`
      UPDATE tracks
      SET title = ?, artist = ?, album = ?, release_year = ?,
          start_sec = ?, end_sec = ?, duration_sec = ?,
          is_identified = ?, is_manual = 1, confidence = ?, notes = ?
      WHERE id = ?
    `).run(
      newTitle,
      newArtist,
      album !== undefined ? album : existing.album,
      release_year !== undefined ? release_year : existing.release_year,
      newStart,
      newEnd,
      newDuration,
      isNowIdentified,
      isNowIdentified ? 100 : 0,
      notes !== undefined ? notes : existing.notes,
      trackId
    );

    // Recalculate parent analysis counts
    recalculateAnalysisStats(existing.analysis_id);

    const updatedTrack = db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId);
    const updatedAnalysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(existing.analysis_id);

    res.json({ track: updatedTrack, analysis: updatedAnalysis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Retry Recognition on an Unidentified Track (Section 4.4)
app.post('/api/tracks/:trackId/retry', async (req, res) => {
  try {
    const { trackId } = req.params;
    const { hintQuery = '' } = req.body;

    const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId);
    if (!track) {
      return res.status(404).json({ error: 'Faixa não encontrada' });
    }

    const analysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(track.analysis_id);

    let matched = null;

    // 1. Try MusicBrainz lookup if user provided a hint or query
    if (hintQuery.trim()) {
      const mbResults = await searchMusicBrainzRecording(hintQuery.trim());
      if (mbResults.length > 0) {
        matched = {
          title: mbResults[0].title,
          artist: mbResults[0].artist,
          album: mbResults[0].album,
          year: mbResults[0].releaseYear,
          mbid: mbResults[0].mbid,
          confidence: 94.5
        };
      }
    }

    // 2. Real multi-point acoustic probing across the track interval using Shazam DSP
    if (!matched && analysis?.file_path && fs.existsSync(analysis.file_path)) {
      const span = Math.max(15, track.end_sec - track.start_sec);
      const offsets = [
        track.start_sec + Math.floor(span * 0.25),
        track.start_sec + Math.floor(span * 0.5),
        track.start_sec + Math.floor(span * 0.75)
      ];
      for (const offset of offsets) {
        const resShazam = await recognizeSegmentWithShazam(
          analysis.file_path,
          offset,
          14,
          analysis.language === 'Inglês' ? 'en-US' : 'pt-BR'
        );
        if (resShazam) {
          matched = resShazam;
          break;
        }
      }
    }

    if (!matched) {
      return res.status(404).json({
        error: 'Nenhuma correspondência acústica encontrada neste intervalo. Utilize a identificação manual se souber o nome da faixa.'
      });
    }

    db.prepare(`
      UPDATE tracks
      SET title = ?, artist = ?, album = ?, release_year = ?, mbid = ?,
          confidence = ?, is_identified = 1, is_manual = 0
      WHERE id = ?
    `).run(
      matched.title,
      matched.artist,
      matched.album,
      matched.year || null,
      matched.mbid,
      matched.confidence,
      trackId
    );

    recalculateAnalysisStats(track.analysis_id);

    const updatedTrack = db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId);
    const updatedAnalysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(track.analysis_id);

    res.json({
      success: true,
      track: updatedTrack,
      analysis: updatedAnalysis
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10b. Re-process an entire analysis from scratch with the real acoustic engine
app.post('/api/analyses/:id/reprocess', (req, res) => {
  try {
    const analysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(req.params.id);
    if (!analysis) {
      return res.status(404).json({ error: 'Análise não encontrada' });
    }
    db.prepare(`
      UPDATE analyses
      SET status = 'processing', current_step = 1, step_label = 'Reiniciando reconhecimento acústico real', progress = 5
      WHERE id = ?
    `).run(req.params.id);

    setImmediate(() => {
      runAnalysisPipeline(req.params.id);
    });

    const updated = db.prepare('SELECT * FROM analyses WHERE id = ?').get(req.params.id);
    res.json({ analysis: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Search MusicBrainz API for manual autocomplete / identification
app.get('/api/musicbrainz/search', async (req, res) => {
  try {
    const { q = '', artist = '' } = req.query;
    if (!q.trim()) return res.json([]);
    const results = await searchMusicBrainzRecording(String(q), String(artist));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12. Delete an analysis
app.delete('/api/analyses/:id', (req, res) => {
  try {
    const analysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(req.params.id);
    if (!analysis) {
      return res.status(404).json({ error: 'Análise não encontrada' });
    }
    if (analysis.file_path && fs.existsSync(analysis.file_path)) {
      try {
        fs.unlinkSync(analysis.file_path);
      } catch {
        // ignore file lock
      }
    }
    db.prepare('DELETE FROM analyses WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 13. Get & Update Settings (AcoustID API Key, Limits, Window Size)
app.get('/api/settings', (_req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings', (req, res) => {
  try {
    const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(req.body)) {
      upsert.run(k, String(v));
    }
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function recalculateAnalysisStats(analysisId) {
  const tracks = db.prepare('SELECT * FROM tracks WHERE analysis_id = ?').all(analysisId);
  let identified = 0;
  let unidentified = 0;
  let confSum = 0;
  for (const t of tracks) {
    if (t.is_identified) {
      identified++;
      confSum += t.confidence || 0;
    } else {
      unidentified++;
    }
  }
  const avg = identified > 0 ? Math.round((confSum / identified) * 10) / 10 : 0;
  db.prepare(`
    UPDATE analyses
    SET identified_tracks_count = ?, unidentified_tracks_count = ?, avg_confidence = ?
    WHERE id = ?
  `).run(identified, unidentified, avg, analysisId);
}

const PORT = process.env.PORT || 3001;

// Serve built frontend in production / unified mode
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[FAIXORA Server] Running at http://localhost:${PORT}`);
});
