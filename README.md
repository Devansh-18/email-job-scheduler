# 📬 ReachInbox — Full-Stack Email Job Scheduler

A **production-grade distributed email scheduling system** built as the ReachInbox hiring assignment. Schedules and sends emails at scale using BullMQ delayed jobs backed by Redis — **zero cron jobs, zero dropped emails, full crash recovery.**

---

## 🗂 Project Structure

```
email-job-scheduler/
├── docker-compose.yml          # PostgreSQL + Redis containers
├── backend/                    # Express + TypeScript API & BullMQ Worker
│   ├── prisma/schema.prisma    # DB models: User, Sender, Email
│   └── src/
│       ├── config/             # Prisma & IORedis singletons
│       ├── controllers/        # auth.controller, email.controller
│       ├── middleware/         # JWT auth.middleware
│       ├── queues/             # BullMQ Queue (email-dispatch-queue)
│       ├── routes/             # auth.routes, email.routes
│       ├── scripts/            # seed-ethereal.ts, test-scheduler.ts
│       ├── services/           # ratelimit, throttle, mailer, reconcile
│       ├── workers/            # BullMQ Worker (email.worker.ts)
│       └── server.ts           # Express entrypoint
└── frontend/                   # Next.js 14 App Router + Tailwind CSS
    └── src/
        ├── app/                # layout, page, login/, dashboard/
        ├── components/         # ComposeModal, ScheduledTable, SentTable
        ├── context/            # AuthContext (Google OAuth)
        ├── hooks/              # useEmails (SWR polling)
        └── lib/                # api.ts (Axios), csvParser.ts (PapaParse)
```

---

## ⚙️ Prerequisites

- **Docker Desktop** (for PostgreSQL & Redis)
- **Node.js v18+** and npm
- A **Google OAuth Client ID** (for real Google login — see step 5 below)

---

## 🚀 Quick Start

### 1. Clone & Start Infrastructure

```bash
git clone <your-repo-url>
cd email-job-scheduler

# Starts PostgreSQL on port 5433 and Redis on port 6379
docker-compose up -d
```

> **Note:** PostgreSQL runs on port `5433` (not 5432) to avoid conflicts with any native Postgres installations.

### 2. Backend Setup

```bash
cd backend
npm install

# Push the Prisma schema to Docker PostgreSQL
npx prisma db push

# Auto-generate Ethereal SMTP credentials and seed the Sender table
npm run seed

# Start the dev server + BullMQ worker (both in one process)
npm run dev
```

Backend will be available at: `http://localhost:5000`

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at: `http://localhost:3000`

---

## 🔐 Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5433/email_scheduler?schema=public"
REDIS_HOST="127.0.0.1"
REDIS_PORT=6379
JWT_SECRET="your_jwt_secret_here"
GOOGLE_CLIENT_ID="your_google_client_id_here"
WORKER_CONCURRENCY=5
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_BASE_URL="http://localhost:5000/api/v1"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your_google_client_id_here"
```

### Setting up Google OAuth Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → APIs & Services → Credentials
3. Create an **OAuth 2.0 Client ID** (Web Application)
4. Add `http://localhost:3000` to **Authorized JavaScript Origins**
5. Copy the Client ID into both `.env` files above

> **Demo fallback:** If you don't configure Google OAuth, use the **"Quick Login as Demo User"** button on the login page — it calls the backend with a mock token for local development.

---

## 📧 Ethereal SMTP Setup

Ethereal is a **free fake SMTP service** — emails are captured and viewable online (not actually delivered).

The seed script handles everything automatically:

```bash
cd backend
npm run seed
```

This calls `nodemailer.createTestAccount()`, generates credentials, and stores them in the `Sender` table in PostgreSQL. The worker reads these credentials when dispatching emails. Preview URLs for sent emails are logged in the server console.

---

## 🏗 Architecture Overview

### How Scheduling Works

1. **POST `/api/v1/emails/schedule`** accepts `{senderId, recipients[], subject, bodyText, startTime, minDelayBetweenSends, maxEmailsPerHour}`.
2. Each recipient gets its own `Email` DB record (UUID as primary key).
3. All records are created atomically in a **`prisma.$transaction`**.
4. `emailQueue.addBulk(...)` enqueues BullMQ delayed jobs with:
   - `jobId: email.id` (same UUID — ensures idempotency)
   - `delay: Math.max(0, startTime - now)` (fires at the correct absolute time)
5. The **BullMQ Worker** (`email.worker.ts`) consumes jobs from `email-dispatch-queue`.

### How Persistence on Restart is Handled

BullMQ stores all delayed jobs in **Redis**, which is persisted via a Docker volume. However, if Redis is flushed or jobs are lost:

- On every Express startup, **`ReconciliationService.reconcileOrphanedJobs()`** runs.
- It queries PostgreSQL for all `SCHEDULED` or `RESCHEDULED` emails.
- For each record without an active BullMQ job (`await emailQueue.getJob(record.id) === null`), it re-enqueues with the remaining delay: `Math.max(0, scheduledAt - now)`.
- This guarantees emails fire at their **original scheduled time** even after a full crash.

