import initSqlJs from 'sql.js';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { App } from '@capacitor/app';

let db = null;
let SQL = null;
let saveTimeout = null;

// Convert base64 to Uint8Array
const base64ToUint8 = (base64) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Convert Uint8Array to base64
const uint8ToBase64 = (uint8Array) => {
  let binary = '';
  const len = uint8Array.byteLength;
  const chunk = 8192;
  for (let i = 0; i < len; i += chunk) {
    const slice = uint8Array.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, slice);
  }
  return btoa(binary);
};

// Check if running on native device
const isNative = () => {
  return window.Capacitor && window.Capacitor.isNativePlatform();
};

// Load database file
const loadDbFile = async () => {
  if (isNative()) {
    try {
      const file = await Filesystem.readFile({
        path: 'bestbill.db',
        directory: Directory.Documents
      });
      console.log('[LOCAL DB] Loaded SQLite database file from storage');
      return base64ToUint8(file.data);
    } catch (e) {
      console.log('[LOCAL DB] Database file not found, creating fresh database');
      return null;
    }
  } else {
    // Browser local storage fallback (stored as hex/base64 string)
    const base64 = localStorage.getItem('bestbill_db');
    if (base64) {
      console.log('[LOCAL DB] Loaded database from LocalStorage');
      return base64ToUint8(base64);
    }
    return null;
  }
};

// Save database file (throttled/debounced to avoid UI lag)
const saveDbFile = () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      const data = db.export();
      const base64 = uint8ToBase64(data);
      if (isNative()) {
        await Filesystem.writeFile({
          path: 'bestbill.db',
          data: base64,
          directory: Directory.Documents
        });
        console.log('[LOCAL DB] Database auto-saved to persistent storage');
      } else {
        localStorage.setItem('bestbill_db', base64);
        console.log('[LOCAL DB] Database auto-saved to LocalStorage');
      }
    } catch (err) {
      console.error('[LOCAL DB] Failed to auto-save database:', err.message);
    }
  }, 1000);
};

// Core Tables Initialization DDL
const DDL_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'owner',
    hotel_id INTEGER,
    created_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS hotels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER REFERENCES users(id),
    name TEXT NOT NULL,
    phone TEXT,
    location TEXT,
    logo_url TEXT,
    upi_id TEXT,
    subscription_amount REAL DEFAULT 0,
    subscription_valid_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
    gst_percentage REAL DEFAULT 0,
    is_service_stopped BOOLEAN DEFAULT 0,
    printer_size TEXT DEFAULT '80mm',
    billing_method TEXT DEFAULT 'qz',
    fssai_number TEXT,
    email TEXT,
    allow_negative_stock BOOLEAN DEFAULT 0
);

