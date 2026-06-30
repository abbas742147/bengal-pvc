
const db = require('./db');

async function migrate() {
  console.log('Creating tables...');
  
  await db.query(`CREATE TABLE IF NOT EXISTS users (
    userid TEXT PRIMARY KEY,
    name TEXT,
    whatsapp TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user',
    district TEXT
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS orders (
    orderid TEXT PRIMARY KEY,
    userid TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    address JSONB,
    filelinks JSONB,
    totalamount NUMERIC,
    status TEXT,
    trackingid TEXT,
    paymentstatus TEXT,
    deliverydate TIMESTAMPTZ,
    remark TEXT
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS payments (
    orderid TEXT PRIMARY KEY,
    email TEXT,
    amount NUMERIC,
    status TEXT,
    date TIMESTAMPTZ,
    utr TEXT,
    planid TEXT,
    type TEXT
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS franchisees (
    franchiseid TEXT PRIMARY KEY,
    name TEXT,
    whatsapp TEXT,
    email TEXT,
    district TEXT,
    password TEXT,
    status TEXT DEFAULT 'ACTIVE',
    balance NUMERIC DEFAULT 0
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS wallet_history (
    txnid TEXT PRIMARY KEY,
    franchiseid TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    type TEXT,
    amount NUMERIC,
    description TEXT
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS withdrawals (
    reqid TEXT PRIMARY KEY,
    franchiseid TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    amount NUMERIC,
    upi TEXT,
    status TEXT,
    utr TEXT
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS discounts (
    code TEXT PRIMARY KEY,
    type TEXT,
    value NUMERIC,
    minorder NUMERIC DEFAULT 0,
    maxuses INTEGER DEFAULT 0,
    usedcount INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    createdby TEXT,
    createddate TIMESTAMPTZ DEFAULT NOW()
  )`);

  // Insert default settings if not exists
  const defaults = [
    ['PVC_PRICE','50'],
    ['SHIPPING_FEE','30'],
    ['FREE_SHIP_10PLUS','TRUE'],
    ['COMMISSION','5'],
    ['MIN_WITHDRAW','200'],
    ['DISC_2_5','10'],
    ['DISC_5_7','15'],
    ['DISC_7_10','18'],
    ['DISC_10_PLUS','24'],
    ['NOTIF_ON','TRUE'],
    ['NOTIF_TEXT','Welcome to Bengal PVC! Premium ID Card Printing.']
  ];
  for (const [k,v] of defaults) {
    await db.query(`INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING`, [k,v]);
  }

  // Create admin user
  await db.query(`INSERT INTO users(userid,name,whatsapp,email,password,role,district) 
    VALUES('ADMIN_1','Admin','0000000000','admin@bengalpvc.in','admin123','admin','All')
    ON CONFLICT(userid) DO NOTHING`);

  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch(e=>{console.error(e);process.exit(1)});
