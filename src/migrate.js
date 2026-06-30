const bcrypt = require('bcryptjs');
const db = require('./db');

async function migrate() {
  console.log('Creating tables...');
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_name TEXT,
      phone TEXT,
      address TEXT,
      status TEXT DEFAULT 'PENDING',
      total NUMERIC(10,2) DEFAULT 0,
      payment_method TEXT,
      upi_txn TEXT,
      discount_code TEXT,
      discount_percent INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      delivered_at TIMESTAMPTZ
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INT REFERENCES orders(id) ON DELETE CASCADE,
      name TEXT,
      qty INT,
      price NUMERIC(10,2)
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS discounts (
      code TEXT PRIMARY KEY,
      percent INT NOT NULL,
      max_uses INT,
      uses INT DEFAULT 0,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS discount_uses (
      id SERIAL PRIMARY KEY,
      code TEXT REFERENCES discounts(code),
      order_id INT REFERENCES orders(id),
      used_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY,
      order_id INT REFERENCES orders(id) ON DELETE CASCADE,
      filename TEXT,
      path TEXT,
      uploaded_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Create admin user if not exists
  const hash = await bcrypt.hash('admin123', 10);
  await db.query(`
    INSERT INTO users (username, password_hash, role)
    VALUES ('admin', $1, 'admin')
    ON CONFLICT (username) DO NOTHING;
  `, [hash]);

  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
