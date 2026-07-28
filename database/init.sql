CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  phone VARCHAR(24),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(140) NOT NULL UNIQUE,
  category VARCHAR(60) NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  image_url TEXT NOT NULL,
  in_stock BOOLEAN NOT NULL DEFAULT true,
  dimensions VARCHAR(60) NOT NULL,
  badge VARCHAR(40) DEFAULT ''
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  total_amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  payment_type VARCHAR(50),
  payment_screenshot_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price_at_purchase NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO products (name, category, description, price, image_url, in_stock, dimensions)
VALUES
  ('Ember Dawn Painting', 'Paintings', 'A vibrant acrylic painting inspired by Malawi sunsets.', 34000, 'https://images.unsplash.com/photo-1544785349-c4a5301826fd?w=800&h=600&fit=crop', true, '80x60cm'),
  ('Ink Flow Drawing', 'Drawings', 'Hand-drawn charcoal piece with graceful linework.', 22000, 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=600&fit=crop', true, '50x70cm'),
  ('Tribal Tee', 'T-Shirts', 'Soft cotton t-shirt featuring local motif prints.', 16000, 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=800&h=600&fit=crop', true, 'S-XL'),
  ('Bronze Essence Sculpture', 'Sculptures', 'A small cast bronze sculpture with natural texture.', 68000, 'https://images.unsplash.com/photo-1496317899792-9d7dbcd928a1?w=800&h=600&fit=crop', true, '18x12x9cm'),
  ('Sunrise Print', 'Prints', 'Limited edition fine art print on heavyweight paper.', 12000, 'https://images.unsplash.com/photo-1481349518771-20055b2a7b24?w=800&h=600&fit=crop', true, '30x40cm')
ON CONFLICT (name) DO NOTHING;
