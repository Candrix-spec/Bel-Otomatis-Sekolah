# Cara Pasang Agen Daya di PC Bel

Agen ini membuat **PC bel mati sendiri** di jam yang diatur admin (tab **⏻ Daya PC** di panel admin bel) dan **membuka halaman bel otomatis** setiap PC menyala.
Menyalakan PC pagi hari diatur terpisah (BIOS / Mikrotik) — lihat bagian B.

Total waktu pasang: ±15 menit, sekali saja.

---

## A. Pasang agen (untuk mati otomatis + buka bel sendiri)

### 1. Syarat
- PC bel Windows 10/11, tersambung internet (untuk sync ke server bel).
- **Python 3** terpasang. Cek: buka Command Prompt, ketik `python --version`.
  Belum ada? Install dari python.org — saat install **centang "Add Python to PATH"**.
- Chrome atau Brave terpasang.

### 2. Salin folder agen
Salin folder `agen-pc-bel` ke PC bel, misalnya menjadi `C:\bel-agen\` (isi: `pc-bel-agent.py` + file ini).

### 3. Coba dulu (mode aman, tidak mematikan PC)
Buka Command Prompt di folder itu:

```
python pc-bel-agent.py --dry-run --sekali
```

Harus muncul log agen mulai + membaca server. Kalau ada baris ralat, baca pesannya.

### 4. Buat tugas otomatis (Task Scheduler) — agen jalan tiap Windows masuk
Jalankan perintah ini di Command Prompt **Run as Administrator** (sesuaikan path):

```
schtasks /Create /TN "Agen Bel Sekolah" /SC ONLOGON /TR "pythonw.exe C:\bel-agen\pc-bel-agent.py" /F
```

`pythonw.exe` = Python tanpa jendela console. Cek terdaftar: `schtasks /Query /TN "Agen Bel Sekolah"`.
Hapus tugas (kalau perlu): `schtasks /Delete /TN "Agen Bel Sekolah" /F`.

### 5. (Disarankan) Windows masuk otomatis tanpa ketik password
Supaya rantai pagi hari tidak tersangkut layar login:
Tekan `Win+R` → ketik `netplwiz` → Enter → hilangkan centang "Users must enter a user name and password" → OK → isi password akun itu sekali. (Kalau kotak centangnya tidak ada, aktifkan dulu dari Settings > Accounts > Sign-in options: matikan "Require Windows Hello sign-in".)

### 6. Aktifkan dari panel admin
Buka https://bel.apiancandra.com/#admin → tab **⏻ Daya PC**:
- Status agen harus 🟢 (agen lapor tiap ±1 menit).
- Centang **Aktifkan mati otomatis**, atur jam mati + hari + menit peringatan → **Simpan & Terbitkan**.

### Cara kerja sehari-hari
- Menjelang jam mati, layar bel menampilkan banner hitung mundur besar.
- Guru yang masih memakai PC menekan **Batalkan Mati Hari Ini** di layar → PC tidak jadi mati (besok normal lagi). Bisa juga dari Command Prompt: `shutdown /a`.
- Kalau PC ternyata baru dinyalakan MELEWATI jam mati (mis. dinyalakan manual jam 18:00 padahal jam mati 17:30), agen memberi waktu 60 detik lalu mematikan — kecuali dibatalkan.

Log agen tersimpan di `C:\bel-agen\agen.log` — buka file itu kalau ada yang terasa janggal.

---

## B. Menyalakan PC pagi hari (pilih SATU)

PC yang mati total tidak bisa menerima perintah apa pun dari aplikasi. Pakai salah satu:

### Opsi 1 — BIOS RTC (paling andal, tanpa alat lain)
1. Nyalakan/restart PC, tekan berulang tombol masuk BIOS (**Del** atau **F2**, tergantung merk) saat logo muncul.
2. Cari menu **Power Management / APM / Advanced**.
3. Aktifkan **Resume by Alarm / RTC Wake / Power On by RTC** → mode **Daily / Every Day** → jam **05:45**.
4. Simpan & keluar (**F10**).
5. Uji: matikan PC malamnya (Shutdown penuh, jangan cabut listrik) → besok 05:45 PC harus menyala sendiri.
   - Catatan: matikan juga "Fast Startup" Windows (Control Panel > Power Options > Choose what the power buttons do > hilangkan centang Turn on fast startup) kalau RTC tidak bekerja.

### Opsi 2 — Wake-on-LAN dari Mikrotik sekolah
1. Di BIOS PC bel: aktifkan **Wake on LAN / Power On by PCI-E**.
2. Di Windows PC bel: Device Manager → Network adapter → Properties → Power Management → centang "Allow this device to wake the computer" + "Only allow a magic packet…"; tab Advanced → "Wake on Magic Packet" = Enabled. Matikan Fast Startup (lihat di atas).
3. Catat MAC address PC bel (`ipconfig /all` → Physical Address).
4. Di Mikrotik (Winbox): buat script + scheduler, contoh jam 05:45 tiap hari:
   - System > Scripts > + : Name `wol-pc-bel`, Source: `/tool wol interface=ether2 mac=AA:BB:CC:DD:EE:FF` (ganti interface & MAC).
   - System > Scheduler > + : Name `nyalakan-pc-bel`, Start Time `05:45:00`, Interval `1d`, On Event `wol-pc-bel`.

---

## Rantai pagi yang diharapkan
05:45 PC menyala sendiri (BIOS/Mikrotik) → Windows masuk otomatis → agen jalan (Task Scheduler) → agen membuka Chrome ke bel.apiancandra.com dengan suara otomatis → halaman bel aktif sendiri tanpa klik → 06:10 lagu pagi mulai. Sore: banner peringatan → PC mati sendiri.
