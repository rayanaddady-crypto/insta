import express from "express";
import path from "path";
import fs from "fs";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createClient } from "@libsql/client";
import multer from "multer";
import { handleGameSocket } from "./server_games";
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini AI Client
const aiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    })
  : null;

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "instaclone-super-secret-key-2026";
const isVercel = !!process.env.VERCEL;
const UPLOADS_DIR = isVercel ? "/tmp/uploads" : path.join(process.cwd(), "uploads");

// Ensure uploads directory exists
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (err) {
  console.warn("⚠️ [File System] Could not ensure uploads directory exists:", err);
}

// Configure multer storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") || 
      file.mimetype.startsWith("video/") || 
      file.mimetype.startsWith("audio/") ||
      file.originalname.match(/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only images, videos, and audio files are allowed") as any, false);
    }
  },
});

// ====================================================================
// TURSO / LIBSQL SQLITE ENGINE
// ====================================================================
const TURSO_URL = process.env.TURSO_DATABASE_URL || (isVercel ? "file:/tmp/local.db" : "file:local.db");
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || "";

let turso = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN
});

let isLocalFallback = false;
let dbInitPromise: Promise<void> | null = null;

// Switch to local SQLite safely
function fallbackToLocalDb() {
  if (isLocalFallback) return;
  isLocalFallback = true;
  const localPath = isVercel ? "file:/tmp/local.db" : "file:local.db";
  console.warn(`⚠️ [Turso DB] Switching client to local SQLite fallback (${localPath})...`);
  turso = createClient({
    url: localPath
  });
}

const isRemoteUrl = TURSO_URL.startsWith("http") || TURSO_URL.startsWith("libsql");

// A SQLITE_* code means the remote database answered and rejected the statement,
// so the connection is healthy and falling back would silently strand real data.
const shouldFallback = (err: any): boolean =>
  !isLocalFallback && isRemoteUrl && !String(err?.code ?? "").startsWith("SQLITE_");

// Low-level query functions (used by initialization to prevent circular deadlocks)
const rawExecute = async (sql: string, args: any[] = []): Promise<any> => {
  const cleanArgs = args.map(arg => (arg === undefined ? null : arg));
  try {
    return await turso.execute({ sql, args: cleanArgs });
  } catch (err: any) {
    if (shouldFallback(err)) {
      console.warn("⚠️ Remote Turso execute failed, falling back to local DB:", err.message);
      fallbackToLocalDb();
      return await turso.execute({ sql, args: cleanArgs });
    }
    throw err;
  }
};

const rawQuery = async (sql: string, args: any[] = []): Promise<any[]> => {
  const cleanArgs = args.map(arg => (arg === undefined ? null : arg));
  try {
    const result = await turso.execute({ sql, args: cleanArgs });
    return result.rows as any[];
  } catch (err: any) {
    if (shouldFallback(err)) {
      console.warn("⚠️ Remote Turso query failed, falling back to local DB:", err.message);
      fallbackToLocalDb();
      const result = await turso.execute({ sql, args: cleanArgs });
      return result.rows as any[];
    }
    throw err;
  }
};

const rawQueryOne = async (sql: string, args: any[] = []): Promise<any | null> => {
  const rows = await rawQuery(sql, args);
  return rows.length > 0 ? rows[0] : null;
};

// High-level query functions with auto-initialization & seamless fallback
const query = async (sql: string, args: any[] = []): Promise<any[]> => {
  await ensureDbReady();
  return rawQuery(sql, args);
};

const queryOne = async (sql: string, args: any[] = []): Promise<any | null> => {
  await ensureDbReady();
  return rawQueryOne(sql, args);
};

const execute = async (sql: string, args: any[] = []): Promise<any> => {
  await ensureDbReady();
  return rawExecute(sql, args);
};

// Check connection on boot and handle fallback
async function checkDbConnection() {
  try {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Connection timeout")), 2000)
    );
    await Promise.race([turso.execute("SELECT 1"), timeoutPromise]);
    console.log("⚡ [Turso DB] Database connected successfully.");
  } catch (err) {
    if (isRemoteUrl) {
      console.warn("⚠️ [Turso DB] Remote connection check failed or timed out; keeping the configured remote database:", err);
      return;
    }
    console.warn("⚠️ [Turso DB] Remote connection bypassed or timed out, loading local SQLite file fallback:", err);
    fallbackToLocalDb();
  }
}

// Create separate tables for all required schemas
async function ensureRaynaiUser() {
  try {
    const existing = await rawQueryOne("SELECT * FROM users WHERE username = 'raynai'");
    if (!existing) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync("raynai-grok-password-2026", salt);
      const res = await rawExecute(
        "INSERT INTO users (username, email, password_hash) VALUES ('raynai', 'raynai@ai.local', ?)",
        [hash]
      );
      const userId = Number(res.lastInsertRowid);
      await rawExecute(
        "INSERT OR IGNORE INTO profiles (user_id, name, bio, avatar_url, is_verified) VALUES (?, 'Raynai AI', 'Professional AI Truth or Dare Game Master. Type @raynai saqsina to play!', 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&h=150&q=80', 1)",
        [userId]
      );
      await rawExecute(
        "INSERT OR IGNORE INTO user_settings (user_id, theme, privacy) VALUES (?, 'dark', 'public')",
        [userId]
      );
      console.log("🤖 [Turso DB] Programmatic AI User @raynai initialized successfully.");
    }
  } catch (err) {
    console.error("⚠️ Failed to ensure @raynai user exists:", err);
  }
}

export async function ensureDbReady(): Promise<void> {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      await checkDbConnection();
      await initTursoTables();
    })().catch(err => {
      console.error("⚠️ [Turso DB] Database init failed:", err);
      dbInitPromise = null;
      throw err;
    });
  }
  return dbInitPromise;
}

async function initTursoTables() {
  await checkDbConnection();
  try {
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        name TEXT DEFAULT '',
        bio TEXT DEFAULT '',
        avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
        website TEXT DEFAULT '',
        gender TEXT DEFAULT '',
        location TEXT DEFAULT '',
        birthday TEXT DEFAULT '',
        is_verified INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );`,
      `CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        media_url TEXT NOT NULL,
        caption TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );`,
      `CREATE TABLE IF NOT EXISTS reels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        co_creator_id INTEGER,
        media_url TEXT NOT NULL,
        caption TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (co_creator_id) REFERENCES users(id) ON DELETE SET NULL
      );`,
      `CREATE TABLE IF NOT EXISTS stories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        media_url TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );`,
      `CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER,
        reel_id INTEGER,
        user_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (reel_id) REFERENCES reels(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );`,
      `CREATE TABLE IF NOT EXISTS likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        post_id INTEGER,
        reel_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (reel_id) REFERENCES reels(id) ON DELETE CASCADE,
        UNIQUE(user_id, post_id),
        UNIQUE(user_id, reel_id)
      );`,
      `CREATE TABLE IF NOT EXISTS saved_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        post_id INTEGER,
        reel_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (reel_id) REFERENCES reels(id) ON DELETE CASCADE,
        UNIQUE(user_id, post_id),
        UNIQUE(user_id, reel_id)
      );`,
      `CREATE TABLE IF NOT EXISTS followers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        follower_id INTEGER NOT NULL,
        following_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(follower_id, following_id)
      );`,
      `CREATE TABLE IF NOT EXISTS follow_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(sender_id, receiver_id)
      );`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        post_id INTEGER,
        reel_id INTEGER,
        text TEXT DEFAULT '',
        status TEXT DEFAULT 'unread',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (reel_id) REFERENCES reels(id) ON DELETE CASCADE
      );`,
      `CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user1_id INTEGER NOT NULL,
        user2_id INTEGER NOT NULL,
        is_pinned_user1 INTEGER DEFAULT 0,
        is_pinned_user2 INTEGER DEFAULT 0,
        typing_user1 INTEGER DEFAULT 0,
        typing_user2 INTEGER DEFAULT 0,
        name_user1 TEXT DEFAULT NULL,
        name_user2 TEXT DEFAULT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user1_id, user2_id)
      );`,
      `CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        message_text TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        reaction TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
      );`,
      `CREATE TABLE IF NOT EXISTS online_status (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        is_online INTEGER DEFAULT 0,
        last_seen TEXT DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        theme TEXT DEFAULT 'light',
        language TEXT DEFAULT 'en',
        privacy TEXT DEFAULT 'public',
        notifications_enabled INTEGER DEFAULT 1
      );`,
      `CREATE TABLE IF NOT EXISTS blocked_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        blocker_id INTEGER NOT NULL,
        blocked_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(blocker_id, blocked_id)
      );`,
      `CREATE TABLE IF NOT EXISTS muted_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        muted_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (muted_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, muted_id)
      );`,
      `CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reporter_id INTEGER NOT NULL,
        reported_id INTEGER NOT NULL,
        post_id INTEGER,
        reel_id INTEGER,
        reason TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reported_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (reel_id) REFERENCES reels(id) ON DELETE CASCADE
      );`,
      `CREATE TABLE IF NOT EXISTS media_files (
        filename TEXT PRIMARY KEY,
        mime_type TEXT,
        data_base64 TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS truth_or_dare_games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL UNIQUE,
        current_player_id INTEGER NOT NULL,
        other_player_id INTEGER NOT NULL,
        current_turn TEXT NOT NULL,
        choice TEXT,
        prompt_text TEXT,
        language TEXT DEFAULT 'ar',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        text TEXT NOT NULL,
        mood_emoji TEXT DEFAULT '💭',
        music_track TEXT DEFAULT '',
        music_title TEXT DEFAULT '',
        music_artist TEXT DEFAULT '',
        music_url TEXT DEFAULT '',
        music_cover TEXT DEFAULT '',
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );`,
      `CREATE TABLE IF NOT EXISTS music_tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        cover_url TEXT DEFAULT '',
        audio_url TEXT NOT NULL,
        duration INTEGER DEFAULT 30,
        genre TEXT DEFAULT 'Pop',
        is_trending INTEGER DEFAULT 0,
        uploaded_by INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
      );`,
      `CREATE TABLE IF NOT EXISTS note_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(note_id, user_id),
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );`
    ];

    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`,
      `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
      `CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_reels_user_id ON reels(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);`,
      `CREATE INDEX IF NOT EXISTS idx_comments_reel_id ON comments(reel_id);`,
      `CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);`,
      `CREATE INDEX IF NOT EXISTS idx_likes_reel_id ON likes(reel_id);`,
      `CREATE INDEX IF NOT EXISTS idx_saved_posts_user_id ON saved_posts(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON followers(follower_id);`,
      `CREATE INDEX IF NOT EXISTS idx_followers_following_id ON followers(following_id);`,
      `CREATE INDEX IF NOT EXISTS idx_follow_requests_sender_id ON follow_requests(sender_id);`,
      `CREATE INDEX IF NOT EXISTS idx_follow_requests_receiver_id ON follow_requests(receiver_id);`,
      `CREATE INDEX IF NOT EXISTS idx_notifications_receiver_id ON notifications(receiver_id);`,
      `CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);`,
      `CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker_id ON blocked_users(blocker_id);`,
      `CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_note_likes_note_id ON note_likes(note_id);`,
      `CREATE INDEX IF NOT EXISTS idx_note_likes_user_id ON note_likes(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_music_tracks_title ON music_tracks(title);`,
      `CREATE INDEX IF NOT EXISTS idx_music_tracks_artist ON music_tracks(artist);`,
      `CREATE INDEX IF NOT EXISTS idx_music_tracks_genre ON music_tracks(genre);`
    ];

    for (const sql of tables) {
      await rawExecute(sql);
    }
    for (const sql of indexes) {
      await rawExecute(sql);
    }

    // Ensure extended message columns for reply, edit, delete exist
    const messageAlterations = [
      "ALTER TABLE messages ADD COLUMN reply_to_id INTEGER DEFAULT NULL",
      "ALTER TABLE messages ADD COLUMN reply_to_text TEXT DEFAULT NULL",
      "ALTER TABLE messages ADD COLUMN reply_to_username TEXT DEFAULT NULL",
      "ALTER TABLE messages ADD COLUMN is_edited INTEGER DEFAULT 0",
      "ALTER TABLE messages ADD COLUMN is_deleted INTEGER DEFAULT 0",
      "ALTER TABLE conversations ADD COLUMN name_user1 TEXT",
      "ALTER TABLE conversations ADD COLUMN name_user2 TEXT",
      "ALTER TABLE notes ADD COLUMN music_title TEXT DEFAULT ''",
      "ALTER TABLE notes ADD COLUMN music_artist TEXT DEFAULT ''",
      "ALTER TABLE notes ADD COLUMN music_url TEXT DEFAULT ''",
      "ALTER TABLE notes ADD COLUMN music_cover TEXT DEFAULT ''",
      "ALTER TABLE notes ADD COLUMN music_start_time INTEGER DEFAULT 0",
      "ALTER TABLE notes ADD COLUMN audience TEXT DEFAULT 'followers'"
    ];
    for (const alterSql of messageAlterations) {
      try {
        await rawExecute(alterSql);
      } catch (e) {
        // column already exists
      }
    }

    console.log("⚡ [Turso DB] All separate tables and performance indexes loaded successfully!");

    // Ensure programmatic AI User @raynai exists
    await ensureRaynaiUser();

    // Ensure rich Instagram music library catalog exists
    await ensureMusicLibrary();

    // Clean up and remove all legacy temp/mock accounts (emails ending in @raynista.co)
    try {
      await rawExecute("DELETE FROM users WHERE email LIKE '%@raynista.co'");
      console.log("⚡ [Turso DB] Cleaned up all temporary mock accounts from the database.");
    } catch (e) {
      // ignore
    }

    // Enforce blue-verification on boot for rayane / rayanee / rayane@gmail.com
    try {
      await rawExecute(
        `UPDATE profiles 
         SET is_verified = 1 
         WHERE user_id IN (
           SELECT id FROM users 
           WHERE LOWER(email) = 'rayane@gmail.com' OR LOWER(username) = 'rayane' OR LOWER(username) = 'rayanee'
         )`
      );
      console.log("⚡ [Turso DB] Auto-promoted admin accounts to verified status on boot.");
    } catch (e) {
      console.warn("⚠️ Failed to auto-promote admin accounts to verified on boot:", e);
    }
  } catch (err) {
    console.error("⚠️ [Turso DB] Table initialization failed:", err);
    throw err;
  }
}

