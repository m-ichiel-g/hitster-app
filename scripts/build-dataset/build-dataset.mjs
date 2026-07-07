// Stap 4: combineert tracks.raw.json + years.json, past corrections.csv toe (overrides
// winnen) en schrijft de uiteindelijke dataset volgens het PRD-schema (§4).
//
// Input:  data/raw/tracks.raw.json, data/raw/years.json, corrections.csv
// Output: ../../public/data/top2000-2025.json

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TRACKS_PATH = path.join(__dirname, 'data', 'raw', 'tracks.raw.json');
const YEARS_PATH = path.join(__dirname, 'data', 'raw', 'years.json');
const CORRECTIONS_PATH = path.join(__dirname, 'corrections.csv');
const OUT_PATH = path.join(__dirname, '..', '..', 'public', 'data', 'top2000-2025.json');

const DATASET_ID = 'top2000-2025';
const DATASET_NAME = 'NPO Radio 2 Top 2000 (2025)';

function parseCsvLine(line) {
  // Simpele CSV-parser: voldoende voor ons vaste 2-koloms formaat (track_id,year),
  // met ondersteuning voor dubbele aanhalingstekens rond velden.
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

async function loadCorrections() {
  let text;
  try {
    text = await readFile(CORRECTIONS_PATH, 'utf-8');
  } catch {
    return new Map();
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const map = new Map();
  for (const line of lines.slice(1)) {
    const [trackId, year] = parseCsvLine(line);
    if (trackId && year) map.set(trackId.trim(), parseInt(year.trim(), 10));
  }
  return map;
}

async function main() {
  const raw = JSON.parse(await readFile(TRACKS_PATH, 'utf-8'));
  const years = JSON.parse(await readFile(YEARS_PATH, 'utf-8'));
  const corrections = await loadCorrections();

  let uncorrectedLowConfidence = 0;
  let missingYear = 0;

  const tracks = raw.tracks
    .map((t) => {
      const resolved = years[t.id];
      const hasCorrection = corrections.has(t.id);
      const year = hasCorrection ? corrections.get(t.id) : resolved?.year ?? null;

      if (!hasCorrection && resolved?.confidence === 'laag') uncorrectedLowConfidence++;
      if (year == null || !Number.isFinite(year)) missingYear++;

      return {
        id: t.id,
        title: t.title,
        artist: t.artist,
        year,
        cover: t.cover,
        rank: t.rank,
      };
    })
    .sort((a, b) => a.rank - b.rank);

  const dataset = {
    id: DATASET_ID,
    name: DATASET_NAME,
    source_playlist: raw.source_playlist,
    tracks,
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(dataset, null, 2));

  console.log(`${tracks.length} tracks weggeschreven naar ${path.relative(process.cwd(), OUT_PATH)}`);
  if (missingYear > 0) {
    console.warn(`⚠ ${missingYear} track(s) hebben geen geldig jaartal.`);
  }
  console.log(
    `${uncorrectedLowConfidence} track(s) staan nog op een ongecontroleerde (lage-zekerheid) waarde ` +
      `— zie review.csv, corrigeer via corrections.csv en draai dit script opnieuw.`
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
