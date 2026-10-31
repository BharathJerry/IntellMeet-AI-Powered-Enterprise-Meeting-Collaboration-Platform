# Testing guide and results sheet

Use this to produce the evidence for the report. Only test systems you own (your own Render and Vercel URLs).

## 1. Automated tests and coverage
```bash
cd backend
npm run test:coverage       # needs MONGO_URI_TEST in .env for the integration tests
```
Record: number of suites, number of tests, statement/branch coverage. Screenshot the table. Also check the green run on the GitHub **Actions** tab.

## 2. HTTP load test
Wake the service first (open `/health` once), then:
```bash
cd backend
node scripts/load-http.js https://YOUR-API.onrender.com 10 30
node scripts/load-http.js https://YOUR-API.onrender.com 25 30
node scripts/load-http.js https://YOUR-API.onrender.com 50 30
```
Arguments: base URL, concurrent users, seconds. It logs in once, then each virtual user loops over `GET /health`, `GET /meetings`, `GET /analytics/overview` and occasionally `POST /meetings`. Results are printed and saved to `load-http-results.json`.

The free Render plan has very limited CPU and memory, so expect latency to climb with concurrency. That is a real finding: report it honestly, with the numbers, and mention that a paid instance or horizontal scaling would be the next step.

## 3. Real-time (Socket.io) load test
```bash
node scripts/load-sockets.js https://YOUR-API.onrender.com 20 10
node scripts/load-sockets.js https://YOUR-API.onrender.com 50 10
node scripts/load-sockets.js https://YOUR-API.onrender.com 100 10
```
Arguments: base URL, simultaneous connections, chat messages to send. It opens that many sockets in one meeting and measures connect time, join time and how long each chat message takes to reach every participant. This covers the concurrent-participant and latency goals for signalling and chat. It does not measure WebRTC media quality, which depends on the browsers and networks.

## 4. Security scan (OWASP ZAP)
1. Install ZAP from zaproxy.org (the Windows installer).
2. Open ZAP, choose **Automated Scan**, enter your **Vercel URL**, and start the attack. Repeat for your **Render API URL**.
3. When finished, use **Report > Generate Report** (HTML) and save it.
4. Note the alert counts (High, Medium, Low). For each Medium or High alert, write down whether you fixed it or accepted the risk and why.
Typical findings on a static React site are missing security headers or cache settings; for the API, helmet already adds most headers.

## 5. Dependency check
```bash
cd backend && npm audit --omit=dev
cd ../frontend && npm audit --omit=dev
```
Record the production vulnerability counts. Do not run `npm audit fix --force`.

## 6. Lighthouse
In Chrome (private window, no extensions): open your Vercel URL, press F12, open the **Lighthouse** tab, tick Performance, Accessibility, Best Practices and SEO, and run it once for **Mobile** and once for **Desktop**. Record the four scores for each and screenshot them.

## 7. Real multi-user session
Join one meeting from at least three devices (for example laptop, a second browser, and a phone on mobile data). Check video, audio, chat, screen presenting, and the AI summary afterwards. Record this for the demo video.

## Results sheet (copy into the report)

| Test | Setting | Result |
|---|---|---|
| Automated tests | suites / tests / pass | |
| Coverage | statements / branches | |
| HTTP load | 10 users, 30 s: req/s, p95 ms, errors | |
| HTTP load | 25 users, 30 s: req/s, p95 ms, errors | |
| HTTP load | 50 users, 30 s: req/s, p95 ms, errors | |
| Sockets | 20 / 50 / 100 connections: connect p95, chat fan-out p95, delivered % | |
| ZAP | High / Medium / Low alerts (frontend, API) | |
| npm audit | production vulnerabilities (backend, frontend) | |
| Lighthouse mobile | Performance / Accessibility / Best Practices / SEO | |
| Lighthouse desktop | Performance / Accessibility / Best Practices / SEO | |
