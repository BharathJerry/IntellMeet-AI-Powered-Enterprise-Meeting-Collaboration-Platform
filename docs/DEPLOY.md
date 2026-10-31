# Deploying IntellMeet

## 0. Try everything locally with Docker (also the "easy local setup" for judges)
    docker compose up --build
Open http://localhost:5173. Stop with Ctrl+C, then `docker compose down`.

## 1. Database: MongoDB Atlas
- Network Access: allow `0.0.0.0/0` (Render's IPs change).
- Connection string must end with `/intellmeet` before the `?`.

## 2. Backend on Render (first deploy)
1. Render dashboard > New > **Blueprint** > pick your GitHub repo (it reads `render.yaml`).
2. Enter `MONGO_URI`. For `CLIENT_URL` type a placeholder for now. The JWT secrets are generated for you.
3. When it is live, open `https://<your-service>.onrender.com/health`. It should show `{"status":"ok"}`.

## 3. Frontend on Vercel
1. Vercel > Add New > Project > pick the repo > **Root Directory: `frontend`** (framework: Vite).
2. Environment variables: `VITE_API_URL` = your Render URL (https, no trailing slash).
   Optional: `VITE_GOOGLE_CLIENT_ID`, and the TURN values from section 5.
3. Deploy, then copy the Vercel URL.

## 4. Connect them
- Render > your service > Environment > `CLIENT_URL` = the Vercel URL, **exactly, no trailing slash** > save (it redeploys).
- Google login: add the Vercel URL under Authorized JavaScript origins, and set `GOOGLE_CLIENT_ID` on Render.

## 5. TURN server (video between different networks)
STUN alone fails for many home and mobile networks. Get free TURN credentials from a provider such as
Metered or Open Relay (check their current free limits), then set on Vercel and redeploy:
`VITE_TURN_URL` (comma-separate several URLs), `VITE_TURN_USER`, `VITE_TURN_PASS`.
In `frontend/src/pages/Room.jsx` replace the `const ICE = ...` line with:

    const turn = import.meta.env.VITE_TURN_URL;
    const ICE = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        ...(turn ? [{ urls: turn.split(","), username: import.meta.env.VITE_TURN_USER, credential: import.meta.env.VITE_TURN_PASS }] : []),
      ],
    };

## 6. Keep the free backend awake for the demo
Render's free plan sleeps after ~15 minutes idle (the first request then takes ~30-60 seconds).
Create a free UptimeRobot monitor on `https://<your-service>.onrender.com/health` every 5 minutes,
and open the site once before anyone judges it.

## 7. Smoke test (two devices, different networks)
- [ ] /health works, sign up works, Google button appears (if configured)
- [ ] Create a meeting, join from a phone on mobile data: video, chat, present screen
- [ ] Transcribe, AI summary, Make tasks
- [ ] Board drag and drop updates live in both browsers
- [ ] Record a short clip, play it back from the meeting details

## Common problems
| Symptom | Cause / fix |
|---|---|
| "CORS" error in the browser console | `CLIENT_URL` on Render does not exactly match the Vercel URL |
| Login works but video/chat never connect | `VITE_API_URL` is http or has a typo (must be https, no trailing slash); redeploy Vercel after changing it |
| Camera blocked | The page must be https (Vercel is). Click the lock icon and allow the camera |
| Video works only on the same Wi-Fi | Add the TURN server (section 5) |
| First request very slow | Free Render cold start (section 6) |
| Build fails: `npm ci` | `package-lock.json` must be committed in `backend/` |
