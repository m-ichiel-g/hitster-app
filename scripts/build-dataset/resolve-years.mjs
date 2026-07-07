// Stap 2: bepaalt per track het jaartal van de EERSTE originele uitgave via MusicBrainz,
// met het Spotify-albumjaar als kruiscontrole. Twijfelgevallen komen op review.csv.
//
// Belangrijk: MusicBrainz vereist een nette User-Agent en ~1 request/seconde. We cachen elk
// antwoord lokaal (per track-id) zodat herdraaien niet opnieuw de API belast.
//
// Input:  data/raw/tracks.raw.json (van fetch-playlist.mjs)
// Output: data/raw/years.json, data/raw/review.csv

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '.env');

try {
  process.loadEnvFile(ENV_PATH);
} catch {
  console.error(`Kan .env niet vinden op ${ENV_PATH}. Kopieer .env.example naar .env en vul 'm in.`);
  process.exit(1);
}

const { MUSICBRAINZ_CONTACT_EMAIL } = process.env;
if (!MUSICBRAINZ_CONTACT_EMAIL) {
  console.error('MUSICBRAINZ_CONTACT_EMAIL ontbreekt in .env (nodig voor een nette User-Agent).');
  process.exit(1);
}

const USER_AGENT = `GooseHitster/0.1 (${MUSICBRAINZ_CONTACT_EMAIL})`;
const RATE_LIMIT_MS = 1100; // iets ruimer dan 1/sec, uit beleefdheid richting MusicBrainz
const CACHE_DIR = path.join(__dirname, 'data', 'cache', 'musicbrainz');
const IN_PATH = path.join(__dirname, 'data', 'raw', 'tracks.raw.json');
const YEARS_OUT_PATH = path.join(__dirname, 'data', 'raw', 'years.json');
const REVIEW_OUT_PATH = path.join(__dirname, 'data', 'raw', 'review.csv');

const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(s) {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // diakritische tekens weg
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// "Bohemian Rhapsody - Remastered 2011" -> "Bohemian Rhapsody"; "Hotel California (Live)" -> "Hotel California"
function cleanTitleForSearch(title) {
  return title
    .split(/\s+-\s+/)[0]
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
}

function escapeLucene(s) {
  return s.replace(/([+\-!(){}[\]^"~*?:\\/&|])/g, '\\$1');
}

async function cacheGet(trackId) {
  try {
    return JSON.parse(await readFile(path.join(CACHE_DIR, `${trackId}.json`), 'utf-8'));
  } catch {
    return null;
  }
}

async function cacheSet(trackId, data) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path.join(CACHE_DIR, `${trackId}.json`), JSON.stringify(data, null, 2));
}

async function searchMusicBrainz(artist, title) {
  const cleanTitle = cleanTitleForSearch(title);
  const primaryArtist = artist.split(',')[0].trim();
  const query = `recording:"${escapeLucene(cleanTitle)}" AND artist:"${escapeLucene(primaryArtist)}"`;
  const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=100`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`MusicBrainz-aanvraag mislukt (${res.status}) voor "${artist} - ${title}": ${await res.text()}`);
  }
  return res.json();
}

// Neemt het VROEGSTE jaar onder alle kandidaten die op titel+artiest matchen. MusicBrainz
// heeft vaak losse "recording"-entries per heruitgave/remaster; het topresultaat (hoogste
// score) is daardoor lang niet altijd de originele opname — het minimum wel.
function pickEarliestYear(mbResult, artist, title) {
  const normTitle = normalize(cleanTitleForSearch(title));
  const primaryArtist = normalize(artist.split(',')[0]);

  const years = (mbResult.recordings ?? [])
    .filter((r) => normalize(r.title) === normTitle)
    .filter((r) => (r['artist-credit'] ?? []).some((a) => normalize(a.name) === primaryArtist))
    .map((r) => r['first-release-date'])
    .filter(Boolean)
    .map((d) => parseInt(d.slice(0, 4), 10))
    .filter(Number.isFinite);

  return years.length > 0 ? Math.min(...years) : null;
}

function csvField(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsvRow(row) {
  return ['track_id', 'artist', 'title', 'spotify_year', 'musicbrainz_year', 'chosen_year', 'confidence', 'reason']
    .map((k) => csvField(row[k]))
    .join(',');
}

async function main() {
  const raw = JSON.parse(await readFile(IN_PATH, 'utf-8'));
  let tracks = raw.tracks;
  if (limit) tracks = tracks.slice(0, limit);

  const years = {};
  const reviewRows = [];
  const currentYear = new Date().getFullYear();
  let apiCalls = 0;
  let cacheHits = 0;

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    let mbResult = await cacheGet(track.id);
    if (mbResult) {
      cacheHits++;
    } else {
      mbResult = await searchMusicBrainz(track.artist, track.title);
      await cacheSet(track.id, mbResult);
      apiCalls++;
      await sleep(RATE_LIMIT_MS);
    }

    const mbYear = pickEarliestYear(mbResult, track.artist, track.title);
    const spotifyYear = track.spotify_album_year;

    let chosenYear;
    let source;
    let confidence;
    let reason = '';

    if (mbYear != null) {
      chosenYear = mbYear;
      source = 'musicbrainz';
      const agree = spotifyYear != null && Math.abs(mbYear - spotifyYear) <= 1;
      confidence = agree ? 'hoog' : 'laag';
      if (!agree) reason = 'wijkt_af_van_spotify';
    } else {
      chosenYear = spotifyYear;
      source = 'spotify_fallback';
      confidence = 'laag';
      reason = 'geen_musicbrainz_match';
    }

    if (chosenYear == null || chosenYear > currentYear) {
      confidence = 'laag';
      reason = reason || 'onwaarschijnlijk_jaar';
    }

    years[track.id] = {
      year: chosenYear,
      source,
      confidence,
      mb_year: mbYear,
      spotify_year: spotifyYear,
      reason,
    };

    if (confidence === 'laag') {
      reviewRows.push({
        track_id: track.id,
        artist: track.artist,
        title: track.title,
        spotify_year: spotifyYear ?? '',
        musicbrainz_year: mbYear ?? '',
        chosen_year: chosenYear ?? '',
        confidence,
        reason,
      });
    }

    if ((i + 1) % 10 === 0 || i === tracks.length - 1) {
      console.log(`  ${i + 1}/${tracks.length} verwerkt (${apiCalls} MusicBrainz-aanroepen, ${cacheHits} uit cache)`);
    }
  }

  await mkdir(path.dirname(YEARS_OUT_PATH), { recursive: true });
  await writeFile(YEARS_OUT_PATH, JSON.stringify(years, null, 2));

  const header = 'track_id,artist,title,spotify_year,musicbrainz_year,chosen_year,confidence,reason';
  const body = reviewRows.map(toCsvRow).join('\n');
  await writeFile(REVIEW_OUT_PATH, header + '\n' + body + (body ? '\n' : ''));

  console.log(`\n${tracks.length} tracks verwerkt.`);
  console.log(`Jaartallen weggeschreven naar ${path.relative(process.cwd(), YEARS_OUT_PATH)}`);
  console.log(
    `${reviewRows.length} op de nakijklijst → ${path.relative(process.cwd(), REVIEW_OUT_PATH)}`
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
