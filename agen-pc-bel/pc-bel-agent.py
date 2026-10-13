#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Agen Daya PC Bel — program kecil yang tinggal di PC bel sekolah.
Tugasnya:
  1. Membaca pengaturan "Daya PC" dari server bel (config.power) tiap ±15 detik.
  2. Lapor diri (heartbeat) ke server supaya admin bisa melihat agen aktif.
  3. Menjelang jam mati: menyalakan hitung mundur shutdown Windows
     (shutdown /s /t ...) — layar bel menampilkan banner peringatan + tombol
     Batalkan; kalau dibatalkan dari layar, agen menjalankan shutdown /a.
  4. Saat mulai jalan: membuka Chrome/Brave ke halaman bel dengan izin suara
     otomatis, supaya bel langsung aktif tanpa klik.
Menyalakan PC pagi hari BUKAN tugas agen ini (PC mati total) — itu dari
BIOS RTC / Wake-on-LAN. Lihat CARA-PASANG-AGEN.md.

Hanya memakai pustaka standar Python 3. Jalan di Windows (target utama).
Mode aman untuk mencoba:  python pc-bel-agent.py --dry-run
"""
import json, os, platform, socket, subprocess, sys, time, urllib.request
from datetime import datetime, timedelta

SERVER = os.environ.get('BEL_SERVER', 'https://bel.apiancandra.com').rstrip('/')
DRY = '--dry-run' in sys.argv or os.environ.get('BEL_DRY_RUN') == '1'
SEKALI = '--sekali' in sys.argv          # satu putaran lalu keluar (buat tes)
NO_CHROME = '--no-chrome' in sys.argv
NAME = socket.gethostname() or 'pc-bel'
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE_F = os.path.join(HERE, 'agen-cache.json')
LOG_F = os.path.join(HERE, 'agen.log')
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0 Safari/537.36')
POLL = 15          # detik antar pemeriksaan
HEARTBEAT = 60     # detik antar laporan ke server

def log(msg):
    line = '[%s] %s' % (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), msg)
    print(line, flush=True)
    try:
        with open(LOG_F, 'a', encoding='utf-8') as f:
            f.write(line + '\n')
    except Exception:
        pass

def http(method, path, data=None, timeout=10):
    req = urllib.request.Request(SERVER + path, method=method)
    req.add_header('User-Agent', UA)
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req, body, timeout=timeout) as resp:
        raw = resp.read().decode('utf-8', 'replace')
        return json.loads(raw) if raw else {}

def load_cache():
    try:
        with open(CACHE_F, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}

def save_cache(c):
    try:
        with open(CACHE_F, 'w', encoding='utf-8') as f:
            json.dump(c, f)
    except Exception as e:
        log('gagal simpan cache: %s' % e)

def run_cmd(args, why):
    log('%s: %s%s' % (why, ' '.join(args), ' (DRY-RUN, tidak dieksekusi)' if DRY else ''))
    if DRY:
        return
    try:
        subprocess.run(args, capture_output=True, timeout=30)
    except Exception as e:
        log('gagal menjalankan perintah: %s' % e)

def buka_browser_bel():
    """Buka Chrome/Brave ke halaman bel dengan suara otomatis (sekali, saat agen mulai)."""
    if platform.system() != 'Windows':
        log('bukan Windows — lewati buka browser otomatis')
        return
    url = SERVER + '/'
    try:
        out = subprocess.run(['tasklist'], capture_output=True, text=True, timeout=15).stdout.lower()
    except Exception:
        out = ''
    if 'chrome.exe' in out or 'brave.exe' in out:
        log('browser sudah jalan — tidak dibuka lagi')
        return
    candidates = [
        r'C:\Program Files\Google\Chrome\Application\chrome.exe',
        r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
        os.path.expandvars(r'%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe'),
        r'C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe',
        os.path.expandvars(r'%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe'),
    ]
    exe = next((c for c in candidates if os.path.exists(c)), None)
    if not exe:
        log('Chrome/Brave tidak ditemukan — buka halaman bel manual: %s' % url)
        return
    args = [exe, '--autoplay-policy=no-user-gesture-required', '--start-maximized',
            '--no-first-run', '--disable-session-crashed-bubble', url]
    log('membuka browser bel: %s%s' % (exe, ' (DRY-RUN)' if DRY else ''))
    if DRY:
        return
    try:
        subprocess.Popen(args)
    except Exception as e:
        log('gagal membuka browser: %s' % e)

def main():
    log('Agen Daya PC Bel mulai — server: %s | PC: %s | dry-run: %s' % (SERVER, NAME, DRY))
    if not NO_CHROME:
        buka_browser_bel()
    cache = load_cache()
    state = {'date': None, 'issued': False, 'last_hb': 0.0}
    while True:
        now = datetime.now()
        today = now.strftime('%Y-%m-%d')
        if state['date'] != today:
            state = {'date': today, 'issued': False, 'last_hb': state['last_hb']}
        # --- ambil data terbaru (gagal -> pakai cache terakhir) ---
        try:
            cfg = http('GET', '/api/config')
            pw = http('GET', '/api/power')
            cache = {'config': cfg, 'power': pw}
            save_cache(cache)
        except Exception as e:
            log('server tak terjangkau (%s) — pakai data terakhir' % e)
            cfg = cache.get('config') or {}
            pw = cache.get('power') or {}
        # --- heartbeat ---
        if time.time() - state['last_hb'] >= HEARTBEAT:
            try:
                http('POST', '/api/power/heartbeat', {'name': NAME}, timeout=8)
                state['last_hb'] = time.time()
            except Exception:
                pass
        # --- logika mati otomatis ---
        try:
            p = (cfg or {}).get('power') or {}
            js_day = (now.weekday() + 1) % 7  # Python Mon=0..Sun=6 -> JS getDay (Sun=0..Sat=6); days di config memakai getDay
            if p.get('enabled') and js_day in (p.get('days') or []):
                hh, mm = (p.get('shutdownTime') or '17:30').split(':')[:2]
                off = now.replace(hour=int(hh), minute=int(mm), second=0, microsecond=0)
                warn = off - timedelta(minutes=max(1, int(p.get('warnMinutes') or 5)))
                cancelled = (pw or {}).get('cancelDate') == today
                if cancelled and state['issued']:
                    run_cmd(['shutdown', '/a'], 'dibatalkan dari layar bel -> batalkan hitung mundur Windows')
                    state['issued'] = False
                elif not cancelled:
                    if warn <= now < off and not state['issued']:
                        secs = max(30, int((off - now).total_seconds()))
                        run_cmd(['shutdown', '/s', '/t', str(secs), '/c',
                                 'PC bel akan mati otomatis sesuai jadwal admin bel sekolah.'],
                                'masuk masa peringatan -> mulai hitung mundur shutdown')
                        state['issued'] = True
                    elif off <= now <= off + timedelta(minutes=15) and not state['issued']:
                        run_cmd(['shutdown', '/s', '/t', '60', '/c',
                                 'PC bel mati otomatis (jadwal admin) — PC baru menyala/kembali dari tidur melewati jam mati.'],
                                'melewati jam mati -> shutdown 60 detik')
                        state['issued'] = True
        except Exception as e:
            log('ralat logika daya: %s' % e)
        if SEKALI:
            log('mode --sekali: satu putaran selesai')
            return
        time.sleep(POLL)

if __name__ == '__main__':
    main()
