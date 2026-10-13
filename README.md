# Bel Sekolah Otomatis 🔔

Aplikasi bel sekolah otomatis: server ringan **tanpa dependency** (Node.js bawaan)
+ client PWA satu halaman. Admin mengatur semuanya **online** dari HP/laptop;
PC bel di sekolah **tetap jalan offline** pakai config terakhir yang tersimpan lokal.

## Fitur
- ⏰ Jadwal bel per hari, per kategori jadwal (Normal / Ujian / Bulan Puasa / …) dengan rentang tanggal otomatis
- 🔊 Suara bel bawaan (sintesis WebAudio) + upload MP3
- 🎵 Lagu nasional otomatis setiap pagi sebelum bel pertama
- 📢 Pengumuman suara: ketik teks → PC bel mengucapkannya (text-to-speech)
- ⏻ Daya PC: agen kecil di PC bel mematikan PC otomatis sesuai jadwal admin (nyala pagi via BIOS RTC / Wake-on-LAN)
- 📴 Tahan offline: localStorage + Service Worker + IndexedDB

Panduan lengkap pemakaian ada di [CARA-PAKAI.md](CARA-PAKAI.md).
Panduan agen daya: [agen-pc-bel/CARA-PASANG-AGEN.md](agen-pc-bel/CARA-PASANG-AGEN.md).

## Jalankan (2 menit)

Butuh Node.js saja, tanpa `npm install`:

```bash
ADMIN_PASSWORD=ganti-dengan-password-kuat node server.js
# buka http://localhost:3420
# admin: http://localhost:3420/#admin
```

- Password default `admin123` kalau env tidak diisi — **wajib diganti** untuk pemakaian nyata.
- Semua data tersimpan di `data/` (`config.json`, `audio/`, `power.json`, `announcements.json`).
  Folder `data/` **tidak ikut** repo ini — backup dua file itu = backup semua.
- Versi config naik otomatis tiap "Simpan & Terbitkan"; client sync ±30 detik.

## Struktur

```
server.js            # server Node.js murni (tanpa dependency), port 3420
public/
  index.html         # client + panel admin (satu halaman PWA)
  sw.js              # service worker (offline)
  manifest.webmanifest
agen-pc-bel/
  pc-bel-agent.py    # agen daya untuk PC bel Windows (Python stdlib)
  CARA-PASANG-AGEN.md
CARA-PAKAI.md        # panduan pemakaian lengkap (Bahasa Indonesia)
deploy-stb.sh        # contoh deploy ke STB/Armbian (systemd)
tambah-tunnel.sh     # contoh tambah subdomain ke tunnel Cloudflare
```
