# STREET HEAT LIVE

Working Node.js broadcast-studio starter with camera, microphone, screen sharing, WebRTC guest connections, Socket.IO chat and room signaling, and audio/video uploads.

## Start
1. Install Node.js 18+.
2. Open a terminal in this folder and run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000`.
5. Create a room, enable camera/microphone and copy the invite URL.

## Deploy on Render
Create a **Web Service** from this repository, set Build Command `npm install`, Start Command `npm start`. Render provides HTTPS, required for camera/screen sharing on public domains. Use a persistent disk for `uploads` if you need files to survive deploys; otherwise uploads may be lost on redeployment.

## Production limitations
WebRTC mesh is suited to small groups; production-scale audiences need an SFU/streaming CDN and TURN servers. Guest calls may fail on restrictive networks without TURN. Media uploads are public to anyone who has their URLs; this starter has no authentication, moderation, or paid subscriptions. Use only files you are licensed to stream. For social simulcasting (YouTube/Facebook/etc.), connect a compliant RTMP broadcast service and authorize platform accounts separately.
