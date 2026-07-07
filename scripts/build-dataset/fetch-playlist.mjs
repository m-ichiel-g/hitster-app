// Stap 1: haalt tracks op uit JOUW gedupliceerde kopie van de Top 2000-playlist.
//
// Waarom een gebruikers-login i.p.v. het geplande app-only (client-credentials) token:
// sinds Spotify's playlist-API wijziging (feb. 2026) geeft "Get Playlist Items" alleen nog
// de tracklijst terug voor playlists waarvan jij eigenaar of collaborator bent — voor
// playlists van anderen (zoals NPO Radio 2's origineel) krijg je alleen metadata, geen
// tracks, ongeacht het type token. Zie deviations-log.md voor de volledige uitleg.
//
// Daarom: jij dupliceert de playlist één keer naar je eigen account, en dit script logt
// zichzelf één keer in (Authorization Code + PKCE, gewone Spotify-login, geen Premium
// nodig) om je eigen kopie te mogen lezen. Omdat Spotify "localhost"-redirects niet meer
// toestaat, gebruiken we de al-geregistreerde hitster.goossensen.com-URL: jij plakt na het
// inloggen de resulterende adresbalk-URL terug via --code-url. Het token wordt daarna
// gecachet (met refresh-token), dus dit hoeft maar één keer.
//
// Output: data/raw/tracks.raw.json

import { writeFile, mkdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '.env');

try {
  process.loadEnvFile(ENV_PATH);
} catch {
  console.error(`Kan .env niet vinden op ${ENV_PATH}. Kopieer .env.example naar .env en vul 'm in.`);
  process.exit(1);
}

const { SPOTIFY_CLIENT_ID, SPOTIFY_OWN_PLAYLIST_ID } = process.env;
if (!SPOTIFY_CLIENT_ID) {
  console.error('SPOTIFY_CLIENT_ID ontbreekt in .env.');
  process.exit(1);
}
if (!SPOTIFY_OWN_PLAYLIST_ID) {
  console.error(
    'SPOTIFY_OWN_PLAYLIST_ID ontbreekt in .env. Dupliceer eerst de Top 2000-playlist naar je\n' +
      'eigen account (Spotify-app of open.spotify.com: rechtsklik op de playlist → "Dupliceren"),\n' +
      'en zet het playlist-ID van die kopie (uit de deel-link) in .env.'
  );
  process.exit(1);
}

// De ORIGINELE NPO-playlist (alleen voor attributie in de dataset-output, niet om uit te lezen).
const ORIGINAL_PLAYLIST_URI = 'spotify:playlist:1DTzz7Nh2rJBnyFbjsH1Mh';

// Spotify staat sinds kort geen "localhost"-redirects meer toe voor PKCE (alleen HTTPS, of
// het letterlijke loopback-adres 127.0.0.1). We hergebruiken daarom de al-geregistreerde
// productie-URL; die hoeft niets te doen — jij plakt de resulterende adresbalk-URL terug.
const REDIRECT_URI = 'https://hitster.goossensen.com';
const SCOPE = 'playlist-read-private';
const TOKEN_CACHE_PATH = path.join(__dirname, 'data', 'cache', 'user-token.json');
const PENDING_LOGIN_PATH = path.join(__dirname, 'data', 'cache', 'pkce-pending.json');
const OUT_PATH = path.join(__dirname, 'data', 'raw', 'tracks.raw.json');

function base64url(buf) {
  return buf.toString('base64url');
}