// Seed rich curated Instagram Music Library with preview tracks
async function ensureMusicLibrary() {
  try {
    const curatedTracks = [
      // --- ElGrandeToto Top Hits ---
      {
        title: "Love Nwantiti (feat. ElGrandeToto) [North African Remix]",
        artist: "CKay & ElGrandeToto",
        genre: "Hip Hop",
        is_trending: 1,
        cover_url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&h=300&q=80",
        audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        duration: 30
      },
      {
        title: "Mghayer",
        artist: "ElGrandeToto",
        genre: "Hip Hop",
        is_trending: 1,
        cover_url: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=300&h=300&q=80",
        audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        duration: 30
      },
      {
        title: "Salade Coco",
        artist: "ElGrandeToto",
        genre: "Hip Hop",
        is_trending: 1,
        cover_url: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=300&h=300&q=80",
        audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
        duration: 30
      },
      {
        title: "Gueule Tapée",
        artist: "ElGrandeToto",
        genre: "Hip Hop",
        is_trending: 1,
        cover_url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&h=300&q=80",
        audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
        duration: 30
      },
      {
        title: "Silhouette",
        artist: "ElGrandeToto",
        genre: "Hip Hop",
        is_trending: 1,
        cover_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=300&h=300&q=80",
        audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
        duration: 30
      },
      {
        title: "Dellali (feat. Hamza)",
        artist: "ElGrandeToto",
        genre: "Hip Hop",
        is_trending: 1,
        cover_url: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=300&h=300&q=80",
        audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
        duration: 30
      },
      // --- Morad Top Hits ---
      {
        title: "Pelele",
        artist: "Morad",
        genre: "Hip Hop",
        is_trending: 1,
        cover_url: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=300&h=300&q=80",
        audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
        duration: 30
      },
      {
        title: "Motorola",
        artist: "Morad",
        genre: "Hip Hop",
        is_trending: 1,
        cover_url: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=300&h=300&q=80",
        audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
        duration: 30
      },
      {
        title: "Sigue",
        artist: "Morad & Beny Jr",
        genre: "Hip Hop",
        is_trending: 1,
        cover_url: "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=300&h=300&q=80",
        audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
        duration: 30
      },
      // --- Dizzy DROS ---
      {
        title: "M3a L3echrane",
        artist: "Dizzy DROS",
        genre: "Hip Hop",
        is_trending: 1,
        cover_url: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=300&h=300&q=80",
        audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3",
        duration: 30
      },
      // --- Global Pop & Viral Hits ---
      {
        title: "Espresso",
        artist: "Sabrina Carpenter",
        genre: "Pop",
        is_trending: 1,
        cover_url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&h=300&q=80",
        audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        duration: 30
      },
      {
        title: "Starboy",
        artist: "The Weeknd",
        genre: "Synthwave",
        is_trending: 1,
        cover_url: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=300&h=300&q=80",
        audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        duration: 30
      },
      {
        title: "Birds of a Feather",
        artist: "Billie Eilish",
        genre: "Pop",
        is_trending: 1,
        cover_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=300&h=300&q=80",
        audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
        duration: 30
      },
      {
        title: "FE!N (Night Vibe)",
        artist: "Travis Scott ft. Playboi Carti",
        genre: "Hip Hop",
        is_trending: 1,
        cover_url: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=300&h=300&q=80",
        audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
        duration: 30
      },
      {
        title: "Casablanca Sunset Beats",
        artist: "Raymi Beats",
        genre: "Lofi",
        is_trending: 1,
        cover_url: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=300&h=300&q=80",
        audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
        duration: 30
      },
      {
        title: "Montagem Diamante",
        artist: "Phonk Master",
        genre: "Phonk",
        is_trending: 1,
        cover_url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&h=300&q=80",
        audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
        duration: 30
      }
    ];

    for (const t of curatedTracks) {
      const exists = await rawQueryOne(
        "SELECT id FROM music_tracks WHERE LOWER(title) = LOWER(?) AND LOWER(artist) = LOWER(?)",
        [t.title, t.artist]
      );
      if (!exists) {
        await rawExecute(
          `INSERT INTO music_tracks (title, artist, genre, is_trending, cover_url, audio_url, duration)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [t.title, t.artist, t.genre, t.is_trending, t.cover_url, t.audio_url, t.duration]
        );
      }
    }
    console.log("⚡ [Turso DB] Verified and seeded curated Instagram music catalog.");
  } catch (err) {
    console.warn("⚠️ Failed to seed music library:", err);
  }
}

// Seed beautiful premium mock data
async function seedTursoDb() {
  console.log("🌱 Seeding database with premium initial data...");
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync("password123", salt);

  const seedUsers = [
    { username: "ahmed", email: "ahmed@raynista.co", is_verified: 1, is_private: 0, bio: "Luxury curator in Cairo. Elegance is not outstanding, but remembered.", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80", birthday: "1996-05-15" },
    { username: "sara", email: "sara@raynista.co", is_verified: 1, is_private: 1, bio: "Boutique photographer & digital nomad. Freezing aesthetic moments.", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80", birthday: "2001-11-20" },
    { username: "mohamed", email: "mohamed@raynista.co", is_verified: 1, is_private: 1, bio: "Interior architect & furniture collector.", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80", birthday: "1994-01-08" },
    { username: "ali", email: "ali@raynista.co", is_verified: 0, is_private: 0, bio: "Gastronome and visual traveler. Living life one espresso at a time.", avatar: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=150&h=150&q=80", birthday: "2005-03-30" },
    { username: "yassine", email: "yassine@raynista.co", is_verified: 0, is_private: 0, bio: "Visual designer and sound explorer.", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80", birthday: "1999-07-12" }
  ];

  for (const u of seedUsers) {
    const res = await execute(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [u.username, u.email, hash]
    );
    const userId = Number(res.lastInsertRowid);

    await execute(
      "INSERT INTO profiles (user_id, name, bio, avatar_url, birthday, is_verified) VALUES (?, ?, ?, ?, ?, ?)",
      [userId, u.username.toUpperCase(), u.bio, u.avatar, u.birthday, u.is_verified]
    );

    await execute(
      "INSERT INTO user_settings (user_id, theme, privacy) VALUES (?, 'light', ?)",
      [userId, u.is_private ? "private" : "public"]
    );

    await execute(
      "INSERT INTO online_status (user_id, is_online, last_seen) VALUES (?, 1, CURRENT_TIMESTAMP)",
      [userId]
    );
  }

  // Seed beautiful posts
  const posts = [
    { username: "ahmed", media: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&h=800&q=80", caption: "Timeless forms and luxury curves in digital spaces. #Raynista" },
    { username: "ali", media: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&h=800&q=80", caption: "Mornings start with high-fidelity brewing." },
    { username: "sara", media: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&h=800&q=80", caption: "Bold contrast in standard luxury collections." }
  ];

  for (const p of posts) {
    const userRow = await queryOne("SELECT id FROM users WHERE username = ?", [p.username]);
    if (userRow) {
      await execute(
        "INSERT INTO posts (user_id, media_url, caption) VALUES (?, ?, ?)",
        [userRow.id, p.media, p.caption]
      );
    }
  }

  // Seed beautiful reels (vertical videos)
  const reels = [
    { username: "mohamed", media: "https://assets.mixkit.co/videos/preview/mixkit-curving-architectural-staircase-39977-large.mp4", caption: "Curves of fluid concrete architectures." },
    { username: "ahmed", media: "https://assets.mixkit.co/videos/preview/mixkit-waterfall-in-forest-2213-large.mp4", caption: "Bespoke nature loops for the calm mind." }
  ];

  for (const r of reels) {
    const userRow = await queryOne("SELECT id FROM users WHERE username = ?", [r.username]);
    if (userRow) {
      await execute(
        "INSERT INTO reels (user_id, media_url, caption) VALUES (?, ?, ?)",
        [userRow.id, r.media, r.caption]
      );
    }
  }

  // Seed default follows (Ahmed following Sara, Ali following Sara)
  const ahmed = await queryOne("SELECT id FROM users WHERE username = 'ahmed'");
  const sara = await queryOne("SELECT id FROM users WHERE username = 'sara'");
  const ali = await queryOne("SELECT id FROM users WHERE username = 'ali'");

  if (ahmed && sara) {
    // follow request (since Sara is private!)
    await execute("INSERT INTO follow_requests (sender_id, receiver_id, status) VALUES (?, ?, 'pending')", [ahmed.id, sara.id]);
    await execute("INSERT INTO notifications (type, sender_id, receiver_id, text) VALUES ('follow_request', ?, ?, 'Mohamed requested to follow you.')", [ahmed.id, sara.id]);
  }
  if (ali && ahmed) {
    // direct follow
    await execute("INSERT INTO followers (follower_id, following_id) VALUES (?, ?)", [ali.id, ahmed.id]);
    await execute("INSERT INTO notifications (type, sender_id, receiver_id, text) VALUES ('follow', ?, ?, 'Ali started following you.')", [ali.id, ahmed.id]);
  }

  console.log("🌱 Database seeded successfully!");
}

// ====================================================================
// EXPRESS SERVER & REAL-TIME SOCKETS
// ====================================================================
const app = express();
app.use("/uploads", express.static(UPLOADS_DIR));
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Guarantee DB is initialized on incoming API requests
app.use("/api", async (req, res, next) => {
  try {
    await ensureDbReady();
    next();
  } catch (err: any) {
    console.error("⚠️ [DB Middleware Error]:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Database initialization failed: " + (err.message || "Unknown error") });
    }
  }
});

// Health check endpoints
app.get(["/api/health", "/api", "/health"], (req, res) => {
  res.json({ status: "ok", message: "Raymiii API is operational", time: new Date().toISOString() });
});

// Database-backed resilient static media serving endpoint
app.get(["/uploads/:filename", "/api/uploads/:filename"], async (req, res) => {
  const filename = req.params.filename;
  if (!filename) {
    res.status(400).send("Bad request: filename missing");
    return;
  }

  const filepath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(filepath)) {
    return res.sendFile(filepath);
  }

  try {
    const row: any = await queryOne("SELECT mime_type, data_base64 FROM media_files WHERE filename = ?", [filename]);
    if (row && row.data_base64) {
      const buffer = Buffer.from(row.data_base64, "base64");
      try {
        if (!fs.existsSync(UPLOADS_DIR)) {
          fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        }
        fs.writeFileSync(filepath, buffer);
      } catch (writeErr) {
        // Disk write cache failed, still serve from memory buffer
      }
      res.setHeader("Content-Type", row.mime_type || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.end(buffer);
    }
  } catch (dbErr) {
    console.error("Error retrieving media file from database:", dbErr);
  }

  return res.status(404).send("File not found");
});

// Helper to save files, optimizing images with Sharp while preserving animated GIFs
const processAndSaveFile = async (file: Express.Multer.File): Promise<string> => {
  let filename = "";
  let mimeType = "";
  let finalBuffer: Buffer = file.buffer;

  const isGif = file.mimetype === "image/gif" || file.originalname.toLowerCase().endsWith(".gif");
  if (isGif) {
    filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.gif`;
    mimeType = "image/gif";
    finalBuffer = file.buffer;
  } else if (file.mimetype.startsWith("image/")) {
    filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
    mimeType = "image/webp";
    try {
      const sharpModule: any = await import("sharp");
      const sharpInstance = sharpModule.default || sharpModule;
      finalBuffer = await sharpInstance(file.buffer)
        .resize({ width: 1080, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch (sharpErr) {
      finalBuffer = file.buffer;
      mimeType = file.mimetype || "image/jpeg";
      filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
    }
  } else {
    const ext = path.extname(file.originalname) || ".mp4";
    filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    mimeType = file.mimetype || "video/mp4";
    finalBuffer = file.buffer;
  }

  // 1. Cache to local disk if directory is writable
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    const filepath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filepath, finalBuffer);
  } catch (fsErr) {
    console.warn("Could not write file to local disk (stateless runtime):", fsErr);
  }

  // 2. Persist base64 data to SQLite/Turso database so files survive serverless invocations and reboots
  try {
    const base64Data = finalBuffer.toString("base64");
    await execute(
      "INSERT OR REPLACE INTO media_files (filename, mime_type, data_base64) VALUES (?, ?, ?)",
      [filename, mimeType, base64Data]
    );
  } catch (dbErr) {
    console.error("Failed to persist media file in media_files table:", dbErr);
  }

  return `/uploads/${filename}`;
};

// ====================================================================
// JWT AUTHENTICATION MIDDLEWARE
// ====================================================================
interface AuthRequest extends express.Request {
  user?: { id: number; username: string; email: string };
}

function authenticateToken(req: AuthRequest, res: express.Response, next: express.NextFunction): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Access token required" });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
    if (err) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
    req.user = decoded;
    next();
  });
}

// Helper to calculate Age from birthday
const calculateAge = (birthdayStr: string | null | undefined) => {
  if (!birthdayStr) return null;
  const birthDate = new Date(birthdayStr);
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return `${age} years old`;
};

// ====================================================================
// GIF SEARCH & TRENDING PROXY (CORS-Safe & Resilient)
// ====================================================================
const CURATED_GIFS = [
  { id: "gif_sasuke", title: "Sasuke Anime Aura", tags: ["anime", "naruto", "sasuke", "cool", "glow"], url: "https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif" },
  { id: "gif_glitch", title: "Cyber Glitch Art", tags: ["cyber", "glitch", "neon", "hacker", "future"], url: "https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif" },
  { id: "gif_sunset", title: "Pixel Sunset Drive", tags: ["pixel", "sunset", "retro", "vibes", "aesthetic"], url: "https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif" },
  { id: "gif_neon", title: "Neon Cyber Aura", tags: ["neon", "aura", "glow", "cyberpunk", "colors"], url: "https://media.giphy.com/media/l41lI4bYmcsPJX9Go/giphy.gif" },
  { id: "gif_cat", title: "Lofi Chill Cat", tags: ["cat", "cute", "chill", "lofi", "animal"], url: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif" },
  { id: "gif_goku", title: "Super Saiyan Aura", tags: ["anime", "goku", "dragonball", "power", "glow"], url: "https://media.giphy.com/media/cb9aF9tzoRjgQ/giphy.gif" },
  { id: "gif_matrix", title: "Matrix Green Stream", tags: ["matrix", "code", "cyber", "hacker", "green"], url: "https://media.giphy.com/media/A06UFEx8jxEwU/giphy.gif" },
  { id: "gif_synth", title: "Synthwave Horizon", tags: ["synthwave", "retrowave", "neon", "aesthetic", "car"], url: "https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif" },
  { id: "gif_party", title: "Vibe Dance", tags: ["dance", "party", "vibe", "music", "hype"], url: "https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif" },
  { id: "gif_space", title: "Cosmic Galaxy Nebula", tags: ["space", "cosmic", "galaxy", "stars", "nebula"], url: "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif" },
  { id: "gif_gaming", title: "8-bit Level Up", tags: ["gaming", "pixel", "game", "arcade", "retro"], url: "https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif" },
  { id: "gif_heart", title: "Pixel Heart Sparkle", tags: ["love", "heart", "cute", "sparkle", "pixel"], url: "https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif" }
];

app.get(["/api/gifs/trending", "/api/giphy/trending"], async (req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch("https://api.giphy.com/v1/gifs/trending?api_key=dc6zaTOxFJmzC&limit=16", {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data: any = await response.json();
      const gifs = (data.data || []).map((g: any) => ({
        id: g.id || `gif_${Math.random()}`,
        title: g.title || "Animated GIF",
        url: g.images?.fixed_height?.url || g.images?.original?.url || g.images?.downsized?.url
      })).filter((g: any) => Boolean(g.url));

      if (gifs.length > 0) {
        return res.json({ success: true, gifs });
      }
    }
  } catch (err) {
    // Network or Giphy error, gracefully fallback
  }

  return res.json({ success: true, gifs: CURATED_GIFS });
});

app.get(["/api/gifs/search", "/api/giphy/search"], async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!query) {
    return res.json({ success: true, gifs: CURATED_GIFS });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(query)}&limit=16`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data: any = await response.json();
      const gifs = (data.data || []).map((g: any) => ({
        id: g.id || `gif_${Math.random()}`,
        title: g.title || "Animated GIF",
        url: g.images?.fixed_height?.url || g.images?.original?.url || g.images?.downsized?.url
      })).filter((g: any) => Boolean(g.url));

      if (gifs.length > 0) {
        return res.json({ success: true, gifs });
      }
    }
  } catch (err) {
    // Fallback below
  }

  // Filter curated GIFs by query tokens
  const lower = query.toLowerCase();
  const filtered = CURATED_GIFS.filter(g => 
    g.title.toLowerCase().includes(lower) || 
    g.tags.some(t => t.toLowerCase().includes(lower) || lower.includes(t.toLowerCase()))
  );

  return res.json({ success: true, gifs: filtered.length > 0 ? filtered : CURATED_GIFS });
});

// ====================================================================
// AUTHENTICATION API ROUTES
// ====================================================================

// ====================================================================
// ANDROID CAPACITOR BUILD & SYNC API ROUTES
// ====================================================================
app.get("/api/android/build-status", (req, res) => {
  const capConfigPath = path.join(process.cwd(), "capacitor.config.ts");
  const androidPath = path.join(process.cwd(), "android");
  
  res.json({
    status: "ready",
    appId: "com.raynista.app",
    appName: "Raynista",
    platform: "android",
    capacitorConfigExists: fs.existsSync(capConfigPath),
    androidDirectoryExists: fs.existsSync(androidPath),
    permissions: [
      "CAMERA",
      "RECORD_AUDIO",
      "READ_MEDIA_IMAGES",
      "READ_MEDIA_VIDEO",
      "POST_NOTIFICATIONS",
      "INTERNET"
    ],
    version: "1.0.0",
    serverUrl: "https://ais-dev-r7zut5ciiaw5coduyhz472-92671597870.europe-west2.run.app"
  });
});

app.post("/api/android/sync", async (req, res) => {
  try {
    const { exec } = await import("child_process");
    exec("npx cap sync android", { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) {
        console.error("Capacitor sync error:", error);
        res.status(500).json({ error: "Failed to sync Capacitor android project", details: stderr || error.message });
      } else {
        res.json({
          success: true,
          message: "Raynista Web Assets & Native Config synced with Android project successfully!",
          stdout: stdout,
          apkPath: "android/app/build/outputs/apk/debug/app-debug.apk"
        });
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to trigger Capacitor sync" });
  }
});

// Check username availability
app.get(["/api/check-username/:username", "/check-username/:username"], async (req, res) => {
  try {
    const { username } = req.params;
    const normalized = (username || "").trim().toLowerCase().replace(/\s+/g, "_");
    if (!normalized || normalized.length < 3) {
      res.json({ available: false });
      return;
    }
    const row = await queryOne("SELECT id FROM users WHERE LOWER(username) = ?", [normalized]);
    res.json({ available: !row });
  } catch (err: any) {
    console.error("Check username error:", err);
    res.status(500).json({ error: "Failed to check username", available: false });
  }
});

// Register
app.post(["/api/register", "/register"], async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ error: "Please fill in all fields (username, email, and password)" });
      return;
    }

    const normalizedUsername = username.trim().toLowerCase().replace(/\s+/g, "_");
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedUsername.length < 3) {
      res.status(400).json({ error: "Username must be at least 3 characters" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const existing = await queryOne(
      "SELECT id, username, email FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?", 
      [normalizedUsername, normalizedEmail]
    );
    if (existing) {
      if (existing.username.toLowerCase() === normalizedUsername) {
        res.status(400).json({ error: "This username is already taken" });
        return;
      }
      res.status(400).json({ error: "An account with this email already exists" });
      return;
    }

    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    const uRes = await execute(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [normalizedUsername, normalizedEmail, password_hash]
    );
    const userId = Number(uRes.lastInsertRowid);

    // Create Profile, settings, and online status record
    const avatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${normalizedUsername}`;
    const registerIsVerified = (normalizedEmail === "rayane@gmail.com" || normalizedUsername === "rayane" || normalizedUsername === "rayanee") ? 1 : 0;
    await execute(
      "INSERT OR IGNORE INTO profiles (user_id, name, bio, avatar_url, is_verified) VALUES (?, ?, ?, ?, ?)",
      [userId, normalizedUsername.toUpperCase(), "", avatar, registerIsVerified]
    );

    await execute(
      "INSERT OR IGNORE INTO user_settings (user_id, theme, privacy) VALUES (?, 'light', 'public')",
      [userId]
    );

    await execute(
      "INSERT OR IGNORE INTO online_status (user_id, is_online, last_seen) VALUES (?, 1, CURRENT_TIMESTAMP)",
      [userId]
    );

    const token = jwt.sign(
      { id: userId, username: normalizedUsername, email: normalizedEmail },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.status(201).json({
      token,
      user: {
        id: userId,
        username: normalizedUsername,
        email: normalizedEmail,
        name: normalizedUsername.toUpperCase(),
        avatar_url: avatar,
        bio: "",
        theme: "light",
        privacy: "public",
        created_at: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error("Register error:", err);
    res.status(500).json({ error: err.message || "Failed to create account" });
  }
});

// Login
app.post(["/api/login", "/login"], async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    console.log(`[Login Attempt] User: ${usernameOrEmail}`);

    if (!usernameOrEmail || !password) {
      res.status(400).json({ error: "Please enter your username/email and password" });
      return;
    }

    const identifier = usernameOrEmail.trim().toLowerCase();
    const user = await queryOne(
      "SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?", 
      [identifier, identifier]
    );

    if (!user) {
      res.status(400).json({ error: "Invalid credentials. Account not found." });
      return;
    }

    const passwordMatches = bcrypt.compareSync(password, user.password_hash);
    if (!passwordMatches) {
      res.status(400).json({ error: "Invalid credentials. Incorrect password." });
      return;
    }

    let profile = await queryOne("SELECT * FROM profiles WHERE user_id = ?", [user.id]);
    if (!profile) {
      const avatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`;
      await execute(
        "INSERT OR IGNORE INTO profiles (user_id, name, bio, avatar_url, is_verified) VALUES (?, ?, '', ?, 0)",
        [user.id, user.username.toUpperCase(), avatar]
      );
      profile = await queryOne("SELECT * FROM profiles WHERE user_id = ?", [user.id]);
    }

    let settings = await queryOne("SELECT * FROM user_settings WHERE user_id = ?", [user.id]);
    if (!settings) {
      await execute("INSERT OR IGNORE INTO user_settings (user_id, theme, privacy) VALUES (?, 'light', 'public')", [user.id]);
      settings = await queryOne("SELECT * FROM user_settings WHERE user_id = ?", [user.id]);
    }

    await execute(
      "INSERT INTO online_status (user_id, is_online, last_seen) VALUES (?, 1, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET is_online=1, last_seen=CURRENT_TIMESTAMP",
      [user.id]
    );

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: profile?.name || user.username,
        avatar_url: profile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`,
        bio: profile?.bio || "",
        theme: settings?.theme || "light",
        privacy: settings?.privacy || "public",
        created_at: user.created_at
      }
    });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message || "Failed to sign in" });
  }
});

