# BulkCertifyX

Multi-tenant bulk certificate automation engine with distributed BullMQ background jobs, Redis, Puppeteer PDF rendering, and cryptographically verifiable QR codes.

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.19-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Redis](https://img.shields.io/badge/Redis-BullMQ%20Queue-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![Puppeteer](https://img.shields.io/badge/Puppeteer-PDF%20Generation-40B5A4?style=flat-square&logo=puppeteer&logoColor=white)](https://pptr.dev/)
[![Live Demo](https://img.shields.io/badge/Live_Demo-bulkcertifyx.vercel.app-blue?style=flat-square)](https://bulkcertifyx.vercel.app)

---

## Overview

**BulkCertifyX** is a production-ready, multi-tenant certificate automation platform built for universities, bootcamps, and conference organizers. Generating and dispatching hundreds or thousands of personalized certificates manually is slow, error-prone, and unscalable.

BulkCertifyX solves this by allowing organizers to design dynamic HTML/CSS templates, upload recipient CSV spreadsheets, and offload generation to an asynchronous background worker pool powered by BullMQ and Redis. Certificates are rendered to high-resolution, print-ready PDFs using headless Chromium (Puppeteer), dispatched directly to recipients via transactional email (Resend), and stamped with a unique QR code allowing instant public verification of authenticity.

---

## Features

- **Dynamic Template Studio**: Visual template builder and dynamic placeholder system (`{{name}}`, `{{course}}`, `{{issue_date}}`, `{{id}}`).
- **High-Throughput Bulk Generation**: Processes large CSV recipient lists asynchronously without blocking HTTP request threads.
- **Asynchronous Worker Queue**: Distributed BullMQ and Redis pipeline with automatic retries, job rate-limiting, and error handling.
- **Pixel-Perfect PDF Rendering**: Headless Puppeteer engine generates print-ready, high-resolution vector PDFs.
- **Instant QR Code Verification**: Every certificate embeds a unique verification QR code pointing to an unforgeable public verification page.
- **Real-Time Job Telemetry**: Live progress tracking, socket-driven completion updates (Socket.io), and status indicators.
- **Automated Email Dispatch**: Integrates with Resend to deliver personalized certificates directly to recipient inboxes.
- **Role-Based Access & Multi-Tenancy**: Built on Supabase Row Level Security (RLS) for complete tenant data isolation.

---

## Tech Stack

### Frontend
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS & shadcn/ui components
- **State & Data Fetching**: TanStack React Query & Axios
- **Form Management**: React Hook Form with Zod schema validation
- **Real-Time Updates**: Socket.io Client
- **Data Visualization**: Recharts

### Backend
- **Server**: Node.js & Express.js
- **Queue & Scheduling**: BullMQ & Redis (ioredis)
- **PDF Generation**: Puppeteer (Headless Chromium)
- **QR Engine**: QRCode & Archiver (ZIP packaging)
- **Logging & Validation**: Pino logger & Zod

### Database & Cloud
- **Database & Auth**: Supabase (PostgreSQL with Row Level Security)
- **Email Delivery**: Resend API
- **Billing & Subscriptions**: Razorpay
- **Hosting**: Vercel (Frontend SPA) & Render (Express API & Background Workers)

---

## Architecture

```text
┌────────────────────────┐         HTTPS          ┌────────────────────────┐
│  Client / Browser SPA  │ ─────────────────────▶ │   Express REST API     │
│   (React 18 + Vite)    │ ◀─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │   (Node.js / Render)   │
└────────────────────────┘       Socket.io        └────────────────────────┘
            │                                                 │
            │ Auth & Session                                  │ Queue Jobs
            ▼                                                 ▼
┌────────────────────────┐                        ┌────────────────────────┐
│   Supabase Cloud DB    │                        │  Redis Queue (BullMQ)  │
│ (PostgreSQL + RLS)     │                        └────────────────────────┘
└────────────────────────┘                                    │
                                                              │ Pull Jobs
                                                              ▼
┌────────────────────────┐      HTML/CSS ──▶ PDF  ┌────────────────────────┐
│   Resend Email API     │ ◀───────────────────── │  Render Worker Pool    │
│  (Delivers to Inboxes) │                        │ (Puppeteer Headless)   │
└────────────────────────┘                        └────────────────────────┘
```

The system separates synchronous API operations from compute-intensive PDF rendering:
1. **Frontend Request**: The user designs a certificate template and uploads a recipient CSV file.
2. **API Ingestion**: Express validates the payload via Zod, stores batch metadata in Supabase, and enqueues individual generation tasks into BullMQ.
3. **Worker Processing**: Background worker processes consume jobs from the Redis queue, launch sandboxed Puppeteer instances to render the HTML/CSS template to PDF, and generate unique verification QR codes.
4. **Delivery & Confirmation**: The worker uploads artifacts to Supabase Storage, triggers transactional emails via Resend, and emits real-time progress events back to the client over Socket.io.

---

## Demo

- **Live Production URL**: [https://bulkcertifyx.vercel.app](https://bulkcertifyx.vercel.app)

---

## Installation

### Prerequisites
- Node.js 20+ installed
- Redis instance (local Redis or cloud provider like Upstash)
- Supabase project credentials

### 1. Clone the repository
```bash
git clone https://github.com/hritikkumarpd/BulkCertifyX.git
cd BulkCertifyX
```

### 2. Configure Backend
```bash
cd backend
cp .env.example .env
npm install
npm run migrate    # Apply Supabase database migrations
npm run dev        # Starts Express API on http://localhost:3000
```

### 3. Start Background Queue Worker
In a separate terminal:
```bash
cd backend
npm run worker     # Starts BullMQ Redis worker process
```

### 4. Configure & Start Frontend
```bash
cd ../frontend
cp .env.example .env
npm install
npm run dev        # Starts Vite dev server on http://localhost:5173
```

---

## Environment Variables

### Backend (`backend/.env`)
```env
PORT=3000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Redis (BullMQ Queue)
REDIS_URL=redis://default:password@localhost:6379

# Email Service
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=certificates@yourdomain.com

# Payments
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id
```

---

## License

This project is licensed under the [MIT License](LICENSE) — see the LICENSE file for details.
