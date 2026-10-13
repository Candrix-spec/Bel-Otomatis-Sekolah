#!/bin/bash
# Deploy Bel Sekolah Otomatis di STB (Armbian) — systemd service, port 3420
# Jalankan dari folder hasil extract zip:  ./deploy-stb.sh
set -e
cd "$(dirname "$0")"
APP_DIR="$HOME/bel-sekolah"
echo "== Bel Sekolah: deploy ke $APP_DIR =="

command -v node >/dev/null || { echo "❌ Node.js belum terinstall di STB"; exit 1; }
echo "Node: $(node -v) — RAM aplikasi ini kecil (±40MB, nyaris tanpa CPU saat idle)"

# Salin aplikasi (folder data/ TIDAK ditimpa kalau sudah ada — jadwal & audio aman)
mkdir -p "$APP_DIR"
cp -r server.js public CARA-PAKAI.md "$APP_DIR/" 2>/dev/null || cp -r server.js public "$APP_DIR/"
mkdir -p "$APP_DIR/data/audio"
[ -f "$APP_DIR/data/config.json" ] && echo "ℹ️  data/config.json lama dipertahankan" || true

# Password admin -> .env (tidak pernah ditulis ke repo/chat)
if [ ! -f "$APP_DIR/.env" ]; then
  echo ""
  read -rp "Buat password admin Bel Sekolah: " PW
  [ -z "$PW" ] && { echo "❌ Password tidak boleh kosong"; exit 1; }
  printf "PORT=3420\nADMIN_PASSWORD=%s\n" "$PW" > "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
  echo "✅ Password tersimpan di $APP_DIR/.env (chmod 600)"
else
  echo "ℹ️  .env lama dipertahankan (password tidak berubah)"
fi

# systemd service
SERVICE=/etc/systemd/system/bel-sekolah.service
sudo tee "$SERVICE" >/dev/null <<EOF
[Unit]
Description=Bel Sekolah Otomatis
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=$(command -v node) $APP_DIR/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now bel-sekolah
sleep 1
echo ""
echo "--- Verifikasi lokal ---"
curl -s http://localhost:3420/api/health && echo ""
curl -s http://localhost:3420/api/config | head -c 160 && echo ""
systemctl is-active bel-sekolah
echo ""
echo "✅ Server bel jalan lokal di STB (port 3420)."
echo "➡️  Langkah terakhir: jalankan ./tambah-tunnel.sh untuk membuka https://bel.apiancandra.com"
