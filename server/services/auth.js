const bcrypt = require('bcryptjs');
const db = require('./db');

const SALT_ROUNDS = 10;

async function createUser({ name, email, phone, password }) {
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const result = await db.query(
    'INSERT INTO users (name, email, phone, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, name, email, phone, created_at',
    [name, email, phone, hashedPassword]
  );
  return result.rows[0];
}

async function findUserByEmail(email) {
  const result = await db.query('SELECT id, name, email, phone, password_hash FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

async function verifyPassword(email, password) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const hash = user.password_hash || user.passwordHash || user.password;
  if (!hash) return null;
  const match = await bcrypt.compare(password, hash);
  if (!match) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
  };
}

async function findUserById(id) {
  const result = await db.query('SELECT id, name, email, phone, created_at FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function updateUser({ id, name, email, phone, password }) {
  const updates = [];
  const values = [];
  let idx = 1;

  if (name) {
    updates.push(`name = $${idx++}`);
    values.push(name);
  }
  if (email) {
    updates.push(`email = $${idx++}`);
    values.push(email);
  }
  if (phone) {
    updates.push(`phone = $${idx++}`);
    values.push(phone);
  }
  if (password) {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    updates.push(`password_hash = $${idx++}`);
    values.push(passwordHash);
  }

  if (!updates.length) {
    return findUserById(id);
  }

  values.push(id);
  const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, email, phone, created_at`;
  const result = await db.query(query, values);
  return result.rows[0];
}

module.exports = { createUser, findUserByEmail, verifyPassword, findUserById, updateUser };
