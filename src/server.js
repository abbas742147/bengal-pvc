require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

// Health
app.get('/', (req, res) => res.send('Bengal PVC API running'));
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Auth middleware
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const r = await db.query('SELECT * FROM users WHERE username=$1', [username]);
  const user = r.rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid' });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

// Orders
app.get('/api/orders', auth, async (req, res) => {
  const r = await db.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200');
  res.json(r.rows);
});

app.post('/api/orders', async (req, res) => {
  const { customer_name, phone, address, items = [], total, payment_method, upi_txn, discount_code, discount_percent } = req.body;
  const o = await db.query(
    `INSERT INTO orders (customer_name, phone, address, total, payment_method, upi_txn, discount_code, discount_percent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [customer_name, phone, address, total, payment_method, upi_txn, discount_code, discount_percent || 0]
  );
  const order = o.rows[0];
  for (const it of items) {
    await db.query('INSERT INTO order_items (order_id, name, qty, price) VALUES ($1,$2,$3,$4)', [order.id, it.name, it.qty, it.price]);
  }
  // Track discount use
  if (discount_code) {
    await db.query('INSERT INTO discount_uses (code, order_id) VALUES ($1,$2)', [discount_code, order.id]);
    const u = await db.query('UPDATE discounts SET uses = uses + 1 WHERE code=$1 RETURNING uses, max_uses', [discount_code]);
    if (u.rows[0] && u.rows[0].max_uses && u.rows[0].uses >= u.rows[0].max_uses) {
      await db.query('UPDATE discounts SET active=false WHERE code=$1', [discount_code]);
    }
  }
  res.json(order);
});

app.patch('/api/orders/:id/status', auth, async (req, res) => {
  const { status } = req.body;
  const delivered_at = status === 'DELIVERED' ? new Date() : null;
  const r = await db.query('UPDATE orders SET status=$1, delivered_at=COALESCE($2, delivered_at) WHERE id=$3 RETURNING *', [status, delivered_at, req.params.id]);
  res.json(r.rows[0]);
});

// Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random()*1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

app.post('/api/upload', upload.single('file'), async (req, res) => {
  const { order_id } = req.body;
  await db.query('INSERT INTO files (order_id, filename, path) VALUES ($1,$2,$3)', [order_id, req.file.originalname, req.file.filename]);
  res.json({ url: `/uploads/${req.file.filename}` });
});

// Discounts
app.get('/api/discounts', auth, async (req, res) => {
  const r = await db.query('SELECT * FROM discounts ORDER BY created_at DESC');
  res.json(r.rows);
});

app.post('/api/discounts', auth, async (req, res) => {
  const { code, percent, max_uses } = req.body;
  const r = await db.query(
    `INSERT INTO discounts (code, percent, max_uses) VALUES (UPPER($1),$2,$3)
     ON CONFLICT (code) DO UPDATE SET percent=$2, max_uses=$3, active=true RETURNING *`,
    [code, percent, max_uses]
  );
  res.json(r.rows[0]);
});

app.post('/api/discounts/validate', async (req, res) => {
  const { code } = req.body;
  const r = await db.query('SELECT * FROM discounts WHERE code=UPPER($1) AND active=true', [code]);
  const d = r.rows[0];
  if (!d) return res.json({ valid: false });
  if (d.max_uses && d.uses >= d.max_uses) {
    await db.query('UPDATE discounts SET active=false WHERE code=$1', [d.code]);
    return res.json({ valid: false });
  }
  res.json({ valid: true, percent: d.percent });
});

// Auto-delete files 10 days after DELIVERED (runs daily 2am)
cron.schedule('0 2 * * *', async () => {
  console.log('Running auto-delete job...');
  const r = await db.query(`SELECT f.id, f.path FROM files f JOIN orders o ON f.order_id=o.id WHERE o.status='DELIVERED' AND o.delivered_at < NOW() - INTERVAL '10 days'`);
  for (const file of r.rows) {
    try {
      fs.unlinkSync(path.join(UPLOAD_DIR, file.path));
      await db.query('DELETE FROM files WHERE id=$1', [file.id]);
    } catch (e) {}
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log('API ready');
});
