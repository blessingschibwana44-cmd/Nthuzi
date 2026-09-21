const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const auth = require('./auth');
const db = require('./db');

test('login accepts mixed-case email addresses and trims whitespace', async () => {
  const originalQuery = db.query;

  db.query = async (text, params) => {
    if (text.includes('INSERT INTO users')) {
      return {
        rows: [{
          id: 1,
          name: params[0],
          email: params[1].trim().toLowerCase(),
          phone: params[2],
          created_at: new Date().toISOString()
        }]
      };
    }

    if (text.includes('WHERE LOWER(email) = LOWER($1)')) {
      const normalizedEmail = String(params[0]).trim().toLowerCase();
      const hash = await bcrypt.hash('secret123', 10);
      return {
        rows: [{
          id: 1,
          name: 'Test User',
          email: normalizedEmail,
          phone: '123456',
          password_hash: hash
        }]
      };
    }

    return { rows: [] };
  };

  try {
    const created = await auth.createUser({
      name: 'Test User',
      email: ' Test@Example.com ',
      phone: '123456',
      password: 'secret123'
    });

    assert.equal(created.email, 'test@example.com');

    const user = await auth.verifyPassword(' TEST@EXAMPLE.COM ', 'secret123');
    assert.ok(user);
    assert.equal(user.email, 'test@example.com');
    assert.equal(user.name, 'Test User');
  } finally {
    db.query = originalQuery;
  }
});
