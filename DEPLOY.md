# Deploying Attest

Attest targets a modest-RAM VPS (1–2 GB), linux/amd64 or linux/arm64, no GPU.

## VPS runbook (Docker)

```bash
# 1. Install Docker (Debian/Ubuntu)
curl -fsSL https://get.docker.com | sh

# 2. Get the code and build
git clone https://github.com/PrabakaranR-code/Attest.git && cd Attest
docker build -t attest .

# 3. Run with a named volume for the signing keypair (the only persisted state)
docker run -d --name attest --restart unless-stopped \
  -p 8080:8080 -v attest-data:/data attest

# 4. Smoke test
curl -s http://localhost:8080/healthz
curl -s http://localhost:8080/pubkey
```

Put a reverse proxy (Caddy/nginx) with TLS in front for public exposure; the MCP door is then reachable at `https://your-host/mcp`.

Sizing notes: `MAX_CONCURRENCY=3` and `ATTEST_MAX_RSS_MB=1024` suit a 2 GB VPS. For 1 GB, set `MAX_CONCURRENCY=1` and `ATTEST_MAX_RSS_MB=512`.

## Key persistence check (two-run)

The signing identity must survive restarts. This check **boots the server twice** against the same volume and compares `public_key_id`:

```bash
docker volume create attest-keycheck

# Run 1: boots, generates the keypair on first boot
docker run -d --name attest-check -p 18080:8080 -v attest-keycheck:/data attest
until curl -sf http://localhost:18080/healthz > /dev/null; do sleep 1; done
ID1=$(curl -s http://localhost:18080/pubkey | python3 -c 'import json,sys; print(json.load(sys.stdin)["public_key_id"])')
docker rm -f attest-check

# Run 2: fresh container, same volume — must report the same key id
docker run -d --name attest-check -p 18080:8080 -v attest-keycheck:/data attest
until curl -sf http://localhost:18080/healthz > /dev/null; do sleep 1; done
ID2=$(curl -s http://localhost:18080/pubkey | python3 -c 'import json,sys; print(json.load(sys.stdin)["public_key_id"])')
docker rm -f attest-check

echo "run1=$ID1 run2=$ID2"
[ "$ID1" = "$ID2" ] && echo "KEY PERSISTENCE OK" || echo "KEY PERSISTENCE FAILED"
docker volume rm attest-keycheck
```

Back up the volume (`/data/keys`) if the signing identity matters to you; receipts signed by a lost key remain verifiable only if you kept the public key.

## Bare-metal (no Docker)

```bash
git clone https://github.com/PrabakaranR-code/Attest.git && cd Attest
npm ci && npx playwright install --with-deps chromium
npm run build
ATTEST_KEY_DIR=/var/lib/attest/keys PORT=8080 node dist/server.js
```

Use a systemd unit with `Restart=always`; the engine relaunches its browser on crash and recycles it on the capture-count and RSS limits.
