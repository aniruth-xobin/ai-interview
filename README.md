# Xona: AI System Design Interview Platform

Xona is an interactive, AI-powered whiteboarding platform designed to simulate Staff-level System Design interviews. Candidates draw their architecture on a digital canvas while an AI interviewer analyzes their diagrams in real-time, asks probing follow-up questions, and ultimately grades their performance.

## 🚀 Features
- **Interactive Whiteboard**: Integrated with Excalidraw for a seamless, infinite canvas experience.
- **Real-Time Spatial AI**: The backend mathematical engine parses the spatial topology of the canvas (nodes, text, and connections) and feeds it to the AI.
- **Voice Interaction**: The AI interviewer speaks its questions aloud using the Web SpeechSynthesis API.
- **Automated Grading**: At the end of the interview, the AI generates a structured JSON report (Score, Decision, Strengths, Weaknesses).
- **Admin Dashboard**: Admins can generate unique interview links, track candidates in real-time, and view perfectly reconstructed SVG snapshots of the candidate's final architecture.

## 🛠️ Tech Stack
- **Framework**: Next.js 16 (App Router) + Turbopack
- **Database & Auth**: Supabase (PostgreSQL + Prisma ORM)
- **AI Brain**: Groq API + Llama 3 (70B) for ultra-fast inference
- **Whiteboard Engine**: Excalidraw
- **Styling**: Vanilla CSS Modules (Glassmorphism & dark/light UI themes)

## 📦 Setup & Installation

### 1. Clone the repository
```bash
git clone https://github.com/Aniruth-Dev-2006/System-design.git
cd System-design
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory. You can copy the template from `.env.example`:
```bash
cp .env.example .env
```
Fill in the `.env` file with your **Groq API Keys** and **Supabase Database connection strings**.

### 4. Database Setup
This project uses Prisma to manage the PostgreSQL database schema.
1. Ensure your `DATABASE_URL` is correct in `.env`.
2. Push the schema to your database:
```bash
npx prisma db push
```

### 5. Run the Application
Start the development server:
```bash
npm run dev
```
- The main landing page is at `http://localhost:3000`
- The Admin Panel is at `http://localhost:3000/admin` (Default credentials: `admin` / `admin` for the first setup).

## 🧠 Architecture Highlights
- **Canvas Stripping**: The frontend strips the heavy Excalidraw payload into a lightweight JSON array before sending it over the network.
- **SVG Reconstruction**: The Admin Panel uses a headless `exportToSvg` utility to rebuild the candidate's drawing from raw database elements without loading the full editor.
- **Web Worker Interception**: A custom browser patch intercepts Turbopack Web Worker requests to prevent Excalidraw CORS crashes in Next.js developer  mode.
