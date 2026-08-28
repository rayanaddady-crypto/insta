# InstaClone Full-Stack Deployment & Scaling Guide

This guide details how to configure, run, and scale **InstaClone** in local development, sandbox previews, and production cloud environments.

---

## 1. PROJECT INITIALIZATION

### Backend Directory Setup
Ensure Node.js (v18+) is installed. To initialize a standalone backend service:
```bash
mkdir instaclone-backend && cd instaclone-backend
npm init -y
```

### Required Backend Dependencies
Install critical full-stack packages:
```bash
npm install express socket.io cors jsonwebtoken bcryptjs dotenv
npm install -D typescript @types/node @types/express tsx esbuild
```

### Frontend Directory Setup
For a separate standalone client directory:
```bash
npm create vite@latest instaclone-client -- --template react-ts
cd instaclone-client
```

### Required Frontend Dependencies
Install core styling and interface packages:
```bash
npm install lucide-react motion socket.io-client
npm install -D tailwindcss @tailwindcss/vite
```

---

## 2. DATABASE SYSTEM & CONNECTION COUPLING

InstaClone uses **PostgreSQL** as its relational database. The complete table schema is stored in `/schema.sql`.

### Drizzle ORM Setup (Recommended for TypeScript)
To compile and execute operations smoothly with type-safe schemas, initialize **Drizzle ORM** with **pg**:
```bash
npm install drizzle-orm pg
npm install -D drizzle-kit @types/pg
```

#### Drizzle Database Connection File (`src/db/connection.ts`)
```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export const db = drizzle(pool);
```

---

## 3. FRONTEND AUTHENTICATION & STATE MANAGEMENT

Our React frontend is connected to the backend API endpoints through a unified, lightweight React Context pattern located in `/src/components/AuthContext.tsx`.

### Core Coupling Operations:
1. **JWT Header injection**:
   Our custom `fetchWithAuth()` wrapper interceptor automatically reads the stored JWT string from `localStorage` and appends it to all requests:
   ```typescript
   headers.set("Authorization", `Bearer ${token}`);
   ```
2. **Auto-Session Expiry (401/403)**:
   If the token is invalidated or expired, the wrapper triggers an immediate user redirect to log back in.
3. **Socket.io Syncing**:
   Once user states are successfully validated, a single Socket.io connection is initialized:
   ```typescript
   const socket = io(window.location.origin, { transports: ["websocket"] });
   socket.emit("join", user.id);
   ```

---

## 4. DEPLOYMENT & HOSTING BLUEPRINT

### Option A: Server-Side & Combined Deployments (Render / Fly.io / Cloud Run)
These hosts are perfect for our single-port full-stack architecture since they compile both the Express endpoints, Socket.io channels, and Vite production bundle together.

#### Production Build Command
```bash
npm run build
```
This runs `vite build` (creating client assets in `/dist`) and then uses `esbuild` to compile our TypeScript backend into a compressed CommonJS file:
```bash
esbuild server.ts --bundle --platform=node --outfile=dist/server.cjs --packages=external
```

#### Start Script
```bash
npm run start # Launches: node dist/server.cjs
```

#### Required Environment Variables
* `NODE_ENV`: `production`
* `JWT_SECRET`: A secure, high-entropy random string.
* `DATABASE_URL`: Your production PostgreSQL database connection URI string.

---

### Option B: Decentralized Decoupled Hosting (Vercel + Supabase)
For infinite scaling:
1. **Frontend**: Host the compiled static `/dist` directory on **Vercel** or **Netlify** (Free, fast global CDN edge caches).
2. **Backend Serverless API**: Host Express endpoints on **Vercel Serverless Functions**.
3. **Database & Auth**: Leverage **Supabase**. Replace our Express authentication routes with standard `@supabase/supabase-js` client SDK flows, mapping PostgreSQL queries directly into Supabase RESTful tables.
