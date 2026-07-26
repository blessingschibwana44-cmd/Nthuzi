document.addEventListener('DOMContentLoaded', function() {
  var products = [];
  var catalog = window.mthunziCatalog || { loadProducts: async function() { return []; }, getProducts: function() { return []; } };
  var prodGrid = document.getElementById('prodGrid');
  var filterLabel = document.getElementById('filterLabel');
  var heroSearch = document.getElementById('heroSearch');
  var searchBtn = document.getElementById('btnSearch');
  var categoryFilter = document.getElementById('categoryFilter');
  var priceFilter = document.getElementById('priceFilter');
  var sortFilter = document.getElementById('sortFilter');
  var toast = document.getElementById('toast');

  var state = {
    query: getQueryParam('q') || '',
    category: getQueryParam('cat') || 'All',
    price: getQueryParam('price') || 'all',
    sort: getQueryParam('sort') || 'featured'
  };

  function formatPrice(value) {
    return 'MK ' + value.toLocaleString();
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name) || '';
  }

  function updateUrl() {
    var params = new URLSearchParams();
    if (state.query) params.set('q', state.query);
    if (state.category && state.category !== 'All') params.set('cat', state.category);
    if (state.price && state.price !== 'all') params.set('price', state.price);
    if (state.sort && state.sort !== 'featured') params.set('sort', state.sort);
    var query = params.toString();
    var nextUrl = query ? window.location.pathname + '?' + query : window.location.pathname;
    history.replaceState({}, '', nextUrl);
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(function() {
      toast.classList.remove('show');
    }, 2500);
  }

  function openModal(id) {
    if (id === 'cartModal') renderCart();
    var el = document.getElementById(id);
    if (el) {
      el.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(id) {
    var el = document.getElementById(id);
    if (el) {
      el.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  function renderCart() {
    var cart = JSON.parse(localStorage.getItem('cart') || '[]');
    var cartItems = document.getElementById('cartItems');
    var cartTotalRow = document.getElementById('cartTotalRow');
    var cartTotalAmt = document.getElementById('cartTotalAmt');
    var checkoutBtn = document.getElementById('checkoutBtn');
    if (!cartItems) return;
    cartItems.innerHTML = '';
    if (!cart.length) {
      cartItems.innerHTML = '<div class="cart-empty"><i class="fas fa-shopping-bag" style="font-size:48px;margin-bottom:16px;display:block;"></i>Your cart is empty</div>';
      if (cartTotalRow) cartTotalRow.style.display = 'none';
      if (checkoutBtn) checkoutBtn.style.display = 'none';
      return;
    }
    cart.forEach(function(product) {
      var item = document.createElement('div');
      item.className = 'cart-item';
      item.innerHTML = '<div class="cart-item-img" style="background-image:url(\'' + product.img + '\');"></div><div class="cart-item-info"><div class="cart-item-name">' + product.name + '</div><div class="cart-item-price">' + formatPrice(product.price) + '</div><div class="cart-qty-controls"><button class="cart-qty-btn" data-id="' + product.id + '" data-dir="minus">−</button><span class="cart-qty-num">' + product.qty + '</span><button class="cart-qty-btn" data-id="' + product.id + '" data-dir="plus">+</button></div></div><button class="cart-item-remove" data-id="' + product.id + '"><i class="fas fa-trash-alt"></i></button>';
      item.querySelectorAll('.cart-qty-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var id = parseInt(btn.getAttribute('data-id'));
          var dir = btn.getAttribute('data-dir');
          var cartItem = cart.find(function(i) { return i.id === id; });
          if (cartItem) {
            if (dir === 'plus') cartItem.qty++;
            else if (dir === 'minus' && cartItem.qty > 1) cartItem.qty--;
            else if (dir === 'minus' && cartItem.qty === 1) cart = cart.filter(function(i) { return i.id !== id; });
            localStorage.setItem('cart', JSON.stringify(cart));
            renderCart();
            updateCartBadge();
          }
        });
      });
      item.querySelector('.cart-item-remove').addEventListener('click', function() {
        cart = cart.filter(function(i) { return i.id !== product.id; });
        localStorage.setItem('cart', JSON.stringify(cart));
        renderCart();
        updateCartBadge();
      });
      cartItems.appendChild(item);
    });
    var total = cart.reduce(function(s, i) { return s + i.price * i.qty; }, 0);
    if (cartTotalAmt) cartTotalAmt.textContent = formatPrice(total);
    if (cartTotalRow) cartTotalRow.style.display = 'flex';
    if (checkoutBtn) checkoutBtn.style.display = 'block';
  }

  function updateCartBadge() {
    var cart = JSON.parse(localStorage.getItem('cart') || '[]');
    var cartBadge = document.getElementById('cartBadge');
    if (cartBadge) cartBadge.textContent = cart.reduce(function(s, i) { return s + i.qty; }, 0);
  }

  function renderProducts(items) {
    if (!prodGrid) return;
    if (!items.length) {
      prodGrid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:60px;font-size:18px;color:var(--text-muted);"><i class="fas fa-search" style="font-size:40px;margin-bottom:16px;display:block;"></i>No products found.</div>';
      return;
    }
    prodGrid.innerHTML = items.map(function(product) {
      var badgeHtml = product.badge ? '<div class="prod-badge">' + product.badge + '</div>' : '';
      return '' +
        '<article class="prod-card" data-id="' + product.id + '">' +
          badgeHtml +
          '<div class="prod-img" style="background-image:url(\'' + product.img + '\');"></div>' +
          '<div class="prod-info">' +
            '<div class="prod-cat">' + product.cat + '</div>' +
            '<h3 class="prod-name">' + product.name + '</h3>' +
            '<div class="prod-dimensions">' + product.dimensions + '</div>' +
            '<div class="stock-status ' + (product.stock === 'in-stock' ? 'in-stock' : 'low-stock') + '">' + (product.stock === 'in-stock' ? 'In stock' : 'Low stock') + '</div>' +
            '<div class="prod-footer">' +
              '<span class="prod-price">' + formatPrice(product.price) + '</span>' +
              '<button class="add-cart-btn" data-add="' + product.id + '"><i class="fas fa-shopping-cart"></i> Add</button>' +
            '</div>' +
          '</div>' +
        '</article>';
    }).join('');
  }

  function applyFilter() {
    var filtered = products.slice();
    var label = 'All Products';

    if (state.query) {
      var q = state.query.toLowerCase();
      filtered = filtered.filter(function(p) {
        return p.name.toLowerCase().indexOf(q) > -1 || p.cat.toLowerCase().indexOf(q) > -1;
      });
      label = 'Search: ' + state.query;
    }

    if (state.category && state.category !== 'All') {
      filtered = filtered.filter(function(p) { return p.cat === state.category; });
      label = state.category;
    }

    if (state.price === 'under-10000') {
      filtered = filtered.filter(function(p) { return p.price < 10000; });
    } else if (state.price === '10000-20000') {
      filtered = filtered.filter(function(p) { return p.price >= 10000 && p.price <= 20000; });
    } else if (state.price === '20000-40000') {
      filtered = filtered.filter(function(p) { return p.price > 20000 && p.price <= 40000; });
    } else if (state.price === '40000-plus') {
      filtered = filtered.filter(function(p) { return p.price > 40000; });
    }

    if (state.sort === 'price-asc') {
      filtered.sort(function(a, b) { return a.price - b.price; });
    } else if (state.sort === 'price-desc') {
      filtered.sort(function(a, b) { return b.price - a.price; });
    } else if (state.sort === 'name-asc') {
      filtered.sort(function(a, b) { return a.name.localeCompare(b.name); });
    } else {
      filtered.sort(function(a, b) {
        var aFeatured = a.badge === 'Featured' ? 1 : 0;
        var bFeatured = b.badge === 'Featured' ? 1 : 0;
        return bFeatured - aFeatured;
      });
    }

    if (filterLabel) {
      filterLabel.textContent = label;
    }
    renderProducts(filtered);
  }

  function syncControls() {
    if (heroSearch) heroSearch.value = state.query;
    if (categoryFilter) categoryFilter.value = state.category || 'All';
    if (priceFilter) priceFilter.value = state.price || 'all';
    if (sortFilter) sortFilter.value = state.sort || 'featured';
  }

  function handleSearch() {
    if (!heroSearch) return;
    state.query = heroSearch.value.trim();
    updateUrl();
    applyFilter();
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', handleSearch);
  }

  if (heroSearch) {
    heroSearch.addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
        handleSearch();
      }
    });
  }

  if (categoryFilter) {
    categoryFilter.addEventListener('change', function() {
      state.category = categoryFilter.value;
      updateUrl();
      applyFilter();
    });
  }

  if (priceFilter) {
    priceFilter.addEventListener('change', function() {
      state.price = priceFilter.value;
      updateUrl();
      applyFilter();
    });
  }

  if (sortFilter) {
    sortFilter.addEventListener('change', function() {
      state.sort = sortFilter.value;
      updateUrl();
      applyFilter();
    });
  }

  var cartBtn = document.getElementById('btnCart');
  if (cartBtn) {
    cartBtn.addEventListener('click', function() {
      openModal('cartModal');
    });
  }

  var checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', function() {
      window.location.href = 'payment.html';
    });
  }

  document.querySelectorAll('[data-close]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      closeModal(btn.getAttribute('data-close'));
    });
  });

  document.querySelectorAll('.overlay').forEach(function(el) {
    el.addEventListener('click', function(e) {
      if (e.target === el) closeModal(el.id);
    });
  });

  document.body.addEventListener('click', function(event) {
    var target = event.target;
    if (target.matches('[data-add]')) {
      var productId = Number(target.dataset.add);
      var product = products.find(function(item) { return item.id === productId; });
      if (!product) return;
      var cart = JSON.parse(localStorage.getItem('cart') || '[]');
      var existing = cart.find(function(item) { return item.id === productId; });
      if (existing) {
        existing.qty += 1;
      } else {
        cart.push({ id: product.id, name: product.name, img: product.img, price: product.price, qty: 1 });
      }
      localStorage.setItem('cart', JSON.stringify(cart));
      showToast(product.name + ' added to cart');
      updateCartBadge();
    }
    if (target.closest('.prod-card') && !target.matches('[data-add]')) {
      var card = target.closest('.prod-card');
      window.location.href = 'product-detail.html?id=' + card.dataset.id;
    }
  });

  async function refreshProducts() {
    var loaded = await catalog.loadProducts();
    products = loaded;
    applyFilter();
  }

  syncControls();
  refreshProducts();
  updateCartBadge();
});
