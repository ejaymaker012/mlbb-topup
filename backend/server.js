const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(cors({
  origin: "https://mlbb-topup.vercel.app", // your Vercel frontend domain
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// Railway DB connection (replace with Railway environment variables)
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "yourpassword",
  database: process.env.DB_NAME || "mlbb_topup"
});

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

// Top-up route
app.post("/topup", auth, (req, res) => {
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
app.get("/history", auth, (req, res) => {
  db.query(
    "SELECT * FROM TopUps WHERE user_id=? ORDER BY date DESC",
    [req.userId],
    (err, results) => {
      if (err) return res.status(500).send(err);
      res.send(results);
    }
  );
});

app.listen(3000, () => console.log("Server running on port 3000"));
