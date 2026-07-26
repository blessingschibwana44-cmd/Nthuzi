(function () {
  function normalizeProduct(product) {
    const id = Number(product.id ?? product.product_id ?? 0);
    const category = product.category || product.cat || 'Paintings';
    const image = product.image || product.img || '/assets/sample1.jpg';
    const stocked = product.stocked ?? product.in_stock ?? (product.stock === 'in-stock' || product.stock === true);
    const dimensions = product.dims || product.dimensions || 'N/A';
    const description = product.description || product.desc || '';

    return {
      ...product,
      id,
      name: product.name || 'Untitled Product',
      category,
      description,
      price: Number(product.price || 0),
      image,
      stocked: stocked !== false,
      dims: dimensions,
      stock: product.stock ?? (stocked ? 'in-stock' : 'low-stock'),
      img: image,
      cat: category,
      dimensions,
      desc: description,
      badge: product.badge || (product.featured ? 'Featured' : '')
    };
  }

  async function loadProducts() {
    try {
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('Network response was not ok');
      const result = await response.json();
      const items = Array.isArray(result.data) ? result.data : [];
      const normalized = items.map(normalizeProduct);
      window.siteProducts = normalized;
      window.mthunziCatalog.products = normalized;
      return normalized;
    } catch (error) {
      console.warn('API product load failed.', error);
      window.siteProducts = [];
      window.mthunziCatalog.products = [];
      return [];
    }
  }

  window.mthunziCatalog = {
    products: [],
    loadProducts,
    getProducts: function () {
      return window.mthunziCatalog.products;
    }
  };
  window.siteProducts = window.mthunziCatalog.products;
})();