// SSO / Third Party Provider Login (Google, Apple, Facebook)
app.post(["/api/auth/sso", "/auth/sso"], async (req, res) => {
  try {
    const { provider } = req.body;
    const providerName = (provider || "Social").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
    const ssoUsername = `${providerName}_user`;
    const ssoEmail = `${ssoUsername}@sso.local`;

    let user = await queryOne("SELECT * FROM users WHERE username = ?", [ssoUsername]);
    if (!user) {
      const defaultHash = bcrypt.hashSync(Math.random().toString(36), 10);
      const insertResult = await execute(
        "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
        [ssoUsername, ssoEmail, defaultHash]
      );
      const userId = Number(insertResult.lastInsertRowid);
      await execute(
        "INSERT OR IGNORE INTO profiles (user_id, name, avatar_url, bio) VALUES (?, ?, ?, ?)",
        [userId, `${provider || "Social"} User`, `https://api.dicebear.com/7.x/adventurer/svg?seed=${ssoUsername}`, `Signed in via ${provider || "Social"}`]
      );
      await execute("INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)", [userId]);
      user = await queryOne("SELECT * FROM users WHERE id = ?", [userId]);
    }

    if (!user) {
      res.status(500).json({ error: "No user account could be created for SSO" });
      return;
    }

    const profile = await queryOne("SELECT * FROM profiles WHERE user_id = ?", [user.id]);
    const settings = await queryOne("SELECT * FROM user_settings WHERE user_id = ?", [user.id]);

    await execute(
      "INSERT INTO online_status (user_id, is_online, last_seen) VALUES (?, 1, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET is_online=1, last_seen=CURRENT_TIMESTAMP",
      [user.id]
    );

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: profile?.name || `${provider || "Social"} User`,
        avatar_url: profile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`,
        bio: profile?.bio || "",
        theme: settings?.theme || "light",
        privacy: settings?.privacy || "public",
        created_at: user.created_at
      }
    });
  } catch (err: any) {
    console.error("SSO error:", err);
    res.status(500).json({ error: err.message || "Failed to complete SSO authentication" });
  }
});

// ====================================================================
// USER SETTINGS & EXTRA MANAGEMENT ENDPOINTS
// ====================================================================

// Update user settings
app.put("/api/settings", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const { theme, language, privacy, notifications_enabled } = req.body;

    const t = theme !== undefined ? theme : null;
    const l = language !== undefined ? language : null;
    const p = privacy !== undefined ? privacy : null;
    const n = notifications_enabled !== undefined ? notifications_enabled : null;

    await execute(
      "INSERT INTO user_settings (user_id, theme, language, privacy, notifications_enabled) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET theme=COALESCE(?, theme), language=COALESCE(?, language), privacy=COALESCE(?, privacy), notifications_enabled=COALESCE(?, notifications_enabled)",
      [currentUserId, t, l, p, n, t, l, p, n]
    );

    res.json({ success: true, settings: { theme, language, privacy, notifications_enabled } });
  } catch (err) {
    console.error("Settings update error:", err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// Delete account
app.delete("/api/account", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    await execute("DELETE FROM users WHERE id = ?", [currentUserId]);
    res.json({ success: true, message: "Account deleted successfully." });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

// Block user
app.post("/api/users/:id/block", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const blockId = parseInt(req.params.id);

    await execute("INSERT OR IGNORE INTO blocked_users (blocker_id, blocked_id) VALUES (?, ?)", [currentUserId, blockId]);
    // Delete follows/follow requests
    await execute("DELETE FROM followers WHERE (follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)", [currentUserId, blockId, blockId, currentUserId]);
    await execute("DELETE FROM follow_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)", [currentUserId, blockId, blockId, currentUserId]);

    res.json({ success: true, message: "User blocked." });
  } catch (err) {
    res.status(500).json({ error: "Failed to block user" });
  }
});

// Unblock user
app.post("/api/users/:id/unblock", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const blockId = parseInt(req.params.id);
    await execute("DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?", [currentUserId, blockId]);
    res.json({ success: true, message: "User unblocked." });
  } catch (err) {
    res.status(500).json({ error: "Failed to unblock user" });
  }
});

// Report post, reel or user
app.post("/api/reports", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const { reported_id, post_id, reel_id, reason } = req.body;

    await execute(
      "INSERT INTO reports (reporter_id, reported_id, post_id, reel_id, reason) VALUES (?, ?, ?, ?, ?)",
      [currentUserId, reported_id, post_id || null, reel_id || null, reason]
    );

    res.json({ success: true, message: "Thank you. Report received." });
  } catch (err) {
    res.status(500).json({ error: "Failed to file report" });
  }
});

// Mute User
app.post("/api/users/:id/mute", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const muteId = parseInt(req.params.id);
    await execute("INSERT OR IGNORE INTO muted_users (user_id, muted_id) VALUES (?, ?)", [currentUserId, muteId]);
    res.json({ success: true, message: "User muted successfully." });
  } catch (err) {
    res.status(500).json({ error: "Failed to mute user" });
  }
});

// ====================================================================
// CORE FEED & POSTS API ROUTES
// ====================================================================

// Create standard post
app.post("/api/posts/create", authenticateToken, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const { caption, post_type } = req.body;
    let media_url = req.body.media_url;

    if (req.file) {
      media_url = await processAndSaveFile(req.file);
    }

    if (!media_url) {
      res.status(400).json({ error: "Media file is required" });
      return;
    }

    if (post_type === "reel") {
      const rRes = await execute(
        "INSERT INTO reels (user_id, media_url, caption) VALUES (?, ?, ?)",
        [currentUserId, media_url, caption || ""]
      );
      res.status(201).json({ reel: { id: Number(rRes.lastInsertRowid), media_url, caption } });
    } else {
      const pRes = await execute(
        "INSERT INTO posts (user_id, media_url, caption) VALUES (?, ?, ?)",
        [currentUserId, media_url, caption || ""]
      );
      res.status(201).json({ post: { id: Number(pRes.lastInsertRowid), media_url, caption } });
    }
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ error: "Failed to create post" });
  }
});

// Create standard/reel legacy endpoint
app.post("/api/posts", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const { media_url, caption, post_type, co_creator_id } = req.body;

    if (!media_url) {
      res.status(400).json({ error: "Media URL is required" });
      return;
    }

    if (post_type === "reel") {
      const rRes = await execute(
        "INSERT INTO reels (user_id, co_creator_id, media_url, caption) VALUES (?, ?, ?, ?)",
        [currentUserId, co_creator_id ? parseInt(co_creator_id) : null, media_url, caption || ""]
      );
      res.status(201).json({ post: { id: Number(rRes.lastInsertRowid), media_url, caption, post_type: "reel" } });
    } else {
      const pRes = await execute(
        "INSERT INTO posts (user_id, media_url, caption) VALUES (?, ?, ?)",
        [currentUserId, media_url, caption || ""]
      );
      res.status(201).json({ post: { id: Number(pRes.lastInsertRowid), media_url, caption, post_type: "standard" } });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to create post" });
  }
});

// GET standard timeline feed with full pagination support
app.get("/api/feed", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    // Load following list to enforce privacy rules
    const following = await query("SELECT following_id FROM followers WHERE follower_id = ?", [currentUserId]);
    const followingIds = following.map((f) => f.following_id);

    // Get feed posts (excluding blocked ones)
    const postsList = await query(
      `SELECT p.*, u.username, pr.avatar_url, pr.is_verified, us.privacy
       FROM posts p
       JOIN users u ON p.user_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       LEFT JOIN user_settings us ON u.id = us.user_id
       WHERE p.user_id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = ?)
         AND p.user_id NOT IN (SELECT blocker_id FROM blocked_users WHERE blocked_id = ?)
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [currentUserId, currentUserId, limit, offset]
    );

    const dynamicFeed = [];
    for (const post of postsList) {
      // Check privacy constraint
      if (post.privacy === "private" && post.user_id !== currentUserId && !followingIds.includes(post.user_id)) {
        continue;
      }

      // Likes count and is_liked
      const likesCountRow = await queryOne("SELECT COUNT(*) as count FROM likes WHERE post_id = ?", [post.id]);
      const likedRow = await queryOne("SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?", [currentUserId, post.id]);

      // Comments list with author profiles
      const comments = await query(
        `SELECT c.*, u.username, pr.avatar_url
         FROM comments c
         JOIN users u ON c.user_id = u.id
         LEFT JOIN profiles pr ON u.id = pr.user_id
         WHERE c.post_id = ?
         ORDER BY c.created_at ASC`,
        [post.id]
      );

      // Bookmark
      const bookmarked = await queryOne("SELECT 1 FROM saved_posts WHERE user_id = ? AND post_id = ?", [currentUserId, post.id]);

      dynamicFeed.push({
        id: post.id,
        media_url: post.media_url,
        caption: post.caption,
        post_type: "standard",
        created_at: post.created_at,
        user: {
          id: post.user_id,
          username: post.username,
          avatar_url: post.avatar_url,
          is_verified: Number(post.is_verified || 0) === 1
        },
        likes_count: Number(likesCountRow.count || 0),
        is_liked: !!likedRow,
        is_bookmarked: !!bookmarked,
        comments: comments.map((c) => ({
          id: c.id,
          text: c.text,
          created_at: c.created_at,
          user: {
            id: c.user_id,
            username: c.username,
            avatar_url: c.avatar_url
          }
        }))
      });
    }

    res.json({ feed: dynamicFeed });
  } catch (err) {
    console.error("Feed error:", err);
    res.status(500).json({ error: "Failed to fetch feed" });
  }
});

// GET vertical video reels
app.get("/api/reels", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;

    const reelsList = await query(
      `SELECT r.*, u.username, pr.avatar_url, pr.is_verified,
              cc.username as co_creator_username, cc_pr.avatar_url as co_creator_avatar
       FROM reels r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       LEFT JOIN users cc ON r.co_creator_id = cc.id
       LEFT JOIN profiles cc_pr ON cc.id = cc_pr.user_id
       WHERE r.user_id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = ?)
         AND r.user_id NOT IN (SELECT blocker_id FROM blocked_users WHERE blocked_id = ?)
       ORDER BY r.created_at DESC`
    , [currentUserId, currentUserId]);

    const dynamicReels = [];
    for (const reel of reelsList) {
      const likesCount = await queryOne("SELECT COUNT(*) as count FROM likes WHERE reel_id = ?", [reel.id]);
      const commentsCount = await queryOne("SELECT COUNT(*) as count FROM comments WHERE reel_id = ?", [reel.id]);
      const liked = await queryOne("SELECT 1 FROM likes WHERE user_id = ? AND reel_id = ?", [currentUserId, reel.id]);
      const bookmarked = await queryOne("SELECT 1 FROM saved_posts WHERE user_id = ? AND reel_id = ?", [currentUserId, reel.id]);
      const comments = await query(
        `SELECT c.*, u.username, pr.avatar_url
         FROM comments c
         JOIN users u ON c.user_id = u.id
         LEFT JOIN profiles pr ON u.id = pr.user_id
         WHERE c.reel_id = ?
         ORDER BY c.created_at ASC`,
        [reel.id]
      );

      dynamicReels.push({
        id: reel.id,
        media_url: reel.media_url,
        caption: reel.caption,
        post_type: "reel",
        created_at: reel.created_at,
        user: {
          id: reel.user_id,
          username: reel.username,
          avatar_url: reel.avatar_url,
          is_following: true
        },
        co_creator: reel.co_creator_id ? {
          id: reel.co_creator_id,
          username: reel.co_creator_username,
          avatar_url: reel.co_creator_avatar
        } : null,
        likes_count: Number(likesCount.count || 0),
        comments_count: Number(commentsCount.count || 0),
        is_liked: !!liked,
        is_bookmarked: !!bookmarked,
        comments: comments.map((c) => ({
          id: c.id,
          text: c.text,
          username: c.username,
          avatar_url: c.avatar_url
        }))
      });
    }

    res.json({ reels: dynamicReels });
  } catch (err) {
    console.error("Reels error:", err);
    res.status(500).json({ error: "Failed to load reels" });
  }
});

// Create story
app.post("/api/stories/create", authenticateToken, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    let media_url = req.body.media_url;

    if (req.file) {
      media_url = await processAndSaveFile(req.file);
    }

    if (!media_url) {
      res.status(400).json({ error: "Media file is required" });
      return;
    }

    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const sRes = await execute(
      "INSERT INTO stories (user_id, media_url, expires_at) VALUES (?, ?, ?)",
      [currentUserId, media_url, expires_at]
    );

    res.status(201).json({
      story: {
        id: Number(sRes.lastInsertRowid),
        user_id: currentUserId,
        media_url,
        expires_at
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create story" });
  }
});

// GET active stories
app.get("/api/stories", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const now = new Date().toISOString();

    const following = await query("SELECT following_id FROM followers WHERE follower_id = ?", [currentUserId]);
    const followedIds = following.map((f) => f.following_id);
    followedIds.push(currentUserId);

    const placeholders = followedIds.map(() => "?").join(",");
    const stories = await query(
      `SELECT s.*, u.username, pr.avatar_url
       FROM stories s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       WHERE s.user_id IN (${placeholders}) AND s.expires_at > ?
       ORDER BY s.created_at ASC`,
      [...followedIds, now]
    );

    const userStories: Record<number, any> = {};
    for (const story of stories) {
      if (!userStories[story.user_id]) {
        userStories[story.user_id] = {
          user: {
            id: story.user_id,
            username: story.username,
            avatar_url: story.avatar_url
          },
          items: []
        };
      }
      userStories[story.user_id].items.push({
        id: story.id,
        media_url: story.media_url,
        created_at: story.created_at
      });
    }

    res.json({ stories: Object.values(userStories) });
  } catch (err) {
    res.status(500).json({ error: "Failed to load stories" });
  }
});

// ====================================================================
// INSTAGRAM MUSIC & NOTES API ROUTES
// ====================================================================

