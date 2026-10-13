// Bel Sekolah Otomatis — server ringan TANPA dependency (Node.js bawaan saja)
// Fungsi server: (1) melayani client bel, (2) menyimpan config pusat,
// (3) admin online mengedit config -> client otomatis sync saat online.
// Client tetap jalan OFFLINE memakai config terakhir yang tersimpan lokal.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3420;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
const AUDIO_DIR = path.join(DATA, 'audio');
const CONFIG_FILE = path.join(DATA, 'config.json');
fs.mkdirSync(AUDIO_DIR, { recursive: true });

const DEFAULT_CONFIG = {
  version: 1,
  updatedAt: null,
  school: { name: 'SMK 11 Maret Jakarta', motto: 'Disiplin • Terampil • Berkarakter', year: '' },
  volume: { master: 80, bell: 100, music: 60 }, // persen; volume final = master x per-jenis
  morningMusic: {
    enabled: true,
    startTime: '06:30',
    stopAt: 'firstBell', // firstBell | duration
    durationMinutes: 30,
    days: [1, 2, 3, 4, 5],
    mode: 'urut', // urut | acak
    tracks: [] // daftar lagu diisi admin via panel / tab Lagu Pagi
  },
  // Daya PC bel: agen kecil di PC bel membaca ini -> shutdown otomatis di jam yang diatur.
  // Menyalakan pagi hari BUKAN dari sini (PC mati total) — dari BIOS RTC / Wake-on-LAN Mikrotik.
  power: { enabled: false, shutdownTime: '17:30', days: [1, 2, 3, 4, 5, 6], warnMinutes: 5 },
  audios: [],
  schedules: [], // jadwal bel diisi admin via panel / tab Jadwal Bel
  // Kategori jadwal (profil). Client bermigrasi otomatis dari format lama (schedules polos).
  activeProfileId: 'normal',
  profiles: [
    { id: 'normal', name: 'Normal', from: '', to: '', schedules: null }, // schedules:null = pakai daftar schedules di atas
    { id: 'ujian', name: 'Ujian', from: '', to: '', schedules: [] },
    { id: 'puasa', name: 'Bulan Puasa', from: '', to: '', schedules: [] }
  ]
};

/* ===== Pengumuman (teks dari admin -> disuarakan client bel) ===== */
const ANN_FILE = path.join(DATA, 'announcements.json');
function loadAnn() { try { return JSON.parse(fs.readFileSync(ANN_FILE, 'utf8')); } catch { return []; } }
function saveAnn(list) { fs.writeFileSync(ANN_FILE, JSON.stringify(list.slice(-50), null, 2)); }

