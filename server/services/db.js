const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const defaultConnectionString = process.env.DATABASE_URL || process.env.DB_URL || 'postgres://postgres:postgres@127.0.0.1:5433/mthunzi';

const pool = new Pool({
  connectionString: defaultConnectionString,
});

const productsPath = path.join(__dirname, '..', 'data', 'products.json');

function loadFallbackProducts() {
  try {
    const raw = fs.readFileSync(productsPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveFallbackProducts(products) {
  fs.mkdirSync(path.dirname(productsPath), { recursive: true });
  fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
}

function mapFallbackProduct(product) {
  const image = product.image || product.image_url || '/assets/sample1.jpg';
  const stocked = product.stocked ?? product.in_stock ?? (product.stock === 'in-stock' || product.stock === true);
  const dims = product.dims || product.dimensions || 'N/A';
  const description = product.description || product.desc || '';
  const badge = product.badge || (product.featured ? 'Featured' : '');
  const rawStock = product.stock;
  const resolvedStock = rawStock === undefined || rawStock === null || rawStock === '' ? 0 : Number(rawStock);
  const stock = Number.isFinite(resolvedStock) ? Math.max(0, resolvedStock) : 0;
  return {
    id: Number(product.id ?? 0),
    name: product.name || 'Untitled Product',
    category: product.category || 'Paintings',
    description,
    price: Number(product.price || 0),
    image,
    stocked: stocked !== false && stock > 0,
    dims,
    stock,
    badge,
    featured: badge === 'Featured',
    image_url: image,
    in_stock: stock > 0,
    dimensions: dims,
  };
}

function mapProductRow(row) {
  if (!row) return null;
  const rawStock = row.stock;
  const stock = rawStock === undefined || rawStock === null || rawStock === '' ? 0 : Number(rawStock);
  const safeStock = Number.isFinite(stock) ? Math.max(0, stock) : 0;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    price: Number(row.price),
    image: row.image_url,
    stocked: row.in_stock !== false && safeStock > 0,
    dims: row.dimensions,
    stock: safeStock,
    badge: row.badge || '',
    featured: row.badge === 'Featured',
    image_url: row.image_url,
    in_stock: safeStock > 0,
    dimensions: row.dimensions,
  };
}

function getStockStatus(stock) {
  const amount = Number(stock || 0);
  if (amount <= 0) {
    return { label: 'Out of Stock', cls: 'danger', amount };
  }
  if (amount < 5) {
    return { label: 'Low Stock', cls: 'warning', amount };
  }
  return { label: 'High Stock', cls: 'success', amount };
}

async function query(text, params) {
  return pool.query(text, params);
}

async function checkConnection() {
  await pool.query('SELECT 1');
  return true;
}

async function getProducts() {
  try {
    const result = await query('SELECT id, name, category, description, price, image_url, in_stock, stock, dimensions, badge FROM products ORDER BY id');
    return result.rows.map(mapProductRow);
  } catch (err) {
    console.warn('PostgreSQL unavailable, using local products fallback.', err.message);
    return loadFallbackProducts().map(mapFallbackProduct);
  }
}

async function createProduct(product) {
  const payload = {
    name: product.name,
    category: product.category || 'Paintings',
    description: product.description || '',
    price: Number(product.price || 0),
    image_url: product.image_url || product.image || '/assets/sample1.jpg',
    in_stock: Number(product.stock ?? (product.in_stock !== false ? 10 : 0)) > 0,
    dimensions: product.dimensions || 'N/A',
    stock: Number(product.stock ?? (product.in_stock !== false ? 10 : 0)),
    badge: product.badge || '',
  };

  try {
    const result = await query(
      'INSERT INTO products (name, category, description, price, image_url, in_stock, stock, dimensions, badge) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, name, category, description, price, image_url, in_stock, stock, dimensions, badge',
      [payload.name, payload.category, payload.description, payload.price, payload.image_url, payload.in_stock, payload.stock, payload.dimensions, payload.badge]
    );
    return mapProductRow(result.rows[0]);
  } catch (err) {
    console.warn('PostgreSQL unavailable, writing product to local fallback file.', err.message);
    const products = loadFallbackProducts();
    const nextProduct = {
      id: Date.now(),
      name: payload.name,
      category: payload.category,
      description: payload.description,
      price: payload.price,
      image: payload.image_url,
      stocked: payload.in_stock,
      dims: payload.dimensions,
      stock: payload.stock,
      badge: payload.badge,
      featured: payload.badge === 'Featured',
    };
    products.push(nextProduct);
    saveFallbackProducts(products);
    return mapFallbackProduct(nextProduct);
  }
}

async function updateProduct(id, product) {
  const payload = {
    name: product.name,
    category: product.category || 'Paintings',
    description: product.description || '',
    price: Number(product.price || 0),
    image_url: product.image_url || product.image || '/assets/sample1.jpg',
    in_stock: Number(product.stock ?? (product.in_stock !== false ? 10 : 0)) > 0,
    dimensions: product.dimensions || 'N/A',
    stock: Number(product.stock ?? (product.in_stock !== false ? 10 : 0)),
    badge: product.badge || '',
  };

  try {
    const result = await query(
      'UPDATE products SET name=$1, category=$2, description=$3, price=$4, image_url=$5, in_stock=$6, stock=$7, dimensions=$8, badge=$9 WHERE id=$10 RETURNING id, name, category, description, price, image_url, in_stock, stock, dimensions, badge',
      [payload.name, payload.category, payload.description, payload.price, payload.image_url, payload.in_stock, payload.stock, payload.dimensions, payload.badge, id]
    );
    return mapProductRow(result.rows[0]);
  } catch (err) {
    console.warn('PostgreSQL unavailable, updating local fallback product.', err.message);
    const products = loadFallbackProducts();
    const index = products.findIndex(item => Number(item.id) === Number(id));
    if (index === -1) return null;
    products[index] = {
      ...products[index],
      name: payload.name,
      category: payload.category,
      description: payload.description,
      price: payload.price,
      image: payload.image_url,
      stocked: payload.in_stock,
      dims: payload.dimensions,
      stock: payload.stock,
      badge: payload.badge,
      featured: payload.badge === 'Featured',
    };
    saveFallbackProducts(products);
    return mapFallbackProduct(products[index]);
  }
}

async function deleteProduct(id) {
  try {
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
  } catch (err) {
    console.warn('PostgreSQL unavailable, removing product from local fallback file.', err.message);
    const products = loadFallbackProducts();
    const nextProducts = products.filter(item => Number(item.id) !== Number(id));
    if (nextProducts.length === products.length) return false;
    saveFallbackProducts(nextProducts);
    return true;
  }
}

async function getCustomers() {
  try {
    const result = await query('SELECT id, name, email, phone, created_at FROM users ORDER BY created_at DESC');
    return result.rows;
  } catch (err) {
    console.error('Error fetching customers:', err);
    throw err;
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
    throw err;
  }
}

async function getMessages() {
  try {
    const result = await query('SELECT id, name, email, subject, body, created_at FROM messages ORDER BY created_at DESC');
    return result.rows;
  } catch (err) {
    console.error('Error fetching messages:', err);
    throw err;
  }
}

async function createOrder({ userId, items, totalAmount, paymentType, screenshot }) {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const orderResult = await client.query(
        'INSERT INTO orders (user_id, total_amount, payment_type, payment_screenshot_url, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [userId, totalAmount, paymentType, screenshot, 'pending']
      );
      const orderId = orderResult.rows[0].id;

      for (const item of items) {
        const productResult = await client.query('SELECT stock FROM products WHERE id = $1', [item.product_id]);
        const currentStock = Number(productResult.rows[0]?.stock || 0);
        const orderedQty = Number(item.quantity || 0);
        const nextStock = Math.max(currentStock - orderedQty, 0);

        await client.query(
          'UPDATE products SET stock = $1, in_stock = $1 > 0 WHERE id = $2',
          [nextStock, item.product_id]
        );

        await client.query(
          'INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES ($1, $2, $3, $4)',
          [orderId, item.product_id, orderedQty, item.price]
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
  } catch (err) {
    console.error('Error creating order:', err);
    throw err;
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

module.exports = { query, checkConnection, getProducts, createProduct, updateProduct, deleteProduct, getCustomers, getOrders, getMessages, createOrder, updateOrderStatus, createMessage, getStockStatus };
