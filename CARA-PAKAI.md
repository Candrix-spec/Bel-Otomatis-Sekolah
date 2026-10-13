# 🔔 Bel Sekolah Otomatis — Cara Pakai

Aplikasi bel sekolah: jadwal diatur **admin secara online**, PC bel (client) **tetap bunyi walau internet mati**.

## Cara kerja (penting dipahami)

- **Server** = tempat config pusat (nama sekolah, jadwal, volume, file lagu). Jalan di 1 tempat:
  PC TU / STB / VPS / Railway — yang penting bisa diakses admin & PC bel sesekali.
- **Client** = halaman bel yang dibuka di PC yang tersambung ke speaker sekolah.
  Setiap ±30 detik client cek server: kalau ada config baru dari admin → otomatis dipakai.
  Kalau internet/server mati → client jalan terus pakai config terakhir yang tersimpan di PC itu. **Bel tidak pernah batal gara-gara offline.**
- File lagu yang sudah pernah diunduh client akan di-cache, jadi lagu pagi tetap bisa diputar offline.

## 1. Jalankan server

Butuh Node.js saja (tanpa `npm install` — tidak ada dependency):

```bash
ADMIN_PASSWORD=ganti-password-ini node server.js
# terbuka di http://localhost:3420
```

- Password admin default `admin123` kalau env tidak diisi — **wajib ganti**.
- Data tersimpan di `data/config.json` + `data/audio/` — backup dua itu = backup semua.
  Update/ganti file aplikasi tidak menghapus folder `data/`.
- Untuk online beneran: deploy folder ini ke Railway/VPS, atau jalankan di STB/PC sekolah
  lalu buka port-nya / pakai tunnel seperti aplikasi Apian yang lain. Semua client cukup
  membuka URL server yang sama.

## 2. Di PC bel (client)

1. Buka URL server di Chrome, sambungkan PC ke speaker/amplifier.
2. Klik **▶ Aktifkan & Mulai** (wajib 1 klik — aturan browser supaya audio boleh bunyi otomatis).
3. Klik **⛶ Layar Penuh**. Biarkan tab terbuka terus. Jangan matikan PC-nya.
4. Status di atas jam menunjukkan **Online/Offline** + versi config terakhir.

## 3. Admin mengatur (dari HP/laptop, di mana saja)

1. Buka URL yang sama → **🔐 Masuk Admin** → password.
2. **Umum & Volume** — nama sekolah, motto, volume master / bel / lagu.
3. **Jadwal Bel** — tambah/ubah jam, nama bel, hari aktif, suara (bawaan atau file upload). Ada tombol Tes per baris.
4. **File Audio** — upload MP3 lagu nasional / pengumuman (maks 15MB). Tersimpan di server + lokal.
5. **Lagu Pagi** — aktifkan, jam mulai (mis. 06:30), berhenti saat bel masuk pertama atau setelah durasi,
   hari aktif, urutan urut/acak, lalu pasangkan tiap judul lagu ke file audionya.
6. Klik **💾 Simpan & Terbitkan** → config versi baru; semua client online sync otomatis ±30 detik.
   Client yang sedang offline akan menerima update ini saat online berikutnya.

Mode offline admin: kalau server tidak terjangkau saat login, admin masuk mode OFFLINE —
perubahan hanya tersimpan di PC itu saja (cocok untuk darurat di PC bel langsung).

## Kategori jadwal (v2)

Di tab Jadwal Bel ada **kategori** (Normal, Ujian, Bulan Puasa, + buat sendiri):
tiap kategori punya jadwal sendiri. ⭐ = kategori aktif manual. Isi **rentang tanggal**
pada sebuah kategori → pada tanggal itu kategori tersebut **otomatis** yang dipakai
(mis. Ujian 15–20 Des), lewat tanggalnya otomatis balik ke kategori aktif biasa.
Tombol **Salin** menyalin jadwal dari kategori lain supaya tidak mengisi dari nol.
Suara per jadwal juga bisa **upload MP3 langsung dari kolom Suara** ("⬆ Upload audio baru…").

## Pengumuman suara (v2)

Tab **📢 Pengumuman** di panel admin: ketik teks (ada template Panggilan/Pengumuman/Kumpul),
pilih diucapkan 1–5 kali, klik **Kirim ke PC Bel**. Dalam ±5 detik PC bel menjeda lagu,
menampilkan teksnya besar-besar di layar, dan **mengucapkannya** (text-to-speech Indonesia).
Syarat: PC bel sedang online & sudah pernah klik "Aktifkan & Mulai". Antrean tersimpan 2 jam
di server; tiap PC bel hanya mengucapkan tiap pengumuman sekali.

## Suara bawaan (tanpa file, selalu offline-ready)

Bel Klasik • Bel Panjang • Ding-Dong • Lonceng • Beep — dibuat langsung oleh browser.

## Catatan lagu nasional

Daftar judul (Indonesia Raya, Garuda Pancasila, Bagimu Negeri, Maju Tak Gentar, Halo-Halo Bandung)
sudah disiapkan di panel — **file MP3-nya upload sendiri** di tab File Audio, lalu pasangkan di tab Lagu Pagi.
Lagu diputar berurutan dari jam mulai sampai bel masuk pertama, volumenya mengikuti "Volume lagu".

## Batasan jujur

- Halaman client harus **tetap terbuka** di browser (ini aplikasi web, bukan service Windows).
  Atur PC bel: Chrome auto-start + power plan "tidak sleep".
- Upload audio mode lokal saja (server mati) tidak menyebar ke PC lain — upload ulang saat online.
- 1 server melayani banyak client (bisa 1 PC bel per gedung, semua sync jadwal yang sama).
