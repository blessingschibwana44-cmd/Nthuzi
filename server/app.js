require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const db = require('./services/db');
const auth = require('./services/auth');
const settingsPath = path.join(__dirname, 'data', 'site-settings.json');

const app = express();

function createDefaultSettings() {
  return {
    storeName: 'Mthunzi Creations',
    storeEmail: 'mthunzicreations@gmail.com',
    storePhone: '+265 881799537',
    storeAddress: 'Lunzu Trading Centre, Off M1 Road, Blantyre.',
    storeDescription: 'Mthunzi Creations is a creative enterprise that offers different artistic services to meet your needs. We do screen printing, painting and drawing, illustrations, sign-writing, art lessons and consultancy. We are known for our best quality work.',
    aboutTitle: 'Mthunzi Born to Create',
    aboutText: 'Mthunzi Creations is a creative enterprise that offers different artistic services to meet your needs. We do screen printing, painting and drawing, illustrations, sign-writing, art lessons and consultancy. We are known for our best quality work.',
    contactHeading: 'We’re here to help you order, enquire, and create with confidence.',
    contactIntro: 'Whether you are looking for a custom piece, a quick order update, or help with payment proof, our team responds quickly and professionally.',
    contactPhone: '+265 881799537',
    contactEmail: 'mthunzicreations@gmail.com',
    contactAddress: 'Lunzu Trading Centre, Off M1 Road, Blantyre.',
    paymentAccountName: 'John Botha',
    paymentAccountNumber: '0880058488',
    paymentReferenceLabel: 'Reference number',
    paymentInstructions: 'Send the money to that number and the account name is John Botha. Please include the reference number in your payment note so we can match it quickly.',
    currency: 'MK — Malawian Kwacha',
    shippingThreshold: 'MK 50,000',
    storeOpen: true,
    lowStockAlerts: true,
    orderNotifications: true,
    categories: [
      { id: 'paintings', name: 'Paintings' },
      { id: 'drawings', name: 'Drawings' },
      { id: 't-shirts', name: 'T-Shirts' },
      { id: 'sculptures', name: 'Sculptures' },
      { id: 'prints', name: 'Prints' }
    ]
  };
}

function normalizeCategory(raw) {
  if (typeof raw === 'string') {
    const name = raw.trim();
    if (!name) return null;
    return { id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), name };
  }
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim();
  if (!name) return null;
  const id = String(raw.id || '').trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return { id, name };
}

function normalizeCategories(rawCategories) {
  const defaults = createDefaultSettings().categories;
  const source = Array.isArray(rawCategories) ? rawCategories : defaults;
  const categories = source.map(normalizeCategory).filter(Boolean);
  return categories.length ? categories : defaults;
}

function readSiteSettings() {
  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    const defaults = createDefaultSettings();
    return {
      ...defaults,
      ...parsed,
      categories: normalizeCategories(parsed && Array.isArray(parsed.categories) ? parsed.categories : defaults.categories)
    };
  } catch (error) {
    return createDefaultSettings();
  }
}

function writeSiteSettings(nextSettings) {
  const defaults = createDefaultSettings();
  const normalized = {
    ...defaults,
    ...nextSettings,
    categories: normalizeCategories(nextSettings && nextSettings.categories)
  };
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(normalized, null, 2));
  return normalized;
}

function ensureSchema() {
  return db.query(`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS badge VARCHAR(40) DEFAULT '';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;
  `);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

function isStrongPassword(value) {
  return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(String(value || ''));
}

function normalizeProductPayload(payload) {
  const next = { ...payload };
  const rawStock = next.stock;
  const normalizedStock = rawStock === undefined || rawStock === null || rawStock === ''
    ? 0
    : Number(rawStock);
  const stockValue = Number.isFinite(normalizedStock) ? Math.max(0, normalizedStock) : 0;
  next.stock = stockValue;
  next.in_stock = next.stock > 0;

  if (typeof next.image_url === 'string' && next.image_url.startsWith('data:image/')) {
    const match = next.image_url.match(/^data:image\/([^;]+);base64,(.+)$/i);
    if (!match) {
      throw new Error('Invalid image data payload.');
    }
    const maxBytes = Number(process.env.MAX_PRODUCT_IMAGE_BYTES || 80 * 1024 * 1024);
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > maxBytes) {
      throw new Error(`Image is too large. Maximum size is ${Math.round(maxBytes / (1024 * 1024))} MB.`);
    }

    const ext = match[1].toLowerCase() || 'png';
    const uploadsDir = path.join(__dirname, '..', 'assets', 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    const fileName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, buffer);
    next.image_url = `/assets/uploads/${fileName}`;
  }
  return next;
}

ensureSchema().catch(err => {
  console.error('Schema initialization failed. Make sure PostgreSQL is running and DATABASE_URL is correct.');
  console.error(err.message || err);
});

function startServer(port) {
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server started on http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`Port ${port} is busy. Trying http://localhost:${nextPort} instead.`);
      if (server.listening) {
        server.close(() => startServer(nextPort));
      } else {
        startServer(nextPort);
      }
    } else {
      console.error(err);
      process.exit(1);
    }
  });
}

if (require.main === module) {
  startServer(Number(process.env.PORT || 3000));
}

