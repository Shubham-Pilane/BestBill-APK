import * as db from '../db/localDb';
import * as licenseService from './localLicenseService';
import bcrypt from 'bcryptjs';

// Parse query params from URL
const parseQueryParams = (url) => {
  const params = {};
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) return params;
  const queryString = url.substring(queryIndex + 1);
  const pairs = queryString.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || '');
  }
  return params;
};

// Generate a simple mock JWT
const generateMockToken = (userId, role, hotelId) => {
  return `mock-token-${userId}-${role}-${hotelId}-${Date.now()}`;
};

// Decode a mock JWT to get user
const getAuthenticatedUser = (headers) => {
  const authHeader = headers?.Authorization || headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.replace('Bearer ', '');
  const parts = token.split('-');
  if (parts[0] !== 'mock') return null;
  return {
    id: parseInt(parts[2]),
    role: parts[3],
    hotel_id: parseInt(parts[4])
  };
};

// Stock Deduction Engine (simulating inventoryService.js)
async function deductStockForOrder(orderId, hotelId) {
  // 1. Fetch hotel settings to check if negative stock is allowed
  const hotelRes = await db.query('SELECT allow_negative_stock FROM hotels WHERE id = $1', [hotelId]);
  const allowNegative = hotelRes.rows[0]?.allow_negative_stock === 1 || hotelRes.rows[0]?.allow_negative_stock === true;

  // 2. Fetch all sold items in this order
  const orderItemsRes = await db.query(
    `SELECT oi.quantity, oi.menu_item_id, mi.name as product_name
     FROM order_items oi
     JOIN menu_items mi ON oi.menu_item_id = mi.id
     WHERE oi.order_id = $1`,
    [orderId]
  );

  const ingredientRequirements = {};

  // 3. Accumulate total ingredient requirements across all items
  for (const item of orderItemsRes.rows) {
    // Fetch recipe
    const recipeRes = await db.query('SELECT id FROM recipes WHERE hotel_id = $1 AND product_id = $2', [hotelId, item.menu_item_id]);
    if (recipeRes.rows.length === 0) continue; // No recipe mapping exists for this item
    const recipeId = recipeRes.rows[0].id;

    const recipeItemsRes = await db.query(
      'SELECT ri.inventory_item_id, ri.quantity_required, ii.name, ii.unit, ii.current_stock FROM recipe_items ri JOIN inventory_items ii ON ri.inventory_item_id = ii.id WHERE ri.recipe_id = $1',
      [recipeId]
    );

    for (const recipeItem of recipeItemsRes.rows) {
      const itemId = recipeItem.inventory_item_id;
      const requiredQty = Number(recipeItem.quantity_required) * Number(item.quantity);

      if (!ingredientRequirements[itemId]) {
        ingredientRequirements[itemId] = {
          itemId,
          name: recipeItem.name,
          unit: recipeItem.unit,
          required: 0,
          current_stock: Number(recipeItem.current_stock || 0)
        };
      }
      ingredientRequirements[itemId].required += requiredQty;
    }
  }

  // 4. Validate stock if negative stock is NOT allowed
  if (!allowNegative) {
    for (const itemId in ingredientRequirements) {
      const req = ingredientRequirements[itemId];
      if (req.current_stock < req.required) {
        // unit conversion factor (gram/ml -> kg/l)
        const unit = String(req.unit).toLowerCase().trim();
        const factor = (unit === 'kg' || unit === 'kilogram' || unit === 'kilograms' || unit === 'litre' || unit === 'l' || unit === 'litres') ? 1000 : 1;
        const reqDisplay = req.required / factor;
        const availDisplay = req.current_stock / factor;
        throw new Error(
          `Insufficient stock for ingredient: ${req.name}. ` +
          `Required: ${reqDisplay.toFixed(2)} ${req.unit}, ` +
          `Available: ${availDisplay.toFixed(2)} ${req.unit}.`
        );
      }
    }
  }

  // 5. Update stock values and insert ledger transactions
  for (const itemId in ingredientRequirements) {
    const req = ingredientRequirements[itemId];
    await db.query('UPDATE inventory_items SET current_stock = current_stock - $1 WHERE id = $2 AND hotel_id = $3', [req.required, req.itemId, hotelId]);
    await db.query(
      `INSERT INTO stock_transactions (hotel_id, inventory_item_id, transaction_type, quantity, reference_type, reference_id, remarks) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [hotelId, req.itemId, 'SALE', -req.required, 'orders', orderId, `Sale consumption for Order #${orderId}`]
    );
  }
}

