# Submitly

A project submission and review dashboard. Students submit their web projects (frontend and/or backend repos and live links); mentors review, approve or reject them.

## Tech stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Express.js, TypeScript
- **Database:** PostgreSQL (Neon) via Prisma ORM 8 (release candidate)
- **Auth:** JWT in an httpOnly cookie, role-based access control (STUDENT / MENTOR)

## Features

**Student**
- Sign up and log in
- Submit a project: name, frontend/backend repo URL, frontend/backend live link, description
- A project may have only a frontend or only a backend. Write `N/A` or leave the field empty; at least one repo and one live link are required
- Zod validation with field-level errors, duplicate repo block, rate limit (5 submissions per 10 minutes per student)
- See own submissions and their status

**Mentor**
- Paginated review dashboard
- Server-side filter (All / Pending / Approved / Rejected)
- Approve / reject action
- Aggregated stats (total, pending, approved, rejected)
- Responsive: table on desktop, cards on mobile

## Setup

Requires Node.js 22.18+ or 24.11+ and a PostgreSQL database (a free Neon database works).

### Backend

```bash
cd backend
npm install
cp .env.example .env        # then fill in the values
npx prisma contract emit
npx prisma db init          # creates the tables in an empty database
npm run seed                # creates the mentor account
npm run dev                 # http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev                 # http://localhost:3000
```

### Mentor account (seeded)

- Email: `mentor@submitly.com`
- Password: `Mentor@123`

Students create their own account on the signup page.

## API

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/signup` | public |
| POST | `/api/auth/login` | public |
| POST | `/api/auth/logout` | public |
| GET | `/api/auth/me` | logged in |
| POST | `/api/submissions` | student |
| GET | `/api/submissions/mine` | student |
| GET | `/api/mentor/submissions?page=&pageSize=&status=` | mentor |
| PATCH | `/api/mentor/submissions/:id/status` | mentor |
| GET | `/api/mentor/stats` | mentor |

## Design decisions

- **Auth cookie instead of localStorage.** The JWT is stored in an httpOnly cookie, so JavaScript on the page (for example through XSS) cannot read it. Cookies are sent with `sameSite` and a CORS allow-list with `credentials`.
- **Role comes from the token, never from the request body.** Signup ignores any extra `role` field, so a student cannot make themselves a mentor.
- **Authorization lives on the backend.** One `requireRole` guard covers the whole mentor router. The redirects in the frontend are only UX.
- **Duplicate prevention.** Repo URLs are normalized (trailing slash, `.git`, case) and checked in both the frontend and backend columns. A database unique constraint is the final safety net.
- **`N/A` is stored as `null`**, not as a string, so it is never validated or shown as a URL.
- **Live links must start with `http://` or `https://`**, to block `javascript:` links.
- **Rate limit** is keyed by user id rather than IP, because many students can share one network.
- **Approve/reject only.** Mentors set `APPROVED` or `REJECTED`; `PENDING` is the initial state set by the system.
- **Server-side pagination and filtering** with `limit`/`offset`; student details are loaded with one `IN` query instead of one query per row.
