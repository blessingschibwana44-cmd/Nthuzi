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

  function getStoredUser() {
    try {
      var stored = localStorage.getItem('mthunziAuthUser');
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (error) {
      return null;
    }
  }

  function isSignedIn() {
    return !!getStoredUser();
  }

  function getCartStorageKey() {
    var user = getStoredUser();
    return user && user.id ? 'mthunziCart:' + String(user.id) : 'mthunziCart:guest';
  }

  function getCartItems() {
    var user = getStoredUser();
    var key = getCartStorageKey();
    var legacyKey = 'mthunziCart';
    try {
      var cart = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(cart) && cart.length) return cart;
      var legacyCart = JSON.parse(localStorage.getItem(legacyKey) || '[]');
      if (Array.isArray(legacyCart) && legacyCart.length) {
        if (user && user.id) localStorage.setItem(key, JSON.stringify(legacyCart));
        return legacyCart;
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  function saveCartItems(items) {
    localStorage.setItem(getCartStorageKey(), JSON.stringify(items));
  }

  function requireAuth(message) {
    if (isSignedIn()) return true;
    var redirectTarget = window.location.pathname + window.location.search;
    localStorage.setItem('mthunziAuthRedirect', redirectTarget);
    showToast(message || 'Please sign in to continue.');
    window.location.href = 'login.html';
    return false;
  }

  function closeMobileMenu() {
    var menu = document.getElementById('mobileMenu');
    if (menu) {
      menu.classList.remove('open');
      menu.setAttribute('aria-hidden', 'true');
    }
  }

  function updateCartButtonVisibility() {
    var cartBtn = document.getElementById('btnCart');
    if (!cartBtn) return;
    var cartItems = getCartItems();
    var count = cartItems.reduce(function(total, item) {
      return total + (Number(item.qty) || Number(item.quantity) || 0);
    }, 0);
    cartBtn.style.display = isSignedIn() ? 'flex' : 'none';
    var badge = document.getElementById('cartBadge');
    if (badge) badge.textContent = count;
  }

  function ensureMobileLogoutButton() {
    return;
  }

  function logoutUser() {
    var user = getStoredUser();
    if (user && user.id) {
      localStorage.removeItem('mthunziCart:' + String(user.id));
    }
    localStorage.removeItem('mthunziCart');
    localStorage.removeItem('mthunziCart:guest');
    localStorage.removeItem('mthunziAuthUser');
    localStorage.removeItem('mthunziAuthRedirect');
    updateAuthHeader(null);
    showToast('You have logged out.');
  }

  function updateAuthHeader(user) {
    var isSignedIn = !!user;
    var signInBtn = document.getElementById('btnSignIn');
    var signUpBtn = document.getElementById('btnSignUp');
    var accountBtn = document.getElementById('btnAccount');
    var logoutBtn = document.getElementById('btnLogout');
    var mobileSignIn = document.getElementById('mBtnSignIn');
    var mobileSignUp = document.getElementById('mBtnSignUp');
    var mobileAccount = document.getElementById('mBtnAccount');
    var mobileLogout = document.getElementById('mBtnLogout');

    if (signInBtn) signInBtn.style.display = isSignedIn ? 'none' : '';
    if (signUpBtn) signUpBtn.style.display = isSignedIn ? 'none' : '';
    if (accountBtn) {
      accountBtn.style.display = isSignedIn ? '' : 'none';
      accountBtn.textContent = isSignedIn && user.name ? 'Hi ' + user.name.split(' ')[0] : 'Account';
    }
    if (logoutBtn) logoutBtn.style.display = isSignedIn ? '' : 'none';
    if (mobileSignIn) mobileSignIn.style.display = isSignedIn ? 'none' : '';
    if (mobileSignUp) mobileSignUp.style.display = isSignedIn ? 'none' : '';
    if (mobileAccount) {
      mobileAccount.style.display = isSignedIn ? '' : 'none';
      mobileAccount.textContent = 'Account settings';
    }
    if (mobileLogout) mobileLogout.style.display = isSignedIn ? '' : 'none';

    updateCartButtonVisibility();
  }

  function initAuthHeader() {
    updateAuthHeader(getStoredUser());
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
    var cart = getCartItems();
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
            saveCartItems(cart);
            renderCart();
            updateCartBadge();
          }
        });
      });
      item.querySelector('.cart-item-remove').addEventListener('click', function() {
        cart = cart.filter(function(i) { return i.id !== product.id; });
        saveCartItems(cart);
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
    var cart = getCartItems();
    var cartBadge = document.getElementById('cartBadge');
    if (cartBadge) cartBadge.textContent = cart.reduce(function(s, i) { return s + i.qty; }, 0);
    updateCartButtonVisibility();
  }

  function renderProducts(items) {
    if (!prodGrid) return;
    if (!items.length) {
      prodGrid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:60px;font-size:18px;color:var(--text-muted);"><i class="fas fa-search" style="font-size:40px;margin-bottom:16px;display:block;"></i>No products found.</div>';
      return;
    }
    prodGrid.innerHTML = items.map(function(product) {
      var badgeHtml = product.badge ? '<div class="prod-badge">' + product.badge + '</div>' : '';
      var stockAmount = Number(product.stock || 0);
      var stockLabel = stockAmount <= 0 ? 'Out of stock' : (stockAmount < 5 ? 'Low stock' : 'High stock');
      var stockClass = stockAmount <= 0 ? 'low-stock' : (stockAmount < 5 ? 'low-stock' : 'in-stock');
      return '' +
        '<article class="prod-card" data-id="' + product.id + '">' +
          badgeHtml +
          '<div class="prod-img" style="background-image:url(\'' + product.img + '\');"></div>' +
          '<div class="prod-info">' +
            '<div class="prod-cat">' + product.cat + '</div>' +
            '<h3 class="prod-name">' + product.name + '</h3>' +
            '<div class="prod-dimensions">' + product.dimensions + '</div>' +
            '<div class="stock-status ' + stockClass + '">' + stockLabel + ' · ' + stockAmount + ' left</div>' +
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

  var hamburger = document.getElementById('hamburger');
  var mobileMenu = document.getElementById('mobileMenu');
  var mobileClose = document.getElementById('mobileClose');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', function() {
      var isOpen = mobileMenu.classList.toggle('open');
      mobileMenu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    });
  }

  if (mobileClose && mobileMenu) {
    mobileClose.addEventListener('click', function() {
      mobileMenu.classList.remove('open');
      mobileMenu.setAttribute('aria-hidden', 'true');
    });
  }

  document.querySelectorAll('#mobileMenu a, #mobileMenu button').forEach(function(el) {
    el.addEventListener('click', function() {
      if (el.id === 'mBtnLogout') {
        logoutUser();
      } else if (el.id === 'mBtnSignIn') {
        closeMobileMenu();
        window.location.href = 'login.html';
      } else if (el.id === 'mBtnSignUp') {
        closeMobileMenu();
        window.location.href = 'signup.html';
      } else if (el.id === 'mBtnAccount') {
        closeMobileMenu();
        window.location.href = 'account.html';
      } else {
        closeMobileMenu();
      }
    });
  });

  var cartBtn = document.getElementById('btnCart');
  if (cartBtn) {
    cartBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (!requireAuth('Please sign in to view your cart.')) return;
      openModal('cartModal');
    });
  }

  var logoutBtn = document.getElementById('btnLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      logoutUser();
    });
  }

  var mobileLogoutBtn = document.getElementById('mBtnLogout');
  if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener('click', function() {
      closeMobileMenu();
      logoutUser();
    });
  }

  var signInBtn = document.getElementById('btnSignIn');
  if (signInBtn) {
    signInBtn.addEventListener('click', function() {
      window.location.href = 'login.html';
    });
  }

  var signUpBtn = document.getElementById('btnSignUp');
  if (signUpBtn) {
    signUpBtn.addEventListener('click', function() {
      window.location.href = 'signup.html';
    });
  }

  var accountBtn = document.getElementById('btnAccount');
  if (accountBtn) {
    accountBtn.addEventListener('click', function() {
      window.location.href = 'account.html';
    });
  }

  var mobileAccountBtn = document.getElementById('mBtnAccount');
  if (mobileAccountBtn) {
    mobileAccountBtn.addEventListener('click', function() {
      window.location.href = 'account.html';
    });
  }

  var checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', function() {
      if (!requireAuth('Please sign in to continue to payment.')) return;
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
      var cart = getCartItems();
      var existing = cart.find(function(item) { return item.id === productId; });
      if (existing) {
        existing.qty += 1;
      } else {
        cart.push({ id: product.id, name: product.name, img: product.img, price: product.price, qty: 1 });
      }
      saveCartItems(cart);
      showToast(product.name + ' added to cart');
      updateCartBadge();
    }
    if (target.closest('.prod-card') && !target.matches('[data-add]')) {
      var card = target.closest('.prod-card');
      window.location.href = 'product-detail.html?id=' + card.dataset.id;
    }
  });

  async function refreshCategories() {
    try {
      var res = await fetch('/api/site-settings');
      var json = await res.json();
      var categories = Array.isArray(json.data && json.data.categories) ? json.data.categories : [];
      if (categoryFilter) {
        var current = categoryFilter.value;
        categoryFilter.innerHTML = '<option value="All">All categories</option>' + categories.map(function(category) {
          return '<option value="' + category.name + '">' + category.name + '</option>';
        }).join('');
        categoryFilter.value = current && Array.from(categoryFilter.options).some(function(option) { return option.value === current; }) ? current : 'All';
      }
    } catch (error) {
      console.warn('Could not load categories.', error);
    }
  }

  async function refreshProducts() {
    var loaded = await catalog.loadProducts();
    products = loaded;
    applyFilter();
  }

  syncControls();
  refreshCategories();
  initAuthHeader();
  refreshProducts();
  updateCartBadge();
});
