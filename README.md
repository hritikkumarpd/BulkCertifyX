# BulkCertifyX

**Generate Certificates. In Bulk. Instantly.**

BulkCertifyX is a multi-tenant certificate automation platform. Organizations design
templates, upload recipient CSVs, generate thousands of print-ready PDF certificates in
the background, deliver them by email, and let anyone verify authenticity via QR code.

## Architecture

```
Vercel (frontend)  ──HTTPS──▶  Render (Express API)  ──▶  Supabase (Postgres + Auth + Storage)
                                      │
                                      ├──▶ Redis (Upstash) ──▶ Render Worker ──▶ Puppeteer (PDF)
                                      ├──▶ Resend (email)
                                      └──▶ Razorpay (billing)
```

- **frontend/** — React 18 + Vite + Tailwind + shadcn/ui SPA
- **backend/** — Node.js + Express API and BullMQ workers
- **supabase/** — SQL migrations (schema + Row Level Security)
- **docs/** — architecture, API, deployment notes

## Tech stack

| Layer      | Technology                                                                 |
|------------|----------------------------------------------------------------------------|
| Frontend   | React 18, Vite, TailwindCSS, shadcn/ui, React Router, React Hook Form, Zod, TanStack Query, Axios, Socket.io-client |
| Backend    | Node.js, Express, Socket.io, BullMQ, Puppeteer, QRCode, Archiver           |
| Data       | Supabase (PostgreSQL, Auth, Storage), Redis                                |
| Payments   | Razorpay subscriptions + webhooks                                          |
| Email      | Resend                                                                      |
| Deploy     | Vercel (frontend), Render (API + worker), Docker                           |

## Local setup

Prerequisites: Node 20+, a Supabase project, a Redis instance (local or Upstash).

```bash
# 1. Backend
cd backend
cp .env.example .env        # fill in credentials
npm install
npm run migrate             # applies supabase/migrations against your project
npm run dev                 # API on :3000
npm run worker              # in a second terminal — background jobs

# 2. Frontend
cd frontend
cp .env.example .env        # fill in VITE_* values
npm install
npm run dev                 # app on :5173
```

## Plans

| Plan       | Price (₹/mo) | Certs/mo  | Bulk/job | Templates | Domain | White-label | API |
|------------|--------------|-----------|----------|-----------|--------|-------------|-----|
| Free       | 0            | 25        | 10       | 1         | –      | –           | –   |
| Starter    | 199          | 500       | 200      | 5         | –      | –           | –   |
| Pro        | 599          | 5,000     | 1,000    | ∞         | ✓      | ✓           | ✓   |
| Enterprise | 1,999        | ∞         | ∞        | ∞         | ✓      | ✓           | ✓   |

See [docs/](docs/) for deployment and API reference.

## License

Proprietary — © BulkCertifyX.
