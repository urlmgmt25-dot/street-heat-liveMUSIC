STREET HEAT LIVE repair

Upload server.js and public/app.js to the matching GitHub paths. Do not upload root-level app.js as a substitute for public/app.js. Render Node web service: npm install / npm start.

For reliable connections set Render environment variables TURN_URL (e.g. turns:your-relay.example:5349), TURN_USERNAME and TURN_CREDENTIAL from a real TURN provider. Without these, cross-network connections can buffer.

After deployment: hard-refresh both browsers; join host; turn on camera; start live; share screen; open viewer URL on another network. Verify camera picture-in-picture remains visible. Check Chrome chrome://webrtc-internals for selected candidate pair.

Limitations: Peer-to-peer connections are not scalable to large audiences. Uploaded media stored on Render ephemeral disk can disappear on redeploy. This patch is not production-verified with real devices.
