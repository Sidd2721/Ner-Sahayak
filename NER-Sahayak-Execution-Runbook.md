# NER Sahayak — Offline App: Execution Runbook
### Zero to a working, phone-tested offline app. Every step names the exact file it comes from. Follow in order.

## Critical path, at a glance

```
[you: repo+emulator] → [ZCode: shared] → merge →
    ├── [ZCode: mobile app]      ─┐
    └── [Antigravity: backend]   ─┘ (parallel, different folders)
                → merge both →
[you: self-test on Android via port-forward] → merge →
[you: real Firebase keys + deploy] → [test on an actual phone] → done
```
Steps 24+ (the web dashboard) are separate and not required to call the offline app itself complete.

---

## PART 0 — Before opening either tool (you do this)

**Step 1 — confirm the docs are actually in the repo, not just this chat.**
```bash
cd ner-sahayak
ls docs/
```
Neither agent can read this conversation — only what's physically in `docs/`. It needs: `ARCHITECTURE.md`, `TECHNICAL_ROADMAP.md`, `NER-Sahayak-Offline-App-System-Design-and-Build-Guide.md`, and your web-app guide (confirm its real filename — flagged in the Master Verification file). Copy in anything missing now.

**Step 2 — repo + branch protection.** *(from `NER-Sahayak-Parallel-Build-Workflow.md`, §2)*
```bash
git init   # if not already a repo
mkdir -p docs packages/shared apps/mobile apps/web functions
git add . && git commit -m "initial skeleton + docs"
git remote add origin <your-github-url>
git push -u origin main
```
On GitHub: **Settings → Branches** → add a protection rule on `main` requiring a PR before merge. Neither agent gets push access to `main`.

**Step 3 — emulator running.** *(from `NER-Sahayak-API-Keys-Setup-Guide-v2.md`, Part 1)*
```bash
npm install -g firebase-tools
firebase login
firebase init emulators   # select Firestore, Auth, Functions
```
Create `.env.emulator` in the repo root with the fake values from that file's Part 1.2, and commit it. Then, in its own terminal window that you leave running for the whole session:
```bash
firebase emulators:start
```
Emulator UI at `localhost:4000` — keep this open, you'll check it while the agents work.

---

## PART 1 — packages/shared (ZCode, Stage 1)

- [ ] **Step 4** — open ZCode, point it at the repo folder.
- [ ] **Step 5** — open `NER-Sahayak-Agent-Kickoff-Prompts-v2.md`, copy everything inside the ```` ``` ```` block under **PROMPT 1 — ZCode**, from `You are working...` through the end of the `STAGE 1` section (stop right before `STAGE 2` starts). Paste as your first message to ZCode.
- [ ] **Step 6** — let it work. Confirm it opens a PR on branch `milestone-1-shared`, not a direct push, and that the PR description includes the filled compliance table.
- [ ] **Step 7** — review the PR against `NER-Sahayak-Parallel-Build-Workflow.md` §5, and check the compliance table cites actual lines from your real `ARCHITECTURE.md`, not vague claims.
- [ ] **Step 8** — merge `milestone-1-shared` → `main`.

---

## PART 2 — functions/ (Antigravity, Stage 1 — can start any time after Step 3; runs in parallel with Part 3 below, different folder, no collision)

- [ ] **Step 9** — open Antigravity, point it at the same repo.
- [ ] **Step 10** — from the same file, copy **PROMPT 2 — Antigravity**, `STAGE 1` section only. Paste as first message.
- [ ] **Step 11** — if `packages/shared` isn't merged yet (Step 8), it should stop and say so rather than stub its own copy. If it stops, that's correct behavior — wait for Step 8, then tell it to proceed.
- [ ] **Step 12** — review the PR (especially the Firestore rules rejection tests actually being run, not just written) and merge `milestone-2-backend` → `main`.

---

## PART 3 — apps/mobile, the actual offline app (ZCode, Stage 2 — starts once Step 8 is done)

- [ ] **Step 13** — tell ZCode "`milestone-1-shared` is merged into `main` — pull it and start Stage 2."
- [ ] **Step 14** — paste the `STAGE 2` section of Prompt 1 (some tools lose context between sessions — paste again to be safe, no harm if it's redundant).
- [ ] **Step 15** — let it work through Phases 0-12 of the offline-app guide. It should stop at `npm run build` for Phase 12 — if it tries to run `firebase deploy` or asks you for real credentials, stop it, that's the boundary being crossed.
- [ ] **Step 16** — it opens a PR on `milestone-3-mobile` with the Stage 2 compliance table filled. Confirm rows marked "pending human deploy verification" (installs to home screen, iOS Safari) are actually marked that way, not silently checked off.
- [ ] **Step 17** — before merging, run what you *can* self-test:
  ```bash
  cd apps/mobile && npm install && npm run dev
  ```
  - Desktop browser against `localhost:3001`: submit a report offline, confirm the outbox count increments (visible in the emulator UI's Firestore tab once it syncs, or via devtools → Application → IndexedDB in the meantime).
  - Real Android phone: on your desktop, `chrome://inspect` → enable USB debugging on the phone → add a port-forward rule `3001 → localhost:3001` → open `localhost:3001` in Chrome on the phone itself. This is the one real on-device test you can run before any deploy. Turn on airplane mode on the phone and confirm the Status Board still renders.
- [ ] **Step 18** — merge `milestone-3-mobile` → `main`.

---

## PART 4 — Make it reachable from any phone (you — this is deliberately not an agent step)

- [ ] **Step 19** — real Firebase project: create it, upgrade to Blaze, create Firestore, enable Auth, register the web app. *(API Keys guide, Part 2)*
- [ ] **Step 20** — fill the real `.env` / `.env.local` files with that project's values. *(Part 3)*
- [ ] **Step 21** — deploy the real rules from the repo root: `firebase deploy --only firestore:rules` (no `firebase` command? see the note below — use `npx --yes firebase-tools` in front of every `firebase` command in this section instead, or `npm install -g firebase-tools` once)
- [ ] **Step 22** — build and deploy the offline app for real. **Run from the repo root**, not from inside `apps/mobile` — hosting needs the same `firebase.json` that rules/functions just used, not a separate one:
  ```bash
  cd apps/mobile && npm install && npm run build && cd ..
  firebase init hosting   # public directory: apps/mobile/dist
  firebase deploy --only hosting
  ```
- [ ] **Step 23** — the actual finish line. Open the resulting `https://<project-id>.web.app` URL on a real phone, **on cellular data**, that has never visited it before. Install it. Turn on airplane mode, kill the app, relaunch. If the Status Board renders and a submitted report shows "Pending Sync" then later "Synced" once WiFi comes back — the offline app is complete and working, on an actual phone, not a claim on paper.

---

## PART 5 — Optional, separate: apps/web (only if you also want the control room dashboard)

- [ ] **Step 24** — once `milestone-2-backend` is merged (Step 12), tell Antigravity "M1+M2 merged, start Stage 2" and paste that section of Prompt 2. This is a genuinely separate deliverable — the offline app from Part 3 is complete and demoable without it.