/* ===== Status daya PC bel (laporan agen + pembatalan) ===== */
const POWER_FILE = path.join(DATA, 'power.json');
function loadPower() { try { return JSON.parse(fs.readFileSync(POWER_FILE, 'utf8')); } catch { return { agent: null, cancelDate: '' }; } }
function savePower(p) { fs.writeFileSync(POWER_FILE, JSON.stringify(p, null, 2)); }

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch { fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2)); return structuredClone(DEFAULT_CONFIG); }
}
function saveConfig(cfg) {
  // Versi SELALU naik dari yang tersimpan di disk — jangan percaya body POST
  // (handler menghapus version dari body; dulu ini bikin versi mentok di 2 selamanya
  //  dan client tidak pernah tahu ada update).
  let cur = 1; try { cur = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')).version || 1; } catch {}
  cfg.version = cur + 1;
  cfg.updatedAt = new Date().toISOString();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  return cfg;
}
function isAdmin(req) { return req.headers['x-admin-password'] === ADMIN_PASSWORD; }
function body(req, limit = 30 * 1024 * 1024) {
  return new Promise((res, rej) => { let d=''; req.on('data', c => { d+=c; if (d.length>limit) req.destroy(); }); req.on('end', ()=>res(d)); req.on('error', rej); });
}
const MIME = { '.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webmanifest':'application/manifest+json' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (code, data, type='application/json') => { res.writeHead(code, {'Content-Type':type,'Cache-Control':'no-store'}); res.end(typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data)); };

  if (url.pathname === '/api/health') return send(200, { ok:true, app:'bel-sekolah', time:new Date().toISOString() });
  if (url.pathname === '/api/config' && req.method === 'GET') return send(200, loadConfig());
  if (url.pathname === '/api/config' && req.method === 'POST') {
    if (!isAdmin(req)) return send(401, { error:'Password admin salah' });
    try { const cfg = JSON.parse(await body(req)); delete cfg.version; return send(200, saveConfig(cfg)); }
    catch(e){ return send(400, { error:'JSON tidak valid: '+e.message }); }
  }
  if (url.pathname === '/api/announce' && req.method === 'GET') {
    const fresh = loadAnn().filter(a => Date.now() - a.at < 2 * 3600 * 1000);
    return send(200, { items: fresh });
  }
  if (url.pathname === '/api/announce' && req.method === 'POST') {
    if (!isAdmin(req)) return send(401, { error: 'Password admin salah' });
    try {
      const b = JSON.parse(await body(req, 64 * 1024));
      const text = String(b.text || '').trim().slice(0, 500);
      if (!text) return send(400, { error: 'Teks pengumuman kosong' });
      const item = { id: crypto.randomBytes(5).toString('hex'), text, repeat: Math.min(5, Math.max(1, +b.repeat || 2)), at: Date.now() };
      const list = loadAnn(); list.push(item); saveAnn(list);
      return send(200, item);
    } catch (e) { return send(400, { error: e.message }); }
  }
  if (url.pathname === '/api/announce/clear' && req.method === 'POST') {
    if (!isAdmin(req)) return send(401, { error: 'Password admin salah' });
    saveAnn([]); return send(200, { ok: true });
  }
  /* ===== Daya PC bel: status agen + pembatalan shutdown hari ini =====
     heartbeat & cancel SENGAJA tanpa password: agen di PC bel tidak menyimpan
     password admin, dan tombol Batalkan di layar PC bel harus bisa ditekan guru
     yang sedang di ruangan. Yang disimpan hanya stempel waktu & tanggal. */
  if (url.pathname === '/api/power' && req.method === 'GET') return send(200, loadPower());
  if (url.pathname === '/api/power/heartbeat' && req.method === 'POST') {
    try {
      const b = JSON.parse(await body(req, 16 * 1024) || '{}');
      const p = loadPower();
      p.agent = { name: String(b.name || 'pc-bel').slice(0, 60), at: Date.now() };
      savePower(p); return send(200, { ok: true });
    } catch (e) { return send(400, { error: e.message }); }
  }
  if (url.pathname === '/api/power/cancel' && req.method === 'POST') {
    try {
      const b = JSON.parse(await body(req, 16 * 1024) || '{}');
      const p = loadPower();
      p.cancelDate = String(b.date || '').slice(0, 10); // 'YYYY-MM-DD' menurut jam PC bel
      savePower(p); return send(200, { ok: true, cancelDate: p.cancelDate });
    } catch (e) { return send(400, { error: e.message }); }
  }
  if (url.pathname === '/api/login' && req.method === 'POST') {
    const b = JSON.parse(await body(req) || '{}');
    return b.password === ADMIN_PASSWORD ? send(200,{ok:true}) : send(401,{error:'Password admin salah'});
  }
  // Upload audio (base64) -> disimpan di server, client lain bisa download & cache
  if (url.pathname === '/api/audio' && req.method === 'POST') {
    if (!isAdmin(req)) return send(401, { error:'Password admin salah' });
    try {
      const b = JSON.parse(await body(req));
      const ext = (b.ext || 'mp3').replace(/[^a-z0-9]/gi,'').slice(0,4) || 'mp3';
      const name = crypto.randomBytes(6).toString('hex') + '.' + ext;
      fs.writeFileSync(path.join(AUDIO_DIR, name), Buffer.from(b.dataBase64, 'base64'));
      return send(200, { file: '/audio/' + name });
    } catch(e){ return send(400, { error:e.message }); }
  }
  if (url.pathname.startsWith('/audio/')) {
    const f = path.join(AUDIO_DIR, path.basename(url.pathname));
    if (!fs.existsSync(f)) return send(404, { error:'audio tidak ditemukan' });
    res.writeHead(200, {'Content-Type': MIME[path.extname(f)]||'audio/mpeg','Cache-Control':'public, max-age=31536000, immutable'});
    return fs.createReadStream(f).pipe(res);
  }
  // Static (PWA shell)
  let rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const fp = path.join(PUB, rel);
  if (!fp.startsWith(PUB) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) return send(404, 'Not found', 'text/plain');
  res.writeHead(200, {'Content-Type': MIME[path.extname(fp)]||'application/octet-stream', 'Cache-Control': rel==='sw.js' ? 'no-store' : 'no-cache'});
  fs.createReadStream(fp).pipe(res);
});
server.listen(PORT, '0.0.0.0', () => console.log(`Bel Sekolah jalan di http://localhost:${PORT}  (admin password: ${ADMIN_PASSWORD==='admin123'?'admin123 — GANTI via env ADMIN_PASSWORD!':'[env]'})`));