async function readTokenCache() {
  try {
    return JSON.parse(await readFile(TOKEN_CACHE_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

async function writeTokenCache(tokens) {
  await mkdir(path.dirname(TOKEN_CACHE_PATH), { recursive: true });
  await writeFile(TOKEN_CACHE_PATH, JSON.stringify(tokens, null, 2));
}

async function exchangeToken(body) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token-aanvraag mislukt (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token, // let op: bij refresh geeft Spotify soms geen nieuwe refresh_token terug
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

async function refreshToken(refresh_token) {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token,
    client_id: SPOTIFY_CLIENT_ID,
  });
  const fresh = await exchangeToken(params.toString());
  // Spotify stuurt niet altijd een nieuwe refresh_token mee; oude behouden als die ontbreekt.
  return { ...fresh, refresh_token: fresh.refresh_token ?? refresh_token };
}

async function readPendingLogin() {
  try {
    return JSON.parse(await readFile(PENDING_LOGIN_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function startLogin() {
  const verifier = base64url(crypto.randomBytes(64));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  const state = base64url(crypto.randomBytes(16));

  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.search = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPE,
    state,
  }).toString();

  return { verifier, state, authUrl: authUrl.toString() };
}

function extractCodeFromPastedInput(input, expectedState) {
  const trimmed = input.trim();
  if (!/^https?:\/\//.test(trimmed)) {
    // Aanname: het is de kale 'code' zelf, geen volledige URL.
    return trimmed;
  }
  const url = new URL(trimmed);
  const error = url.searchParams.get('error');
  if (error) {
    throw new Error(`Spotify-login geweigerd: ${error}`);
  }
  const returnedState = url.searchParams.get('state');
  if (returnedState && returnedState !== expectedState) {
    throw new Error(
      'State-mismatch: deze URL hoort niet bij de laatst gestarte login-poging. Start opnieuw zonder --code-url.'
    );
  }
  const code = url.searchParams.get('code');
  if (!code) {
    throw new Error("Kon geen 'code'-parameter vinden in de geplakte URL.");
  }
  return code;
}

async function completeLogin(pastedInput) {
  const pending = await readPendingLogin();
  if (!pending) {
    throw new Error('Geen actieve login-poging gevonden. Draai het script eerst zonder --code-url.');
  }
  const code = extractCodeFromPastedInput(pastedInput, pending.state);

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: SPOTIFY_CLIENT_ID,
    code_verifier: pending.verifier,
  });
  const tokens = await exchangeToken(params.toString());
  await writeTokenCache(tokens);
  await unlink(PENDING_LOGIN_PATH).catch(() => {});
  return tokens.access_token;
}

async function getUserAccessToken() {
  let tokens = await readTokenCache();

  if (tokens && tokens.expires_at > Date.now() + 60_000) {
    return tokens.access_token;
  }
  if (tokens?.refresh_token) {
    try {
      tokens = await refreshToken(tokens.refresh_token);
      await writeTokenCache(tokens);
      return tokens.access_token;
    } catch (err) {
      console.warn(`Refresh-token werkte niet (${err.message}), opnieuw inloggen nodig.`);
    }
  }

  const codeUrlArg = process.argv.find((a) => a.startsWith('--code-url='));
  if (codeUrlArg) {
    return completeLogin(codeUrlArg.slice('--code-url='.length));
  }

  const { verifier, state, authUrl } = startLogin();
  await mkdir(path.dirname(PENDING_LOGIN_PATH), { recursive: true });
  await writeFile(PENDING_LOGIN_PATH, JSON.stringify({ verifier, state, created_at: Date.now() }, null, 2));

  console.log('\nEenmalige Spotify-login nodig. Open deze link in je browser en log in/bevestig:\n');
  console.log(authUrl);
  console.log(
    '\nJe komt daarna uit op hitster.goossensen.com (de pagina hoeft niets te tonen).\n' +
      'Plak de VOLLEDIGE URL uit je adresbalk terug en draai:\n' +
      '  npm run dataset:fetch -- --limit=30 --code-url="<geplakte URL>"\n'
  );
  return null;
}

const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

const PAGE_SIZE = 100;

// Sinds de feb.-2026 API-restructurering heet dit endpoints geneste paging-veld "items"
// i.p.v. "tracks", en elke entry heeft een "item"-veld i.p.v. "track". Werkt met gewone
// limit/offset-paginering zolang SPOTIFY_OWN_PLAYLIST_ID een kale ID is (geen "?si=..."-
// staartje uit de deel-link, dat breekt de URL-opbouw).
async function fetchPage(token, offset, count) {
  const fields = 'total,items(item(id,type,is_local,name,artists(name),album(images,release_date)))';
  const url = `https://api.spotify.com/v1/playlists/${SPOTIFY_OWN_PLAYLIST_ID}/items?limit=${count}&offset=${offset}&fields=${encodeURIComponent(fields)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Playlist-aanvraag mislukt (${res.status}) op offset ${offset}: ${await res.text()}`);
  }
  return res.json(); // paging object: { total, items: [...] }
}

function toTrackRecord(entry, rank) {
  const t = entry.item;
  if (!t || entry.is_local || t.type !== 'track' || !t.id) return null;
  const year = t.album?.release_date ? parseInt(t.album.release_date.slice(0, 4), 10) : null;
  return {
    id: t.id,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(', '),
    cover: t.album?.images?.[0]?.url ?? null,
    rank,
    spotify_album_year: Number.isFinite(year) ? year : null,
  };
}

async function main() {
  const token = await getUserAccessToken();
  if (!token) return; // login-instructies zijn al geprint; kom terug met --code-url

  const tracks = [];
  let offset = 0;
  let total = null;

  while (total === null || offset < total) {
    if (limit && offset >= limit) break;
    const pageSize = limit ? Math.min(PAGE_SIZE, limit - offset) : PAGE_SIZE;
    const page = await fetchPage(token, offset, pageSize);
    total = page.total;

    page.items.forEach((entry, i) => {
      const rank = offset + i + 1;
      const rec = toTrackRecord(entry, rank);
      if (rec) tracks.push(rec);
    });

    offset += page.items.length;
    if (page.items.length < pageSize) break; // geen items meer
  }

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(
    OUT_PATH,
    JSON.stringify(
      {
        fetched_at: new Date().toISOString(),
        source_playlist: ORIGINAL_PLAYLIST_URI,
        fetched_from_own_playlist_id: SPOTIFY_OWN_PLAYLIST_ID,
        requested_limit: limit,
        total_in_playlist: total,
        tracks,
      },
      null,
      2
    )
  );

  console.log(`\n${tracks.length} geldige tracks opgehaald (playlist bevat in totaal ${total}).`);
  console.log(`Weggeschreven naar ${path.relative(process.cwd(), OUT_PATH)}\n`);
  console.log('Rang 1–3 (controleer of rang 1 = de #1 uit de Top 2000):');
  tracks.slice(0, 3).forEach((t) => {
    console.log(`  #${t.rank} — ${t.artist} — ${t.title} (album-jaar: ${t.spotify_album_year})`);
  });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