module.exports = {
  createDefaultSettings,
  readSiteSettings,
  normalizeProductPayload,
  app
};

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request payload is too large.' });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }
  next(err);
});
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  return express.static(path.join(__dirname, '..', 'frontend'))(req, res, next);
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await db.getProducts();
    res.json({ data: products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to load products.' });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    await db.checkConnection();
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    console.error('Database health check failed:', err.message);
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters and include a letter and number.' });
    }
    const user = await auth.createUser({ name, email, phone, password });
    res.status(201).json({ data: user });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered.' });
    }
    res.status(500).json({ error: 'Unable to create user.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }
    const user = await auth.verifyPassword(email, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid login credentials.' });
    }
    res.json({ data: user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    // Check if admin credentials match hardcoded admin or database admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@mthunzi.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (email === adminEmail && password === adminPassword) {
      return res.json({ 
        data: { 
          id: 1,
          name: 'Admin',
          email: adminEmail,
          token: 'admin-token-' + Date.now()
        } 
      });
    }
    
    res.status(401).json({ error: 'Invalid admin credentials.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

app.get('/api/user/:id', async (req, res) => {
  try {
    const user = await auth.findUserById(parseInt(req.params.id, 10));
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ data: user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to fetch user.' });
  }
});

app.patch('/api/user/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, email, phone, password } = req.body;
    const user = await auth.updateUser({ id, name, email, phone, password });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ data: user });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered.' });
    }
    res.status(500).json({ error: 'Unable to update user.' });
  }
});

// Admin endpoints
app.get('/api/admin/customers', async (req, res) => {
  try {
    const customers = await db.getCustomers();
    res.json({ data: customers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to fetch customers.' });
  }
});

app.get('/api/admin/orders', async (req, res) => {
  try {
    const orders = await db.getOrders();
    res.json({ data: orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to fetch orders.' });
  }
});

app.patch('/api/admin/orders/:id', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Order status is required.' });
    }
    const updated = await db.updateOrderStatus(orderId, status);
    if (!updated) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    res.json({ data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to update order status.' });
  }
});

app.get('/api/admin/messages', async (req, res) => {
  try {
    const messages = await db.getMessages();
    res.json({ data: messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to fetch messages.' });
  }
});

app.post('/api/order', async (req, res) => {
  try {
    const { userId, items, totalAmount, paymentType, screenshotUrl } = req.body;
    if (!userId || !items || !totalAmount) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    const orderId = await db.createOrder({ userId, items, totalAmount, paymentType, screenshot: screenshotUrl });
    res.status(201).json({ data: { id: orderId, message: 'Order created successfully.' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to create order.' });
  }
});

app.post('/api/admin/products', async (req, res) => {
  try {
    const payload = normalizeProductPayload(req.body);
    const product = await db.createProduct(payload);
    res.status(201).json({ data: product });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A product with that name already exists.' });
    }
    res.status(500).json({ error: 'Unable to create product.' });
  }
});

app.delete('/api/admin/products/:id', async (req, res) => {
  try {
    const deleted = await db.deleteProduct(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    res.json({ data: { deleted: true } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to delete product.' });
  }
});

app.patch('/api/admin/products/:id', async (req, res) => {
  try {
    const payload = normalizeProductPayload(req.body);
    const product = await db.updateProduct(req.params.id, payload);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    res.json({ data: product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to update product.' });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, body } = req.body;
    if (!name || !email || !subject || !body) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    const message = await db.createMessage({ name, email, subject, body });
    res.status(201).json({ data: message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to send message.' });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/site-settings', (req, res) => {
  try {
    res.json({ data: readSiteSettings() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to load site settings.' });
  }
});

app.get('/api/categories', (req, res) => {
  try {
    const settings = readSiteSettings();
    res.json({ data: settings.categories || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to load categories.' });
  }
});

app.post('/api/admin/categories', (req, res) => {
  try {
    const name = String(req.body && req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Category name is required.' });
    const current = readSiteSettings();
    const categories = normalizeCategories(current.categories);
    const exists = categories.some(category => category.name.toLowerCase() === name.toLowerCase());
    if (exists) return res.status(409).json({ error: 'Category already exists.' });
    const nextCategory = normalizeCategory(name);
    if (!nextCategory) return res.status(400).json({ error: 'Category name is invalid.' });
    const next = writeSiteSettings({ ...current, categories: [...categories, nextCategory] });
    res.status(201).json({ data: next.categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to create category.' });
  }
});

app.patch('/api/admin/categories/:id', (req, res) => {
  try {
    const id = req.params.id;
    const name = String(req.body && req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Category name is required.' });
    const current = readSiteSettings();
    const categories = normalizeCategories(current.categories);
    const existingIndex = categories.findIndex(category => category.id === id);
    if (existingIndex === -1) return res.status(404).json({ error: 'Category not found.' });
    const nextCategory = normalizeCategory(name);
    if (!nextCategory) return res.status(400).json({ error: 'Category name is invalid.' });
    const duplicate = categories.some(category => category.id !== id && category.name.toLowerCase() === name.toLowerCase());
    if (duplicate) return res.status(409).json({ error: 'Category already exists.' });
    categories[existingIndex] = { ...categories[existingIndex], ...nextCategory };
    const next = writeSiteSettings({ ...current, categories });
    res.json({ data: next.categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to update category.' });
  }
});

app.delete('/api/admin/categories/:id', (req, res) => {
  try {
    const id = req.params.id;
    const current = readSiteSettings();
    const categories = normalizeCategories(current.categories);
    const nextCategories = categories.filter(category => category.id !== id);
    if (nextCategories.length === categories.length) return res.status(404).json({ error: 'Category not found.' });
    const next = writeSiteSettings({ ...current, categories: nextCategories });
    res.json({ data: next.categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to delete category.' });
  }
});

app.put('/api/admin/site-settings', (req, res) => {
  try {
    const current = readSiteSettings();
    const next = writeSiteSettings({ ...current, ...req.body });
    res.json({ data: next });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to save site settings.' });
  }
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route not found.' });
  }
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});
