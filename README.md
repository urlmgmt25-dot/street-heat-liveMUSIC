# STREET HEAT LIVE

A runnable, self-hosted live video guest studio and music review queue. Built with Node.js, Express, Socket.IO, and browser WebRTC. **This is a functional starter, not a finished commercial multistreaming service.**

## Start

1. Install Node.js 20 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set a strong random `HOST_KEY`.
4. Run `npm start`.
5. Open `http://localhost:3000` and enter your host key to join as host.
6. Click **Copy Guest Invite** and send the link to guests. Guests leave the host key blank.

For guests on other devices, deploy behind **HTTPS**. Browser camera and screen-sharing APIs require a secure context (localhost is allowed). To share tab audio, select the browser tab and enable tab-audio sharing when offered. Use headphones for every guest.

## Included and working

- Browser camera and microphone preview
- WebRTC guest-to-guest video/audio (mesh, max 10 participants)
- Room links, participant list, host kick controls, text chat
- Screen video sharing to guests (camera video replaced with shared screen)
- Persistent song submission queue (`data/queue.json`)
- Host review selection, rating 0–10, and synchronized score overlay
- Local audio/video preview, authenticated media uploads (100 MB max)
- Basic REST API and Socket.IO events
- Responsive dark studio dashboard

## Known limitations / production work

- **Social multistreaming is NOT implemented.** Use OBS Studio to capture the browser studio window and stream to YouTube, Facebook, Twitch or an RTMP relay. Each provider requires its own streaming authorization/key. Social account OAuth, aggregated comments, and server-side RTMP publishing require additional engineering.
- Browser screen **video** is sent to guests. Screen/tab **audio** is not mixed into the guest WebRTC audio track; use OBS desktop/tab audio for external broadcasting or implement a Web Audio mix before sending.
- Guests join immediately; there is no waiting-room approval workflow yet.
- WebRTC mesh is best for small rooms; 10 participants can overload host upload bandwidth. Use an SFU (LiveKit/mediasoup) for production.
- STUN-only calls may fail behind strict NAT. Configure `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` with a real TURN server.
- The host key is shared with the server over HTTPS in production; use stronger user authentication, roles, session management, rate limiting, CSRF protections, upload malware scanning, and object storage before public deployment.
- Song submissions are open without rate limits; add CAPTCHA, abuse prevention, moderation and rights verification before public launch.
- No built-in stream recording, payment processing, or persistent chat history.
- Uploaded media is not automatically played for guests. Share a browser tab to show it.

## API

- `GET /api/health` — server health
- `GET /api/config` — ICE configuration
- `GET /api/queue` — song list
- `POST /api/queue` — `{artist,title,link}`
- `PATCH /api/queue/:id` — host-only; `x-host-key` header; `{status,score}`
- `DELETE /api/queue/:id` — host-only
- `POST /api/upload` — host-only multipart `media`

## Broadcast via OBS

1. Install OBS Studio.
2. Add a **Window Capture** or **Display Capture** source for the STREET HEAT LIVE studio.
3. Add a desktop/tab audio source as appropriate; use headphones to avoid feedback.
4. In OBS Settings → Stream, select your provider or enter the provider's RTMP endpoint and key.
5. Start streaming in OBS. For multiple destinations, use an approved RTMP relay or OBS multistreaming setup.

## Deploy

Deploy on a Node.js hosting service that supports persistent WebSocket connections, HTTPS, and writable persistent storage. Set `HOST_KEY`, `PUBLIC_BASE_URL`, and TURN credentials as environment variables. For scale, replace JSON-file storage with PostgreSQL, uploads with S3-compatible object storage, and mesh WebRTC with an SFU.
