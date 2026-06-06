const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(bodyParser.json());

const SECRET = "mlbbsecretkey";

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password', // change to your MySQL password
  database: 'mlbb_topup'
});

// Register
app.post('/register', (req, res) => {
  const { name, email, password, mlbb_id } = req.body;
  const hashed = bcrypt.hashSync(password, 10);
  db.query("INSERT INTO Users (name, email, password, mlbb_id) VALUES (?, ?, ?, ?)",
    [name, email, hashed, mlbb_id],
    (err) => {
      if (err) return res.status(500).send(err);
      res.send({ message: "User registered successfully" });
    });
});

// Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.query("SELECT * FROM Users WHERE email=?", [email], (err, results) => {
    if (err || results.length === 0) return res.status(401).send({ message: "Invalid credentials" });
    const user = results[0];
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).send({ message: "Invalid credentials" });
    const token = jwt.sign({ id: user.id, isAdmin: user.isAdmin }, SECRET, { expiresIn: "1h" });
    res.send({ message: "Login successful", token, isAdmin: user.isAdmin });
  });
});

// Middleware
function auth(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).send({ message: "No token provided" });
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.status(401).send({ message: "Unauthorized" });
    req.userId = decoded.id;
    req.isAdmin = decoded.isAdmin;
    next();
  });
}

// Top-Up
app.post('/topup', auth, (req, res) => {
  const { diamonds, amount } = req.body;
  db.query("INSERT INTO TopUps (user_id, diamonds, amount, status) VALUES (?, ?, ?, 'pending')",
    [req.userId, diamonds, amount],
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.send({ message: "Top-up request created", topupId: result.insertId });
    });
});

// Admin: View all top-ups
app.get('/admin/topups', auth, (req, res) => {
  if (!req.isAdmin) return res.status(403).send({ message: "Admins only" });
  db.query("SELECT * FROM TopUps", (err, results) => {
    if (err) return res.status(500).send(err);
    res.send(results);
  });
});

app.listen(3000, () => console.log("MLBB Top-Up Server running on port 3000"));
app.post('/topup', auth, (req, res) => {
  const { diamonds, amount, method, mlbbId, mlbbServer } = req.body;
  db.query("INSERT INTO TopUps (user_id, mlbb_id, mlbb_server, diamonds, amount, method, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')",
    [req.userId, mlbbId, mlbbServer, diamonds, amount, method],
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.send({ message: "Top-up request created", topupId: result.insertId });
    });
});
// Get transaction history for logged-in user
app.get('/history', auth, (req, res) => {
  db.query("SELECT * FROM TopUps WHERE user_id=? ORDER BY date DESC", [req.userId], (err, results) => {
    if (err) return res.status(500).send(err);
    res.send(results);
  });
});
// Get transaction history for logged-in user
app.get('/history', auth, (req, res) => {
  db.query(
    "SELECT id, mlbb_id, mlbb_server, diamonds, amount, method, status, date FROM TopUps WHERE user_id=? ORDER BY date DESC",
    [req.userId],
    (err, results) => {
      if (err) return res.status(500).send(err);
      res.send(results);
    }
  );
});

