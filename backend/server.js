const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors({
  origin: "https://mlbb-topup.vercel.app",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// db is set once connectDatabase() succeeds
let db = null;

const DB_CONFIG = {
  host:     process.env.MYSQLHOST     || process.env.DB_HOST,
  user:     process.env.MYSQLUSER     || process.env.DB_USER,
  password: process.env.MYSQLPASSWORD || process.env.DB_PASS,
  database: process.env.MYSQLDATABASE || process.env.DB_NAME,
  port:     process.env.MYSQLPORT     ? Number(process.env.MYSQLPORT) : 3306,
};

const RETRY_INTERVAL_MS = 5000;
const MAX_RETRIES = 12; // ~1 minute of retries

function connectDatabase(attempt = 1) {
  console.log(
    `[DB] Connection attempt ${attempt}/${MAX_RETRIES} — ` +
    `host=${DB_CONFIG.host} port=${DB_CONFIG.port} ` +
    `user=${DB_CONFIG.user} database=${DB_CONFIG.database}`
  );

  const connection = mysql.createConnection(DB_CONFIG);

  connection.connect((err) => {
    if (err) {
      console.error(`[DB] Connection failed (attempt ${attempt}):`, err.message);

      if (attempt < MAX_RETRIES) {
        console.log(`[DB] Retrying in ${RETRY_INTERVAL_MS / 1000}s…`);
        setTimeout(() => connectDatabase(attempt + 1), RETRY_INTERVAL_MS);
      } else {
        console.error("[DB] Max retries reached. The app will continue running but database queries will fail.");
      }
      return;
    }

    console.log("[DB] Connected successfully.");
    db = connection;

    // Handle unexpected disconnects and attempt to reconnect
    connection.on("error", (err) => {
      console.error("[DB] Connection error:", err.message);
      db = null;
      if (err.code === "PROTOCOL_CONNECTION_LOST" || err.code === "ECONNRESET") {
        console.log("[DB] Lost connection — attempting to reconnect…");
        connectDatabase(1);
      } else {
        throw err;
      }
    });
  });
}

// Guard middleware — returns 503 when the DB isn't ready yet
function requireDb(req, res, next) {
  if (!db) {
    return res.status(503).json({ error: "Database not available. Please try again shortly." });
  }
  next();
}

// Middleware for auth
function auth(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.status(403).send("No token provided");
  jwt.verify(token, "secretkey", (err, decoded) => {
    if (err) return res.status(500).send("Failed to authenticate token");
    req.userId = decoded.id;
    next();
  });
}

// Health check — always responds so Railway knows the process is alive
app.get("/health", (req, res) => {
  res.json({ status: "ok", db: db ? "connected" : "disconnected" });
});

// Top-up route
app.post("/topup", auth, requireDb, (req, res) => {
  const { diamonds, amount, method, mlbbId, mlbbServer } = req.body;
  db.query(
    "INSERT INTO TopUps (user_id, mlbb_id, mlbb_server, diamonds, amount, method, status) VALUES (?, ?, ?, ?, ?, ?, 'success')",
    [req.userId, mlbbId, mlbbServer, diamonds, amount, method],
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.send({ message: "Top-up successful", topupId: result.insertId });
    }
  );
});

// History route
app.get("/history", auth, requireDb, (req, res) => {
  db.query(
    "SELECT * FROM TopUps WHERE user_id=? ORDER BY date DESC",
    [req.userId],
    (err, results) => {
      if (err) return res.status(500).send(err);
      res.send(results);
    }
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
  // Start connecting to the database only after the server is up
  connectDatabase();
});
