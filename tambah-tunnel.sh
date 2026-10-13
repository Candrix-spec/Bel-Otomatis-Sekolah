#!/bin/bash
# Tambah rute bel.apiancandra.com -> localhost:3420 ke tunnel Cloudflare 'router9' di STB.
# Aman dijalankan ulang (cek dulu apakah rute sudah ada).
set -e
HOST="bel.apiancandra.com"

# Cari file config cloudflared — UTAMAKAN yang dipakai service systemd (ExecStart --config).
# Pelajaran 2026-10-11: di STB Apian ada DUA config — service baca /etc/cloudflared/config.yml,
# sedangkan salinan /root/.cloudflared/config.yml basi (tak berisi dokumenguru). Salah pilih
# file = subdomain lain hilang dari ingress.
CFG=""
EXEC_CFG=$(systemctl cat cloudflared 2>/dev/null | grep -o -- '--config [^ ]*' | head -1 | awk '{print $2}')
[ -n "$EXEC_CFG" ] && [ -f "$EXEC_CFG" ] && CFG="$EXEC_CFG"
if [ -z "$CFG" ]; then
  for f in "/etc/cloudflared/config.yml" "$HOME/.cloudflared/config.yml" "/etc/cloudflared/config.yaml" "$HOME/.cloudflared/config.yaml"; do
    [ -f "$f" ] && CFG="$f" && break
  done
fi
if [ -z "$CFG" ]; then
  echo "❌ config.yml cloudflared tidak ketemu. Isi folder ~/.cloudflared:"
  ls -la "$HOME/.cloudflared" 2>/dev/null || true
  echo "Berhenti — kirim output ini ke Muse."
  exit 1
fi
echo "Config tunnel: $CFG"
cat "$CFG"

if grep -q "$HOST" "$CFG"; then
  echo "ℹ️  $HOST sudah ada di ingress — tidak diubah."
else
  cp "$CFG" "$CFG.bak-bel"
  # Sisipkan ingress SEBELUM baris penutup "- service: http_status:404"
  python3 - "$CFG" "$HOST" <<'PYEOF'
import sys
cfg, host = sys.argv[1], sys.argv[2]
lines = open(cfg).read().splitlines(True)
out, done = [], False
for ln in lines:
    if not done and 'http_status:404' in ln:
        # Samakan persis dengan indentasi baris 404 yang ada (mis. " - service:")
        pre = ln[:ln.index('-')]
        out.append(f"{pre}- hostname: {host}\n")
        out.append(f"{pre}  service: http://localhost:3420\n")
        done = True
    out.append(ln)
if not done:
    out.append(f"  - hostname: {host}\n    service: http://localhost:3420\n")
open(cfg, 'w').writelines(out)
print("Ingress ditambahkan:", done)
PYEOF
  echo "✅ Ingress $HOST ditambahkan (backup: $CFG.bak-bel)"
fi

# Route DNS (butuh cert cloudflared login yang sudah ada dari setup router9)
if command -v cloudflared >/dev/null; then
  cloudflared tunnel route dns router9 "$HOST" || echo "ℹ️  Route DNS gagal/sudah ada — subdomain ini tampaknya sudah mengarah ke tunnel (wildcard), lanjut saja."
fi

# Validasi YAML dulu — JANGAN restart kalau config rusak (pernah bikin 520)
if command -v cloudflared >/dev/null; then
  if ! cloudflared tunnel --config "$CFG" ingress validate; then
    echo "❌ Config tunnel TIDAK valid — restore backup, cloudflared TIDAK direstart:"
    cp "$CFG.bak-bel" "$CFG" 2>/dev/null || true
    echo "   Config dikembalikan ke backup. Kirim output ini ke Muse."
    exit 1
  fi
  echo "✅ Config tunnel valid"
fi

# Restart cloudflared
if systemctl list-unit-files | grep -q '^cloudflared'; then
  sudo systemctl restart cloudflared && echo "✅ cloudflared direstart (service)"
elif systemctl list-unit-files | grep -q '^cf-tunnel'; then
  sudo systemctl restart cf-tunnel && echo "✅ cf-tunnel direstart (service)"
else
  echo "⚠️ cloudflared TIDAK jalan sebagai systemd service (masih foreground?)."
  echo "   Restart manual proses cloudflared-nya, atau pasang service:"
  echo "   sudo cloudflared service install && sudo systemctl enable --now cloudflared"
fi
sleep 3
echo "--- Tes dari STB ---"
curl -s -m 15 https://$HOST/api/health || echo "(belum respon — tunggu ±30 detik propagasi, lalu tes lagi dari HP)"
echo ""
echo "Selesai. Buka https://$HOST dari HP untuk memastikan."
