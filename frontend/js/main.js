const defaultProducts = [
  {
    id: 1,
    name: 'Ember Dawn Painting',
    category: 'Paintings',
    description: 'A vibrant acrylic painting inspired by Malawi sunsets.',
    price: 34000,
    image: 'https://images.unsplash.com/photo-1544785349-c4a5301826fd?w=800&h=600&fit=crop',
    stocked: true,
    dims: '80x60cm',
  },
  {
    id: 2,
    name: 'Ink Flow Drawing',
    category: 'Drawings',
    description: 'Hand-drawn charcoal piece with graceful linework.',
    price: 22000,
    image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=600&fit=crop',
    stocked: true,
    dims: '50x70cm',
  },
  {
    id: 3,
    name: 'Tribal Tee',
    category: 'T-Shirts',
    description: 'Soft cotton t-shirt featuring local motif prints.',
    price: 16000,
    image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=800&h=600&fit=crop',
    stocked: true,
    dims: 'S-XL',
  },
  {
    id: 4,
    name: 'Bronze Essence Sculpture',
    category: 'Sculptures',
    description: 'A small cast bronze sculpture with natural texture.',
    price: 68000,
    image: 'https://images.unsplash.com/photo-1496317899792-9d7dbcd928a1?w=800&h=600&fit=crop',
    stocked: true,
    dims: '18x12x9cm',
  },
  {
    id: 5,
    name: 'Sunrise Print',
    category: 'Prints',
    description: 'Limited edition fine art print on heavyweight paper.',
    price: 12000,
    image: 'https://images.unsplash.com/photo-1481349518771-20055b2a7b24?w=800&h=600&fit=crop',
    stocked: true,
    dims: '30x40cm',
  },
];

let products = [...defaultProducts];
const cart = [];

async function loadProducts() {
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Network response was not ok');
    const result = await response.json();
    if (Array.isArray(result.data) && result.data.length) {
      products = result.data;
    }
  } catch (error) {
    console.warn('API product load failed, using fallback products.', error);
  }
}

const prodGrid = document.getElementById('prodGrid');
const cartBadge = document.getElementById('cartBadge');
const cartItems = document.getElementById('cartItems');
const cartTotalRow = document.getElementById('cartTotalRow');
const cartTotalAmt = document.getElementById('cartTotalAmt');
const toast = document.getElementById('toast');
const detailImg = document.getElementById('detailImg');
const detailName = document.getElementById('detailName');
const detailCat = document.getElementById('detailCat');
const detailDimensions = document.getElementById('detailDimensions');
const detailPrice = document.getElementById('detailPrice');
const detailDesc = document.getElementById('detailDesc');
const detailStock = document.getElementById('detailStock');
const detailAddBtn = document.getElementById('detailAddBtn');

let selectedProduct = null;

function formatPrice(value) {
  return `MK ${value.toLocaleString()}`;
}

function updateCartCount() {
  cartBadge.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function renderProducts(items) {
  prodGrid.innerHTML = items
    .map(product => `
      <article class="prod-card" data-id="${product.id}">
        <div class="prod-img" style="background-image:url('${product.image}')"></div>
        <div class="prod-info">
          <div class="prod-cat">${product.category}</div>
          <h3 class="prod-name">${product.name}</h3>
          <div class="prod-dimensions">${product.dims}</div>
          <div class="stock-status ${product.stocked ? 'in-stock' : 'low-stock'}">${product.stocked ? 'In stock' : 'Limited stock'}</div>
          <div class="prod-footer">
            <span class="prod-price">${formatPrice(product.price)}</span>
            <button class="add-cart-btn" data-add="${product.id}">Add</button>
          </div>
        </div>
      </article>`)
    .join('');
}

function renderCartItems() {
  if (!cart.length) {
    cartItems.innerHTML = '<div class="cart-empty">Your cart is empty.</div>';
    cartTotalRow.style.display = 'none';
    return;
  }

  cartItems.innerHTML = cart
    .map(item => `
      <div class="cart-item">
        <div class="cart-item-img" style="background-image:url('${item.image}')"></div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">${formatPrice(item.price)} x ${item.quantity}</div>
          <div class="cart-qty-controls">
            <button class="cart-qty-btn" data-change="${item.id}" data-delta="-1">-</button>
            <span class="cart-qty-num">${item.quantity}</span>
            <button class="cart-qty-btn" data-change="${item.id}" data-delta="1">+</button>
            <button class="cart-item-remove" data-remove="${item.id}">Remove</button>
          </div>
        </div>
      </div>`)
    .join('');

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  cartTotalAmt.textContent = formatPrice(total);
  cartTotalRow.style.display = 'flex';
}

function addToCart(productId) {
  const product = products.find(p => p.id === Number(productId));
  if (!product) return;

  const existing = cart.find(item => item.id === product.id);
  if (existing) existing.quantity += 1;
  else cart.push({ ...product, quantity: 1 });

  updateCartCount();
  renderCartItems();
  showToast(`${product.name} added to cart`);
}

function changeCartQuantity(productId, delta) {
  const item = cart.find(p => p.id === Number(productId));
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    const index = cart.indexOf(item);
    cart.splice(index, 1);
  }
  updateCartCount();
  renderCartItems();
}

function openProductDetail(productId) {
  selectedProduct = products.find(p => p.id === Number(productId));
  if (!selectedProduct) return;
  detailImg.style.backgroundImage = `url('${selectedProduct.image}')`;
  detailName.textContent = selectedProduct.name;
  detailCat.textContent = selectedProduct.category;
  detailDimensions.textContent = selectedProduct.dims;
  detailPrice.textContent = formatPrice(selectedProduct.price);
  detailDesc.textContent = selectedProduct.description;
  detailStock.textContent = selectedProduct.stocked ? 'In stock' : 'Limited stock';
  detailStock.className = `stock-status ${selectedProduct.stocked ? 'in-stock' : 'low-stock'}`;
  openModal('prodModal');
}

function setupEvents() {
  document.body.addEventListener('click', event => {
    const target = event.target;

    if (target.matches('[data-add]')) addToCart(target.dataset.add);
    if (target.matches('[data-change]')) changeCartQuantity(target.dataset.change, Number(target.dataset.delta));
    if (target.matches('[data-remove]')) changeCartQuantity(target.dataset.remove, -999);
    if (target.closest('.prod-card')) {
      const card = target.closest('.prod-card');
      if (!target.matches('[data-add]')) {
        window.location.href = `product-detail.html?id=${card.dataset.id}`;
      }
    }
    if (target.matches('.modal-close')) closeModal(target.dataset.close);
    if (target.matches('#btnCart')) openModal('cartModal');
    if (target.matches('#btnSearch')) {
      const query = document.getElementById('heroSearch').value.trim().toLowerCase();
      const filtered = products.filter(p => p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query));
      renderProducts(filtered.length ? filtered : products);
      document.getElementById('filterLabel').textContent = query ? `Search: ${query}` : 'All Items';
    }
    if (target.matches('.tag') || target.matches('.footer-cat')) {
      const category = target.dataset.cat;
      const filtered = products.filter(p => p.category === category);
      renderProducts(filtered);
      document.getElementById('filterLabel').textContent = category;
      window.scrollTo({ top: document.getElementById('shop').offsetTop - 90, behavior: 'smooth' });
    }
  });

  detailAddBtn.addEventListener('click', () => {
    if (selectedProduct) {
      addToCart(selectedProduct.id);
      closeModal('prodModal');
    }
  });
}

function init() {
  renderProducts(products);
  updateCartCount();
  renderCartItems();
  setupEvents();
}

init();
