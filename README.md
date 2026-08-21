# Xona: AI Technical Interview Platform

Xona is an interactive, AI-powered interview platform designed to simulate Staff-level Technical interviews. Candidates participate in a multi-phase interview starting with a conversational round, proceeding to a coding challenge with an integrated code editor, and finishing with an architecture design session on a digital canvas. An AI interviewer analyzes their code and diagrams in real-time, asks probing follow-up questions, and evaluates their performance.

## ✨ Features
- **Multi-Phase Interview**: Seamless transitions from behavioral conversation to coding, and then to system design.
- **Interactive Code Editor & Whiteboard**: Integrated text editor for coding rounds and Excalidraw for infinite canvas architecture design.
- **Real-Time AI**: The backend parses the spatial topology of the canvas and submitted code, feeding it to the AI.
- **Client-Side Multilingual TTS**: Uses Piper ONNX Web Runtime for fast, local in-browser Text-to-Speech without latency, complete with support for English, French, Polish, Chinese, Hindi, Malayalam, Telugu, and Tamil.
- **Automated Grading**: Generates a structured JSON report (Score, Decision, Strengths, Weaknesses, Recommendation).
- **Admin Dashboard**: Generate unique interview plans and links, track candidates, view submitted code, and see SVG snapshots of final architectures.

## 🛠️ Tech Stack
- **Framework**: Next.js 16 (App Router) + Turbopack
- **Database**: Supabase (PostgreSQL)
- **AI Brain**: Groq API + Llama-3.3-70b-versatile for ultra-fast reasoning
- **Whiteboard Engine**: Excalidraw
- **TTS Engine**: `@diffusionstudio/vits-web` & Kokoro TTS

---

## 🚀 Setup & Installation Guide

To ensure a seamless, error-free setup on any PC or laptop, please follow these instructions carefully.

### Prerequisites
- **Node.js**: Version 18.x or 20.x is required.
- **Git**: To clone the repository.
- **Supabase**: You will need a [Supabase](https://supabase.com/) project for the database.

### 1. Clone the repository
```bash
git clone https://github.com/aniruth-xobin/System-design-interview.git
cd System-design-interview
```

### 2. Environment Variables
Create a `.env` file in the root directory. You can copy the template from `.env.example`:
```bash
cp .env.example .env
```
Fill in the `.env` file with your details:
- **Groq API Keys**: Provide multiple keys (`GROQ_API_KEY_1`, `GROQ_API_KEY_2`, etc.) to enable automatic round-robin rate-limit bypassing.
- **Supabase Credentials**: Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the Supabase client.

### 3. Install dependencies
Run the following command to install all packages:
```bash
npm install
```

### 4. Database Setup
Create an `InterviewLink` and `InterviewSession` table in your Supabase project with the appropriate schema matching the application logic.

### 5. Start the Application
Start the Next.js development server with Turbopack:
```bash
npm run dev
```

- **Candidate View**: `http://localhost:3000`
- **Admin Panel**: `http://localhost:3000/admin`

---

## ⚙️ Troubleshooting

If you encounter errors during installation or runtime, check these common fixes:

#### 1. Turbopack Internal Error / Corrupted Cache
If Next.js crashes with a `TurbopackInternalError` or complains about a corrupted database/SST file, clear the cache:
1. Stop the dev server (`Ctrl + C`).
2. Delete the `.next` folder (`rm -rf .next` or `Remove-Item -Recurse -Force .next` on Windows).
3. Restart `npm run dev`.

#### 2. Excalidraw / Canvas not rendering
Ensure you are using Node.js v18+. Next.js Turbopack sometimes struggles with Web Worker resolutions in older Node versions. If the canvas fails to load completely, try disabling Turbopack by modifying your `package.json` script from `"next dev"` to `"next dev --turbo=false"`.
