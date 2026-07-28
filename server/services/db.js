const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL || 'postgres://postgres:postgres@127.0.0.1:5433/mthunzi',
});

function mapProductRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    price: Number(row.price),
    image: row.image_url,
    stocked: row.in_stock,
    dims: row.dimensions,
    stock: row.in_stock ? 10 : 0,
    badge: row.badge || '',
    featured: row.badge === 'Featured',
  };
}

async function query(text, params) {
  return pool.query(text, params);
}

async function getProducts() {
  const result = await query('SELECT id, name, category, description, price, image_url, in_stock, dimensions, badge FROM products ORDER BY id');
  return result.rows.map(mapProductRow);
}

async function createProduct(product) {
  const payload = {
    name: product.name,
    category: product.category || 'Paintings',
    description: product.description || '',
    price: Number(product.price || 0),
    image_url: product.image_url || '/assets/sample1.jpg',
    in_stock: product.in_stock !== false,
    dimensions: product.dimensions || 'N/A',
    stock: Number(product.stock || 10),
    badge: product.badge || '',
  };

  const result = await query(
    'INSERT INTO products (name, category, description, price, image_url, in_stock, dimensions, badge) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name, category, description, price, image_url, in_stock, dimensions, badge',
    [payload.name, payload.category, payload.description, payload.price, payload.image_url, payload.in_stock, payload.dimensions, payload.badge]
  );
  return mapProductRow(result.rows[0]);
}

async function updateProduct(id, product) {
  const payload = {
    name: product.name,
    category: product.category || 'Paintings',
    description: product.description || '',
    price: Number(product.price || 0),
    image_url: product.image_url || '/assets/sample1.jpg',
    in_stock: product.in_stock !== false,
    dimensions: product.dimensions || 'N/A',
    stock: Number(product.stock || 10),
    badge: product.badge || '',
  };

  const result = await query(
    'UPDATE products SET name=$1, category=$2, description=$3, price=$4, image_url=$5, in_stock=$6, dimensions=$7, badge=$8 WHERE id=$9 RETURNING id, name, category, description, price, image_url, in_stock, dimensions, badge',
    [payload.name, payload.category, payload.description, payload.price, payload.image_url, payload.in_stock, payload.dimensions, payload.badge, id]
  );
  return mapProductRow(result.rows[0]);
}

async function deleteProduct(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM order_items WHERE product_id = $1', [id]);
    const result = await client.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    await client.query('COMMIT');
    return result.rowCount > 0;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getCustomers() {
  try {
    const result = await query('SELECT id, name, email, phone, created_at FROM users ORDER BY created_at DESC');
    return result.rows;
  } catch (err) {
    console.error('Error fetching customers:', err);
    return [];
  }
}

async function getOrders() {
  try {
    const result = await query(`
      SELECT o.id, o.user_id, u.name, u.email, o.total_amount, o.status, o.payment_type, o.payment_screenshot_url, o.created_at,
             oi.product_id, oi.quantity, oi.price_at_purchase, p.name as product_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      ORDER BY o.created_at DESC, oi.id ASC
    `);

    const ordersMap = new Map();
    result.rows.forEach(row => {
      if (!ordersMap.has(row.id)) {
        ordersMap.set(row.id, {
          id: row.id,
          user_id: row.user_id,
          name: row.name,
          email: row.email,
          total_amount: Number(row.total_amount),
          status: row.status,
          payment_type: row.payment_type,
          payment_screenshot_url: row.payment_screenshot_url,
          created_at: row.created_at,
          items: []
        });
      }

      if (row.product_id) {
        ordersMap.get(row.id).items.push({
          product_id: row.product_id,
          name: row.product_name || 'Product',
          qty: row.quantity,
          price: Number(row.price_at_purchase)
        });
      }
    });

    return Array.from(ordersMap.values());
  } catch (err) {
    console.error('Error fetching orders:', err);
    return [];
  }
}

async function getMessages() {
  try {
    const result = await query('SELECT id, name, email, subject, body, created_at FROM messages ORDER BY created_at DESC');
    return result.rows;
  } catch (err) {
    console.error('Error fetching messages:', err);
    return [];
  }
}

async function createOrder({ userId, items, totalAmount, paymentType, screenshot }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderResult = await client.query(
      'INSERT INTO orders (user_id, total_amount, payment_type, payment_screenshot_url, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [userId, totalAmount, paymentType, screenshot, 'pending']
    );
    const orderId = orderResult.rows[0].id;

    for (const item of items) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES ($1, $2, $3, $4)',
        [orderId, item.product_id, item.quantity, item.price]
      );
    }
    await client.query('COMMIT');
    return orderId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateOrderStatus(orderId, status) {
  try {
    const result = await query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, user_id, total_amount, status, payment_type, payment_screenshot_url, created_at', [status, orderId]);
    return result.rows[0] || null;
  } catch (err) {
    console.error('Error updating order status:', err);
    throw err;
  }
}

async function createMessage({ name, email, subject, body }) {
  try {
    const result = await query(
      'INSERT INTO messages (name, email, subject, body) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, email, subject, body]
    );
    return result.rows[0];
  } catch (err) {
    console.error('Error creating message:', err);
    throw err;
  }
}

module.exports = { query, getProducts, createProduct, updateProduct, deleteProduct, getCustomers, getOrders, getMessages, createOrder, updateOrderStatus, createMessage };
