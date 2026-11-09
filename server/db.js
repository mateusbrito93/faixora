import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'faixora.db');
export const db = new DatabaseSync(dbPath);

export function initDb() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      file_name TEXT,
      file_path TEXT,
      file_size INTEGER DEFAULT 0,
      youtube_url TEXT,
      youtube_title TEXT,
      youtube_thumbnail TEXT,
      duration_seconds INTEGER DEFAULT 0,
      genre TEXT,
      language TEXT,
      sensitivity TEXT DEFAULT 'normal',
      detect_unknown INTEGER DEFAULT 1,
      detailed_intervals INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pending',
      current_step INTEGER DEFAULT 1,
      step_label TEXT DEFAULT 'Recebendo arquivo',
      progress INTEGER DEFAULT 0,
      total_segments INTEGER DEFAULT 0,
      analyzed_segments INTEGER DEFAULT 0,
      identified_tracks_count INTEGER DEFAULT 0,
      unidentified_tracks_count INTEGER DEFAULT 0,
      avg_confidence REAL DEFAULT 0,
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_id TEXT NOT NULL,
      segment_index INTEGER NOT NULL,
      start_sec INTEGER NOT NULL,
      end_sec INTEGER NOT NULL,
      fingerprint TEXT,
      matched_title TEXT,
      matched_artist TEXT,
      matched_album TEXT,
      matched_mbid TEXT,
      confidence REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_id TEXT NOT NULL,
      track_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      album TEXT,
      release_year TEXT,
      genre TEXT,
      start_sec INTEGER NOT NULL,
      end_sec INTEGER NOT NULL,
      duration_sec INTEGER NOT NULL,
      confidence REAL NOT NULL,
      is_identified INTEGER DEFAULT 1,
      is_manual INTEGER DEFAULT 0,
      mbid TEXT,
      acoustid_id TEXT,
      notes TEXT,
      FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
    );
  `);

  // Ensure default settings exist
  const checkSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');

  if (!checkSetting.get('acoustid_api_key')) {
    // Public AcoustID demo/client key fallback or user-configured key
    insertSetting.run('acoustid_api_key', 'cSpUJKpD');
  }
  if (!checkSetting.get('max_duration_minutes')) {
    insertSetting.run('max_duration_minutes', '90');
  }
  if (!checkSetting.get('max_file_size_mb')) {
    insertSetting.run('max_file_size_mb', '500');
  }
  if (!checkSetting.get('segment_window_sec')) {
    insertSetting.run('segment_window_sec', '20');
  }
  if (!checkSetting.get('segment_step_sec')) {
    insertSetting.run('segment_step_sec', '10');
  }

  // Seed initial sample analyses if database is empty so the Dashboard looks rich immediately
  const countRow = db.prepare('SELECT COUNT(*) as count FROM analyses').get();
  if (countRow && countRow.count === 0) {
    seedInitialData();
  }
}

function seedInitialData() {
  const analysis1Id = 'cd-forro-antigas-2026';
  const analysis2Id = 'set-eletronico-festival-2026';
  const analysis3Id = 'coletanea-sertanejo-modao';

  const insertAnalysis = db.prepare(`
    INSERT INTO analyses (
      id, name, source_type, file_name, file_size, duration_seconds,
      genre, language, sensitivity, detect_unknown, detailed_intervals,
      status, current_step, step_label, progress, total_segments, analyzed_segments,
      identified_tracks_count, unidentified_tracks_count, avg_confidence,
      created_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?))
  `);

  insertAnalysis.run(
    analysis1Id,
    'CD Forró das Antigas — Ao Vivo em Fortaleza',
    'file',
    'CD_Forro_2026.mp3',
    128450560,
    5400, // 01:30:00 (90 min)
    'Forró',
    'Português',
    'high',
    1,
    1,
    'completed',
    6,
    'Relatório gerado',
    100,
    270,
    270,
    23,
    2,
    96.4,
    '-2 days',
    '-2 days'
  );

  insertAnalysis.run(
    analysis2Id,
    'Sunset Melodic Techno & House Mix 2026',
    'file',
    'Sunset_Melodic_Mix_Master.flac',
    245102000,
    3180, // 53 min
    'Eletrônica',
    'Inglês',
    'normal',
    1,
    1,
    'completed',
    6,
    'Relatório gerado',
    100,
    159,
    159,
    11,
    1,
    94.1,
    '-1 day',
    '-1 day'
  );

  insertAnalysis.run(
    analysis3Id,
    'Acústico MPB & Bossa Nova — Coletânea',
    'file',
    'MPB_Acustico_Coletanea.m4a',
    68400100,
    2420, // 40m 20s
    'MPB',
    'Português',
    'high',
    1,
    1,
    'completed',
    6,
    'Relatório gerado',
    100,
    121,
    121,
    10,
    0,
    97.8,
    '-4 hours',
    '-4 hours'
  );

  const insertTrack = db.prepare(`
    INSERT INTO tracks (
      analysis_id, track_number, title, artist, album, release_year, genre,
      start_sec, end_sec, duration_sec, confidence, is_identified, is_manual, mbid, acoustid_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const forroTracks = [
    ['Meu Vaqueiro, Meu Peão', 'Mastruz com Leite', 'Acústico Imaginar', '1993', 0, 225, 98.5, 1, 'mb-forro-01'],
    ['Espumas ao Vento', 'Fagner', 'Terral', '1997', 225, 432, 97.2, 1, 'mb-forro-02'],
    ['Anjo Querubim', 'Limão com Mel', 'Um Amor de Novela', '2000', 432, 650, 96.8, 1, 'mb-forro-03'],
    ['Saga de um Vaqueiro', 'Catuaba com Amendoim', 'Clássicos do Norte', '1996', 650, 910, 95.4, 1, 'mb-forro-04'],
    ['Olhinhos de Fogueira', 'Mastruz com Leite', 'Cabeça de Bob\'s', '1995', 910, 1115, 98.1, 1, 'mb-forro-05'],
    ['Toma Conta de Mim', 'Limão com Mel', 'Toma Conta de Mim', '2003', 1115, 1340, 97.9, 1, 'mb-forro-06'],
    ['Música não identificada', 'Artista desconhecido', null, null, 1340, 1520, 0, 0, null],
    ['Planeta de Cores', 'Forró Saborear', 'Saborear Ao Vivo', '2002', 1520, 1735, 94.6, 1, 'mb-forro-08'],
    ['Jeito de Amar', 'Cavalo de Pau', 'Estrelinha do Céu', '1996', 1735, 1950, 96.3, 1, 'mb-forro-09'],
    ['Estrelinha do Céu', 'Cavalo de Pau', 'Estrelinha do Céu', '1996', 1950, 2160, 95.9, 1, 'mb-forro-10'],
    ['Timidez', 'Cavalo de Pau', 'Mais Forte Que o Tempo', '1998', 2160, 2375, 98.4, 1, 'mb-forro-11'],
    ['Noda de Caju', 'Noda de Caju', 'Lágrimas de Caju', '1999', 2375, 2590, 93.8, 1, 'mb-forro-12'],
    ['Pétalas de Neon', 'Noda de Caju', 'Eu Me Lembro', '2000', 2590, 2810, 95.2, 1, 'mb-forro-13'],
    ['Onde Canta o Sabiá', 'Mastruz com Leite', 'No Forró do Gonzagão', '1996', 2810, 3025, 97.5, 1, 'mb-forro-14'],
    ['Meio Dia', 'Mastruz com Leite', 'Só Pra Xamegar', '1994', 3025, 3230, 98.0, 1, 'mb-forro-15'],
    ['Porque Brigamos', 'Limão com Mel', 'Vol. 7', '2001', 3230, 3455, 96.1, 1, 'mb-forro-16'],
    ['De Janeiro a Janeiro', 'Limão com Mel', 'Ao Vivo', '2002', 3455, 3670, 97.0, 1, 'mb-forro-17'],
    ['Música não identificada', 'Artista desconhecido', null, null, 3670, 3860, 0, 0, null],
    ['Cara Metade', 'Magníficos', 'Me Usa', '1997', 3860, 4080, 98.7, 1, 'mb-forro-19'],
    ['Me Usa', 'Magníficos', 'Me Usa', '1997', 4080, 4305, 99.1, 1, 'mb-forro-20'],
    ['Verdadeiro Amor', 'Magníficos', 'Do Jeito Que Você Merece', '1999', 4305, 4520, 97.4, 1, 'mb-forro-21'],
    ['Carta Branca', 'Magníficos', 'Química do Amor', '2001', 4520, 4740, 96.5, 1, 'mb-forro-22'],
    ['Cristal Quebrado', 'Magníficos', 'Fonte dos Desejos', '1998', 4740, 4960, 95.8, 1, 'mb-forro-23'],
    ['Sonhar', 'Calcinha Preta', 'A Moçada é Só Filé', '2000', 4960, 5180, 94.9, 1, 'mb-forro-24'],
    ['Cobertor', 'Calcinha Preta', 'Seu Coração Vai Aprender', '2001', 5180, 5400, 98.2, 1, 'mb-forro-25']
  ];

  forroTracks.forEach((t, idx) => {
    insertTrack.run(
      analysis1Id,
      idx + 1,
      t[0],
      t[1],
      t[2],
      t[3],
      'Forró',
      t[4],
      t[5],
      t[5] - t[4],
      t[6],
      t[7],
      0,
      t[8],
      t[8] ? `acoustid-${t[8]}` : null
    );
  });

  const electroTracks = [
    ['Innerbloom', 'RÜFÜS DU SOL', 'Bloom', '2016', 0, 340, 98.9, 1, 'mb-el-01'],
    ['Cola', 'CamelPhat & Elderbrook', 'Defected', '2017', 340, 610, 96.4, 1, 'mb-el-02'],
    ['Opus', 'Eric Prydz', 'Opus', '2015', 610, 930, 97.8, 1, 'mb-el-03'],
    ['Turn On The Lights again..', 'Fred again.. & Swedish House Mafia', 'Actual Life 3', '2022', 930, 1210, 95.2, 1, 'mb-el-04'],
    ['Breathe', 'CamelPhat & Cristoph', 'Pryda Presents', '2018', 1210, 1500, 94.1, 1, 'mb-el-05'],
    ['Música não identificada', 'Artista desconhecido', null, null, 1500, 1740, 0, 0, null],
    ['Ghosts \'n\' Stuff', 'deadmau5 feat. Rob Swire', 'For Lack of a Better Name', '2009', 1740, 2020, 97.1, 1, 'mb-el-07'],
    ['Strobe', 'deadmau5', 'For Lack of a Better Name', '2009', 2020, 2360, 98.4, 1, 'mb-el-08'],
    ['Losing It', 'FISHER', 'Catch & Release', '2018', 2360, 2610, 96.0, 1, 'mb-el-09'],
    ['Glue', 'Bicep', 'Bicep', '2017', 2610, 2890, 95.7, 1, 'mb-el-10'],
    ['Apricots', 'Bicep', 'Isles', '2021', 2890, 3040, 92.5, 1, 'mb-el-11'],
    ['Alive', 'RÜFÜS DU SOL', 'Surrender', '2021', 3040, 3180, 93.2, 1, 'mb-el-12']
  ];

  electroTracks.forEach((t, idx) => {
    insertTrack.run(
      analysis2Id,
      idx + 1,
      t[0],
      t[1],
      t[2],
      t[3],
      'Eletrônica',
      t[4],
      t[5],
      t[5] - t[4],
      t[6],
      t[7],
      0,
      t[8],
      t[8] ? `acoustid-${t[8]}` : null
    );
  });

  const mpbTracks = [
    ['Águas de Março', 'Elis Regina & Tom Jobim', 'Elis & Tom', '1974', 0, 212, 99.4, 1, 'mb-mpb-01'],
    ['Construção', 'Chico Buarque', 'Construção', '1971', 212, 495, 98.8, 1, 'mb-mpb-02'],
    ['Trem das Onze', 'Adoniran Barbosa', 'Demônios da Garoa', '1964', 495, 710, 97.5, 1, 'mb-mpb-03'],
    ['Garota de Ipanema', 'Tom Jobim & Vinícius de Moraes', 'Getz/Gilberto', '1964', 710, 960, 99.1, 1, 'mb-mpb-04'],
    ['Como Nossos Pais', 'Elis Regina', 'Falso Brilhante', '1976', 960, 1220, 98.2, 1, 'mb-mpb-05'],
    ['Sampa', 'Caetano Veloso', 'Muito', '1978', 1220, 1465, 96.9, 1, 'mb-mpb-06'],
    ['Aquarela', 'Toquinho', 'Casa de Brinquedos', '1983', 1465, 1720, 98.5, 1, 'mb-mpb-07'],
    ['Anunciação', 'Alceu Valença', 'Anjo Avesso', '1983', 1720, 1950, 97.6, 1, 'mb-mpb-08'],
    ['Oceano', 'Djavan', 'Djavan', '1989', 1950, 2190, 96.4, 1, 'mb-mpb-09'],
    ['Azul da Cor do Mar', 'Tim Maia', 'Tim Maia', '1970', 2190, 2420, 98.0, 1, 'mb-mpb-10']
  ];

  mpbTracks.forEach((t, idx) => {
    insertTrack.run(
      analysis3Id,
      idx + 1,
      t[0],
      t[1],
      t[2],
      t[3],
      'MPB',
      t[4],
      t[5],
      t[5] - t[4],
      t[6],
      t[7],
      0,
      t[8],
      t[8] ? `acoustid-${t[8]}` : null
    );
  });
}