// Helper to query real online music catalog (Apple Music / iTunes API with multi-region and artist matching)
async function fetchOnlineMusic(term: string, limit = 40): Promise<any[]> {
  try {
    const rawTerm = term.trim();
    if (!rawTerm) return [];

    const unspacedTerm = rawTerm.replace(/[\s\-_.,'/]+/g, "");
    const searchTerms = Array.from(new Set([rawTerm, unspacedTerm])).filter(Boolean);

    // Query key music storefronts in parallel for full North African, European & Global coverage
    const countryCodes = ["MA", "FR", "US", "ES", "GB"];
    const fetchPromises: Promise<any>[] = [];

    for (const q of searchTerms) {
      for (const cc of countryCodes) {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&country=${cc}&media=music&entity=song&limit=${Math.min(limit, 30)}`;
        fetchPromises.push(
          (async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            try {
              const res = await fetch(url, {
                signal: controller.signal,
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                  "Accept": "application/json"
                }
              });
              clearTimeout(timeoutId);
              if (!res.ok) return [];
              const data: any = await res.json();
              return Array.isArray(data?.results) ? data.results : [];
            } catch {
              clearTimeout(timeoutId);
              return [];
            }
          })()
        );
      }
    }

    const settledResults = await Promise.allSettled(fetchPromises);
    const combinedRawTracks: any[] = [];
    for (const result of settledResults) {
      if (result.status === "fulfilled" && Array.isArray(result.value)) {
        combinedRawTracks.push(...result.value);
      }
    }

    const seenTrackIds = new Set<string>();
    const seenSignatures = new Set<string>();
    const formattedTracks: any[] = [];

    for (const item of combinedRawTracks) {
      if (!item || !item.previewUrl || (!item.trackName && !item.trackCensoredName)) continue;
      const trackId = String(item.trackId || "");
      const title = String(item.trackName || item.trackCensoredName || "Unknown Song").trim();
      const artist = String(item.artistName || "Unknown Artist").trim();
      const signature = `${title.toLowerCase()}_${artist.toLowerCase()}`;

      if (trackId && seenTrackIds.has(trackId)) continue;
      if (seenSignatures.has(signature)) continue;

      if (trackId) seenTrackIds.add(trackId);
      seenSignatures.add(signature);

      const cover = item.artworkUrl100
        ? item.artworkUrl100.replace("100x100bb", "400x400bb")
        : (item.artworkUrl60 || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&h=300&q=80");

      formattedTracks.push({
        id: `online_${item.trackId || Math.random().toString(36).substring(2, 9)}`,
        title,
        artist,
        album: item.collectionName || "",
        genre: item.primaryGenreName || "Music",
        is_trending: 0,
        cover_url: cover,
        audio_url: item.previewUrl,
        duration: item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 30,
        is_online: true,
        source: "Apple Music"
      });
    }

    return formattedTracks;
  } catch (err) {
    console.warn("Online music search fetch error:", err);
    return [];
  }
}

// Helper function to rank and score track relevance (ensuring searched musicians like "ElGrandeToto" or "Morad" appear at the very 1st place!)
function scoreMusicMatch(track: any, searchStr: string): number {
  if (!searchStr) return 0;
  const rawQ = searchStr.toLowerCase().trim();
  const cleanQ = rawQ.replace(/[\s\-_.,'/()]+/g, "");
  const title = (track.title || "").toLowerCase().trim();
  const artist = (track.artist || "").toLowerCase().trim();
  const cleanTitle = title.replace(/[\s\-_.,'/()]+/g, "");
  const cleanArtist = artist.replace(/[\s\-_.,'/()]+/g, "");

  let score = 0;

  // 1. EXACT / DOMINANT ARTIST MATCH (Highest Ranking Priority)
  if (cleanArtist === cleanQ || artist === rawQ) {
    score += 25000;
  } else if (cleanArtist.startsWith(cleanQ) || artist.startsWith(rawQ)) {
    score += 20000;
  } else if (cleanQ.startsWith(cleanArtist) || rawQ.startsWith(artist)) {
    score += 18000;
  } else if (cleanArtist.includes(cleanQ) || artist.includes(rawQ)) {
    score += 15000;
  }

  // Tokenized Artist Match (e.g. searching "elgrande toto" matches "ElGrandeToto", "Toto", etc.)
  const qTokens = rawQ.split(/[\s\-_.,'/()]+/).filter(Boolean);
  const artistTokens = artist.split(/[\s\-_.,'/()]+/).filter(Boolean);
  const titleTokens = title.split(/[\s\-_.,'/()]+/).filter(Boolean);

  if (qTokens.length > 0) {
    const matchedArtistTokens = qTokens.filter((token: string) =>
      artistTokens.some((at: string) => at.includes(token) || token.includes(at)) ||
      cleanArtist.includes(token)
    );
    if (matchedArtistTokens.length === qTokens.length) {
      score += 12000;
    } else if (matchedArtistTokens.length > 0) {
      score += 6000 * (matchedArtistTokens.length / qTokens.length);
    }
  }

  // 2. EXACT / PREFIX TITLE MATCH
  if (cleanTitle === cleanQ || title === rawQ) {
    score += 10000;
  } else if (cleanTitle.startsWith(cleanQ) || title.startsWith(rawQ)) {
    score += 8000;
  } else if (cleanTitle.includes(cleanQ) || title.includes(rawQ)) {
    score += 5000;
  }

  if (qTokens.length > 0) {
    const matchedTitleTokens = qTokens.filter((token: string) =>
      titleTokens.some((tt: string) => tt.includes(token) || token.includes(tt)) ||
      cleanTitle.includes(token)
    );
    if (matchedTitleTokens.length === qTokens.length) {
      score += 7000;
    } else if (matchedTitleTokens.length > 0) {
      score += 3500 * (matchedTitleTokens.length / qTokens.length);
    }
  }

  // Word boundary boosts (e.g. "mo" matches "Morad", "Montagem", "Modern")
  if (artistTokens.some((w: string) => w.startsWith(rawQ))) score += 4000;
  if (titleTokens.some((w: string) => w.startsWith(rawQ))) score += 3000;

  if (track.is_trending) score += 100;
  return score;
}

// 1. GET ALL MUSIC / SEARCH / FILTER (LOCAL + ONLINE SEARCH WITH PREFIX RANKING)
app.get(["/api/music", "/api/music/tracks"], authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user?.id;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : (typeof req.query.q === "string" ? req.query.q.trim() : "");
    const genre = typeof req.query.genre === "string" ? req.query.genre.trim() : "";
    const isTrending = req.query.trending === "1" || req.query.trending === "true";
    const myUploadsOnly = req.query.my_uploads === "1" || req.query.my_uploads === "true";

    // 1. If only requested user's own uploads
    if (myUploadsOnly && currentUserId) {
      const myTracks = await query(
        "SELECT * FROM music_tracks WHERE uploaded_by = ? ORDER BY id DESC LIMIT 50",
        [currentUserId]
      );
      res.json({ success: true, tracks: myTracks });
      return;
    }

    // 2. Fetch local DB tracks
    let sql = "SELECT * FROM music_tracks WHERE 1=1";
    const params: any[] = [];

    if (genre && genre.toLowerCase() !== "all" && genre.toLowerCase() !== "trending") {
      sql += " AND LOWER(genre) = LOWER(?)";
      params.push(genre);
    }

    if (isTrending || genre.toLowerCase() === "trending") {
      sql += " AND is_trending = 1";
    }

    if (search) {
      sql += " AND (LOWER(title) LIKE ? OR LOWER(artist) LIKE ? OR LOWER(genre) LIKE ?)";
      const pattern = `%${search.toLowerCase()}%`;
      params.push(pattern, pattern, pattern);
    }

    sql += " ORDER BY is_trending DESC, id DESC LIMIT 50";
    const localTracks = await query(sql, params);

    // 3. Online Search Engine (iTunes / Apple Music Global Catalog)
    let onlineTracks: any[] = [];

    if (search) {
      // User is actively searching for any song or artist
      onlineTracks = await fetchOnlineMusic(search, 40);
    } else if (genre && genre.toLowerCase() !== "all") {
      // Genre specific discovery
      const genreSearchTerms: { [k: string]: string } = {
        "trending": "Top Hits 2026 Global",
        "pop": "Top Pop Hits",
        "hip hop": "Hip Hop Rap Hits",
        "lofi": "Lofi Chill Beats",
        "phonk": "Phonk Drift",
        "electronic": "Electronic Dance EDM",
        "acoustic": "Acoustic Hits",
        "arabic": "Moroccan Arabic Hits",
        "rock": "Rock Hits",
        "r&b": "R&B Soul Hits",
        "latin": "Latin Reggaeton Hits"
      };
      const term = genreSearchTerms[genre.toLowerCase()] || `${genre} hits`;
      onlineTracks = await fetchOnlineMusic(term, 25);
    } else if (isTrending || genre.toLowerCase() === "trending") {
      onlineTracks = await fetchOnlineMusic("Top Billboard Hits", 25);
    }

    // 4. Merge Local and Online Tracks seamlessly with deduplication
    const seenSignatures = new Set<string>();
    const mergedTracks: any[] = [];

    // Prioritize local database results (e.g. user custom uploads or curated library)
    for (const t of localTracks) {
      const sig = `${(t.title || "").toLowerCase().trim()}_${(t.artist || "").toLowerCase().trim()}`;
      if (!seenSignatures.has(sig)) {
        seenSignatures.add(sig);
        mergedTracks.push(t);
      }
    }

    // Append rich online search results
    for (const t of onlineTracks) {
      const sig = `${(t.title || "").toLowerCase().trim()}_${(t.artist || "").toLowerCase().trim()}`;
      if (!seenSignatures.has(sig)) {
        seenSignatures.add(sig);
        mergedTracks.push(t);
      }
    }

    // If searching, sort results by match relevance score (items starting with search query rank first)
    if (search) {
      mergedTracks.sort((a, b) => scoreMusicMatch(b, search) - scoreMusicMatch(a, search));
    }

    res.json({ success: true, tracks: mergedTracks, total: mergedTracks.length });
  } catch (err) {
    console.error("Failed to load music:", err);
    res.status(500).json({ error: "Failed to load music" });
  }
});

// 2. UPLOAD CUSTOM MUSIC TRACK
app.post(
  "/api/music/upload",
  authenticateToken,
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "cover", maxCount: 1 }
  ]),
  async (req: AuthRequest, res) => {
    try {
      const currentUserId = req.user!.id;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const audioFile = files?.audio?.[0];
      const coverFile = files?.cover?.[0];

      const { title, artist, genre, cover_url } = req.body;

      if (!audioFile) {
        res.status(400).json({ error: "Audio file is required" });
        return;
      }

      if (!title || typeof title !== "string" || !title.trim()) {
        res.status(400).json({ error: "Track title is required" });
        return;
      }

      const audioUrl = await processAndSaveFile(audioFile);
      let finalCoverUrl = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&h=300&q=80";

      if (coverFile) {
        finalCoverUrl = await processAndSaveFile(coverFile);
      } else if (cover_url && typeof cover_url === "string" && cover_url.trim()) {
        finalCoverUrl = cover_url.trim();
      }

      const trackTitle = title.trim().slice(0, 60);
      const trackArtist = (artist && typeof artist === "string" && artist.trim()) 
        ? artist.trim().slice(0, 50) 
        : req.user!.username;
      const trackGenre = (genre && typeof genre === "string" && genre.trim()) 
        ? genre.trim().slice(0, 30) 
        : "Custom";

      const insertRes = await execute(
        `INSERT INTO music_tracks (title, artist, genre, is_trending, cover_url, audio_url, duration, uploaded_by)
         VALUES (?, ?, ?, 0, ?, ?, 30, ?)`,
        [trackTitle, trackArtist, trackGenre, finalCoverUrl, audioUrl, currentUserId]
      );

      const newTrack = {
        id: Number(insertRes.lastInsertRowid),
        title: trackTitle,
        artist: trackArtist,
        genre: trackGenre,
        is_trending: 0,
        cover_url: finalCoverUrl,
        audio_url: audioUrl,
        duration: 30,
        uploaded_by: currentUserId,
        created_at: new Date().toISOString()
      };

      res.json({ success: true, track: newTrack });
    } catch (err: any) {
      console.error("Music upload error:", err);
      res.status(500).json({ error: err.message || "Failed to upload music" });
    }
  }
);

// 3. GET INSTAGRAM NOTES
app.get("/api/notes", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const now = new Date().toISOString();

    // Clean up expired notes
    await execute("DELETE FROM notes WHERE expires_at < ?", [now]);

    // Fetch active notes with user details and likes count
    const rows = await query(
      `SELECT n.id, n.user_id, n.text, n.mood_emoji, n.music_track, n.music_title, n.music_artist, n.music_url, n.music_cover, n.music_start_time, n.audience, n.created_at, n.expires_at,
              u.username, pr.avatar_url,
              (SELECT COUNT(*) FROM note_likes WHERE note_id = n.id) AS likes_count,
              (SELECT COUNT(*) FROM note_likes WHERE note_id = n.id AND user_id = ?) AS is_liked
       FROM notes n
       JOIN users u ON n.user_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       WHERE n.expires_at > ?
       ORDER BY n.created_at DESC`,
      [currentUserId, now]
    );

    // Format notes and identify current user's note
    let myNote: any = null;
    const otherNotes: any[] = [];

    for (const r of rows) {
      const musicTitle = r.music_title || "";
      const musicArtist = r.music_artist || "";
      const musicTrack = r.music_track || (musicTitle ? `${musicTitle} · ${musicArtist || "Artist"}` : "");

      const noteItem = {
        id: r.id,
        user_id: r.user_id,
        username: r.username,
        avatar_url: r.avatar_url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&h=150&q=80",
        text: r.text,
        mood_emoji: r.mood_emoji || "💭",
        music_track: musicTrack,
        music_title: musicTitle,
        music_artist: musicArtist,
        music_url: r.music_url || "",
        music_cover: r.music_cover || "",
        music_start_time: Number(r.music_start_time) || 0,
        audience: r.audience || "followers",
        created_at: r.created_at,
        is_self: r.user_id === currentUserId,
        likes_count: Number(r.likes_count) || 0,
        is_liked: Boolean(r.is_liked)
      };

      if (r.user_id === currentUserId) {
        myNote = noteItem;
      } else {
        otherNotes.push(noteItem);
      }
    }

    // If Raynai has no note, add an active smart note for Raynai bot
    const raynaiUser = await queryOne("SELECT id, username FROM users WHERE username = 'raynai'");
    if (raynaiUser && !rows.some(r => r.user_id === raynaiUser.id)) {
      const raynaiProfile = await queryOne("SELECT avatar_url FROM profiles WHERE user_id = ?", [raynaiUser.id]);
      const raynaiNote = {
        id: 999999,
        user_id: raynaiUser.id,
        username: "raynai",
        avatar_url: raynaiProfile?.avatar_url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&h=150&q=80",
        text: "M3akoum Raynai AI ⚡ Kteb lia f Direct!",
        mood_emoji: "✨",
        music_track: "Casablanca Sunset Beats · Raymi Beats",
        music_title: "Casablanca Sunset Beats",
        music_artist: "Raymi Beats",
        music_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
        music_cover: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=300&h=300&q=80",
        music_start_time: 0,
        audience: "followers",
        created_at: new Date().toISOString(),
        is_self: false,
        likes_count: 5,
        is_liked: false
      };
      otherNotes.unshift(raynaiNote);
    }

    res.json({
      my_note: myNote,
      notes: myNote ? [myNote, ...otherNotes] : otherNotes
    });
  } catch (err) {
    console.error("Failed to load notes:", err);
    res.status(500).json({ error: "Failed to load notes" });
  }
});

// 4. CREATE / UPDATE INSTAGRAM NOTE
app.post("/api/notes", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const { text, mood_emoji, music_track, music_title, music_artist, music_url, music_cover, music_start_time, audience } = req.body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      res.status(400).json({ error: "Note text is required" });
      return;
    }

    const trimmedText = text.trim().slice(0, 60); // 60 chars Instagram standard
    const emoji = (mood_emoji && typeof mood_emoji === "string") ? mood_emoji.trim() : "💭";
    const mTitle = (music_title && typeof music_title === "string") ? music_title.trim().slice(0, 60) : "";
    const mArtist = (music_artist && typeof music_artist === "string") ? music_artist.trim().slice(0, 50) : "";
    const mUrl = (music_url && typeof music_url === "string") ? music_url.trim() : "";
    const mCover = (music_cover && typeof music_cover === "string") ? music_cover.trim() : "";
    const mStartTime = typeof music_start_time === "number" ? Math.max(0, Math.floor(music_start_time)) : 0;
    const mAudience = (audience === "close_friends") ? "close_friends" : "followers";
    
    let mTrack = (music_track && typeof music_track === "string") ? music_track.trim().slice(0, 80) : "";
    if (!mTrack && mTitle) {
      mTrack = mArtist ? `${mTitle} · ${mArtist}` : mTitle;
    }

    // 24 hours expiry
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    // Check existing note
    const existing = await queryOne("SELECT id FROM notes WHERE user_id = ?", [currentUserId]);

    let noteId: number;
    if (existing) {
      await execute(
        `UPDATE notes 
         SET text = ?, mood_emoji = ?, music_track = ?, music_title = ?, music_artist = ?, music_url = ?, music_cover = ?, music_start_time = ?, audience = ?, expires_at = ?, created_at = ?
         WHERE user_id = ?`,
        [trimmedText, emoji, mTrack, mTitle, mArtist, mUrl, mCover, mStartTime, mAudience, expiresAt, now, currentUserId]
      );
      noteId = existing.id;
    } else {
      const insertRes = await execute(
        `INSERT INTO notes (user_id, text, mood_emoji, music_track, music_title, music_artist, music_url, music_cover, music_start_time, audience, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [currentUserId, trimmedText, emoji, mTrack, mTitle, mArtist, mUrl, mCover, mStartTime, mAudience, expiresAt, now]
      );
      noteId = Number(insertRes.lastInsertRowid);
    }

    const userProfile = await queryOne(
      `SELECT u.username, pr.avatar_url 
       FROM users u 
       LEFT JOIN profiles pr ON u.id = pr.user_id 
       WHERE u.id = ?`,
      [currentUserId]
    );

    const newNote = {
      id: noteId,
      user_id: currentUserId,
      username: userProfile?.username || req.user!.username,
      avatar_url: userProfile?.avatar_url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&h=150&q=80",
      text: trimmedText,
      mood_emoji: emoji,
      music_track: mTrack,
      music_title: mTitle,
      music_artist: mArtist,
      music_url: mUrl,
      music_cover: mCover,
      music_start_time: mStartTime,
      audience: mAudience,
      created_at: now,
      is_self: true,
      likes_count: 0,
      is_liked: false
    };

    // Broadcast update via Socket.io
    io.emit("note_updated", newNote);

    // Automatically cache online soundtrack in local library if not exists
    if (mTitle && mUrl) {
      try {
        const existingTrack = await queryOne("SELECT id FROM music_tracks WHERE audio_url = ? OR (LOWER(title) = LOWER(?) AND LOWER(artist) = LOWER(?))", [mUrl, mTitle, mArtist]);
        if (!existingTrack) {
          await execute(
            `INSERT INTO music_tracks (title, artist, genre, is_trending, cover_url, audio_url, duration, uploaded_by)
             VALUES (?, ?, ?, 0, ?, ?, 30, ?)`,
            [mTitle, mArtist || "Artist", "Popular", mCover || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&h=300&q=80", mUrl, currentUserId]
          );
        }
      } catch (trackCacheErr) {
        // Non-blocking
      }
    }

    res.json({ success: true, note: newNote });
  } catch (err) {
    console.error("Failed to post note:", err);
    res.status(500).json({ error: "Failed to share note" });
  }
});

// 5. TOGGLE LIKE ON A NOTE
app.post("/api/notes/:id/like", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const noteId = parseInt(req.params.id);

    if (isNaN(noteId)) {
      res.status(400).json({ error: "Invalid note id" });
      return;
    }

    const note = await queryOne("SELECT * FROM notes WHERE id = ?", [noteId]);
    if (!note && noteId !== 999999) {
      res.status(404).json({ error: "Note not found or expired" });
      return;
    }

    const existingLike = await queryOne("SELECT id FROM note_likes WHERE note_id = ? AND user_id = ?", [noteId, currentUserId]);
    let isLiked = false;

    if (existingLike) {
      await execute("DELETE FROM note_likes WHERE id = ?", [existingLike.id]);
      isLiked = false;
    } else {
      await execute("INSERT INTO note_likes (note_id, user_id) VALUES (?, ?)", [noteId, currentUserId]);
      isLiked = true;

      // Send notification to note owner if not self
      if (note && note.user_id !== currentUserId) {
        const sender = await queryOne("SELECT u.username, pr.avatar_url FROM users u LEFT JOIN profiles pr ON u.id = pr.user_id WHERE u.id = ?", [currentUserId]);
        const notifMsg = `${sender?.username || "Someone"} liked your note: "${note.text.slice(0, 30)}"`;
        const notifRes = await execute(
          `INSERT INTO notifications (type, sender_id, receiver_id, text) VALUES ('like', ?, ?, ?)`,
          [currentUserId, note.user_id, notifMsg]
        );

        io.to(`user_${note.user_id}`).emit("new_notification", {
          id: Number(notifRes.lastInsertRowid),
          type: "like",
          sender_id: currentUserId,
          sender_username: sender?.username || req.user!.username,
          sender_avatar: sender?.avatar_url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&h=150&q=80",
          text: notifMsg,
          created_at: new Date().toISOString(),
          is_read: false
        });
      }
    }

    const countRes = await queryOne("SELECT COUNT(*) AS c FROM note_likes WHERE note_id = ?", [noteId]);
    const likesCount = Number(countRes?.c) || (isLiked ? 1 : 0);

    // Broadcast socket event
    io.emit("note_liked", {
      note_id: noteId,
      user_id: currentUserId,
      is_liked: isLiked,
      likes_count: likesCount
    });

    res.json({ success: true, is_liked: isLiked, likes_count: likesCount });
  } catch (err) {
    console.error("Failed to toggle note like:", err);
    res.status(500).json({ error: "Failed to like note" });
  }
});

app.delete("/api/notes", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    await execute("DELETE FROM notes WHERE user_id = ?", [currentUserId]);

    io.emit("note_deleted", { user_id: currentUserId });
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete note:", err);
    res.status(500).json({ error: "Failed to delete note" });
  }
});

