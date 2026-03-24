#!/usr/bin/env bash
set -e

NGROK_BIN=/home/runner/workspace/node_modules/@expo/ngrok-bin-linux-x64/ngrok
PORT=5000

# Kill any lingering ngrok or metro processes
pkill -f "ngrok http" 2>/dev/null || true
sleep 1

# Start ngrok in background, tunnel to Metro port
"$NGROK_BIN" http "$PORT" --log=stdout --log-format=json &
NGROK_PID=$!

echo "Starting ngrok tunnel (pid $NGROK_PID)..."

# Wait up to 15s for the tunnel URL to appear via the local API
TUNNEL_URL=""
for i in $(seq 1 30); do
  sleep 0.5
  TUNNEL_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null \
    | node -e "
        try {
          const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
          const t = (d.tunnels || []).find(t => t.proto === 'https' || t.proto === 'http');
          if (t) process.stdout.write(t.public_url);
        } catch(e) {}
      " 2>/dev/null) || true
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
done

if [ -z "$TUNNEL_URL" ]; then
  echo "ERROR: ngrok failed to establish a tunnel. Check authtoken."
  kill "$NGROK_PID" 2>/dev/null || true
  exit 1
fi

# Extract just the hostname (Metro needs it without protocol)
TUNNEL_HOST=$(echo "$TUNNEL_URL" | sed 's|https\?://||')

echo ""
echo "Tunnel established: $TUNNEL_URL"
echo "Metro will advertise: $TUNNEL_HOST"
echo ""

# Start Expo with the tunnel hostname injected
export REACT_NATIVE_PACKAGER_HOSTNAME="$TUNNEL_HOST"
exec npx expo start --port "$PORT"