CREATE TABLE IF NOT EXISTS master_menu (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    category_name TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id INTEGER REFERENCES hotels(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
    is_deleted BOOLEAN DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id INTEGER REFERENCES hotels(id) ON DELETE CASCADE,
    master_id INTEGER REFERENCES master_menu(id) ON DELETE SET NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    description TEXT,
    is_available BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
    is_deleted BOOLEAN DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id INTEGER REFERENCES hotels(id) ON DELETE CASCADE,
    table_number TEXT NOT NULL,
    capacity INTEGER DEFAULT 4,
    status TEXT DEFAULT 'available',
    floor TEXT DEFAULT 'Floor 1',
    created_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
    UNIQUE (hotel_id, floor, table_number)
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER REFERENCES tables(id) ON DELETE CASCADE,
    room_id INTEGER,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
    owner_message TEXT,
    guest_note TEXT,
    is_delivered BOOLEAN DEFAULT 0,
    source TEXT DEFAULT 'admin',
    is_prepared BOOLEAN DEFAULT 0,
    waiter_name TEXT,
    kot_sent_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    total_amount REAL DEFAULT 0,
    gst REAL DEFAULT 0,
    final_amount REAL DEFAULT 0,
    discount_percentage REAL DEFAULT 0,
    is_paid BOOLEAN DEFAULT 0,
    payment_method TEXT,
    created_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id INTEGER REFERENCES menu_items(id),
    quantity INTEGER NOT NULL,
    printed_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
    UNIQUE (order_id, menu_item_id)
);

CREATE TABLE IF NOT EXISTS subscription_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id INTEGER REFERENCES hotels(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    months_added INTEGER NOT NULL,
    valid_from TIMESTAMP DEFAULT (datetime('now', 'localtime')),
    valid_until TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS inventory_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id INTEGER REFERENCES hotels(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
    updated_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id INTEGER REFERENCES hotels(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES inventory_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    current_stock REAL DEFAULT 0,
    minimum_stock REAL DEFAULT 0,
    purchase_rate REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
    updated_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id INTEGER REFERENCES hotels(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    gst_number TEXT,
    created_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS purchase_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id INTEGER REFERENCES hotels(id) ON DELETE CASCADE,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    invoice_number TEXT,
    invoice_date DATE,
    total_amount REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS purchase_entry_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_entry_id INTEGER REFERENCES purchase_entries(id) ON DELETE CASCADE,
    inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity REAL NOT NULL,
    rate REAL NOT NULL,
    amount REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id INTEGER REFERENCES hotels(id) ON DELETE CASCADE,
    inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL,
    quantity REAL NOT NULL,
    reference_type TEXT,
    reference_id INTEGER,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id INTEGER REFERENCES hotels(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
    UNIQUE (hotel_id, product_id)
);

CREATE TABLE IF NOT EXISTS recipe_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
    inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity_required REAL NOT NULL,
    UNIQUE (recipe_id, inventory_item_id)
);

CREATE TABLE IF NOT EXISTS credits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id INTEGER REFERENCES hotels(id) ON DELETE CASCADE,
    bill_id INTEGER REFERENCES bills(id) ON DELETE CASCADE,
    party_type TEXT NOT NULL,
    vendor_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_phone TEXT,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    settled_at TIMESTAMP,
    settlement_payment_method TEXT,
    created_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
    updated_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
);
`;

// Helper: convert PG parameterized query placeholders ($1, $2, etc) to (?)
function sanitizeQuery(sql) {
  let cleaned = sql.replace(/\$(\d+)/g, '?');
  
  // Replace time intervals
  cleaned = cleaned
    .replace(/NOW\(\) - INTERVAL '2 days'/gi, "datetime('now', '-2 days')")
    .replace(/NOW\(\) - INTERVAL '1 year'/gi, "datetime('now', '-1 year')")
    .replace(/NOW\(\)/gi, "datetime('now', 'localtime')")
    .replace(/CURRENT_TIMESTAMP/gi, "(datetime('now', 'localtime'))")
    .replace(/CURRENT_DATE/gi, "date('now', 'localtime')");

  if (cleaned.includes('?::interval') || cleaned.includes('?::timestamp')) {
    cleaned = cleaned
      .replace(/\+\s*\?::interval/gi, "+ ?")
      .replace(/::timestamp/gi, "");
  }
  
  return cleaned;
}

// Immediate sync save (flushes DB to storage)
export const saveDbFileNow = async () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  if (!db) return;
  try {
    const data = db.export();
    const base64 = uint8ToBase64(data);
    if (isNative()) {
      await Filesystem.writeFile({
        path: 'bestbill.db',
        data: base64,
        directory: Directory.Documents
      });
      console.log('[LOCAL DB] Persistent DB saved immediately to storage');
    } else {
      localStorage.setItem('bestbill_db', base64);
      console.log('[LOCAL DB] Persistent DB saved immediately to LocalStorage');
    }
  } catch (err) {
    console.error('[LOCAL DB] Immediate save failed:', err.message);
  }
};

// Lifecycle listeners for instant state persistence
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => saveDbFileNow());
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveDbFileNow();
  });
  if (isNative() && window.Capacitor) {
    try {
      App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          console.log('[LOCAL DB] App paused/backgrounded -> Flushing DB immediately');
          saveDbFileNow();
        }
      });
    } catch (e) {
      console.warn('Capacitor App listener note:', e);
    }
  }
}

// Seed default hotel, user, tables and menu items if fresh DB
const ensureDefaultSeedData = () => {
  try {
    const hotelCheck = db.exec("SELECT COUNT(*) as count FROM hotels");
    const count = hotelCheck[0]?.values[0]?.[0] || 0;
    if (count === 0) {
      console.log('[LOCAL DB] No hotel found. Seeding default hotel, user, categories, menu & tables...');
      db.run("INSERT INTO users (id, name, email, password, role, hotel_id) VALUES (1, 'Owner', 'owner@bestbill.com', '$2a$10$e8461719999999999999999999999999999999999999999999999', 'owner', 1)");
      db.run("INSERT INTO hotels (id, owner_id, name, phone, location, gst_percentage) VALUES (1, 1, 'BestBill Hotel', '9822401802', 'Main Market', 0)");
      db.run("INSERT INTO categories (id, hotel_id, name) VALUES (1, 1, 'General')");
      
      // Default Menu Items
      db.run("INSERT INTO menu_items (hotel_id, category_id, name, price, description, is_available) VALUES (1, 1, 'Pani Puri', 40, 'Crispy Puris with Spicy Flavored Water', 1)");
      db.run("INSERT INTO menu_items (hotel_id, category_id, name, price, description, is_available) VALUES (1, 1, 'Sev Puri', 60, 'Crunchy Puri topped with Sev & Chutneys', 1)");
      db.run("INSERT INTO menu_items (hotel_id, category_id, name, price, description, is_available) VALUES (1, 1, 'Masala Dosa', 80, 'South Indian Rice Crepe with Potato Filling', 1)");
      db.run("INSERT INTO menu_items (hotel_id, category_id, name, price, description, is_available) VALUES (1, 1, 'Tea', 15, 'Hot Masala Tea', 1)");
      db.run("INSERT INTO menu_items (hotel_id, category_id, name, price, description, is_available) VALUES (1, 1, 'Coffee', 25, 'Hot Brewed Coffee', 1)");

      // Default Tables 1 to 6
      for (let i = 1; i <= 6; i++) {
        db.run("INSERT INTO tables (hotel_id, table_number, capacity, floor) VALUES (1, ?, 4, 'Floor 1')", [i.toString()]);
      }
      saveDbFileNow();
    }
  } catch (err) {
    console.error('[LOCAL DB SEED ERROR]', err);
  }
};

export const initDb = async () => {
  if (db) return db;

  try {
    console.log('[LOCAL DB] Initializing sql.js...');
    SQL = await initSqlJs({
      locateFile: (file) => `/sql-wasm.wasm`
    });

    const fileBuffer = await loadDbFile();
    if (fileBuffer) {
      db = new SQL.Database(fileBuffer);
      console.log('[LOCAL DB] Existing database initialized');
    } else {
      db = new SQL.Database();
      console.log('[LOCAL DB] Fresh database initialized. Running DDL...');
      db.run(DDL_SCHEMA);
      saveDbFileNow();
    }
    
    // Enable Foreign Keys & Seed Defaults
    db.run('PRAGMA foreign_keys = ON;');
    ensureDefaultSeedData();
    return db;
  } catch (err) {
    console.error('[LOCAL DB INIT ERROR]', err);
    throw err;
  }
};

// Database Query Adapter
export const query = async (text, params = []) => {
  if (!db) {
    await initDb();
  }

  return new Promise((resolve, reject) => {
    try {
      const sanitizedSql = sanitizeQuery(text);
      
      // Map true/false/undefined
      const safeParams = params.map(p => {
        if (p === true) return 1;
        if (p === false) return 0;
        if (p === undefined) return null;
        // Map intervals
        if (typeof p === 'string' && p.endsWith(' months')) {
          const val = parseInt(p.split(' ')[0]) || 1;
          return `+${val} month`;
        }
        return p;
      });

      const isSelect = sanitizedSql.trim().toUpperCase().startsWith('SELECT') || 
                       sanitizedSql.toUpperCase().includes('RETURNING');

      if (isSelect) {
        const stmt = db.prepare(sanitizedSql);
        stmt.bind(safeParams);
        
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();

        // Emulate RETURNING clause by fetching inserted/updated row if RETURNING yielded empty or partial rows
        let returningRows = rows;
        if (sanitizedSql.toUpperCase().includes('RETURNING')) {
          const upperSql = sanitizedSql.toUpperCase();
          let tableName = null;
          
          if (upperSql.includes('INTO ')) {
            const match = upperSql.match(/INTO\s+([a-zA-Z0-9_]+)/i);
            if (match) tableName = match[1].toLowerCase();
          } else if (upperSql.includes('UPDATE ')) {
            const match = upperSql.match(/UPDATE\s+([a-zA-Z0-9_]+)/i);
            if (match) tableName = match[1].toLowerCase();
          }

          const lastIdRes = db.exec('SELECT last_insert_rowid() as id');
          const lastId = lastIdRes[0]?.values[0]?.[0];

          if (tableName && lastId) {
            try {
              const fullRowRes = db.exec(`SELECT * FROM ${tableName} WHERE id = ${lastId}`);
              if (fullRowRes.length > 0 && fullRowRes[0].values.length > 0) {
                const columns = fullRowRes[0].columns;
                const values = fullRowRes[0].values[0];
                const fullRow = {};
                columns.forEach((col, idx) => {
                  fullRow[col] = values[idx];
                });
                returningRows = [fullRow];
              }
            } catch (e) {
              console.warn('[LOCAL DB] RETURNING fallback fetch note:', e.message);
            }
          }

          if (returningRows.length === 0 && lastId) {
            returningRows = [{ id: lastId }];
          }
        }

        // Auto save on write queries even if they use RETURNING
        const upperSql = sanitizedSql.trim().toUpperCase();
        if (upperSql.startsWith('INSERT') || upperSql.startsWith('UPDATE') || upperSql.startsWith('DELETE') || upperSql.startsWith('REPLACE') || upperSql.includes('RETURNING')) {
          saveDbFile();
        }

        resolve({
          rows: returningRows,
          rowCount: returningRows.length
        });
      } else {
        db.run(sanitizedSql, safeParams);
        
        let rowCount = 0;
        try {
          const changesRes = db.exec('SELECT changes()');
          rowCount = changesRes[0]?.values[0]?.[0] || 0;
        } catch (e) {}

        // Auto save on writes
        saveDbFile();

        resolve({
          rows: [],
          rowCount
        });
      }
    } catch (err) {
      console.error('[LOCAL DB QUERY ERROR] Failed query:', text, err);
      reject(err);
    }
  });
};

// Mock Transaction Client
export const getClient = async () => {
  return {
    query: (text, params) => query(text, params),
    release: () => {}
  };
};

export const getDbInstance = () => db;