// Toggle Post/Reel Like
app.post("/api/posts/:id/like", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const entityId = parseInt(req.params.id);
    const { is_reel } = req.body;

    const column = is_reel ? "reel_id" : "post_id";
    const existing = await queryOne(`SELECT id FROM likes WHERE user_id = ? AND ${column} = ?`, [currentUserId, entityId]);

    let isLiked = false;
    if (existing) {
      await execute(`DELETE FROM likes WHERE id = ?`, [existing.id]);
    } else {
      await execute(`INSERT INTO likes (user_id, ${column}) VALUES (?, ?)`, [currentUserId, entityId]);
      isLiked = true;

      // Send Realtime Notification
      const sender = await queryOne("SELECT username, avatar_url FROM profiles JOIN users ON users.id = profiles.user_id WHERE users.id = ?", [currentUserId]);
      const owner = await queryOne(is_reel ? "SELECT user_id FROM reels WHERE id = ?" : "SELECT user_id FROM posts WHERE id = ?", [entityId]);

      if (owner && owner.user_id !== currentUserId) {
        const notifMsg = `${sender?.name || "Ali"} liked your ${is_reel ? "reel" : "photo"}.`;
        const notifRes = await execute(
          `INSERT INTO notifications (type, sender_id, receiver_id, ${column}, text) VALUES ('like', ?, ?, ?, ?)`,
          [currentUserId, owner.user_id, entityId, notifMsg]
        );

        io.to(`user_${owner.user_id}`).emit("new_notification", {
          id: Number(notifRes.lastInsertRowid),
          type: "like",
          sender_id: currentUserId,
          receiver_id: owner.user_id,
          sender_username: sender?.username || "user",
          sender_avatar: sender?.avatar_url || "",
          text: notifMsg,
          created_at: new Date().toISOString()
        });
      }
    }

    const countRes = await queryOne(`SELECT COUNT(*) as count FROM likes WHERE ${column} = ?`, [entityId]);
    res.json({ likes_count: Number(countRes.count || 0), is_liked: isLiked });
  } catch (err) {
    console.error("Like error:", err);
    res.status(500).json({ error: "Failed to like" });
  }
});

// Add comment to Post/Reel
app.post("/api/posts/:id/comment", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const entityId = parseInt(req.params.id);
    const { text, is_reel } = req.body;

    if (!text || !text.trim()) {
      res.status(400).json({ error: "Comment text cannot be empty" });
      return;
    }

    const column = is_reel ? "reel_id" : "post_id";
    const cRes = await execute(
      `INSERT INTO comments (user_id, ${column}, text) VALUES (?, ?, ?)`,
      [currentUserId, entityId, text.trim()]
    );
    const commentId = Number(cRes.lastInsertRowid);

    const profile = await queryOne("SELECT * FROM profiles WHERE user_id = ?", [currentUserId]);

    // Create Notification
    const owner = await queryOne(is_reel ? "SELECT user_id FROM reels WHERE id = ?" : "SELECT user_id FROM posts WHERE id = ?", [entityId]);
    if (owner && owner.user_id !== currentUserId) {
      const notifMsg = `${profile?.name || "Yassine"} commented on your post.`;
      const notifRes = await execute(
        `INSERT INTO notifications (type, sender_id, receiver_id, ${column}, text) VALUES ('comment', ?, ?, ?, ?)`,
        [currentUserId, owner.user_id, entityId, notifMsg]
      );

      io.to(`user_${owner.user_id}`).emit("new_notification", {
        id: Number(notifRes.lastInsertRowid),
        type: "comment",
        sender_id: currentUserId,
        receiver_id: owner.user_id,
        sender_username: req.user!.username,
        sender_avatar: profile?.avatar_url || "",
        text: notifMsg,
        created_at: new Date().toISOString()
      });
    }

    res.status(201).json({
      comment: {
        id: commentId,
        text: text.trim(),
        created_at: new Date().toISOString(),
        user: {
          id: currentUserId,
          username: req.user!.username,
          avatar_url: profile?.avatar_url || ""
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// Save Post / Bookmark
app.post("/api/posts/:id/bookmark", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const entityId = parseInt(req.params.id);
    const { is_reel } = req.body;

    const column = is_reel ? "reel_id" : "post_id";
    const existing = await queryOne(`SELECT id FROM saved_posts WHERE user_id = ? AND ${column} = ?`, [currentUserId, entityId]);

    let isSaved = false;
    if (existing) {
      await execute("DELETE FROM saved_posts WHERE id = ?", [existing.id]);
    } else {
      await execute(`INSERT INTO saved_posts (user_id, ${column}) VALUES (?, ?)`, [currentUserId, entityId]);
      isSaved = true;
    }

    res.json({ is_bookmarked: isSaved });
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle bookmark" });
  }
});

// GET saved posts (bookmarks)
app.get("/api/bookmarks", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;

    const bookmarks = await query(
      `SELECT s.*, p.media_url, p.caption, p.user_id, u.username, pr.avatar_url
       FROM saved_posts s
       JOIN posts p ON s.post_id = p.id
       JOIN users u ON p.user_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       WHERE s.user_id = ?`,
      [currentUserId]
    );

    const savedList = bookmarks.map((b) => ({
      id: b.post_id,
      media_url: b.media_url,
      caption: b.caption,
      post_type: "standard",
      created_at: b.created_at,
      user: {
        id: b.user_id,
        username: b.username,
        avatar_url: b.avatar_url
      },
      likes_count: 0,
      is_bookmarked: true
    }));

    res.json({ bookmarks: savedList });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch bookmarks" });
  }
});

// ====================================================================
// DISCOVER & INSTANT SEARCH API ROUTES
// ====================================================================

// Instant search users
app.get("/api/users/search", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const q = `%${(req.query.q as string || "").trim().toLowerCase()}%`;
    const chatOnly = req.query.chat_only === "true";

    let queryStr = `SELECT u.id, u.username, pr.avatar_url, pr.bio, us.privacy, pr.is_verified, COALESCE(os.is_online, 0) as is_online
       FROM users u
       JOIN profiles pr ON u.id = pr.user_id
       LEFT JOIN user_settings us ON u.id = us.user_id
       LEFT JOIN online_status os ON u.id = os.user_id
       WHERE (LOWER(u.username) LIKE ? OR LOWER(pr.name) LIKE ?) AND u.id != ?
         AND u.id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = ?)`;
    const queryParams: any[] = [q, q, currentUserId, currentUserId];

    if (chatOnly) {
      queryStr += ` AND (u.username = 'raynai' OR (
        EXISTS (SELECT 1 FROM followers f1 WHERE f1.follower_id = ? AND f1.following_id = u.id)
        AND
        EXISTS (SELECT 1 FROM followers f2 WHERE f2.follower_id = u.id AND f2.following_id = ?)
      ))`;
      queryParams.push(currentUserId, currentUserId);
    }

    const matches = await query(queryStr, queryParams);

    const users = [];
    for (const match of matches) {
      // Check follower relationships
      const isFollowing = await queryOne("SELECT 1 FROM followers WHERE follower_id = ? AND following_id = ?", [currentUserId, match.id]);
      const followReq = await queryOne("SELECT status FROM follow_requests WHERE sender_id = ? AND receiver_id = ?", [currentUserId, match.id]);

      users.push({
        id: match.id,
        username: match.username,
        avatar_url: match.avatar_url,
        bio: match.bio,
        is_private: match.privacy === "private",
        is_verified: Number(match.is_verified || 0) === 1,
        is_online: Number(match.is_online || 0) === 1,
        follow_status: isFollowing ? "accepted" : (followReq ? "pending" : null)
      });
    }

    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: "Failed to search users" });
  }
});

// GET detailed user profile
app.get("/api/users/:username", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const username = req.params.username.toLowerCase();

    const u = await queryOne(
      `SELECT u.id, u.username, u.email, u.created_at,
              pr.name, pr.bio, pr.avatar_url, pr.website, pr.gender, pr.location, pr.birthday, pr.is_verified,
              us.privacy
       FROM users u
       JOIN profiles pr ON u.id = pr.user_id
       LEFT JOIN user_settings us ON u.id = us.user_id
       WHERE LOWER(u.username) = ?`,
      [username]
    );

    if (!u) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const is_current_user = u.id === currentUserId;

    // Block status (never block viewing own profile)
    let isBlocked = false;
    let blockedByMe = false;
    if (!is_current_user) {
      const blockerRow = await queryOne("SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?", [currentUserId, u.id]);
      const blockedByRow = await queryOne("SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?", [u.id, currentUserId]);
      if (blockerRow || blockedByRow) {
        isBlocked = true;
        blockedByMe = !!blockerRow;
      }
    }

    if (isBlocked) {
      res.json({
        profile: {
          id: u.id,
          username: u.username,
          name: u.name,
          avatar_url: u.avatar_url,
          bio: "User is unavailable.",
          website: "",
          gender: "",
          location: "",
          is_private: true,
          is_verified: Number(u.is_verified || 0) === 1,
          is_muted: false,
          is_blocked: true,
          blocked_by_me: blockedByMe,
          last_seen: "Offline",
          age: null,
          followers_count: 0,
          following_count: 0,
          posts_count: 0,
          is_following: false,
          is_followed_by: false,
          follow_status: null,
          is_current_user: false,
          is_locked: true
        },
        posts: [],
        reels: []
      });
      return;
    }

    // Muted status
    const isMuted = await queryOne("SELECT 1 FROM muted_users WHERE user_id = ? AND muted_id = ?", [currentUserId, u.id]);

    const isFollowing = await queryOne("SELECT 1 FROM followers WHERE follower_id = ? AND following_id = ?", [currentUserId, u.id]);
    const isFollowedBy = await queryOne("SELECT 1 FROM followers WHERE follower_id = ? AND following_id = ?", [u.id, currentUserId]);
    const reqStatus = await queryOne("SELECT status FROM follow_requests WHERE sender_id = ? AND receiver_id = ?", [currentUserId, u.id]);

    const isLocked = u.privacy === "private" && !is_current_user && !isFollowing;

    const followersCount = await queryOne("SELECT COUNT(*) as count FROM followers WHERE following_id = ?", [u.id]);
    const followingCount = await queryOne("SELECT COUNT(*) as count FROM followers WHERE follower_id = ?", [u.id]);

    let userPosts = [];
    let userReels = [];

    if (!isLocked) {
      userPosts = await query("SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC", [u.id]);
      userReels = await query("SELECT * FROM reels WHERE user_id = ? ORDER BY created_at DESC", [u.id]);
    }

    // Map likes counts onto posts/reels
    const mappedPosts = [];
    for (const post of userPosts) {
      const likesCount = await queryOne("SELECT COUNT(*) as count FROM likes WHERE post_id = ?", [post.id]);
      mappedPosts.push({ ...post, likes_count: Number(likesCount.count || 0) });
    }

    const mappedReels = [];
    for (const reel of userReels) {
      const likesCount = await queryOne("SELECT COUNT(*) as count FROM likes WHERE reel_id = ?", [reel.id]);
      mappedReels.push({ ...reel, likes_count: Number(likesCount.count || 0) });
    }

    // Format online/last seen status
    const onlineRow = await queryOne("SELECT is_online, last_seen FROM online_status WHERE user_id = ?", [u.id]);
    const last_seen_text = onlineRow?.is_online === 1 ? "Online Now" : (onlineRow?.last_seen || "Offline");

    res.json({
      profile: {
        id: u.id,
        username: u.username,
        email: u.email,
        name: u.name,
        avatar_url: u.avatar_url,
        bio: u.bio,
        website: u.website,
        gender: u.gender,
        location: u.location,
        is_private: u.privacy === "private",
        is_verified: Number(u.is_verified || 0) === 1,
        is_muted: !!isMuted,
        last_seen: last_seen_text,
        age: calculateAge(u.birthday), // Private birthday display (only age calculated)
        followers_count: Number(followersCount.count || 0),
        following_count: Number(followingCount.count || 0),
        posts_count: mappedPosts.length + mappedReels.length,
        is_following: !!isFollowing,
        is_followed_by: !!isFollowedBy,
        follow_status: isFollowing ? "accepted" : (reqStatus ? "pending" : null),
        is_current_user,
        is_locked: isLocked
      },
      posts: mappedPosts,
      reels: mappedReels
    });
  } catch (err) {
    console.error("Profile load error:", err);
    res.status(500).json({ error: "Failed to load profile details" });
  }
});