### How Rate Limiting & Concurrency Are Implemented

The system enforces throughput through **three independent layers**, each addressing a different failure mode.

---

#### Layer 1 — Worker Concurrency (Parallelism)

Configured via the `WORKER_CONCURRENCY` environment variable (default: `5`):

```ts
// email.worker.ts
const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
new Worker(QUEUE, handler, { connection, concurrency });
```

Multiple workers can process jobs simultaneously. Safety against double-sends is enforced by an **atomic Postgres compare-and-swap** at the very start of every job:

```ts
const result = await prisma.email.updateMany({
  where: { id: emailId, status: { in: ['SCHEDULED', 'RESCHEDULED'] } },
  data: { status: 'PROCESSING' },
});
if (result.count === 0) return; // Another worker already claimed it — exit cleanly
```

If two workers pick up the same job simultaneously, only one succeeds the `updateMany` (Postgres row-level lock). The other exits immediately. **Zero double-sends, regardless of concurrency level.**

---

#### Layer 2 — Inter-Send Throttle (Delay Between Emails)

**File:** `throttle.service.ts`  
**Redis key:** `last_send:sender:{senderId}`

Before every send, the worker checks the timestamp of the last email dispatched by that sender:

```
Redis stores: last_send:sender:abc → "1694600000000" (unix ms timestamp)

Worker checks: if (now - lastSend) < minDelay → await sleep(remaining)
Worker sets:   last_send:sender:abc = now
```

- Configurable per-sender via the **Compose form** → "Delay between 2 emails" field (seconds).
- The form value updates the `Sender` DB row (`minDelayBetweenSends`), which the worker reads at job time.
- Shared in Redis → safe across all parallel workers.
- Default: **2 seconds** between consecutive emails from the same sender.

---

#### Layer 3 — Dual Hourly Rate Limit (Sender Global Ceiling + Isolated Batch Limit)

**File:** `ratelimit.service.ts`  
**Redis key patterns:**
- `ratelimit:sender:{senderId}:{YYYY-MM-DD-HH}` (Global sender ceiling across all batches)
- `ratelimit:batch:{batchId}:{YYYY-MM-DD-HH}` (Isolated limit specific to one email batch)

```
Example keys:
  ratelimit:sender:sender-a:2024-09-13-14   →  count=45 (Total across all batches from Sender A)
  ratelimit:batch:batch-uuid-1:2024-09-13-14 →  count=10 (Count for Batch 1)
  ratelimit:batch:batch-uuid-2:2024-09-13-14 →  count=35 (Count for Batch 2)
```

The system enforces **two levels of rate limits simultaneously**:
1. **Global Per-Sender Ceiling**: Configured via `MAX_EMAILS_PER_HOUR_PER_SENDER` in `backend/.env` (default: 200/hr). No sender can ever exceed this number of total emails dispatched in an hour, across all batches.
2. **Isolated Per-Batch Limit**: Configured per batch schedule request and stored directly on each `Email` record alongside `batchId`.

**Atomic Redis pipeline on every job pickup:**
```ts
// 1. Pipeline increments both global sender counter & batch counter
pipeline.incr(senderKey);
pipeline.ttl(senderKey);
pipeline.incr(batchKey);
pipeline.ttl(batchKey);

// 2. Check if either limit is exceeded
const isSenderExceeded = senderCount > globalSenderLimit;
const isBatchExceeded = batchCount > batchLimit;

if (isSenderExceeded || isBatchExceeded) {
  // Revert both counters (no phantom counts)
  await decrPipeline.exec();
  return { allowed: false, delayMs: msToNextHour + jitter(0–5s) };
}
```

**When a limit is hit:**
1. Both counters are decremented back.
2. The email DB record is updated to `RESCHEDULED`.
3. The job is re-enqueued in BullMQ with `delay = ms until next UTC hour + 0–5s jitter`.
4. At the next hour, the job retries.
5. **No job is ever dropped.** Only delayed.

---

#### Batch Isolation & Settings Persistence

The `maxEmailsPerHour` and `minDelayBetweenSends` values configured during email creation are stored **directly on each `Email` record** alongside a unique `batchId` (UUID). 

Unlike legacy implementations:
- Submitting a new batch **never** mutates the `Sender` database record.
- Every batch retains its own configured rate limit and inter-send delay completely isolated from other batches.
- Older scheduled or active batches run unaffected when new batches are submitted for the same sender.
- The global sender ceiling (`MAX_EMAILS_PER_HOUR_PER_SENDER`) ensures overall hourly limits for a sender are strictly honored regardless of individual batch limits.

---

#### Scenario Walkthroughs

