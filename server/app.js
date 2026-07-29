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

function readSiteSettings() {
  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

function writeSiteSettings(nextSettings) {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(nextSettings, null, 2));
}

function ensureSchema() {
  return db.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS badge VARCHAR(40) DEFAULT ''");
}

function normalizeProductPayload(payload) {
  const next = { ...payload };
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
  console.error('Schema initialization failed:', err);
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

startServer(Number(process.env.PORT || 3000));

app.use(cors());
app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/api/products', async (req, res) => {
  try {
    const products = await db.getProducts();
    res.json({ data: products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to load products.' });
  }
});

app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
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

app.put('/api/admin/site-settings', (req, res) => {
  try {
    const current = readSiteSettings();
    const next = { ...current, ...req.body };
    writeSiteSettings(next);
    res.json({ data: next });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to save site settings.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});