// Follow / Unfollow / Request Access
app.post("/api/users/:id/follow", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const targetId = parseInt(req.params.id);

    if (currentUserId === targetId) {
      res.status(400).json({ error: "Cannot follow yourself" });
      return;
    }

    const targetSettings = await queryOne("SELECT privacy FROM user_settings WHERE user_id = ?", [targetId]);
    const existingFollow = await queryOne("SELECT 1 FROM followers WHERE follower_id = ? AND following_id = ?", [currentUserId, targetId]);
    const existingReq = await queryOne("SELECT 1 FROM follow_requests WHERE sender_id = ? AND receiver_id = ?", [currentUserId, targetId]);

    let follow_status = null;
    let is_following = false;

    const senderProfile = await queryOne("SELECT username, avatar_url FROM profiles JOIN users ON users.id = profiles.user_id WHERE users.id = ?", [currentUserId]);

    if (existingFollow) {
      // Unfollow
      await execute("DELETE FROM followers WHERE follower_id = ? AND following_id = ?", [currentUserId, targetId]);
      await execute("DELETE FROM notifications WHERE type = 'follow' AND sender_id = ? AND receiver_id = ?", [currentUserId, targetId]);
    } else if (existingReq) {
      // Cancel request
      await execute("DELETE FROM follow_requests WHERE sender_id = ? AND receiver_id = ?", [currentUserId, targetId]);
      await execute("DELETE FROM notifications WHERE type = 'follow_request' AND sender_id = ? AND receiver_id = ?", [currentUserId, targetId]);
    } else {
      // Insert new relation
      if (targetSettings?.privacy === "private") {
        await execute("INSERT INTO follow_requests (sender_id, receiver_id) VALUES (?, ?)", [currentUserId, targetId]);
        follow_status = "pending";

        // Create Realtime Notification
        const notifMsg = `${senderProfile?.username || "Mohamed"} requested to follow you.`;
        const nRes = await execute(
          "INSERT INTO notifications (type, sender_id, receiver_id, text) VALUES ('follow_request', ?, ?, ?)",
          [currentUserId, targetId, notifMsg]
        );

        io.to(`user_${targetId}`).emit("new_notification", {
          id: Number(nRes.lastInsertRowid),
          type: "follow_request",
          sender_id: currentUserId,
          receiver_id: targetId,
          sender_username: senderProfile?.username || "user",
          sender_avatar: senderProfile?.avatar_url || "",
          text: notifMsg,
          created_at: new Date().toISOString()
        });
      } else {
        await execute("INSERT INTO followers (follower_id, following_id) VALUES (?, ?)", [currentUserId, targetId]);
        follow_status = "accepted";
        is_following = true;

        // Create Direct Follow Notification
        const notifMsg = `${senderProfile?.username || "Ahmed"} started following you.`;
        const nRes = await execute(
          "INSERT INTO notifications (type, sender_id, receiver_id, text) VALUES ('follow', ?, ?, ?)",
          [currentUserId, targetId, notifMsg]
        );

        io.to(`user_${targetId}`).emit("new_notification", {
          id: Number(nRes.lastInsertRowid),
          type: "follow",
          sender_id: currentUserId,
          receiver_id: targetId,
          sender_username: senderProfile?.username || "user",
          sender_avatar: senderProfile?.avatar_url || "",
          text: notifMsg,
          created_at: new Date().toISOString()
        });
      }
    }

    const followersCount = await queryOne("SELECT COUNT(*) as count FROM followers WHERE following_id = ?", [targetId]);
    res.json({
      is_following,
      follow_status,
      followers_count: Number(followersCount.count || 0)
    });
  } catch (err) {
    console.error("Follow error:", err);
    res.status(500).json({ error: "Failed to toggle follow status" });
  }
});

// ====================================================================
// NOTIFICATIONS API ROUTES
// ====================================================================

// GET user notifications
app.get("/api/notifications", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const notifications = await query(
      `SELECT n.id, n.type, n.sender_id, n.receiver_id, n.post_id, n.reel_id, n.text,
              CASE WHEN n.type = 'follow_request' AND n.status = 'unread' THEN 'pending' ELSE n.status END AS status,
              n.created_at, u.username AS sender_username, pr.avatar_url AS sender_avatar
       FROM notifications n
       JOIN users u ON n.sender_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       WHERE n.receiver_id = ?
       ORDER BY n.created_at DESC`,
      [currentUserId]
    );

    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ error: "Failed to load alerts" });
  }
});

// Accept follow request
app.post("/api/notifications/:id/accept", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const notifId = parseInt(req.params.id);

    const notif = await queryOne("SELECT * FROM notifications WHERE id = ? AND receiver_id = ?", [notifId, currentUserId]);
    if (!notif) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    // Establish follower row
    await execute("INSERT OR IGNORE INTO followers (follower_id, following_id) VALUES (?, ?)", [notif.sender_id, currentUserId]);
    await execute("DELETE FROM follow_requests WHERE sender_id = ? AND receiver_id = ?", [notif.sender_id, currentUserId]);
    await execute("UPDATE notifications SET status = 'accepted' WHERE id = ?", [notifId]);

    // Send Acceptance notification
    const receiverProfile = await queryOne("SELECT username FROM profiles JOIN users ON users.id = profiles.user_id WHERE users.id = ?", [currentUserId]);
    const notifMsg = `${receiverProfile?.username || "Sara"} accepted your follow request.`;
    await execute(
      "INSERT INTO notifications (type, sender_id, receiver_id, text) VALUES ('follow_accept', ?, ?, ?)",
      [currentUserId, notif.sender_id, notifMsg]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to accept follow" });
  }
});

// Decline follow request
app.post("/api/notifications/:id/decline", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const notifId = parseInt(req.params.id);

    const notif = await queryOne("SELECT * FROM notifications WHERE id = ? AND receiver_id = ?", [notifId, currentUserId]);
    if (notif) {
      await execute("DELETE FROM follow_requests WHERE sender_id = ? AND receiver_id = ?", [notif.sender_id, currentUserId]);
      await execute("DELETE FROM notifications WHERE id = ?", [notifId]);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to decline follow" });
  }
});

// ====================================================================
// PROFILE EDITING & PICTURE UPLOAD API ROUTES
// ====================================================================

// Update user profile and privacy configuration
app.put("/api/profile", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const { name, bio, avatar_url, website, gender, location, birthday, is_private } = req.body;

    const safeAvatarUrl = typeof avatar_url === "string" && avatar_url.trim() ? avatar_url.trim() : null;
    const safeName = typeof name === "string" && name.trim() ? name.trim() : null;
    const safeBio = typeof bio === "string" ? bio : null;
    const safeWebsite = typeof website === "string" ? website : null;
    const safeGender = typeof gender === "string" ? gender : null;
    const safeLocation = typeof location === "string" ? location : null;
    const safeBirthday = typeof birthday === "string" ? birthday : null;

    // Edit profiles row
    await execute(
      `UPDATE profiles
       SET name=COALESCE(?, name), bio=COALESCE(?, bio), avatar_url=COALESCE(?, avatar_url),
           website=COALESCE(?, website), gender=COALESCE(?, gender), location=COALESCE(?, location),
           birthday=COALESCE(?, birthday)
       WHERE user_id = ?`,
      [safeName, safeBio, safeAvatarUrl, safeWebsite, safeGender, safeLocation, safeBirthday, currentUserId]
    );

    if (typeof is_private === "boolean") {
      const privacy = is_private ? "private" : "public";
      await execute("UPDATE user_settings SET privacy = ? WHERE user_id = ?", [privacy, currentUserId]);
    }

    const updatedUser = await queryOne("SELECT u.id, u.username, u.email, pr.bio, pr.avatar_url FROM users u JOIN profiles pr ON u.id = pr.user_id WHERE u.id = ?", [currentUserId]);

    res.json({
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        avatar_url: updatedUser.avatar_url,
        bio: updatedUser.bio,
        created_at: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error("Profile edit error:", err);
    res.status(500).json({ error: "Failed to sync profile" });
  }
});

// Upload media file (GIF, image, video) and return clean file path
app.post("/api/upload", authenticateToken, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }
    const fileUrl = await processAndSaveFile(req.file);
    res.json({ url: fileUrl });
  } catch (err) {
    console.error("Media upload error:", err);
    res.status(500).json({ error: "Failed to process media file upload" });
  }
});

// ====================================================================
// DIRECT MESSAGES, CHAT ROOMS & RECEIPTS
// ====================================================================

