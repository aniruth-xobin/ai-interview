# Xona: AI System Design Interview Platform

Xona is an interactive, AI-powered whiteboarding platform designed to simulate Staff-level System Design interviews. Candidates draw their architecture on a digital canvas while an AI interviewer analyzes their diagrams in real-time, asks probing follow-up questions, and evaluates their performance.

## 🚀 Features
- **Interactive Whiteboard**: Integrated with Excalidraw for a seamless, infinite canvas experience.
- **Real-Time Spatial AI**: The backend parses the spatial topology of the canvas (nodes, text, and connections) and feeds it to the AI.
- **Client-Side Multilingual TTS**: Uses Piper ONNX Web Runtime for fast, local in-browser Text-to-Speech without latency, complete with support for English, French, Polish, Chinese, Hindi, Malayalam, Telugu, and Tamil.
- **Automated Grading**: Generates a structured JSON report (Score, Decision, Strengths, Weaknesses).
- **Admin Dashboard**: Generate unique interview links, track candidates, and view SVG snapshots of final architectures.

## 🛠️ Tech Stack
- **Framework**: Next.js 16 (App Router) + Turbopack
- **Database & Auth**: Supabase (PostgreSQL) + Prisma ORM
- **AI Brain**: Groq API + Llama-3.3-70b-versatile for ultra-fast reasoning
- **Whiteboard Engine**: Excalidraw
- **TTS Engine**: `@diffusionstudio/vits-web` (patched for Multilingual ONNX)

---

## 📦 Setup & Installation Guide

To ensure a seamless, error-free setup on any PC or laptop, please follow these instructions carefully.

### Prerequisites
- **Node.js**: Version 18.x or 20.x is required.
- **Git**: To clone the repository.
- **PostgreSQL Database**: We recommend setting up a free [Supabase](https://supabase.com/) project.

### 1. Clone the repository
```bash
git clone https://github.com/Aniruth-Dev-2006/System-design.git
cd System-design
```

### 2. Environment Variables
Create a `.env` file in the root directory. You can copy the template from `.env.example`:
```bash
cp .env.example .env
```
Fill in the `.env` file with your details:
- **Groq API Keys**: You can provide multiple keys (`GROQ_API_KEY_1`, `GROQ_API_KEY_2`, etc.) to enable automatic round-robin rate-limit bypassing.
- **Supabase / Postgres Credentials**: Set `DATABASE_URL` for Prisma, and `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the frontend client.

### 3. Install dependencies & Patch Packages
Run the following command to install all packages. 
*(Note: This project contains a `postinstall` script (`patch.cjs`) that automatically modifies the TTS library to inject custom Indic and CJK language models. Do not skip this step.)*

```bash
npm install
```

### 4. Database Setup (Prisma)
Ensure your `DATABASE_URL` in `.env` is correct, then sync the schema and generate the client:
```bash
# Push the schema to your database
npx prisma db push

# Generate the Prisma client
npx prisma generate
```

### 5. Start the Application
Start the Next.js development server with Turbopack:
```bash
npm run dev
```

- **Candidate View**: `http://localhost:3000`
- **Admin Panel**: `http://localhost:3000/admin` (Default credentials: `admin` / `admin` for the first setup).

---

## 🛠️ Troubleshooting

If you encounter errors during installation or runtime, check these common fixes:

#### 1. "Cannot find module... vits-web" or TTS errors
If the TTS models aren't loading or the console shows missing language models, the postinstall script might have failed. Run it manually:
```bash
node patch.cjs
```

#### 2. Turbopack Internal Error / Corrupted Cache
If Next.js crashes with a `TurbopackInternalError` or complains about a corrupted database/SST file, clear the cache:
1. Stop the dev server (`Ctrl + C`).
2. Delete the `.next` folder (`rm -rf .next` or `Remove-Item -Recurse -Force .next` on Windows).
3. Restart `npm run dev`.

#### 3. Prisma "Table does not exist" or Query Errors
If the application crashes on login or saving data, your database schema is out of sync.
Run `npx prisma db push` followed by `npx prisma generate`, and restart your server.

#### 4. Excalidraw / Canvas not rendering
Ensure you are using Node.js v18+. Next.js Turbopack sometimes struggles with Web Worker resolutions in older Node versions. If the canvas fails to load completely, try disabling Turbopack by modifying your `package.json` script from `"next dev"` to `"next dev --turbo=false"`.
