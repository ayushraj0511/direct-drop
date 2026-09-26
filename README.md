# Direct Drop

Direct Drop is a modern browser-based peer-to-peer file transfer website inspired by FilePizza.

## What it does

- Sender / Receiver landing page
- Sender file picker and drag & drop
- Temporary 6-digit pairing code
- QR code
- Shareable connection link
- WebRTC browser-to-browser transfer
- Live progress, speed and ETA
- Chunked large-file transfer
- WebRTC DataChannel backpressure
- No permanent file upload to the application server
- STUN configuration
- Optional TURN/Coturn fallback
- Responsive modern UI with smooth transitions

## Requirements

- Node.js 18+ recommended
- npm

## Install

```bash
npm install
```

## Development

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run server
```

For the simplest production-like run:

```bash
npm run build
npm start
```

Then open:

```text
http://localhost:3000
```

## Production / different networks

Use HTTPS in production. Configure a TURN server for networks where direct WebRTC connectivity fails.

Copy `.env.example` to `.env` and set:

```env
PORT=3000
BASE_URL=https://your-domain.example
TURN_URL=turn:turn.your-domain.example:3478
TURN_USERNAME=...
TURN_CREDENTIAL=...
```

The project intentionally does not receive or store the actual file in the Node/Express application. The server handles temporary pairing/session information and PeerJS signaling. File bytes travel through the WebRTC DataChannel when the connection is established.

## Architecture

```text
Browser A (Sender)
      |
      | WebRTC DataChannel
      |
Browser B (Receiver)

        ^
        |
Temporary signaling/session server
        |
   STUN / optional TURN
```

## Important limitation

"Any network" does not mean every pair of devices will always have a direct P2P path. WebRTC may need a TURN relay when NAT/firewall rules prevent a direct connection. A TURN server is therefore recommended for a real production deployment.

## Security notes

- Use HTTPS.
- Use short-lived sessions.
- Keep TURN credentials server-side.
- Keep rate limits on 6-digit code attempts.
- Do not store transferred files on the application server.
- Expire sessions after inactivity.