// Router Request Handler
export async function handleRequest(method, url, body = null, headers = {}) {
  const methodUpper = method.toUpperCase();
  const path = url.replace(/^\/api/, '').split('?')[0];
  const queryParams = parseQueryParams(url);
  const user = getAuthenticatedUser(headers);

  console.log(`[LOCAL ROUTER] ${methodUpper} ${path}`, { queryParams, body, user });

  try {
    // ----------------------------------------
    // AUTHENTICATION ROUTES
    // ----------------------------------------
    if (path === '/auth/register-status') {
      const usersRes = await db.query('SELECT count(*) as count FROM users');
      const count = usersRes.rows[0]?.count || 0;
      return { status: 200, data: { isRegistrationAllowed: count === 0 } };
    }

    if (path === '/auth/register' && methodUpper === 'POST') {
      const { name, email, password, hotelName, phone, location, address } = body;
      const hashedPassword = await bcrypt.hash(password, 10);
      const loc = location || address || '';
      
      // Create user
      const userRes = await db.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, email, hashedPassword, 'owner']
      );
      const newUser = userRes.rows[0];

      // Create hotel
      const hotelRes = await db.query(
        'INSERT INTO hotels (owner_id, name, phone, location) VALUES ($1, $2, $3, $4) RETURNING *',
        [newUser.id, hotelName, phone, loc]
      );
      const newHotel = hotelRes.rows[0];

      // Update user hotel ID
      await db.query('UPDATE users SET hotel_id = $1 WHERE id = $2', [newHotel.id, newUser.id]);
      
      // Save registration date for trial validation
      localStorage.setItem('registration_date', new Date().toISOString());

      // Pre-populate some tables for onboarding convenience
      for (let i = 1; i <= 5; i++) {
        await db.query('INSERT INTO tables (hotel_id, table_number, floor) VALUES ($1, $2, $3)', [newHotel.id, i.toString(), 'Floor 1']);
      }

      return { status: 201, data: { message: 'Registration successful' } };
    }

    if (path === '/auth/login' && methodUpper === 'POST') {
      const { email, password } = body;
      const usersRes = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      if (usersRes.rows.length === 0) {
        return { status: 400, data: { message: 'Invalid email or password' } };
      }
      
      const dbUser = usersRes.rows[0];
      const match = await bcrypt.compare(password, dbUser.password);
      if (!match) {
        return { status: 400, data: { message: 'Invalid email or password' } };
      }

      // Fetch hotel details
      const hotelRes = await db.query('SELECT * FROM hotels WHERE id = $1', [dbUser.hotel_id]);
      const hotel = hotelRes.rows[0] || {};

      // Validate license expiration
      const details = await licenseService.getLicenseDetails();
      if (!details.isValid) {
        const errorReason = details.type === 'trial'
          ? 'Your 30-day offline free trial has expired. Please contact Shubham Pilane to renew or activate your license. Mobile: 9822401802'
          : `Your ${details.type} license key has expired. Please contact Shubham Pilane to renew your subscription. Mobile: 9822401802`;
        
        return {
          status: 403,
          data: {
            message: 'PLAN_EXPIRED',
            reason: errorReason,
            contact_phone: '9822401802',
            contact_email: 'bestbillsolutions@gmail.com'
          }
        };
      }

      // Get configuration flags (mocked/stored locally)
      const token = generateMockToken(dbUser.id, dbUser.role, dbUser.hotel_id);
      
      return {
        status: 200,
        data: {
          token,
          user: {
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            role: dbUser.role,
            hotel_id: dbUser.hotel_id,
            hotel_name: hotel.name || 'BestBill Hotel',
            hotel_phone: hotel.phone || '',
            hotel_location: hotel.location || '',
            upi_id: hotel.upi_id || '',
            subscription_valid_until: details.expiresAt,
            lodgingEnabled: false, // Desktop only - disabled on mobile
            kotEnabled: false, // Desktop only - disabled on mobile
            whatsAppBillingEnabled: localStorage.getItem('cfg_whatsapp_billing') === 'true',
            inventoryEnabled: true,
            tokenCounterEnabled: localStorage.getItem('cfg_token_counter') === 'true',
            simpleKotEnabled: false // Desktop only - disabled on mobile
          }
        }
      };
    }

    if (path === '/auth/forgot-password' && methodUpper === 'POST') {
      const { email, newPassword } = body;
      const usersRes = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (usersRes.rows.length === 0) return { status: 404, data: { message: 'User not found' } };
      
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.query('UPDATE users SET password = $1 WHERE email = $2', [hashedPassword, email]);
      return { status: 200, data: { message: 'Password updated successfully' } };
    }

    if (path === '/auth/subscription-status') {
      const details = await licenseService.getLicenseDetails();
      return { status: 200, data: details };
    }

    if (path === '/auth/activate-license' && methodUpper === 'POST') {
      const { licenseKey } = body;
      if (!licenseKey) return { status: 400, data: { message: 'License key is required' } };
      
      const success = await licenseService.setLicenseKey(licenseKey);
      if (success) {
        return { status: 200, data: { message: 'License activated successfully!' } };
      } else {
        return { status: 400, data: { message: 'Invalid license key. Please try again.' } };
      }
    }

    // Require Auth for all other routes
    if (!user) {
      return { status: 401, data: { message: 'Unauthorized' } };
    }

    // ----------------------------------------
    // TABLE MANAGEMENT ROUTES
    // ----------------------------------------
    if (path === '/tables' && methodUpper === 'GET') {
      const tables = await db.query(
        `SELECT t.*, o.id as active_order_id 
         FROM tables t 
         LEFT JOIN orders o ON o.table_id = t.id AND o.status = 'active'
         WHERE t.hotel_id = $1 OR t.hotel_id = 1
         ORDER BY t.floor ASC, LENGTH(t.table_number) ASC, t.table_number ASC`,
        [user?.hotel_id || 1]
      );

      if (tables.rows.length === 0) {
        const targetHotelId = user?.hotel_id || 1;
        for (let i = 1; i <= 6; i++) {
          await db.query('INSERT OR IGNORE INTO tables (hotel_id, table_number, capacity, floor) VALUES ($1, $2, 4, $3)', [targetHotelId, i.toString(), 'Floor 1']);
        }
        const retryTables = await db.query(
          `SELECT t.*, o.id as active_order_id 
           FROM tables t 
           LEFT JOIN orders o ON o.table_id = t.id AND o.status = 'active'
           WHERE t.hotel_id = $1 OR t.hotel_id = 1
           ORDER BY t.floor ASC, LENGTH(t.table_number) ASC, t.table_number ASC`,
          [targetHotelId]
        );
        return { status: 200, data: retryTables.rows };
      }

      return { status: 200, data: tables.rows };
    }

    if (path === '/tables/batch' && methodUpper === 'POST') {
      const { tableNumbers, floor } = body;
      const floorValue = floor || 'Floor 1';
      for (const num of tableNumbers) {
        await db.query('INSERT OR IGNORE INTO tables (hotel_id, table_number, floor) VALUES ($1, $2, $3)', [user.hotel_id, num, floorValue]);
      }
      return { status: 201, data: { message: 'Tables created securely' } };
    }

    if (path.startsWith('/tables/') && path.split('/').length === 3 && methodUpper === 'PUT') {
      const tableId = parseInt(path.split('/')[2]);
      const { table_number, capacity, floor } = body;
      const res = await db.query(
        'UPDATE tables SET table_number = $1, capacity = $2, floor = $3 WHERE id = $4 AND hotel_id = $5 RETURNING *',
        [table_number, capacity, floor, tableId, user.hotel_id]
      );
      if (res.rows.length === 0) return { status: 404, data: { message: 'Table not found' } };
      return { status: 200, data: res.rows[0] };
    }

    if (path.startsWith('/tables/') && methodUpper === 'DELETE') {
      // If delete table bill rollback
      if (path.includes('/bill/')) {
        const billId = parseInt(path.split('/')[4]);
        const billCheck = await db.query('SELECT order_id FROM bills WHERE id = $1', [billId]);
        if (billCheck.rows.length === 0) return { status: 404, data: { message: 'Bill not found' } };
        const orderId = billCheck.rows[0].order_id;
        
        await db.query('DELETE FROM bills WHERE id = $1', [billId]);
        await db.query("UPDATE orders SET status = 'active' WHERE id = $1", [orderId]);
        return { status: 200, data: { message: 'Bill rolled back, order is active again' } };
      }

      if (path.split('/').length === 3) {
        const tableId = parseInt(path.split('/')[2]);
        await db.query('DELETE FROM tables WHERE id = $1 AND hotel_id = $2', [tableId, user.hotel_id]);
        return { status: 200, data: { message: 'Table deleted' } };
      }
    }

    if (path.startsWith('/tables/') && path.endsWith('/order') && methodUpper === 'GET') {
      const tableId = parseInt(path.split('/')[2]);
      const orderRes = await db.query("SELECT * FROM orders WHERE table_id = $1 AND status = 'active'", [tableId]);
      
      if (orderRes.rows.length === 0) {
        return { status: 200, data: { order: null, items: [] } };
      }

      const order = orderRes.rows[0];
      const itemsRes = await db.query(
        `SELECT oi.id, oi.order_id, oi.menu_item_id, oi.quantity, mi.name, mi.price
         FROM order_items oi
         JOIN menu_items mi ON oi.menu_item_id = mi.id
         WHERE oi.order_id = $1
         ORDER BY oi.created_at ASC`,
        [order.id]
      );
      return { status: 200, data: { order, items: itemsRes.rows } };
    }

    if (path.startsWith('/tables/') && path.endsWith('/order') && methodUpper === 'POST') {
      const tableId = parseInt(path.split('/')[2]);
      const { menuItemId, quantity } = body;

      let orderRes = await db.query("SELECT id FROM orders WHERE table_id = $1 AND status = 'active'", [tableId]);
      let orderId;
      
      if (orderRes.rows.length === 0) {
        const insertOrder = await db.query(
          "INSERT INTO orders (table_id, status, source) VALUES ($1, 'active', 'admin') RETURNING id",
          [tableId]
        );
        orderId = insertOrder.rows[0].id;
      } else {
        orderId = orderRes.rows[0].id;
      }

      const existingItem = await db.query(
        "SELECT id, quantity FROM order_items WHERE order_id = $1 AND menu_item_id = $2",
        [orderId, menuItemId]
      );

      if (existingItem.rows.length > 0) {
        await db.query(
          "UPDATE order_items SET quantity = quantity + $1 WHERE id = $2",
          [quantity, existingItem.rows[0].id]
        );
      } else {
        await db.query(
          "INSERT INTO order_items (order_id, menu_item_id, quantity) VALUES ($1, $2, $3)",
          [orderId, menuItemId, quantity]
        );
      }

      const updatedItems = await db.query(
        `SELECT oi.*, mi.name, mi.price FROM order_items oi 
         JOIN menu_items mi ON oi.menu_item_id = mi.id 
         WHERE oi.order_id = $1 ORDER BY oi.created_at ASC`,
        [orderId]
      );

      return { status: 200, data: { items: updatedItems.rows } };
    }

    if (path.startsWith('/tables/') && path.includes('/order/items/') && methodUpper === 'PUT') {
      const tableId = parseInt(path.split('/')[2]);
      const orderItemId = parseInt(path.split('/')[5]);
      const { quantity } = body;

      await db.query(`
        UPDATE order_items 
        SET quantity = $1 
        WHERE id = $2 
           OR (order_id IN (SELECT id FROM orders WHERE table_id = $3 AND status = 'active') AND menu_item_id = $2)
      `, [quantity, orderItemId, tableId]);

      return { status: 200, data: { message: 'Quantity updated' } };
    }

    if (path.startsWith('/tables/') && path.includes('/order/items/') && methodUpper === 'DELETE') {
      const tableId = parseInt(path.split('/')[2]);
      const orderItemId = parseInt(path.split('/')[5]);

      let itemQuery = await db.query('SELECT id, order_id FROM order_items WHERE id = $1', [orderItemId]);
      if (itemQuery.rows.length === 0) {
        itemQuery = await db.query(
          "SELECT id, order_id FROM order_items WHERE menu_item_id = $1 AND order_id IN (SELECT id FROM orders WHERE table_id = $2 AND status = 'active')",
          [orderItemId, tableId]
        );
      }

      if (itemQuery.rows.length === 0) return { status: 404, data: { message: 'Item not found' } };
      const actualItemId = itemQuery.rows[0].id;
      const orderId = itemQuery.rows[0].order_id;

      await db.query('DELETE FROM order_items WHERE id = $1', [actualItemId]);

      const remainingQuery = await db.query('SELECT count(*) as count FROM order_items WHERE order_id = $1', [orderId]);
      const hasRemaining = remainingQuery.rows[0].count > 0;

      if (!hasRemaining) {
        await db.query('DELETE FROM orders WHERE id = $1', [orderId]);
        return { status: 200, data: { items: [], order_deleted: true } };
      }

      const updatedItems = await db.query(
        `SELECT oi.*, mi.name, mi.price FROM order_items oi 
         JOIN menu_items mi ON oi.menu_item_id = mi.id 
         WHERE oi.order_id = $1 ORDER BY oi.created_at ASC`,
        [orderId]
      );

      return { status: 200, data: { items: updatedItems.rows, order_deleted: false } };
    }

    if (path.startsWith('/tables/') && path.endsWith('/order/kot') && methodUpper === 'POST') {
      const tableId = parseInt(path.split('/')[2]);
      const { waiter, notes } = body;

      const [hotelRes, tableRes, orderRes] = await Promise.all([
        db.query('SELECT billing_method FROM hotels WHERE id = $1', [user.hotel_id]),
        db.query('SELECT table_number, floor FROM tables WHERE id = $1', [tableId]),
        db.query(`
          SELECT o.id as order_id, oi.quantity, oi.printed_quantity, mi.name
          FROM orders o
          JOIN order_items oi ON oi.order_id = o.id
          JOIN menu_items mi ON oi.menu_item_id = mi.id
          WHERE o.table_id = $1 AND o.status = 'active'
        `, [tableId])
      ]);

      if (orderRes.rows.length === 0) {
        return { status: 404, data: { message: 'No active order to print' } };
      }

      const printItems = orderRes.rows
        .filter(item => item.quantity > (item.printed_quantity || 0))
        .map(item => ({
          name: item.name,
          quantity: item.quantity - (item.printed_quantity || 0)
        }));

      if (printItems.length === 0) {
        return { status: 200, data: { success: false, message: 'No new items added to cart' } };
      }

      const orderId = orderRes.rows[0].order_id;
      const finalWaiter = waiter || 'Owner';

      // Update order details
      await db.query(
        "UPDATE orders SET waiter_name = $1, guest_note = $2, is_prepared = 0, kot_sent_at = CURRENT_TIMESTAMP WHERE id = $3", 
        [finalWaiter, notes || '', orderId]
      );

      // Update printed quantities
      await db.query("UPDATE order_items SET printed_quantity = quantity WHERE order_id = $1", [orderId]);

      // Emit client-side Bluetooth print payload
      const printPayload = {
        type: 'KOT',
        table: tableRes.rows[0]?.table_number || tableId.toString(),
        floor: tableRes.rows[0]?.floor || '',
        waiter: finalWaiter,
        items: printItems,
        notes: notes || ''
      };
      
      // We trigger the local window printing/Bluetooth spoler via listener in Profile/Dashboard.
      // Store in window for UI to pick up and print
      window.dispatchEvent(new CustomEvent('print-job-triggered', { detail: printPayload }));

      return { status: 200, data: { success: true, message: 'KOT printed successfully' } };
    }

    if (path.startsWith('/tables/') && path.endsWith('/swap') && methodUpper === 'POST') {
      const tableId = parseInt(path.split('/')[2]);
      const { targetTableId } = body;

      const sourceOrder = await db.query('SELECT id FROM orders WHERE table_id = $1 AND status = $2', [tableId, 'active']);
      if (sourceOrder.rows.length === 0) return { status: 400, data: { message: 'No active order to swap' } };

      const targetOrder = await db.query('SELECT id FROM orders WHERE table_id = $1 AND status = $2', [targetTableId, 'active']);
      if (targetOrder.rows.length > 0) return { status: 400, data: { message: 'Target table is busy' } };

      await db.query('UPDATE orders SET table_id = $1 WHERE id = $2', [targetTableId, sourceOrder.rows[0].id]);
      return { status: 200, data: { message: 'Table successfully swapped' } };
    }

    if (path.startsWith('/tables/') && path.endsWith('/bill') && methodUpper === 'POST') {
      const tableId = parseInt(path.split('/')[2]);
      const { discount_percentage } = body;

      const [hotelRes, tableRes, orderRes] = await Promise.all([
        db.query('SELECT name, phone, location, gst_percentage FROM hotels WHERE id = $1', [user.hotel_id]),
        db.query('SELECT table_number FROM tables WHERE id = $1', [tableId]),
        db.query(`
          SELECT o.id as order_id, oi.quantity, mi.name, mi.price, mi.id as menu_item_id
          FROM orders o
          JOIN order_items oi ON oi.order_id = o.id
          JOIN menu_items mi ON oi.menu_item_id = mi.id
          WHERE o.table_id = $1 AND o.status = 'active'
        `, [tableId])
      ]);

      if (orderRes.rows.length === 0) {
        return { status: 404, data: { message: 'No active order' } };
      }

      const orderId = orderRes.rows[0].order_id;
      const hotel = hotelRes.rows[0] || {};
      const gstRate = parseFloat(hotel.gst_percentage || 0);

      const subtotal = orderRes.rows.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const gst = subtotal * (gstRate / 100);
      const initialTotal = subtotal + gst;
      const discount = parseFloat(discount_percentage) || 0;
      const finalAmount = initialTotal - (initialTotal * (discount / 100));

      // Deduct stock from inventory
      try {
        await deductStockForOrder(orderId, user.hotel_id);
      } catch (e) {
        console.warn('[STOCK DEDUCTION NOTE]', e.message);
      }

      const billRes = await db.query(
        `INSERT INTO bills (order_id, total_amount, gst, final_amount, discount_percentage) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id, order_id, total_amount, gst, final_amount, discount_percentage`,
        [orderId, subtotal, gst, finalAmount, discount]
      );

      const newBill = billRes.rows[0] || {};

      await db.query("UPDATE orders SET status = 'completed' WHERE id = $1", [orderId]);

      const responsePayload = {
        ...newBill,
        subtotal: subtotal,
        total_amount: finalAmount,
        gst_percentage: gstRate,
        items: orderRes.rows,
        hotel_name: hotel.name || 'BestBill Hotel',
        hotel_phone: hotel.phone || '',
        hotel_location: hotel.location || ''
      };

      return { status: 200, data: responsePayload };
    }

    if (path.startsWith('/tables/bill/') && path.endsWith('/pay') && methodUpper === 'PUT') {
      const billId = parseInt(path.split('/')[3]);
      const { method } = body;

      const result = await db.query(
        'UPDATE bills SET is_paid = 1, payment_method = $1 WHERE id = $2 RETURNING *',
        [method, billId]
      );
      if (result.rows.length === 0) return { status: 404, data: { message: 'Bill record not found' } };
      return { status: 200, data: { success: true, bill: result.rows[0] } };
    }

    if (path.startsWith('/tables/') && path.endsWith('/bill/send') && methodUpper === 'POST') {
      return { status: 200, data: { success: true, message: 'SMS mock sent' } };
    }

    // ----------------------------------------
    // MENU ROUTES
    // ----------------------------------------
    if (path === '/menu/categories' && methodUpper === 'GET') {
      const cats = await db.query('SELECT * FROM categories WHERE hotel_id = $1 AND is_deleted = 0 ORDER BY name ASC', [user.hotel_id]);
      return { status: 200, data: cats.rows };
    }

    if (path === '/menu/categories' && methodUpper === 'POST') {
      const { name } = body;
      await db.query('INSERT INTO categories (hotel_id, name) VALUES ($1, $2)', [user.hotel_id, name]);
      return { status: 201, data: { message: 'Category added' } };
    }

    if (path.startsWith('/menu/categories/') && methodUpper === 'PUT') {
      const id = parseInt(path.split('/')[3]);
      const { name } = body;
      await db.query('UPDATE categories SET name = $1 WHERE id = $2 AND hotel_id = $3', [name, id, user.hotel_id]);
      return { status: 200, data: { message: 'Category updated' } };
    }

    if (path.startsWith('/menu/categories/') && methodUpper === 'DELETE') {
      const id = parseInt(path.split('/')[3]);
      await db.query('UPDATE categories SET is_deleted = 1 WHERE id = $2 AND hotel_id = $3', [id, user.hotel_id]);
      return { status: 200, data: { message: 'Category deleted' } };
    }

    if (path === '/menu/items' && methodUpper === 'GET') {
      const { page, limit = 10, search = '' } = queryParams;
      const hotelId = user?.hotel_id || 1;
      
      let itemsRes;
      if (search) {
        itemsRes = await db.query(
          `SELECT mi.*, c.name as category_name 
           FROM menu_items mi 
           LEFT JOIN categories c ON mi.category_id = c.id
           WHERE (mi.hotel_id = $1 OR mi.hotel_id = 1) AND mi.is_deleted = 0 AND (mi.name LIKE $2 OR c.name LIKE $3)
           ORDER BY c.name ASC, mi.name ASC`,
          [hotelId, `%${search}%`, `%${search}%`]
        );
      } else {
        itemsRes = await db.query(
          `SELECT mi.*, c.name as category_name 
           FROM menu_items mi 
           LEFT JOIN categories c ON mi.category_id = c.id
           WHERE (mi.hotel_id = $1 OR mi.hotel_id = 1) AND mi.is_deleted = 0
           ORDER BY c.name ASC, mi.name ASC`,
          [hotelId]
        );
      }

      if (itemsRes.rows.length === 0) {
        itemsRes = await db.query(
          `SELECT mi.*, c.name as category_name 
           FROM menu_items mi 
           LEFT JOIN categories c ON mi.category_id = c.id
           WHERE mi.is_deleted = 0
           ORDER BY mi.name ASC`
        );
      }

      if (page !== undefined) {
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10;
        const totalItems = itemsRes.rows.length;
        const totalPages = Math.ceil(totalItems / limitNum) || 1;
        const offset = (pageNum - 1) * limitNum;
        const pagedRows = itemsRes.rows.slice(offset, offset + limitNum);

        return {
          status: 200,
          data: {
            items: pagedRows,
            totalPages: totalPages,
            currentPage: pageNum,
            totalItems: totalItems
          }
        };
      }
      
      return { status: 200, data: itemsRes.rows };
    }

    if (path === '/menu/items' && methodUpper === 'POST') {
      const { category_id, name, price, description, is_available } = body;
      await db.query(
        'INSERT INTO menu_items (hotel_id, category_id, name, price, description, is_available) VALUES ($1, $2, $3, $4, $5, $6)',
        [user.hotel_id, category_id, name, price, description, is_available ? 1 : 0]
      );
      return { status: 201, data: { message: 'Item created' } };
    }

    if (path.startsWith('/menu/items/') && methodUpper === 'PUT') {
      const id = parseInt(path.split('/')[3]);
      const { category_id, name, price, description, is_available } = body;
      await db.query(
        'UPDATE menu_items SET category_id = $1, name = $2, price = $3, description = $4, is_available = $5 WHERE id = $6 AND hotel_id = $7',
        [category_id, name, price, description, is_available ? 1 : 0, id, user.hotel_id]
      );
      return { status: 200, data: { message: 'Item updated' } };
    }

    if (path.startsWith('/menu/items/') && methodUpper === 'DELETE') {
      const id = parseInt(path.split('/')[3]);
      await db.query('UPDATE menu_items SET is_deleted = 1 WHERE id = $2 AND hotel_id = $3', [id, user.hotel_id]);
      return { status: 200, data: { message: 'Item deleted' } };
    }

    if (path === '/menu/items/bulk' && methodUpper === 'POST') {
      const { items } = body;
      for (const item of items) {
        // Find or create category
        let catId;
        const catRes = await db.query('SELECT id FROM categories WHERE name = $1 AND hotel_id = $2 AND is_deleted = 0', [item.category, user.hotel_id]);
        if (catRes.rows.length > 0) {
          catId = catRes.rows[0].id;
        } else {
          const insertCat = await db.query('INSERT INTO categories (hotel_id, name) VALUES ($1, $2) RETURNING id', [user.hotel_id, item.category]);
          catId = insertCat.rows[0].id;
        }

        // Insert item
        await db.query(
          'INSERT INTO menu_items (hotel_id, category_id, name, price, description) VALUES ($1, $2, $3, $4, $5)',
          [user.hotel_id, catId, item.name, item.price, item.description || '']
        );
      }
      return { status: 200, data: { message: 'Items bulk imported' } };
    }

    if (path === '/menu/purge-all' && methodUpper === 'DELETE') {
      await db.query('UPDATE menu_items SET is_deleted = 1 WHERE hotel_id = $1', [user.hotel_id]);
      await db.query('UPDATE categories SET is_deleted = 1 WHERE hotel_id = $1', [user.hotel_id]);
      return { status: 200, data: { message: 'All menu purged' } };
    }

    // ----------------------------------------
    // BILLS HISTORICAL ROUTES
    // ----------------------------------------
    if (path === '/bills/history' && methodUpper === 'GET') {
      const result = await db.query(`
        SELECT b.*, 
               COALESCE(t.table_number, 'Counter') as table_number
        FROM bills b 
        JOIN orders o ON b.order_id = o.id 
        LEFT JOIN tables t ON o.table_id = t.id
        WHERE t.hotel_id = $1
        ORDER BY b.created_at DESC`,
        [user.hotel_id]
      );
      
      const bills = result.rows;
      for (let b of bills) {
        const itemsRes = await db.query(`
          SELECT oi.quantity, mi.name, mi.price 
          FROM order_items oi 
          JOIN menu_items mi ON oi.menu_item_id = mi.id 
          WHERE oi.order_id = $1`, 
          [b.order_id]
        );
        b.items_json = JSON.stringify(itemsRes.rows);
        b.items = itemsRes.rows;
        b.is_paid = b.is_paid === 1 || b.is_paid === true;
      }

      return { status: 200, data: bills };
    }

    if (path.startsWith('/bills/') && methodUpper === 'GET' && !path.endsWith('/history') && !path.includes('/print') && !path.includes('/pay')) {
      const parts = path.split('/');
      const billId = parseInt(parts[2]);
      if (isNaN(billId)) {
        return { status: 400, data: { message: 'Invalid Bill ID' } };
      }
      const billRes = await db.query(`
        SELECT b.*, o.table_id,
               COALESCE(t.table_number, 'Parcel Counter') as table_number,
               h.name as hotel_name, h.phone as hotel_phone, h.location as hotel_location, h.gst_percentage, h.upi_id, h.fssai_number, h.email as hotel_email
        FROM bills b
        LEFT JOIN orders o ON b.order_id = o.id
        LEFT JOIN tables t ON o.table_id = t.id
        LEFT JOIN hotels h ON h.id = $2 OR h.id = 1
        WHERE b.id = $1`,
        [billId, Number(user?.hotel_id || 1)]
      );

      let bill = billRes.rows[0];
      if (!bill || !bill.id) {
        const fallbackRes = await db.query('SELECT * FROM bills WHERE id = $1', [billId]);
        if (fallbackRes.rows.length === 0) return { status: 404, data: { message: 'Bill not found' } };
        bill = fallbackRes.rows[0];
      }

      const itemsRes = await db.query(`
        SELECT oi.quantity, mi.name, mi.price 
        FROM order_items oi 
        JOIN menu_items mi ON oi.menu_item_id = mi.id 
        WHERE oi.order_id = $1`,
        [bill.order_id]
      );

      return {
        status: 200,
        data: {
          ...bill,
          subtotal: bill.total_amount,
          items: itemsRes.rows,
          parsedItems: itemsRes.rows,
          is_paid: bill.is_paid === 1 || bill.is_paid === true
        }
      };
    }

    if (path.startsWith('/bills/') && path.endsWith('/print') && methodUpper === 'POST') {
      const billId = parseInt(path.split('/')[2]);
      const { paymentMethod } = body || {};

      const billRes = await db.query(`
        SELECT b.*, o.table_id,
               h.name as hotel_name, h.phone as hotel_phone, h.location as hotel_location, h.gst_percentage, h.upi_id, h.printer_size, h.fssai_number, h.email as hotel_email
        FROM bills b
        JOIN orders o ON b.order_id = o.id
        LEFT JOIN tables t ON o.table_id = t.id
        JOIN hotels h ON h.id = $2
        WHERE b.id = $1`,
        [billId, Number(user.hotel_id)]
      );

      if (billRes.rows.length === 0) return { status: 404, data: { message: 'Bill not found' } };
      const bill = billRes.rows[0];

      const itemsRes = await db.query(`
        SELECT oi.quantity, mi.name, mi.price 
        FROM order_items oi 
        JOIN menu_items mi ON oi.menu_item_id = mi.id 
        WHERE oi.order_id = $1`,
        [bill.order_id]
      );

      let tableName = 'Counter';
      if (bill.table_id) {
        const tableQuery = await db.query('SELECT table_number, floor FROM tables WHERE id = $1', [bill.table_id]);
        if (tableQuery.rows[0]) tableName = `Table ${tableQuery.rows[0].table_number} (${tableQuery.rows[0].floor})`;
      }

      const showUPI = (bill.is_paid === 0 || bill.is_paid === false) && (paymentMethod === 'upi' || bill.payment_method === 'upi');

      const printPayload = {
        type: 'FINAL_BILL',
        billId: bill.id,
        table: tableName,
        subtotal: bill.total_amount,
        gst: bill.gst,
        finalAmount: bill.final_amount,
        discountPercentage: bill.discount_percentage,
        items: itemsRes.rows.map(i => ({ name: i.name, price: i.price, qty: i.quantity })),
        hotelName: bill.hotel_name,
        hotelPhone: bill.hotel_phone,
        hotelLocation: bill.hotel_location,
        upiId: showUPI ? (bill.upi_id || '') : '',
        isPaid: bill.is_paid === 1 || bill.is_paid === true,
        gst_percentage: bill.gst_percentage,
        printerSize: localStorage.getItem('cfg_printer_size') || '80mm'
      };

      // Trigger Bluetooth receipt spoler
      window.dispatchEvent(new CustomEvent('print-job-triggered', { detail: printPayload }));

      return { status: 200, data: { success: true, message: 'Print job emitted locally' } };
    }

    if ((path.includes('/bill/') || path.includes('/bills/')) && path.endsWith('/pay') && methodUpper === 'PUT') {
      const parts = path.split('/');
      const billId = parseInt(parts[parts.length - 2]);
      const { method } = body || {};
      await db.query('UPDATE bills SET is_paid = 1, payment_method = $1 WHERE id = $2', [method || 'cash', billId]);
      return { status: 200, data: { success: true } };
    }

    // ----------------------------------------
    // ----------------------------------------
    // CREDIT ROUTES (REWRITTEN FOR MOBILE APP MATCH)
    // ----------------------------------------
    if (path === '/credit/dashboard' && methodUpper === 'GET') {
      const totalRes = await db.query("SELECT SUM(amount) as sum FROM credits WHERE hotel_id = $1 AND status = 'pending'", [user.hotel_id]);
      const custRes = await db.query("SELECT SUM(amount) as sum FROM credits WHERE hotel_id = $1 AND status = 'pending' AND party_type = 'customer'", [user.hotel_id]);
      const vendRes = await db.query("SELECT SUM(amount) as sum FROM credits WHERE hotel_id = $1 AND status = 'pending' AND party_type = 'vendor'", [user.hotel_id]);
      const settledRes = await db.query("SELECT SUM(amount) as sum FROM credits WHERE hotel_id = $1 AND status = 'settled'", [user.hotel_id]);
      return {
        status: 200,
        data: {
          totalOutstandingAmount: Number(totalRes.rows[0]?.sum || 0),
          customerOutstandingAmount: Number(custRes.rows[0]?.sum || 0),
          vendorOutstandingAmount: Number(vendRes.rows[0]?.sum || 0),
          totalSettledAmount: Number(settledRes.rows[0]?.sum || 0)
        }
      };
    }

    if (path === '/credit/transactions' && methodUpper === 'GET') {
      const credits = await db.query(
        `SELECT c.*, b.created_at as bill_date, s.name as vendor_name, s.phone as vendor_phone
         FROM credits c
         LEFT JOIN bills b ON c.bill_id = b.id
         LEFT JOIN suppliers s ON c.vendor_id = s.id
         WHERE c.hotel_id = $1 ORDER BY c.created_at DESC`,
        [user.hotel_id]
      );
      return { status: 200, data: credits.rows.map(c => ({ ...c, amount: Number(c.amount) })) };
    }


    if (path.startsWith('/credit/transactions/') && methodUpper === 'GET' && !path.endsWith('/settle')) {
      const creditId = parseInt(path.split('/')[3]);
      const creditRes = await db.query(
        `SELECT c.*, s.name as vendor_name, s.phone as vendor_phone, s.gst_number as vendor_gst
         FROM credits c
         LEFT JOIN suppliers s ON c.vendor_id = s.id
         WHERE c.id = $1 AND c.hotel_id = $2`,
        [creditId, user.hotel_id]
      );
      if (creditRes.rows.length === 0) return { status: 404, data: { error: 'Not found' } };
      
      const credit = creditRes.rows[0];
      let bill = null;
      let items = [];
      
      if (credit.bill_id) {
        const billRes = await db.query('SELECT * FROM bills WHERE id = $1', [credit.bill_id]);
        if (billRes.rows.length > 0) {
          bill = billRes.rows[0];
          const itemsRes = await db.query(
            `SELECT oi.quantity, mi.name, mi.price 
             FROM order_items oi 
             JOIN menu_items mi ON oi.menu_item_id = mi.id 
             WHERE oi.order_id = $1`, 
             [bill.order_id]
          );
          items = itemsRes.rows;
        }
      }
      return { status: 200, data: { credit, bill, items } };
    }

    if ((path === '/credit/save' || path === '/credit/transactions') && methodUpper === 'POST') {
      const { bill_id, party_type, amount, vendor_id, customer_name, customer_phone } = body;
      await db.query(
        `INSERT INTO credits (hotel_id, bill_id, party_type, vendor_id, customer_name, customer_phone, amount, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [user.hotel_id, bill_id || null, party_type, vendor_id || null, customer_name || null, customer_phone || null, amount, 'pending']
      );

      if (bill_id) {
        await db.query('UPDATE bills SET payment_method = \'credit\', is_paid = 0 WHERE id = $1', [bill_id]);
      }
      return { status: 200, data: { success: true } };
    }

    if (path.startsWith('/credit/transactions/') && path.endsWith('/settle') && methodUpper === 'POST') {
      const creditId = parseInt(path.split('/')[3]);
      const { method } = body;
      await db.query(
        'UPDATE credits SET status = \'settled\', settled_at = CURRENT_TIMESTAMP, settlement_payment_method = $1 WHERE id = $2 AND hotel_id = $3',
        [method, creditId, user.hotel_id]
      );
      return { status: 200, data: { success: true } };
    }

    if (path === '/credit/vendors' && methodUpper === 'GET') {
      const suppliers = await db.query('SELECT * FROM suppliers WHERE hotel_id = $1 ORDER BY name ASC', [user.hotel_id]);
      return { status: 200, data: suppliers.rows };
    }

    if (path === '/credit/vendors' && methodUpper === 'POST') {
      const { name, phone, email, gstin, gst_number, address } = body;
      const gst = gstin || gst_number || null;
      const res = await db.query(
        'INSERT INTO suppliers (hotel_id, name, phone, email, address, gst_number) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [user.hotel_id, name, phone || null, email || null, address || null, gst]
      );
      return { status: 201, data: res.rows[0] };
    }

    if (path.startsWith('/credit/vendors/') && methodUpper === 'PUT') {
      const vendorId = parseInt(path.split('/')[3]);
      const { name, phone, email, gstin, gst_number, address } = body;
      const gst = gstin || gst_number || null;
      await db.query(
        'UPDATE suppliers SET name = $1, phone = $2, email = $3, address = $4, gst_number = $5 WHERE id = $6 AND hotel_id = $7',
        [name, phone || null, email || null, address || null, gst, vendorId, user.hotel_id]
      );
      return { status: 200, data: { id: vendorId, name, phone, email, address, gst_number: gst } };
    }

    if (path.startsWith('/credit/vendors/') && methodUpper === 'DELETE') {
      const vendorId = parseInt(path.split('/')[3]);
      await db.query('DELETE FROM suppliers WHERE id = $1 AND hotel_id = $2', [vendorId, user.hotel_id]);
      return { status: 200, data: { success: true } };
    }

    // ----------------------------------------
    // INVENTORY ROUTES (REWRITTEN FOR MOBILE APP MATCH)
    // ----------------------------------------
    if (path === '/inventory/dashboard' && methodUpper === 'GET') {
      const totalRes = await db.query('SELECT count(*) as count FROM inventory_items WHERE hotel_id = $1', [user.hotel_id]);
      const lowRes = await db.query('SELECT count(*) as count FROM inventory_items WHERE hotel_id = $1 AND current_stock <= minimum_stock', [user.hotel_id]);
      const valRes = await db.query('SELECT SUM(current_stock * purchase_rate) as total FROM inventory_items WHERE hotel_id = $1', [user.hotel_id]);
      const count = Number(totalRes.rows[0]?.count || 0);
      const lowCount = Number(lowRes.rows[0]?.count || 0);
      return {
        status: 200,
        data: {
          totalItems: count,
          totalIngredients: count,
          lowStockItems: lowCount,
          inventoryValue: Number(valRes.rows[0]?.total || 0)
        }
      };
    }

    if (path === '/inventory/items' && methodUpper === 'GET') {
      const items = await db.query(
        `SELECT ii.*, ic.name as category_name
         FROM inventory_items ii
         LEFT JOIN inventory_categories ic ON ii.category_id = ic.id
         WHERE ii.hotel_id = $1 ORDER BY ii.name ASC`,
        [user.hotel_id]
      );
      return { status: 200, data: items.rows.map(i => ({ ...i, current_stock: Number(i.current_stock), minimum_stock: Number(i.minimum_stock), purchase_rate: Number(i.purchase_rate) })) };
    }

    if (path === '/inventory/items' && methodUpper === 'POST') {
      const { name, category_id, unit, minimum_stock, purchase_rate, current_stock } = body;
      const res = await db.query(
        'INSERT INTO inventory_items (hotel_id, name, category_id, unit, minimum_stock, purchase_rate, current_stock) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [user.hotel_id, name, category_id || null, unit || null, minimum_stock || 0, purchase_rate || 0, current_stock || 0]
      );
      return { status: 201, data: res.rows[0] };
    }

    if (path.startsWith('/inventory/items/') && methodUpper === 'PUT') {
      const itemId = parseInt(path.split('/')[3]);
      const { name, category_id, unit, minimum_stock, purchase_rate, current_stock } = body;
      await db.query(
        'UPDATE inventory_items SET name = $1, category_id = $2, unit = $3, minimum_stock = $4, purchase_rate = $5, current_stock = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 AND hotel_id = $8',
        [name, category_id || null, unit || null, minimum_stock || 0, purchase_rate || 0, current_stock || 0, itemId, user.hotel_id]
      );
      return { status: 200, data: { success: true } };
    }

    if (path.startsWith('/inventory/items/') && methodUpper === 'DELETE') {
      const itemId = parseInt(path.split('/')[3]);
      await db.query('DELETE FROM inventory_items WHERE id = $1 AND hotel_id = $2', [itemId, user.hotel_id]);
      return { status: 200, data: { success: true } };
    }

    if (path === '/inventory/categories' && methodUpper === 'GET') {
      const cats = await db.query('SELECT * FROM inventory_categories WHERE hotel_id = $1 ORDER BY name ASC', [user.hotel_id]);
      return { status: 200, data: cats.rows };
    }

    if (path === '/inventory/categories' && methodUpper === 'POST') {
      const { id, name } = body;
      if (id) {
        await db.query('UPDATE inventory_categories SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND hotel_id = $3', [name, id, user.hotel_id]);
        return { status: 200, data: { success: true } };
      } else {
        await db.query('INSERT INTO inventory_categories (hotel_id, name) VALUES ($1, $2)', [user.hotel_id, name]);
        return { status: 201, data: { success: true } };
      }
    }

    if (path.startsWith('/inventory/categories/') && methodUpper === 'DELETE') {
      const id = parseInt(path.split('/')[3]);
      await db.query('DELETE FROM inventory_categories WHERE id = $1 AND hotel_id = $2', [id, user.hotel_id]);
      return { status: 200, data: { success: true } };
    }

    if (path === '/inventory/recipes' && methodUpper === 'GET') {
      const res = await db.query(`
        SELECT r.*, mi.name as product_name
        FROM recipes r
        JOIN menu_items mi ON r.product_id = mi.id
        WHERE r.hotel_id = $1
      `, [user.hotel_id]);
      return { status: 200, data: res.rows };
    }

    if (path.startsWith('/inventory/recipes/product/') && methodUpper === 'GET') {
      const productId = parseInt(path.split('/')[4]);
      const recipeRes = await db.query('SELECT * FROM recipes WHERE product_id = $1 AND hotel_id = $2', [productId, user.hotel_id]);
      if (recipeRes.rows.length === 0) {
        return { status: 200, data: [] };
      }
      const recipeId = recipeRes.rows[0].id;
      const itemsRes = await db.query(`
        SELECT ri.*, ii.name as ingredient_name, ii.unit
        FROM recipe_items ri
        JOIN inventory_items ii ON ri.inventory_item_id = ii.id
        WHERE ri.recipe_id = $1
      `, [recipeId]);
      return { status: 200, data: itemsRes.rows.map(ri => ({ ...ri, quantity_required: Number(ri.quantity_required) })) };
    }

    if (path === '/inventory/recipes' && methodUpper === 'POST') {
      const { product_id, items } = body;
      const existing = await db.query('SELECT id FROM recipes WHERE product_id = $1 AND hotel_id = $2', [product_id, user.hotel_id]);
      if (existing.rows.length > 0) {
        await db.query('DELETE FROM recipe_items WHERE recipe_id = $1', [existing.rows[0].id]);
        await db.query('DELETE FROM recipes WHERE id = $1', [existing.rows[0].id]);
      }
      const recipeRes = await db.query('INSERT INTO recipes (hotel_id, product_id) VALUES ($1, $2) RETURNING id', [user.hotel_id, product_id]);
      const recipeId = recipeRes.rows[0].id;
      for (const ri of items) {
        await db.query('INSERT INTO recipe_items (recipe_id, inventory_item_id, quantity_required) VALUES ($1, $2, $3)', [recipeId, ri.inventory_item_id, ri.quantity_required]);
      }
      return { status: 200, data: { success: true } };
    }

    if (path === '/inventory/adjustments' && methodUpper === 'POST') {
      const { inventory_item_id, physical_stock, remarks } = body;
      const itemRes = await db.query('SELECT unit, current_stock FROM inventory_items WHERE id = $1 AND hotel_id = $2', [inventory_item_id, user.hotel_id]);
      if (itemRes.rows.length === 0) return { status: 404, data: { message: 'Item not found' } };
      const current = itemRes.rows[0].current_stock;
      const diff = physical_stock - current;
      await db.query('UPDATE inventory_items SET current_stock = $1 WHERE id = $2 AND hotel_id = $3', [physical_stock, inventory_item_id, user.hotel_id]);
      if (diff !== 0) {
        await db.query(
          `INSERT INTO stock_transactions (hotel_id, inventory_item_id, transaction_type, quantity, reference_type, reference_id, remarks) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [user.hotel_id, inventory_item_id, 'ADJUSTMENT', diff, 'stock_adjustments', null, remarks || 'Physical Stock Adjustment']
        );
      }
      return { status: 200, data: { success: true } };
    }

    if (path === '/inventory/reports/transactions' && methodUpper === 'GET') {
      const ledger = await db.query(
        `SELECT st.*, ii.name as item_name, ii.unit
         FROM stock_transactions st
         JOIN inventory_items ii ON st.inventory_item_id = ii.id
         WHERE st.hotel_id = $1 ORDER BY st.created_at DESC LIMIT 500`,
        [user.hotel_id]
      );
      return { status: 200, data: ledger.rows.map(st => ({ ...st, quantity: Number(st.quantity) })) };
    }

    // ----------------------------------------
    // HOTEL PROFILE & CONFIGURATION ROUTES
    // ----------------------------------------
    if (path === '/hotel' && methodUpper === 'GET') {
      const hotel = await db.query('SELECT * FROM hotels WHERE id = $1', [user.hotel_id]);
      return { status: 200, data: hotel.rows[0] || {} };
    }

    if (path === '/hotel' && methodUpper === 'PUT') {
      const { name, phone, location, address, upi_id, gst_percentage, fssai_number, email } = body;
      const loc = location || address || '';
      await db.query(
        'UPDATE hotels SET name = $1, phone = $2, location = $3, upi_id = $4, gst_percentage = $5, fssai_number = $6, email = $7 WHERE id = $8',
        [name, phone, loc, upi_id, gst_percentage, fssai_number || null, email || null, user.hotel_id]
      );
      return { status: 200, data: { success: true, name, phone, location: loc, upi_id, gst_percentage, fssai_number, email } };
    }

    if (path === '/hotel/waiters' && methodUpper === 'GET') {
      const waiters = await db.query('SELECT * FROM users WHERE hotel_id = $1 AND role = $2', [user.hotel_id, 'waiter']);
      return { status: 200, data: waiters.rows };
    }

    if (path === '/hotel/waiters' && methodUpper === 'POST') {
      const { name, email, password } = body;
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.query(
        'INSERT INTO users (name, email, password, role, hotel_id) VALUES ($1, $2, $3, $4, $5)',
        [name, email, hashedPassword, 'waiter', user.hotel_id]
      );
      return { status: 200, data: { success: true } };
    }

    if (path.startsWith('/hotel/waiters/') && methodUpper === 'DELETE') {
      const id = parseInt(path.split('/')[3]);
      await db.query('DELETE FROM users WHERE id = $1 AND hotel_id = $2 AND role = \'waiter\'', [id, user.hotel_id]);
      return { status: 200, data: { success: true } };
    }

    // Settings Configuration Toggles
    if (path === '/hotel/lodging-status') return { status: 200, data: { enabled: false } };
    if (path === '/hotel/kot-status') return { status: 200, data: { enabled: false } };
    if (path === '/hotel/simple-kot-status') return { status: 200, data: { enabled: false } };
    
    if (path === '/hotel/whatsapp-billing-status') {
      return { status: 200, data: { enabled: localStorage.getItem('cfg_whatsapp_billing') === 'true' } };
    }
    if (path === '/hotel/inventory-status') {
      return { status: 200, data: { enabled: localStorage.getItem('cfg_inventory') !== 'false' } };
    }
    if (path === '/hotel/token-counter-status') {
      return { status: 200, data: { enabled: localStorage.getItem('cfg_token_counter') === 'true' } };
    }

    if (path === '/hotel/toggle-lodging') {
      return { status: 400, data: { message: 'Lodging configuration is not supported on mobile.' } };
    }

    if (path === '/hotel/toggle-kot') {
      const { enabled, passcode } = body;
      if (passcode !== '556677' && passcode !== '981267') {
        return { status: 400, data: { message: 'Incorrect activation passcode for KOT Module (Default: 556677)' } };
      }
      localStorage.setItem('cfg_kot', enabled ? 'true' : 'false');
      return { status: 200, data: { success: true } };
    }

    if (path === '/hotel/toggle-simple-kot') {
      const { enabled, passcode } = body;
      if (passcode !== '778899' && passcode !== '981267') {
        return { status: 400, data: { message: 'Incorrect activation passcode for Simple KOT (Default: 778899)' } };
      }
      localStorage.setItem('cfg_simple_kot', enabled ? 'true' : 'false');
      return { status: 200, data: { success: true } };
    }

    if (path === '/hotel/toggle-whatsapp-billing') {
      const { enabled, passcode } = body;
      if (passcode !== '445566' && passcode !== '981267') {
        return { status: 400, data: { message: 'Incorrect activation passcode for WhatsApp Billing (Default: 445566)' } };
      }
      localStorage.setItem('cfg_whatsapp_billing', enabled ? 'true' : 'false');
      return { status: 200, data: { success: true } };
    }
    if (path === '/hotel/toggle-inventory') {
      const { enabled, passcode } = body;
      if (passcode !== '112233' && passcode !== '981267') {
        return { status: 400, data: { message: 'Incorrect activation passcode for Inventory (Default: 112233)' } };
      }
      localStorage.setItem('cfg_inventory', enabled ? 'true' : 'false');
      return { status: 200, data: { success: true } };
    }
    if (path === '/hotel/toggle-token-counter') {
      const { enabled, passcode } = body;
      if (passcode !== '332211' && passcode !== '981267') {
        return { status: 400, data: { message: 'Incorrect activation passcode for Token Counter (Default: 332211)' } };
      }
      localStorage.setItem('cfg_token_counter', enabled ? 'true' : 'false');
      return { status: 200, data: { success: true } };
    }

    if (path === '/hotel/installed-printers') {
      // Mock: no windows drivers on mobile
      return { status: 200, data: [] };
    }

    if (path === '/hotel/printers-config') {
      const billingPrinter = localStorage.getItem('cfg_bluetooth_mac') || '';
      const billingSize = localStorage.getItem('cfg_printer_size') || '80mm';
      return {
        status: 200,
        data: {
          printers: {
            billing: { connectionType: 'bluetooth', deviceName: billingPrinter, paperSize: billingSize }
          }
        }
      };
    }

    if (path === '/hotel/printers-config' && methodUpper === 'POST') {
      // Used to change printer configurations
      const { printers } = body;
      if (printers?.billing) {
        localStorage.setItem('cfg_bluetooth_mac', printers.billing.deviceName || '');
        localStorage.setItem('cfg_printer_size', printers.billing.paperSize || '80mm');
      }
      return { status: 200, data: { success: true } };
    }

    if (path === '/profile' && methodUpper === 'PUT') {
      const { name, email, password } = body;
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query('UPDATE users SET name = $1, email = $2, password = $3 WHERE id = $4', [name, email, hashedPassword, user.id]);
      } else {
        await db.query('UPDATE users SET name = $1, email = $2 WHERE id = $3', [name, email, user.id]);
      }
      return { status: 200, data: { success: true } };
    }

    // Default Fallback
    console.warn(`[LOCAL ROUTER] Route not found: ${methodUpper} ${path}`);
    return { status: 404, data: { message: 'Route not found' } };

  } catch (err) {
    console.error(`[LOCAL ROUTER ERROR] ${methodUpper} ${path}:`, err);
    return { status: 500, data: { message: `Local processing failed: ${err.message}`, error: err.message } };
  }
}