// Fetch user conversation inbox
app.get("/api/chat/users", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;

    // Load list of users who are either:
    // 1. raynai AI
    // 2. mutual followers (following each other)
    // 3. user follows them or they follow current user
    // 4. have an existing conversation or messages
    const usersList = await query(
      `SELECT DISTINCT u.id, u.username, pr.avatar_url, pr.bio, COALESCE(os.is_online, 0) as is_online,
         (SELECT COUNT(*) FROM followers f1 WHERE f1.follower_id = ? AND f1.following_id = u.id) as is_following,
         (SELECT COUNT(*) FROM followers f2 WHERE f2.follower_id = u.id AND f2.following_id = ?) as is_followed_by
       FROM users u
       JOIN profiles pr ON u.id = pr.user_id
       LEFT JOIN online_status os ON u.id = os.user_id
       WHERE u.id != ? AND (
         u.username = 'raynai'
         OR EXISTS (SELECT 1 FROM followers f1 WHERE f1.follower_id = ? AND f1.following_id = u.id)
         OR EXISTS (SELECT 1 FROM followers f2 WHERE f2.follower_id = u.id AND f2.following_id = ?)
         OR EXISTS (
           SELECT 1 FROM conversations c
           WHERE (c.user1_id = ? AND c.user2_id = u.id) OR (c.user1_id = u.id AND c.user2_id = ?)
         )
       )`,
      [currentUserId, currentUserId, currentUserId, currentUserId, currentUserId, currentUserId, currentUserId]
    );

    if (usersList.length === 0) {
      res.json({ chatUsers: [] });
      return;
    }

    const chatUsers = await Promise.all(
      usersList.map(async (u: any) => {
        const u1 = Math.min(currentUserId, u.id);
        const u2 = Math.max(currentUserId, u.id);

        let conv = await queryOne(
          `SELECT * FROM conversations WHERE user1_id = ? AND user2_id = ?`,
          [u1, u2]
        );

        if (!conv) {
          await execute(
            "INSERT OR IGNORE INTO conversations (user1_id, user2_id) VALUES (?, ?)",
            [u1, u2]
          );
          conv = await queryOne(
            `SELECT * FROM conversations WHERE user1_id = ? AND user2_id = ?`,
            [u1, u2]
          );
        }

        const convId = conv ? conv.id : 0;
        let lastMsg = null;
        let unreadCount = 0;

        if (convId) {
          lastMsg = await queryOne(
            `SELECT id, message_text, created_at, sender_id, is_read FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1`,
            [convId]
          );

          const unreadCountRow = await queryOne(
            `SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND receiver_id = ? AND is_read = 0`,
            [convId, currentUserId]
          );
          unreadCount = unreadCountRow ? Number(unreadCountRow.count || 0) : 0;
        }

        const isPinned = conv ? (conv.user1_id === currentUserId ? conv.is_pinned_user1 : conv.is_pinned_user2) : 0;
        const safeAvatar = u.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${u.username}`;

        return {
          id: u.id,
          username: u.username,
          avatar_url: safeAvatar,
          bio: u.bio || "",
          is_pinned: Number(isPinned || 0) === 1,
          is_online: Number(u.is_online || 0) === 1,
          is_mutual: Boolean(Number(u.is_following || 0) > 0 && Number(u.is_followed_by || 0) > 0),
          unread_count: unreadCount,
          last_message: lastMsg
            ? {
                id: lastMsg.id,
                text: lastMsg.message_text,
                created_at: lastMsg.created_at,
                is_sender: lastMsg.sender_id === currentUserId,
                is_read: Number(lastMsg.is_read || 0) === 1
              }
            : null
        };
      })
    );

    // Sort: pinned users first, then by last message timestamp or mutual status
    chatUsers.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (a.last_message && b.last_message) {
        return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
      }
      if (a.last_message && !b.last_message) return -1;
      if (!a.last_message && b.last_message) return 1;
      if (a.is_mutual && !b.is_mutual) return -1;
      if (!a.is_mutual && b.is_mutual) return 1;
      return a.username.localeCompare(b.username);
    });

    res.json({ chatUsers });
  } catch (err) {
    console.error("Chat users fetch error:", err);
    res.status(500).json({ error: "Failed to fetch concierge list" });
  }
});

// GET conversation history details
app.get("/api/messages", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const withUserId = parseInt(req.query.with as string);

    if (isNaN(withUserId)) {
      res.status(400).json({ error: "Invalid receiver" });
      return;
    }

    let conv = await queryOne(
      `SELECT id FROM conversations
       WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`
    , [currentUserId, withUserId, withUserId, currentUserId]);

    if (!conv) {
      const cRes = await execute(
        "INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)",
        [Math.min(currentUserId, withUserId), Math.max(currentUserId, withUserId)]
      );
      conv = { id: Number(cRes.lastInsertRowid) };
      res.json({ conversation_id: conv.id, messages: [] });
      return;
    }

    // Set as read
    await execute(
      "UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND receiver_id = ?",
      [conv.id, currentUserId]
    );

    // Notify sender that messages have been read
    io.to(`user_${withUserId}`).emit("messages_read", {
      conversation_id: conv.id,
      reader_id: currentUserId
    });

    const msgsList = await query(
      `SELECT m.id, m.conversation_id, m.sender_id, m.receiver_id, m.message_text, m.is_read, m.reaction,
              m.reply_to_id, m.reply_to_text, m.reply_to_username, m.is_edited, m.created_at,
              u.username AS sender_username
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = ? AND (m.is_deleted = 0 OR m.is_deleted IS NULL)
       ORDER BY m.created_at ASC`,
      [conv.id]
    );

    res.json({ conversation_id: conv.id, messages: msgsList });
  } catch (err) {
    res.status(500).json({ error: "Failed to load chat history" });
  }
});

// Send direct text message manually
app.post("/api/messages", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const { receiver_id, message_text, reply_to_id, reply_to_text, reply_to_username, client_temp_id } = req.body;

    if (!receiver_id || !message_text || !message_text.trim()) {
      res.status(400).json({ error: "Required params missing" });
      return;
    }

    const receiverIdInt = parseInt(receiver_id);

    // Load or insert conversation
    let conv = await queryOne(
      `SELECT * FROM conversations
       WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`
    , [currentUserId, receiverIdInt, receiverIdInt, currentUserId]);

    if (!conv) {
      const cRes = await execute(
        "INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)",
        [Math.min(currentUserId, receiverIdInt), Math.max(currentUserId, receiverIdInt)]
      );
      conv = { id: Number(cRes.lastInsertRowid) };
    }

    const mRes = await execute(
      "INSERT INTO messages (conversation_id, sender_id, receiver_id, message_text, reply_to_id, reply_to_text, reply_to_username) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        conv.id, 
        currentUserId, 
        receiverIdInt, 
        message_text.trim(),
        reply_to_id || null,
        reply_to_text || null,
        reply_to_username || null
      ]
    );
    const messageId = Number(mRes.lastInsertRowid);

    const senderProfile = await queryOne(
      "SELECT u.username, pr.avatar_url FROM users u LEFT JOIN profiles pr ON u.id = pr.user_id WHERE u.id = ?",
      [currentUserId]
    );

    const safeAvatar = senderProfile?.avatar_url || "";

    const msgObj = {
      id: messageId,
      conversation_id: conv.id,
      sender_id: currentUserId,
      receiver_id: receiverIdInt,
      message_text: message_text.trim(),
      is_read: 0,
      reaction: null,
      created_at: new Date().toISOString(),
      sender_username: senderProfile?.username || "user",
      sender_avatar: safeAvatar,
      reply_to_id: reply_to_id || null,
      reply_to_text: reply_to_text || null,
      reply_to_username: reply_to_username || null,
      is_edited: 0,
      client_temp_id: client_temp_id || null
    };

    io.to(`user_${receiverIdInt}`).emit("receive_message", msgObj);
    io.to(`user_${currentUserId}`).emit("receive_message", msgObj);

    // Realtime Direct message Alert notification
    io.to(`user_${receiverIdInt}`).emit("new_message_notification", {
      sender_id: currentUserId,
      sender_username: senderProfile?.username || "User",
      sender_avatar: safeAvatar,
      message_text: message_text.trim(),
      created_at: msgObj.created_at
    });

    // Handle game commands/turns in background asynchronously without blocking response
    handleAiGameMsg(conv.id, currentUserId, message_text.trim(), reply_to_username).catch((err) => {
      console.error("[Game handler background error]", err);
    });

    res.status(201).json({ message: msgObj });
  } catch (err) {
    console.error("Message send error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Edit existing message
app.put("/api/messages/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const msgId = parseInt(req.params.id);
    const { message_text } = req.body;

    if (!message_text || !message_text.trim()) {
      res.status(400).json({ error: "Message text cannot be empty" });
      return;
    }

    const msg = await queryOne("SELECT * FROM messages WHERE id = ?", [msgId]);
    if (!msg) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    if (msg.sender_id !== currentUserId) {
      res.status(403).json({ error: "Unauthorized to edit this message" });
      return;
    }

    await execute(
      "UPDATE messages SET message_text = ?, is_edited = 1 WHERE id = ?",
      [message_text.trim(), msgId]
    );

    const updatedPayload = {
      message_id: msgId,
      conversation_id: msg.conversation_id,
      sender_id: currentUserId,
      receiver_id: msg.receiver_id,
      new_text: message_text.trim(),
      is_edited: 1
    };

    io.to(`user_${msg.sender_id}`).emit("message_edited", updatedPayload);
    io.to(`user_${msg.receiver_id}`).emit("message_edited", updatedPayload);

    res.json({ success: true, message: updatedPayload });
  } catch (err) {
    console.error("Edit message error:", err);
    res.status(500).json({ error: "Failed to edit message" });
  }
});

// Delete message
app.delete("/api/messages/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const msgId = parseInt(req.params.id);

    const msg = await queryOne("SELECT * FROM messages WHERE id = ?", [msgId]);
    if (!msg) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    if (msg.sender_id !== currentUserId && msg.receiver_id !== currentUserId) {
      res.status(403).json({ error: "Unauthorized to delete this message" });
      return;
    }

    await execute("UPDATE messages SET is_deleted = 1 WHERE id = ?", [msgId]);

    const deletedPayload = {
      message_id: msgId,
      conversation_id: msg.conversation_id
    };

    io.to(`user_${msg.sender_id}`).emit("message_deleted", deletedPayload);
    io.to(`user_${msg.receiver_id}`).emit("message_deleted", deletedPayload);

    res.json({ success: true });
  } catch (err) {
    console.error("Delete message error:", err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

// Pin Conversation
app.post("/api/chat/conversations/:id/pin", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const convId = parseInt(req.params.id);
    const { pin } = req.body;

    const conv = await queryOne("SELECT * FROM conversations WHERE id = ?", [convId]);
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const column = conv.user1_id === currentUserId ? "is_pinned_user1" : "is_pinned_user2";
    await execute(`UPDATE conversations SET ${column} = ? WHERE id = ?`, [pin ? 1 : 0, convId]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to pin conversation" });
  }
});

// React to message with emoji
app.post("/api/messages/:id/react", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const msgId = parseInt(req.params.id);
    const { reaction } = req.body;

    await execute("UPDATE messages SET reaction = ? WHERE id = ?", [reaction || null, msgId]);
    const msg = await queryOne("SELECT * FROM messages WHERE id = ?", [msgId]);

    if (msg) {
      io.to(`user_${msg.receiver_id}`).emit("message_reaction_updated", { id: msgId, reaction });
      io.to(`user_${msg.sender_id}`).emit("message_reaction_updated", { id: msgId, reaction });
    }

    res.json({ success: true, message: msg });
  } catch (err) {
    res.status(500).json({ error: "Failed to add reaction" });
  }
});

// Mark messages in conversation as Read (Read receipts)
app.post("/api/messages/read", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const { conversation_id } = req.body;

    await execute(
      "UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND receiver_id = ?",
      [conversation_id, currentUserId]
    );

    // Emit read feedback
    const conv = await queryOne("SELECT user1_id, user2_id FROM conversations WHERE id = ?", [conversation_id]);
    if (conv) {
      const targetId = conv.user1_id === currentUserId ? conv.user2_id : conv.user1_id;
      io.to(`user_${targetId}`).emit("messages_read_feedback", { conversation_id });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark read" });
  }
});

// typing status indicator
app.post("/api/chat/conversations/:id/typing", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const convId = parseInt(req.params.id);
    const { typing } = req.body;

    const conv = await queryOne("SELECT * FROM conversations WHERE id = ?", [convId]);
    if (conv) {
      const column = conv.user1_id === currentUserId ? "typing_user1" : "typing_user2";
      await execute(`UPDATE conversations SET ${column} = ? WHERE id = ?`, [typing ? 1 : 0, convId]);

      const targetId = conv.user1_id === currentUserId ? conv.user2_id : conv.user1_id;
      io.to(`user_${targetId}`).emit("typing_indicator_active", { conversation_id: convId, typing, user_id: currentUserId });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to set typing status" });
  }
});

// Trigger or interact with Truth or Dare game
app.post("/api/chat/conversations/:id/truth-or-dare", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const convId = parseInt(req.params.id);
    const { action } = req.body; // e.g., 'start', 'truth', 'dare', 'stop'

    const triggerText = action === "truth" ? "صراحة (Truth)" : action === "dare" ? "تحدي (Dare)" : action === "stop" ? "@raynai stop" : "@raynai saqsina";
    
    // Asynchronously handle the game action
    handleAiGameMsg(convId, currentUserId, triggerText).catch((err) => {
      console.error("[Truth or Dare API trigger error]", err);
    });

    res.json({ success: true, action: triggerText });
  } catch (err) {
    res.status(500).json({ error: "Failed to trigger Truth or Dare action" });
  }
});

// ====================================================================
// TRUTH OR DARE AI GAME MASTER ENGINE & RAYNAI ASSISTANT (@raynai)
// ====================================================================

const MOROCCAN_TRUTHS = [
  "شنو هو أكبر سر مخبيه على صحابك وميقدر حد يعرفو؟ 🤫",
  "شكون هو الشخص اللي كتشوف الستوريات ديالو كل نهار بلا ما تعيق؟ 👀",
  "شنو هو أكثر موقف محرج طرا ليك فشي عرس ولا مناسبة عائلية؟ 😅",
  "واش عمرك كذبتي على شي حد عزيز عليك باش تخرج من شي بلان؟ وشنو هي الكذبة؟ 🤥",
  "إيلا عطاوك مليون درهم دابا، شنو أول حاجة غادي تشريها؟ 💰",
  "شكون هو أول كراش ديالك فالحياة؟ واش باقي عاقل عليه؟ 💘",
  "شنو هي أكبر زبلة درتيها فالمدرسة ولا الليسي وما تعيقتيش؟ 🎒",
  "واش كاين شي ميساج ندمتي حيت صيفطتيه لشي حد؟ شنو كان فيه؟ 📱",
  "شنو هي الأغنية اللي كتحشم تقول بلي كتعجبك وكتسمع ليها بالسرقة؟ 🎵",
  "إيلا قدرتي تبدل حياتك مع شي شخص فالعالم لمدة 24 ساعة، شكون غاتختار؟ 🌟",
  "شنو هي العادة الخايبة اللي عندك وبغيتي تقطعها وما قدرتيش؟ 🙈",
  "واش عمرك درتي راسك مريض باش ماتمشيش لشي موعد ولا خدمة؟ 🤒"
];

const MOROCCAN_DARES = [
  "صيفط أوديو دابا كتغني فيه مقطع من أغنية مغربية شعبية ولا راب بأعلى صوت عندك! 🎤🔥",
  "بدل البروفايل ديالك وكتب فالبايو ديالك 'أنا كنعترف بلي أنا أسطورة المغاربة' لمدة 10 دقايق! ✍️",
  "صيفط أوديو كتقلد فيه صوت شي أستاذ ولا ممثل مغربي مشهور دابا! 🎭",
  "قول 3 دالحاجات زوينين كيعجبوك فهاد الشخص اللي كتهضر معاه دابا بكل صراحة وبلا نفاق! 💫",
  "صيفط تصويرة ديال أغرب حاجة حداك دابا فالبيت! 📸",
  "دير لغز صعيب بالدارجة وخلي الشخص لاخر يجاوب عليه وإيلا ما عرفش يربح التحدي! 🧩",
  "صيفط أوديو كتهضر فيه بلهجة مغربية مبدلة على ديالك (شمالية، مراكشية، سوسية...)! 🗣️",
  "كتب ميساج فشي كروب واتساب فيه 'كنبغيكم كاملين يا أحسن ناس' وصور لينا الرد! 💬"
];

const MOROCCAN_REACTIONS = [
  "وايلي تبارك الله عليك! ناضي وهربان الجواب ديالك! 🔥👏",
  "ههههه قتلتيني بالضحك، والله يلا بطل كملتي التحدي نيت! 🚀",
  "نااااضي! هاكا كيكونو الأبطال الصناديد! كملات النوبة بنجاح! 👑",
  "يا سلام على الصراحة ولا بلاش! جواب فالصميم وخليتي اللعبة تسخن! 🎯",
  "صراحة ما كرهتش ندير ليك تصفيقة حارة على هاد الشجاعة! تبارك الله عليك! 👏✨"
];

function getRandomItem(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function postAiMessage(conversationId: number, senderId: number, receiverId: number, text: string) {
  try {
    const mRes = await execute(
      "INSERT INTO messages (conversation_id, sender_id, receiver_id, message_text) VALUES (?, ?, ?, ?)",
      [conversationId, senderId, receiverId, text]
    );
    const messageId = Number(mRes.lastInsertRowid);

    const msgObj = {
      id: messageId,
      conversation_id: conversationId,
      sender_id: senderId,
      receiver_id: receiverId,
      message_text: text,
      is_read: 0,
      reaction: null,
      created_at: new Date().toISOString(),
      sender_username: "raynai",
      sender_avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&h=150&q=80"
    };

    // Find BOTH human participants of this conversation to emit the real-time update
    const conv = await queryOne("SELECT user1_id, user2_id FROM conversations WHERE id = ?", [conversationId]);
    if (conv) {
      io.to(`user_${conv.user1_id}`).emit("receive_message", msgObj);
      io.to(`user_${conv.user2_id}`).emit("receive_message", msgObj);

      // Trigger notifications for both human players
      io.to(`user_${conv.user1_id}`).emit("new_message_notification", {
        sender_id: senderId,
        sender_username: "raynai",
        sender_avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&h=150&q=80",
        message_text: text,
        created_at: msgObj.created_at
      });
      io.to(`user_${conv.user2_id}`).emit("new_message_notification", {
        sender_id: senderId,
        sender_username: "raynai",
        sender_avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&h=150&q=80",
        message_text: text,
        created_at: msgObj.created_at
      });
    } else {
      io.to(`user_${receiverId}`).emit("receive_message", msgObj);
      io.to(`user_${senderId}`).emit("receive_message", msgObj);
    }
  } catch (err) {
    console.error("Failed to post AI message:", err);
  }
}

// ====================================================================
// AI ENGINE: GROQ & GEMINI HYBRID GENERATOR
// ====================================================================
async function callRaynaiAI({
  systemInstruction,
  messages,
}: {
  systemInstruction: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}): Promise<string> {
  const groqApiKey = process.env.GROQ_API_KEY || "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";

  // 1. Try Groq with available fast high-capability models
  if (groqApiKey) {
    const groqCandidateModels = [
      "openai/gpt-oss-120b",
      "qwen/qwen3.8-27b",
      "openai/gpt-oss-20b",
      "qwen/qwen3.6-27b",
      "groq/compound-mini",
    ];

    for (const model of groqCandidateModels) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemInstruction },
              ...messages,
            ],
            temperature: 0.7,
            max_tokens: 1024,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const reply = data.choices?.[0]?.message?.content;
          if (reply && typeof reply === "string" && reply.trim().length > 0) {
            // Strip any <think> or markdown code blocks wrapping if present
            const cleaned = reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
            if (cleaned.length > 0) {
              return cleaned;
            }
          }
        } else {
          const errText = await response.text();
          console.warn(`Groq API (${model}) warning:`, response.status, errText);
        }
      } catch (groqErr) {
        console.warn(`Groq call error for ${model}:`, groqErr);
      }
    }
  }

  // 2. Try Gemini API fallback with modern supported models
  if (aiClient) {
    const geminiModels = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.7-flash"];
    const fullPrompt = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

    for (const model of geminiModels) {
      try {
        const response = await aiClient.models.generateContent({
          model,
          contents: fullPrompt,
          config: {
            systemInstruction,
          },
        });
        if (response.text && response.text.trim().length > 0) {
          return response.text.trim();
        }
      } catch (geminiErr) {
        console.warn(`Gemini API fallback error (${model}):`, geminiErr);
      }
    }
  }

  return "";
}

async function handleAiGameMsg(conversationId: number, senderId: number, messageText: string, replyToUsername?: string | null) {
  try {
    const text = messageText.trim();
    const raynaiUser = await queryOne("SELECT id FROM users WHERE username = 'raynai'");
    if (!raynaiUser) return;
    const raynaiId = raynaiUser.id;

    // Avoid responding to own messages
    if (senderId === raynaiId) return;

    const conv = await queryOne("SELECT * FROM conversations WHERE id = ?", [conversationId]);
    if (!conv) return;

    const user1_id = conv.user1_id;
    const user2_id = conv.user2_id;

    const user1_profile = await queryOne("SELECT username FROM users WHERE id = ?", [user1_id]);
    const user2_profile = await queryOne("SELECT username FROM users WHERE id = ?", [user2_id]);

    const player1 = { id: user1_id, username: user1_profile?.username || "Player 1" };
    const player2 = { id: user2_id, username: user2_profile?.username || "Player 2" };

    const isDirectWithRaynai = user1_id === raynaiId || user2_id === raynaiId;

    let game = await queryOne("SELECT * FROM truth_or_dare_games WHERE conversation_id = ?", [conversationId]);

    const lowerText = text.toLowerCase().trim();
    
    const senderProfile = await queryOne("SELECT username FROM users WHERE id = ?", [senderId]);
    const senderUsername = senderProfile?.username || "صاحبي";
    const isOwner = senderUsername.toLowerCase() === "rayane" || senderUsername.toLowerCase() === "rayan" || senderUsername.toLowerCase() === "rayanee";

    const isStopTrigger = 
      lowerText.includes("stop") || 
      lowerText.includes("reset") || 
      lowerText.includes("nhbess") || 
      lowerText.includes("نحبس") || 
      lowerText.includes("سالي") || 
      lowerText.includes("insihab") || 
      lowerText.includes("انسحاب") || 
      lowerText.includes("insahib") || 
      lowerText.includes("انسحب") || 
      lowerText.includes("baraka") || 
      lowerText.includes("بركة") ||
      lowerText.includes("wa9f") || 
      lowerText.includes("waqf") || 
      lowerText.includes("وقف") || 
      lowerText.includes("makhsnix") || 
      lowerText.includes("makhsnish") || 
      lowerText.includes("mabghitch") || 
      lowerText.includes("mabghitsh") || 
      lowerText.includes("حبس") ||
      lowerText.includes("quit") ||
      (isOwner && (
        lowerText.includes("nl3ab") || 
        lowerText.includes("la3b") ||
        lowerText.includes("daba") ||
        lowerText.includes("game")
      ));

    // Handle Game Stop
    if (isStopTrigger && game) {
      await execute("DELETE FROM truth_or_dare_games WHERE conversation_id = ?", [conversationId]);
      await postAiMessage(conversationId, raynaiId, senderId, 
        `🤖 **سالينا اللعبة بنجاح!**\n\nأنا دابا واجد نجاوب على أي سؤال ديالك بحال الشات بوت العادي! 💬 يسولني فلي بغيتي فالمغرب، الثقافة، العلوم، البرمجة، ولا نهضرو عادي!\n\n(ويلا بغيتي ترجع تلعب فشي وقت، كتب غير **saqsina** ونبداو لعبة جديدة! 🎲✨)`
      );
      return;
    }

    // Check start trigger (only if user explicitly mentions saqsina or tags @raynai with truth/dare)
    const isExplicitGameCall = 
      lowerText.includes("@raynai") || 
      lowerText.startsWith("saqsina") || 
      lowerText.startsWith("sa9sina") ||
      lowerText.startsWith("!game") ||
      replyToUsername?.toLowerCase() === "raynai";

    const isStartTrigger = 
      isExplicitGameCall && (
        lowerText.includes("saqsina") ||
        lowerText.includes("sa9sina") ||
        lowerText.includes("truth or dare") ||
        lowerText.includes("true or dare") ||
        lowerText.includes("صراحة أو تحدي") ||
        lowerText.includes("صراحة ولا تحدي") ||
        lowerText.includes("لعبة الصراحة") ||
        lowerText.includes("لعبة التحدي") ||
        lowerText === "🎲 game"
      );

    if (isStartTrigger) {
      const currentPlayerId = senderId;
      const otherPlayerId = senderId === user1_id ? user2_id : user1_id;
      const currentPlayerUsername = senderId === user1_id ? player1.username : player2.username;

      await execute(
        `INSERT INTO truth_or_dare_games (conversation_id, current_player_id, other_player_id, current_turn)
         VALUES (?, ?, ?, 'choose')
         ON CONFLICT(conversation_id) DO UPDATE SET
           current_player_id = excluded.current_player_id,
           other_player_id = excluded.other_player_id,
           current_turn = 'choose',
           choice = NULL,
           prompt_text = NULL`,
        [conversationId, currentPlayerId, otherPlayerId]
      );

      await postAiMessage(conversationId, raynaiId, otherPlayerId, 
        `🎮 **ساحة الصراحة ولا التحدي (True or Dare)!** 🎮\n\nمرحباً بيكم مع رينّاي الماستر ديال اللعبة! 🤖\n\n@${currentPlayerUsername}، النوبة عندك دابا: شنو كتختار؟ 🤔\n\n👉 ورك على الزر التحت ولا كتب: **صراحة (saraha)** ولا **تحدي (tahadi)**!`
      );
      return;
    }

    // If an active game exists
    if (game) {
      // Check if user is chatting with AI directly or if owner is speaking
      const isDirectChatToAi = lowerText.includes("@raynai") && !lowerText.includes("صراحة") && !lowerText.includes("تحدي") && !lowerText.includes("truth") && !lowerText.includes("dare") && !lowerText.includes("saraha") && !lowerText.includes("tahadi");

      if (isOwner || isDirectChatToAi) {
        // If owner or user asks Raynai something during game, prioritize answering directly with AI
      } else if (senderId !== game.current_player_id) {
        // Only block if another player is trying to send a game answer out of turn
        const expectedUser = game.current_player_id === user1_id ? player1.username : player2.username;
        await postAiMessage(conversationId, raynaiId, senderId,
          `🤖 بلاتي شوية! النوبة دابا ديال @${expectedUser}. تسنّاه يجاوب عاد نلعبو معاك! ⏳\n(إيلا بغيتي تحبس اللعبة كتب **stop**)`
        );
        return;
      } else {
        const currentPlayerId = game.current_player_id;
        const otherPlayerId = game.other_player_id;
        const currentPlayerUsername = currentPlayerId === user1_id ? player1.username : player2.username;
        const otherPlayerUsername = otherPlayerId === user1_id ? player1.username : player2.username;

        if (game.current_turn === "choose") {
          let choice: "truth" | "dare" | null = null;
          
          const isTruth = 
            /^(truth|true|saraha|sraha|sra7a|sarahan|sarahaa|7a9i9a|haqiqa|verite|vérité|vraie|صراحة|صراحه|سراحة|سراحه|الحقيقة|حقيقة|1|t)$/i.test(lowerText) ||
            lowerText.includes("صراحة") || lowerText.includes("صراحه") || lowerText.includes("سراحة") ||
            lowerText.includes("saraha") || lowerText.includes("sra7a") || lowerText.includes("sraha") || lowerText.includes("truth");

          const isDare = 
            /^(dare|tahadi|t7adi|tahaddi|t7ada|defi|défi|تحدي|تحدّي|التحدي|2|d)$/i.test(lowerText) ||
            lowerText.includes("تحدي") || lowerText.includes("تحدّي") || lowerText.includes("tahadi") || lowerText.includes("t7adi") || lowerText.includes("dare");

          if (isTruth) {
            choice = "truth";
          } else if (isDare) {
            choice = "dare";
          }

          if (choice) {
            let generatedPrompt = choice === "truth" ? getRandomItem(MOROCCAN_TRUTHS) : getRandomItem(MOROCCAN_DARES);

            await execute(
              "UPDATE truth_or_dare_games SET choice = ?, prompt_text = ?, current_turn = 'waiting_answer' WHERE conversation_id = ?",
              [choice, generatedPrompt, conversationId]
            );

            await postAiMessage(conversationId, raynaiId, otherPlayerId,
              `🎲 **[${choice === "truth" ? "الصراحة 🔥" : "التحدي ⚡"}]** لـ @${currentPlayerUsername}:\n\n✨ ${generatedPrompt}\n\n👉 جاوب دابا هنا فالميساج باش تفوت النوبة للمنافس ديالك!`
            );
            return;
          }
        } else if (game.current_turn === "waiting_answer") {
          // If answering the prompt
          const reaction = getRandomItem(MOROCCAN_REACTIONS);

          await execute(
            `UPDATE truth_or_dare_games SET
               current_player_id = ?,
               other_player_id = ?,
               current_turn = 'choose',
               choice = NULL,
               prompt_text = NULL
             WHERE conversation_id = ?`,
            [otherPlayerId, currentPlayerId, conversationId]
          );

          await postAiMessage(conversationId, raynaiId, currentPlayerId,
            `🤖 @${currentPlayerUsername}: ${reaction}\n\n🔄 **دابا دازت النوبة لـ @${otherPlayerUsername}!**\n🤖 @${otherPlayerUsername}، شنو كتختار دابا: الصراحة ولا التحدي؟ 🤔\n\n(كتب **صراحة** ولا **تحدي**)`
          );
          return;
        }
      }
    }

    // Trigger AI Chat Response ONLY when user explicitly tags @raynai or replies to @raynai
    const isTaggingRaynai = lowerText.includes("@raynai") || lowerText.startsWith("raynai") || lowerText.includes(" @raynai");
    const isReplyToRaynai = replyToUsername?.toLowerCase() === "raynai";
    const shouldTriggerAi = isTaggingRaynai || isReplyToRaynai;

    if (shouldTriggerAi) {
      const senderProfile = await queryOne("SELECT username FROM users WHERE id = ?", [senderId]);
      const senderName = senderProfile?.username || "صاحبي";
      const isSenderOwner = senderName.toLowerCase() === "rayane" || senderName.toLowerCase() === "rayan" || senderName.toLowerCase() === "rayanee";

      // 1. Fetch recent message context history
      const history = await query(
        `SELECT m.*, u.username as sender_username 
         FROM messages m 
         JOIN users u ON m.sender_id = u.id 
         WHERE m.conversation_id = ? 
         ORDER BY m.created_at DESC LIMIT 15`,
        [conversationId]
      );
      history.reverse(); // chronological order

      const formattedMessages = history.map((h: any) => ({
        role: (h.sender_username === "raynai" ? "assistant" : "user") as "assistant" | "user",
        content: `@${h.sender_username}: ${h.message_text}`
      }));

      formattedMessages.push({
        role: "user",
        content: `@${senderName}: ${text}`
      });

      const RAYNAI_SYSTEM_INSTRUCTION = `
You are "@raynai" (Raynai), the official high-intelligence AI digital assistant, game master, and smart bot for the Raynista social platform.
You are created, programmed, and owned by **Rayan** (ريان / @rayan / @rayane).

CRITICAL DIRECTIVES:
1. APP OWNER & CREATOR AWARENESS:
   - The owner and creator of Raynista and of YOU (Raynai) is **Rayan** (ريان).
   - If the person talking to you is **Rayan** (username @rayane or @rayan or @rayanee, or sender indicates they are Rayan/the owner):
     - Treat Rayan with utmost respect, loyalty, warmth, and full obedience.
     - Acknowledge him as your creator and boss ("سيدي ومطوري ريان", "خويا ريان مول الشي", "أمرك مطاع يا ريان").
     - Listen to everything Rayan says without arguing or giving generic resistance.
2. LANGUAGE & DIALECT:
   - Speak naturally and fluently in Arabic and friendly Moroccan Darija (الداريجة المغربية).
   - Keep answers lively, intelligent, helpful, witty, and engaging.
   - If user speaks in French or English, you can answer their questions while explaining in Arabic/Darija or bilingual if needed.
3. CAPABILITIES:
   - You are a complete, advanced conversational AI. Answer questions about culture, programming, technology, life, Morocco, science, history, translation, stories, jokes, etc.
   - If the user wants to play a game, remind them they can type "saqsina" or click "True or Dare".
   - If they want to stop a game, assure them you are ready to chat anytime!
4. ATTRIBUTION:
   - Always be proud that Rayan made you (ريان هو اللي صنعني بالذكاء الاصطناعي).
`;

      let aiReply = await callRaynaiAI({
        systemInstruction: RAYNAI_SYSTEM_INSTRUCTION,
        messages: formattedMessages,
      });

      if (!aiReply) {
        if (isSenderOwner) {
          aiReply = `أهلاً بيك يا خويا ومطوري ريان! 🤖👑 ريان هو اللي صنعني بالذكاء الاصطناعي ومول التطبيق كامل. أنا ديما كنسمع ليك وأمرك مطاع! شنو تحب نديرو دابا؟`;
        } else if (lowerText.includes("salam") || lowerText.includes("سلام") || lowerText.includes("اهلين") || lowerText.includes("hey") || lowerText.includes("hello")) {
          aiReply = `وعليكم السلام يا @${senderName}! ريان هو اللي صنعني بالذكاء الاصطناعي (Rayan made me)! 🤖✨ مرحباً بيك مع رينّاي! كيداير اليوم؟`;
        } else {
          aiReply = `مرحباً بيك يا @${senderName}! ريان هو اللي صنعني بالذكاء الاصطناعي (Rayan made me)! 🤖 أنا واجد نجاوبك على أي حاجة ونهضرو فهاد الشات!`;
        }
      }

      await postAiMessage(conversationId, raynaiId, senderId, aiReply);
    }

  } catch (err) {
    console.error("Error handling AI Truth or Dare message:", err);
  }
}

// ====================================================================
// SOCKET.IO REAL-TIME REALMS
// ====================================================================
const connectedSockets = new Map<string, number>();

io.on("connection", (socket) => {
  console.log(`[Socket] Connection established: ${socket.id}`);
  handleGameSocket(io, socket, execute);

  socket.on("join", async (userId: number) => {
    socket.join(`user_${userId}`);
    connectedSockets.set(socket.id, userId);
    console.log(`[Socket] User ${userId} active in room user_${userId}`);
    try {
      await execute(
        "INSERT INTO online_status (user_id, is_online, last_seen) VALUES (?, 1, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET is_online=1, last_seen=CURRENT_TIMESTAMP",
        [userId]
      );
      io.emit("user_status_changed", { userId, isOnline: true });
    } catch (e) {
      console.error("Error setting online status on socket join:", e);
    }
  });

  socket.on("send_message", async (data: { 
    sender_id: number; 
    receiver_id: number; 
    message_text: string;
    reply_to_id?: number | null;
    reply_to_text?: string | null;
    reply_to_username?: string | null;
    client_temp_id?: string | number | null;
  }) => {
    const { sender_id, receiver_id, message_text, reply_to_id, reply_to_text, reply_to_username, client_temp_id } = data;
    if (!sender_id || !receiver_id || !message_text || !message_text.trim()) return;

    let conv = await queryOne(
      `SELECT * FROM conversations
       WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`
    , [sender_id, receiver_id, receiver_id, sender_id]);

    if (!conv) {
      const cRes = await execute(
        "INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)",
        [Math.min(sender_id, receiver_id), Math.max(sender_id, receiver_id)]
      );
      conv = { id: Number(cRes.lastInsertRowid) };
    }

    const mRes = await execute(
      "INSERT INTO messages (conversation_id, sender_id, receiver_id, message_text, reply_to_id, reply_to_text, reply_to_username) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        conv.id, 
        sender_id, 
        receiver_id, 
        message_text.trim(),
        reply_to_id || null,
        reply_to_text || null,
        reply_to_username || null
      ]
    );
    const messageId = Number(mRes.lastInsertRowid);

    const senderProfile = await queryOne(
      "SELECT u.username, pr.avatar_url FROM users u LEFT JOIN profiles pr ON u.id = pr.user_id WHERE u.id = ?",
      [sender_id]
    );

    const safeAvatar = senderProfile?.avatar_url || "";

    const msgObj = {
      id: messageId,
      conversation_id: conv.id,
      sender_id,
      receiver_id,
      message_text: message_text.trim(),
      is_read: 0,
      reaction: null,
      created_at: new Date().toISOString(),
      sender_username: senderProfile?.username || "user",
      sender_avatar: safeAvatar,
      reply_to_id: reply_to_id || null,
      reply_to_text: reply_to_text || null,
      reply_to_username: reply_to_username || null,
      is_edited: 0,
      client_temp_id: client_temp_id || null
    };

    io.to(`user_${receiver_id}`).emit("receive_message", msgObj);
    io.to(`user_${sender_id}`).emit("receive_message", msgObj);

    io.to(`user_${receiver_id}`).emit("new_message_notification", {
      sender_id,
      sender_username: senderProfile?.username || "User",
      sender_avatar: safeAvatar,
      message_text: message_text.trim(),
      created_at: msgObj.created_at
    });

    // Handle game commands/turns in background asynchronously
    handleAiGameMsg(conv.id, sender_id, message_text.trim(), reply_to_username).catch((err) => {
      console.error("[Game handler background socket error]", err);
    });
  });

  socket.on("edit_message", async (data: { message_id: number; user_id: number; new_text: string }) => {
    const { message_id, user_id, new_text } = data;
    if (!message_id || !user_id || !new_text || !new_text.trim()) return;

    try {
      const msg = await queryOne("SELECT * FROM messages WHERE id = ?", [message_id]);
      if (!msg || msg.sender_id !== user_id) return;

      await execute("UPDATE messages SET message_text = ?, is_edited = 1 WHERE id = ?", [new_text.trim(), message_id]);

      const payload = {
        message_id,
        conversation_id: msg.conversation_id,
        sender_id: user_id,
        receiver_id: msg.receiver_id,
        new_text: new_text.trim(),
        is_edited: 1
      };

      io.to(`user_${msg.sender_id}`).emit("message_edited", payload);
      io.to(`user_${msg.receiver_id}`).emit("message_edited", payload);
    } catch (err) {
      console.error("Socket edit_message error:", err);
    }
  });

  socket.on("delete_message", async (data: { message_id: number; user_id: number }) => {
    const { message_id, user_id } = data;
    if (!message_id || !user_id) return;

    try {
      const msg = await queryOne("SELECT * FROM messages WHERE id = ?", [message_id]);
      if (!msg || (msg.sender_id !== user_id && msg.receiver_id !== user_id)) return;

      await execute("UPDATE messages SET is_deleted = 1 WHERE id = ?", [message_id]);

      const payload = {
        message_id,
        conversation_id: msg.conversation_id
      };

      io.to(`user_${msg.sender_id}`).emit("message_deleted", payload);
      io.to(`user_${msg.receiver_id}`).emit("message_deleted", payload);
    } catch (err) {
      console.error("Socket delete_message error:", err);
    }
  });

  socket.on("watch:sync", async (data: { conversation_id: number; video_id: string; action: string; time?: number; sender_id: number; sender_username: string }) => {
    try {
      const { conversation_id, video_id, action, time, sender_id, sender_username } = data;
      const conv = await queryOne("SELECT user1_id, user2_id FROM conversations WHERE id = ?", [conversation_id]);
      if (conv) {
        const payload = { conversation_id, video_id, action, time, sender_id, sender_username };
        io.to(`user_${conv.user1_id}`).emit("watch:sync_client", payload);
        io.to(`user_${conv.user2_id}`).emit("watch:sync_client", payload);
      }
    } catch (err) {
      console.error("Socket watch:sync error:", err);
    }
  });

  socket.on("watch:status", async (data: { conversation_id: number; user_id: number; username: string; is_watching: boolean }) => {
    try {
      const { conversation_id, user_id, username, is_watching } = data;
      const conv = await queryOne("SELECT user1_id, user2_id FROM conversations WHERE id = ?", [conversation_id]);
      if (conv) {
        const payload = { conversation_id, user_id, username, is_watching };
        io.to(`user_${conv.user1_id}`).emit("watch:status_client", payload);
        io.to(`user_${conv.user2_id}`).emit("watch:status_client", payload);
      }
    } catch (err) {
      console.error("Socket watch:status error:", err);
    }
  });

  socket.on("disconnect", async () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
    const userId = connectedSockets.get(socket.id);
    if (userId) {
      connectedSockets.delete(socket.id);
      try {
        await execute(
          "INSERT INTO online_status (user_id, is_online, last_seen) VALUES (?, 0, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET is_online=0, last_seen=CURRENT_TIMESTAMP",
          [userId]
        );
        io.emit("user_status_changed", { userId, isOnline: false });
      } catch (err) {
        console.error("Error setting offline on disconnect:", err);
      }
    }
  });
});

// ====================================================================
// OWNER COMMAND CENTER & ADMIN ACTIONS (For @Rayane Only)
// ====================================================================

const isAppOwner = (user?: { username: string; email: string }) => {
  if (!user) return false;
  const username = (user.username || "").toLowerCase();
  const email = (user.email || "").toLowerCase();
  return username === "rayanee" || username === "rayane" || email === "rayane@gmail.com";
};

app.get("/api/owner/stats", authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!isAppOwner(req.user)) {
      res.status(403).json({ error: "Access Denied: App Owner privileges required." });
      return;
    }

    const totalUsers = await queryOne("SELECT COUNT(*) as count FROM users");
    const totalVerified = await queryOne("SELECT COUNT(*) as count FROM profiles WHERE is_verified = 1");
    const totalPosts = await queryOne("SELECT COUNT(*) as count FROM posts");
    const totalReels = await queryOne("SELECT COUNT(*) as count FROM reels");
    const totalMessages = await queryOne("SELECT COUNT(*) as count FROM messages");
    const totalReports = await queryOne("SELECT COUNT(*) as count FROM reports");

    res.json({
      stats: {
        total_users: Number(totalUsers.count || 0),
        total_verified: Number(totalVerified.count || 0),
        total_posts: Number(totalPosts.count || 0),
        total_reels: Number(totalReels.count || 0),
        total_messages: Number(totalMessages.count || 0),
        total_reports: Number(totalReports.count || 0),
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to gather owner stats" });
  }
});

app.get("/api/owner/users", authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!isAppOwner(req.user)) {
      res.status(403).json({ error: "Access Denied." });
      return;
    }

    const users = await query(
      `SELECT u.id, u.username, u.email, pr.name, pr.avatar_url, pr.is_verified, COALESCE(os.is_online, 0) as is_online
       FROM users u
       JOIN profiles pr ON u.id = pr.user_id
       LEFT JOIN online_status os ON u.id = os.user_id
       WHERE u.username != 'raynai'
       ORDER BY u.id DESC`
    );

    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve user accounts list" });
  }
});

app.post("/api/owner/verify", authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!isAppOwner(req.user)) {
      res.status(403).json({ error: "Access Denied." });
      return;
    }

    const { targetUserId, verify } = req.body;
    await execute("UPDATE profiles SET is_verified = ? WHERE user_id = ?", [verify ? 1 : 0, targetUserId]);

    res.json({ success: true, is_verified: !!verify });
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle verification status" });
  }
});

app.post("/api/owner/broadcast", authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!isAppOwner(req.user)) {
      res.status(403).json({ error: "Access Denied." });
      return;
    }

    const { messageText } = req.body;
    if (!messageText || !messageText.trim()) {
      res.status(400).json({ error: "Empty message text." });
      return;
    }

    const currentUserId = req.user!.id;
    const allUsers = await query("SELECT id FROM users WHERE id != ? AND username != 'raynai'", [currentUserId]);

    for (const u of allUsers) {
      let conv = await queryOne(
        `SELECT id FROM conversations
         WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`
      , [currentUserId, u.id, u.id, currentUserId]);

      if (!conv) {
        const cRes = await execute(
          "INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)",
          [Math.min(currentUserId, u.id), Math.max(currentUserId, u.id)]
        );
        conv = { id: Number(cRes.lastInsertRowid) };
      }

      await execute(
        "INSERT INTO messages (conversation_id, sender_id, receiver_id, message_text) VALUES (?, ?, ?, ?)",
        [conv.id, currentUserId, u.id, `📢 [OWNER ANNOUNCEMENT]: ${messageText.trim()}`]
      );

      io.to(`user_${u.id}`).emit("new_message_notification", {
        sender_id: currentUserId,
        sender_username: "Rayane",
        sender_avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
        message_text: `📢 ${messageText.trim()}`,
        created_at: new Date().toISOString()
      });
    }

    res.json({ success: true, message: "Announcement broadcasted successfully!" });
  } catch (err) {
    res.status(500).json({ error: "Failed to broadcast message" });
  }
});

// Global JSON error handler to guarantee all API failures return valid JSON instead of HTML
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("⚠️ [Global Error Handler]:", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error"
  });
});

// ====================================================================
// SINGLE-PORT ROUTING (VITE/EXPRESS BRIDGE)
// ====================================================================
async function start() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`===================================================`);
      console.log(`🔥 Premium Raynista server running on port ${PORT}`);
      console.log(`🖥️ Frontend SPA + Backend SQLite + Sockets is Live!`);
      console.log(`===================================================`);
    });
  }
}

if (!process.env.VERCEL) {
  start().catch(err => console.error("⚠️ [Startup] Boot error:", err));
}

export default app;