**Single sender, 500 emails, limit=200/hr:**
```
Hour 1: Jobs 1–200 → SENT. Jobs 201–500 → RESCHEDULED to Hour 2.
Hour 2: Jobs 201–400 → SENT. Jobs 401–500 → RESCHEDULED to Hour 3.
Hour 3: Jobs 401–500 → SENT.
Result: All 500 delivered across 3 hours. Zero drops.
```

**Two different senders running simultaneously:**
```
Sender A counter: ratelimit:sender:A:2024-09-13-14
Sender B counter: ratelimit:sender:B:2024-09-13-14
→ Completely independent. A's sends do not consume B's quota.
```

**High concurrency (WORKER_CONCURRENCY=10), 1000 emails, limit=200/hr:**
```
10 workers INCR the same Redis counter simultaneously.
Redis INCR is atomic — no double counting.
First 200 INCRs return count ≤ 200 → allowed.
From job 201 onward → count > 200 → DECR back → reschedule.
Race conditions are impossible because INCR is a single atomic Redis op.
```

---

#### Assignment Requirement Coverage

| Assignment Requirement | How We Satisfy It |
|---|---|
| Configurable concurrency | `WORKER_CONCURRENCY` env var → `new Worker(..., { concurrency })` |
| Safe parallel execution | Postgres atomic `updateMany` compare-and-swap guard |
| Delay between sends | Redis timestamp throttle in `throttle.service.ts` |
| Per-sender hourly rate limit | Redis `INCR` counter keyed by `senderId + UTC hour` |
| Limit configurable (not hardcoded) | Stored on `Sender` DB row, updated via Compose form |
| Redis-backed (multi-worker safe) | All counters live in Redis, shared across all worker instances |
| Jobs not dropped on limit hit | Re-enqueued with `delay = msToNextHour + jitter` via `emailQueue.add()` |
| Rescheduled to next hour window | `nextHour.setUTCHours(hour + 1, 0, 0, 0)` calculates exact boundary |

---

## ✅ Features Implemented

### Backend
| Feature | Implementation |
|---|---|
| Schedule emails via API | `POST /api/v1/emails/schedule` with Zod validation |
| BullMQ delayed jobs | `email.queue.ts` + `email.worker.ts` |
| No cron jobs | Zero `node-cron`, `agenda`, `setInterval` — verified by search |
| Crash recovery / persistence | `ReconciliationService` on boot |
| Idempotency | `jobId: email.id` (UUID dedup) + atomic `updateMany` guard |
| Per-sender hourly rate limit | Redis sliding counter in `ratelimit.service.ts` |
| Inter-send throttle | Redis timestamp tracking in `throttle.service.ts` |
| Configurable concurrency | `WORKER_CONCURRENCY` env var |
| Ethereal SMTP delivery | `mailer.service.ts` + `seed-ethereal.ts` |
| Google OAuth backend verify | `auth.controller.ts` + `google-auth-library` |
| JWT authentication | `auth.middleware.ts` |
| List scheduled/sent emails | `GET /api/v1/emails/scheduled` & `/sent` |
| Sender management | `GET /api/v1/emails/senders` |

### Frontend
| Feature | Implementation |
|---|---|
| Google OAuth login | `@react-oauth/google` + `AuthContext` |
| Demo quick login | Fallback for local dev without Google Client ID |
| Dashboard topbar | User avatar, name, email, logout button |
| Scheduled Emails tab | `ScheduledTable.tsx` with status badges (Scheduled / Processing / Rescheduled) |
| Sent Emails tab | `SentTable.tsx` with Sent/Failed badges + error tooltips |
| Real-time polling | SWR `refreshInterval: 3000ms` |
| Compose modal | Subject, body, start time, delay, hourly limit, CSV upload |
| CSV/TXT lead parsing | PapaParse with deduplication badge |
| Empty states | Shown when no emails in each tab |
| Loading spinners | Per-table loading indicators |
| Statistics cards | Live counts for Scheduled / Rescheduled / Sent / Failed |

---

## 🧪 Automated Verification

Run the built-in acceptance test suite:

```bash
cd backend
npx ts-node src/scripts/test-scheduler.ts
```

Tests cover:
- ✅ Rate limiting (2 of 5 allowed, 3 rescheduled)
- ✅ Inter-send throttle timing (≥ 2000ms spacing)
- ✅ Crash recovery & job reconciliation

---

## 📝 Assumptions & Trade-offs

1. **PostgreSQL on 5433:** Mapped to avoid collision with native Postgres installations.
2. **Inter-send throttle uses `setTimeout`:** This holds the worker slot during the wait. An alternative is BullMQ limiter, but this approach is simpler and allows per-sender configurability without queue-level changes.
3. **Rate limit uses UTC hour boundaries:** Simple, deterministic, and identical across distributed workers.
4. **Single process for API + Worker:** Both Express and the BullMQ worker boot together in `server.ts`. In production, these would be separated into distinct processes/containers.
5. **Google Client ID is optional for local dev:** A "Quick Login as Demo User" fallback lets reviewers test the full dashboard without OAuth setup.
