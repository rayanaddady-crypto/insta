var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_http = require("http");
var import_socket = require("socket.io");
var import_cors = __toESM(require("cors"), 1);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var import_vite = require("vite");
var import_client = require("@libsql/client");
var import_multer = __toESM(require("multer"), 1);
var import_sharp = __toESM(require("sharp"), 1);
var PORT = 3e3;
var JWT_SECRET = process.env.JWT_SECRET || "instaclone-super-secret-key-2026";
var UPLOADS_DIR = import_path.default.join(process.cwd(), "uploads");
if (!import_fs.default.existsSync(UPLOADS_DIR)) {
  import_fs.default.mkdirSync(UPLOADS_DIR, { recursive: true });
}
var upload = (0, import_multer.default)({
  storage: import_multer.default.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images and videos are allowed"), false);
    }
  }
});
var TURSO_URL = process.env.TURSO_DATABASE_URL || "file:local.db";
var TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || "";
var turso = (0, import_client.createClient)({
  url: TURSO_URL,
  authToken: TURSO_TOKEN
});
var query = async (sql, args = []) => {
  const cleanArgs = args.map((arg) => arg === void 0 ? null : arg);
  const result = await turso.execute({ sql, args: cleanArgs });
  return result.rows;
};
var queryOne = async (sql, args = []) => {
  const rows = await query(sql, args);
  return rows.length > 0 ? rows[0] : null;
};
var execute = async (sql, args = []) => {
  const cleanArgs = args.map((arg) => arg === void 0 ? null : arg);
  return await turso.execute({ sql, args: cleanArgs });
};
async function checkDbConnection() {
  try {
    await turso.execute("SELECT 1");
    console.log("\u26A1 [Turso DB] Remote database connected successfully.");
  } catch (err) {
    console.warn("\u26A0\uFE0F [Turso DB] Remote connection bypassed, loading local SQLite file fallback:", err);
    turso = (0, import_client.createClient)({
      url: "file:local.db"
    });
  }
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
      `CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker_id ON blocked_users(blocker_id);`
    ];
    for (const sql of tables) {
      await execute(sql);
    }
    for (const sql of indexes) {
      await execute(sql);
    }
    console.log("\u26A1 [Turso DB] All separate tables and performance indexes loaded successfully!");
    await execute("DELETE FROM users WHERE email LIKE '%@raynista.co'");
    console.log("\u26A1 [Turso DB] Cleaned up all temporary mock accounts from the database.");
  } catch (err) {
    console.error("\u26A0\uFE0F [Turso DB] Table initialization failed:", err);
  }
}
initTursoTables();
var app = (0, import_express.default)();
app.use("/uploads", import_express.default.static(UPLOADS_DIR));
var server = (0, import_http.createServer)(app);
var io = new import_socket.Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});
app.use((0, import_cors.default)());
app.use(import_express.default.json());
var processAndSaveFile = async (file) => {
  if (file.mimetype.startsWith("image/")) {
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
    const filepath = import_path.default.join(UPLOADS_DIR, filename);
    await (0, import_sharp.default)(file.buffer).resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 80 }).toFile(filepath);
    return `/uploads/${filename}`;
  } else {
    const ext = import_path.default.extname(file.originalname) || ".mp4";
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const filepath = import_path.default.join(UPLOADS_DIR, filename);
    import_fs.default.writeFileSync(filepath, file.buffer);
    return `/uploads/${filename}`;
  }
};
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    res.status(401).json({ error: "Access token required" });
    return;
  }
  import_jsonwebtoken.default.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      res.status(403).json({ error: "Invalid or expired token" });
      return;
    }
    req.user = decoded;
    next();
  });
}
var calculateAge = (birthdayStr) => {
  if (!birthdayStr) return null;
  const birthDate = new Date(birthdayStr);
  if (isNaN(birthDate.getTime())) return null;
  const today = /* @__PURE__ */ new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || m === 0 && today.getDate() < birthDate.getDate()) {
    age--;
  }
  return `${age} years old`;
};
app.get("/api/android/build-status", (req, res) => {
  const capConfigPath = import_path.default.join(process.cwd(), "capacitor.config.ts");
  const androidPath = import_path.default.join(process.cwd(), "android");
  res.json({
    status: "ready",
    appId: "com.raynista.app",
    appName: "Raynista",
    platform: "android",
    capacitorConfigExists: import_fs.default.existsSync(capConfigPath),
    androidDirectoryExists: import_fs.default.existsSync(androidPath),
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
          stdout,
          apkPath: "android/app/build/outputs/apk/debug/app-debug.apk"
        });
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to trigger Capacitor sync" });
  }
});
app.get("/api/check-username/:username", async (req, res) => {
  const { username } = req.params;
  const normalized = username.trim().toLowerCase().replace(/\s+/g, "_");
  const row = await queryOne("SELECT id FROM users WHERE LOWER(username) = ?", [normalized]);
  res.json({ available: !row && normalized.length >= 3 });
});
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      res.status(400).json({ error: "Please fill in all fields" });
      return;
    }
    const normalizedUsername = username.trim().toLowerCase().replace(/\s+/g, "_");
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await queryOne("SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?", [normalizedUsername, normalizedEmail]);
    if (existing) {
      res.status(400).json({ error: "Username or email already exists" });
      return;
    }
    const salt = import_bcryptjs.default.genSaltSync(10);
    const password_hash = import_bcryptjs.default.hashSync(password, salt);
    const uRes = await execute(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [normalizedUsername, normalizedEmail, password_hash]
    );
    const userId = Number(uRes.lastInsertRowid);
    const avatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${normalizedUsername}`;
    await execute(
      "INSERT INTO profiles (user_id, name, bio, avatar_url) VALUES (?, ?, ?, ?)",
      [userId, normalizedUsername.toUpperCase(), "", avatar]
    );
    await execute(
      "INSERT INTO user_settings (user_id, theme, privacy) VALUES (?, 'light', 'public')",
      [userId]
    );
    await execute(
      "INSERT INTO online_status (user_id, is_online, last_seen) VALUES (?, 1, CURRENT_TIMESTAMP)",
      [userId]
    );
    const token = import_jsonwebtoken.default.sign(
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
        avatar_url: avatar,
        bio: "",
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Failed to create account" });
  }
});
app.post("/api/login", async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    if (!usernameOrEmail || !password) {
      res.status(400).json({ error: "Please provide credentials" });
      return;
    }
    const identifier = usernameOrEmail.trim().toLowerCase();
    const user = await queryOne("SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?", [identifier, identifier]);
    if (!user || !import_bcryptjs.default.compareSync(password, user.password_hash)) {
      res.status(400).json({ error: "Invalid credentials" });
      return;
    }
    const profile = await queryOne("SELECT * FROM profiles WHERE user_id = ?", [user.id]);
    const settings = await queryOne("SELECT * FROM user_settings WHERE user_id = ?", [user.id]);
    await execute(
      "INSERT INTO online_status (user_id, is_online, last_seen) VALUES (?, 1, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET is_online=1, last_seen=CURRENT_TIMESTAMP",
      [user.id]
    );
    const token = import_jsonwebtoken.default.sign(
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
        avatar_url: profile?.avatar_url || "",
        bio: profile?.bio || "",
        theme: settings?.theme || "light",
        privacy: settings?.privacy || "public",
        created_at: user.created_at
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Failed to sign in" });
  }
});
app.put("/api/settings", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { theme, language, privacy, notifications_enabled } = req.body;
    const t = theme !== void 0 ? theme : null;
    const l = language !== void 0 ? language : null;
    const p = privacy !== void 0 ? privacy : null;
    const n = notifications_enabled !== void 0 ? notifications_enabled : null;
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
app.delete("/api/account", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    await execute("DELETE FROM users WHERE id = ?", [currentUserId]);
    res.json({ success: true, message: "Account deleted successfully." });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});
app.post("/api/users/:id/block", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const blockId = parseInt(req.params.id);
    await execute("INSERT OR IGNORE INTO blocked_users (blocker_id, blocked_id) VALUES (?, ?)", [currentUserId, blockId]);
    await execute("DELETE FROM followers WHERE (follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)", [currentUserId, blockId, blockId, currentUserId]);
    await execute("DELETE FROM follow_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)", [currentUserId, blockId, blockId, currentUserId]);
    res.json({ success: true, message: "User blocked." });
  } catch (err) {
    res.status(500).json({ error: "Failed to block user" });
  }
});
app.post("/api/users/:id/unblock", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const blockId = parseInt(req.params.id);
    await execute("DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?", [currentUserId, blockId]);
    res.json({ success: true, message: "User unblocked." });
  } catch (err) {
    res.status(500).json({ error: "Failed to unblock user" });
  }
});
app.post("/api/reports", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
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
app.post("/api/users/:id/mute", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const muteId = parseInt(req.params.id);
    await execute("INSERT OR IGNORE INTO muted_users (user_id, muted_id) VALUES (?, ?)", [currentUserId, muteId]);
    res.json({ success: true, message: "User muted successfully." });
  } catch (err) {
    res.status(500).json({ error: "Failed to mute user" });
  }
});
app.post("/api/posts/create", authenticateToken, upload.single("file"), async (req, res) => {
  try {
    const currentUserId = req.user.id;
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
app.post("/api/posts", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
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
app.get("/api/feed", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    const following = await query("SELECT following_id FROM followers WHERE follower_id = ?", [currentUserId]);
    const followingIds = following.map((f) => f.following_id);
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
      if (post.privacy === "private" && post.user_id !== currentUserId && !followingIds.includes(post.user_id)) {
        continue;
      }
      const likesCountRow = await queryOne("SELECT COUNT(*) as count FROM likes WHERE post_id = ?", [post.id]);
      const likedRow = await queryOne("SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?", [currentUserId, post.id]);
      const comments = await query(
        `SELECT c.*, u.username, pr.avatar_url
         FROM comments c
         JOIN users u ON c.user_id = u.id
         LEFT JOIN profiles pr ON u.id = pr.user_id
         WHERE c.post_id = ?
         ORDER BY c.created_at ASC`,
        [post.id]
      );
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
app.get("/api/reels", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
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
       ORDER BY r.created_at DESC`,
      [currentUserId, currentUserId]
    );
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
app.post("/api/stories/create", authenticateToken, upload.single("file"), async (req, res) => {
  try {
    const currentUserId = req.user.id;
    let media_url = req.body.media_url;
    if (req.file) {
      media_url = await processAndSaveFile(req.file);
    }
    if (!media_url) {
      res.status(400).json({ error: "Media file is required" });
      return;
    }
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString();
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
app.get("/api/stories", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const now = (/* @__PURE__ */ new Date()).toISOString();
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
    const userStories = {};
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
app.post("/api/posts/:id/like", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
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
          created_at: (/* @__PURE__ */ new Date()).toISOString()
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
app.post("/api/posts/:id/comment", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
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
        sender_username: req.user.username,
        sender_avatar: profile?.avatar_url || "",
        text: notifMsg,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    res.status(201).json({
      comment: {
        id: commentId,
        text: text.trim(),
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        user: {
          id: currentUserId,
          username: req.user.username,
          avatar_url: profile?.avatar_url || ""
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to add comment" });
  }
});
app.post("/api/posts/:id/bookmark", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
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
app.get("/api/bookmarks", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
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
app.get("/api/users/search", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const q = `%${(req.query.q || "").trim().toLowerCase()}%`;
    const matches = await query(
      `SELECT u.id, u.username, pr.avatar_url, pr.bio, us.privacy, pr.is_verified, COALESCE(os.is_online, 0) as is_online
       FROM users u
       JOIN profiles pr ON u.id = pr.user_id
       LEFT JOIN user_settings us ON u.id = us.user_id
       LEFT JOIN online_status os ON u.id = os.user_id
       WHERE (LOWER(u.username) LIKE ? OR LOWER(pr.name) LIKE ?) AND u.id != ?
         AND u.id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = ?)`,
      [q, q, currentUserId, currentUserId]
    );
    const users = [];
    for (const match of matches) {
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
        follow_status: isFollowing ? "accepted" : followReq ? "pending" : null
      });
    }
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: "Failed to search users" });
  }
});
app.get("/api/users/:username", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
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
    const isBlocked = await queryOne("SELECT 1 FROM blocked_users WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)", [currentUserId, u.id, u.id, currentUserId]);
    if (isBlocked) {
      res.status(403).json({ error: "Access restricted" });
      return;
    }
    const isMuted = await queryOne("SELECT 1 FROM muted_users WHERE user_id = ? AND muted_id = ?", [currentUserId, u.id]);
    const isFollowing = await queryOne("SELECT 1 FROM followers WHERE follower_id = ? AND following_id = ?", [currentUserId, u.id]);
    const reqStatus = await queryOne("SELECT status FROM follow_requests WHERE sender_id = ? AND receiver_id = ?", [currentUserId, u.id]);
    const is_current_user = u.id === currentUserId;
    const isLocked = u.privacy === "private" && !is_current_user && !isFollowing;
    const followersCount = await queryOne("SELECT COUNT(*) as count FROM followers WHERE following_id = ?", [u.id]);
    const followingCount = await queryOne("SELECT COUNT(*) as count FROM followers WHERE follower_id = ?", [u.id]);
    let userPosts = [];
    let userReels = [];
    if (!isLocked) {
      userPosts = await query("SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC", [u.id]);
      userReels = await query("SELECT * FROM reels WHERE user_id = ? ORDER BY created_at DESC", [u.id]);
    }
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
    const onlineRow = await queryOne("SELECT is_online, last_seen FROM online_status WHERE user_id = ?", [u.id]);
    const last_seen_text = onlineRow?.is_online === 1 ? "Online Now" : onlineRow?.last_seen || "Offline";
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
        age: calculateAge(u.birthday),
        // Private birthday display (only age calculated)
        followers_count: Number(followersCount.count || 0),
        following_count: Number(followingCount.count || 0),
        posts_count: mappedPosts.length + mappedReels.length,
        is_following: !!isFollowing,
        follow_status: isFollowing ? "accepted" : reqStatus ? "pending" : null,
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
app.post("/api/users/:id/follow", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
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
      await execute("DELETE FROM followers WHERE follower_id = ? AND following_id = ?", [currentUserId, targetId]);
      await execute("DELETE FROM notifications WHERE type = 'follow' AND sender_id = ? AND receiver_id = ?", [currentUserId, targetId]);
    } else if (existingReq) {
      await execute("DELETE FROM follow_requests WHERE sender_id = ? AND receiver_id = ?", [currentUserId, targetId]);
      await execute("DELETE FROM notifications WHERE type = 'follow_request' AND sender_id = ? AND receiver_id = ?", [currentUserId, targetId]);
    } else {
      if (targetSettings?.privacy === "private") {
        await execute("INSERT INTO follow_requests (sender_id, receiver_id) VALUES (?, ?)", [currentUserId, targetId]);
        follow_status = "pending";
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
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        });
      } else {
        await execute("INSERT INTO followers (follower_id, following_id) VALUES (?, ?)", [currentUserId, targetId]);
        follow_status = "accepted";
        is_following = true;
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
          created_at: (/* @__PURE__ */ new Date()).toISOString()
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
app.get("/api/notifications", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const notifications = await query(
      `SELECT n.*, u.username, pr.avatar_url
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
app.post("/api/notifications/:id/accept", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const notifId = parseInt(req.params.id);
    const notif = await queryOne("SELECT * FROM notifications WHERE id = ? AND receiver_id = ?", [notifId, currentUserId]);
    if (!notif) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
    await execute("INSERT OR IGNORE INTO followers (follower_id, following_id) VALUES (?, ?)", [notif.sender_id, currentUserId]);
    await execute("DELETE FROM follow_requests WHERE sender_id = ? AND receiver_id = ?", [notif.sender_id, currentUserId]);
    await execute("UPDATE notifications SET status = 'accepted' WHERE id = ?", [notifId]);
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
app.post("/api/notifications/:id/decline", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
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
app.put("/api/profile", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { name, bio, avatar_url, website, gender, location, birthday, is_private } = req.body;
    await execute(
      `UPDATE profiles
       SET name=COALESCE(?, name), bio=COALESCE(?, bio), avatar_url=COALESCE(?, avatar_url),
           website=COALESCE(?, website), gender=COALESCE(?, gender), location=COALESCE(?, location),
           birthday=COALESCE(?, birthday)
       WHERE user_id = ?`,
      [name, bio, avatar_url, website, gender, location, birthday, currentUserId]
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
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  } catch (err) {
    console.error("Profile edit error:", err);
    res.status(500).json({ error: "Failed to sync profile" });
  }
});
app.get("/api/chat/users", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const usersList = await query(
      `SELECT u.id, u.username, pr.avatar_url, pr.bio, COALESCE(os.is_online, 0) as is_online
       FROM users u
       JOIN profiles pr ON u.id = pr.user_id
       LEFT JOIN online_status os ON u.id = os.user_id
       WHERE u.id != ?`,
      [currentUserId]
    );
    const chatUsers = [];
    for (const u of usersList) {
      let conv = await queryOne(
        `SELECT * FROM conversations
         WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`,
        [currentUserId, u.id, u.id, currentUserId]
      );
      if (!conv) {
        const cRes = await execute(
          "INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)",
          [Math.min(currentUserId, u.id), Math.max(currentUserId, u.id)]
        );
        conv = { id: Number(cRes.lastInsertRowid), user1_id: Math.min(currentUserId, u.id), user2_id: Math.max(currentUserId, u.id), is_pinned_user1: 0, is_pinned_user2: 0 };
      }
      const lastMsg = await queryOne(
        `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1`,
        [conv.id]
      );
      const isPinned = conv.user1_id === currentUserId ? conv.is_pinned_user1 : conv.is_pinned_user2;
      chatUsers.push({
        id: u.id,
        username: u.username,
        avatar_url: u.avatar_url,
        bio: u.bio,
        is_pinned: Number(isPinned || 0) === 1,
        is_online: Number(u.is_online || 0) === 1,
        last_message: lastMsg ? {
          id: lastMsg.id,
          text: lastMsg.message_text,
          created_at: lastMsg.created_at,
          is_sender: lastMsg.sender_id === currentUserId,
          is_read: Number(lastMsg.is_read || 0) === 1
        } : null
      });
    }
    chatUsers.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (!a.last_message) return 1;
      if (!b.last_message) return -1;
      return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
    });
    res.json({ chatUsers });
  } catch (err) {
    console.error("Chat users fetch error:", err);
    res.status(500).json({ error: "Failed to fetch concierge list" });
  }
});
app.get("/api/messages", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const withUserId = parseInt(req.query.with);
    if (isNaN(withUserId)) {
      res.status(400).json({ error: "Invalid receiver" });
      return;
    }
    const conv = await queryOne(
      `SELECT id FROM conversations
       WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`,
      [currentUserId, withUserId, withUserId, currentUserId]
    );
    if (!conv) {
      res.json({ messages: [] });
      return;
    }
    await execute(
      "UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND receiver_id = ?",
      [conv.id, currentUserId]
    );
    const msgsList = await query(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
      [conv.id]
    );
    res.json({ messages: msgsList });
  } catch (err) {
    res.status(500).json({ error: "Failed to load chat history" });
  }
});
app.post("/api/messages", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { receiver_id, message_text } = req.body;
    if (!receiver_id || !message_text || !message_text.trim()) {
      res.status(400).json({ error: "Required params missing" });
      return;
    }
    const receiverIdInt = parseInt(receiver_id);
    let conv = await queryOne(
      `SELECT * FROM conversations
       WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`,
      [currentUserId, receiverIdInt, receiverIdInt, currentUserId]
    );
    if (!conv) {
      const cRes = await execute(
        "INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)",
        [Math.min(currentUserId, receiverIdInt), Math.max(currentUserId, receiverIdInt)]
      );
      conv = { id: Number(cRes.lastInsertRowid) };
    }
    const mRes = await execute(
      "INSERT INTO messages (conversation_id, sender_id, receiver_id, message_text) VALUES (?, ?, ?, ?)",
      [conv.id, currentUserId, receiverIdInt, message_text.trim()]
    );
    const messageId = Number(mRes.lastInsertRowid);
    const msgObj = {
      id: messageId,
      conversation_id: conv.id,
      sender_id: currentUserId,
      receiver_id: receiverIdInt,
      message_text: message_text.trim(),
      is_read: 0,
      reaction: null,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    io.to(`user_${receiverIdInt}`).emit("receive_message", msgObj);
    io.to(`user_${currentUserId}`).emit("receive_message", msgObj);
    io.to(`user_${receiverIdInt}`).emit("new_message_notification", {
      sender_id: currentUserId,
      message_text: message_text.trim()
    });
    res.status(201).json({ message: msgObj });
  } catch (err) {
    console.error("Message send error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});
app.post("/api/chat/conversations/:id/pin", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
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
app.post("/api/messages/:id/react", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
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
app.post("/api/messages/read", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { conversation_id } = req.body;
    await execute(
      "UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND receiver_id = ?",
      [conversation_id, currentUserId]
    );
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
app.post("/api/chat/conversations/:id/typing", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
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
io.on("connection", (socket) => {
  console.log(`[Socket] Connection established: ${socket.id}`);
  socket.on("join", (userId) => {
    socket.join(`user_${userId}`);
    console.log(`[Socket] User ${userId} active in room user_${userId}`);
  });
  socket.on("send_message", async (data) => {
    const { sender_id, receiver_id, message_text } = data;
    if (!sender_id || !receiver_id || !message_text || !message_text.trim()) return;
    let conv = await queryOne(
      `SELECT * FROM conversations
       WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`,
      [sender_id, receiver_id, receiver_id, sender_id]
    );
    if (!conv) {
      const cRes = await execute(
        "INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)",
        [Math.min(sender_id, receiver_id), Math.max(sender_id, receiver_id)]
      );
      conv = { id: Number(cRes.lastInsertRowid) };
    }
    const mRes = await execute(
      "INSERT INTO messages (conversation_id, sender_id, receiver_id, message_text) VALUES (?, ?, ?, ?)",
      [conv.id, sender_id, receiver_id, message_text.trim()]
    );
    const messageId = Number(mRes.lastInsertRowid);
    const msgObj = {
      id: messageId,
      conversation_id: conv.id,
      sender_id,
      receiver_id,
      message_text: message_text.trim(),
      is_read: 0,
      reaction: null,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    io.to(`user_${receiver_id}`).emit("receive_message", msgObj);
    io.to(`user_${sender_id}`).emit("receive_message", msgObj);
    io.to(`user_${receiver_id}`).emit("new_message_notification", {
      sender_id,
      message_text: message_text.trim()
    });
  });
  socket.on("disconnect", () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`===================================================`);
    console.log(`\u{1F525} Premium Raynista server running on port ${PORT}`);
    console.log(`\u{1F5A5}\uFE0F Frontend SPA + Backend SQLite + Sockets is Live!`);
    console.log(`===================================================`);
  });
}
start();
//# sourceMappingURL=server.cjs.map
