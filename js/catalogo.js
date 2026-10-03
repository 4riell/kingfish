// /js/catalogo.js
import { db, auth } from './firebase.js';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// -- CATEGORIAS --
window.loadCategories = function() {
  onSnapshot(collection(db, "categories"), (snapshot) => {
    window.allCategories = [];
    snapshot.forEach(docSnap => { window.allCategories.push({ id: docSnap.id, ...docSnap.data() }); });
    window.renderCategories();
  });
};

window.renderCategories = function() {
  const catalogFilters = document.getElementById("catalog-filters");
  const recipeFilters = document.getElementById("recipe-filters");
  const selectProd = document.getElementById("prod-category");
  const selectRecipe = document.getElementById("recipe-category");
  const listContainer = document.getElementById("category-list");
  
  if (listContainer) {
    listContainer.innerHTML = "";
    window.allCategories.forEach(cat => {
      listContainer.innerHTML += `<li style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee; align-items:center;">
        <strong>${cat.name}</strong><button onclick="deleteCategory('${cat.id}')" style="color:#e74c3c; background:none; border:none; cursor:pointer; font-size:1.1rem;"><i class="fa-solid fa-trash"></i></button></li>`;
    });
  }
  if (catalogFilters) {
    catalogFilters.innerHTML = `<button class="filter-btn active" onclick="filterCategory('todos')">Todos</button><button class="filter-btn" onclick="filterCategory('promocoes')"><i class="fa-solid fa-tag"></i> Promoções</button>`;
    window.allCategories.forEach(cat => catalogFilters.innerHTML += `<button class="filter-btn" onclick="filterCategory('${cat.name}')">${cat.name}</button>`);
  }
  if (recipeFilters) {
    recipeFilters.innerHTML = `<button class="filter-btn active" onclick="filterRecipeCategory('todos')">Todas</button>`;
    window.allCategories.forEach(cat => recipeFilters.innerHTML += `<button class="filter-btn" onclick="filterRecipeCategory('${cat.name}')">${cat.name}</button>`);
  }
  let optionsHTML = `<option value="">Selecione...</option>`;
  window.allCategories.forEach(cat => optionsHTML += `<option value="${cat.name}">${cat.name}</option>`);
  if (selectProd) selectProd.innerHTML = optionsHTML;
  if (selectRecipe) selectRecipe.innerHTML = optionsHTML;
};

window.addCategory = async function() {
  const input = document.getElementById("new-category-name"); const name = input.value.trim();
  if (!name) return;
  try { await addDoc(collection(db, "categories"), { name }); input.value = ""; } catch (error) { alert("Erro: " + error.message); }
};

window.deleteCategory = async function(id) {
  if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;
  try { await deleteDoc(doc(db, "categories", id)); } catch (error) { alert("Erro: " + error.message); }
};

// -- PRODUTOS --
window.loadProducts = function() {
  onSnapshot(collection(db, "products"), (snapshot) => {
    window.allProducts = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.images) data.images = data.image ? [data.image] : ["https://via.placeholder.com/300x200?text=Sem+Imagem"];
      window.allProducts.push({ ...data, id: docSnap.id });
    });
    window.renderProducts(window.allProducts);
  });
};

window.renderProducts = function(products) {
  const container = document.getElementById("products-container");
  if (!container) return;
  container.innerHTML = "";

  let listToRender = window.currentCategory === "todos" ? [...products] : window.currentCategory === "promocoes" ? products.filter(p => p.isOnSale) : products.filter(p => p.category === window.currentCategory);
  listToRender.sort((a, b) => {
    if (a.isOutOfStock && !b.isOutOfStock) return 1; if (!a.isOutOfStock && b.isOutOfStock) return -1;
    if (a.isOnSale && !b.isOnSale) return -1; if (!a.isOnSale && b.isOnSale) return 1; return 0;
  });

  listToRender.forEach((product) => {
    const card = document.createElement("div");
    card.className = `product-card ${product.isOutOfStock ? 'out-of-stock' : ''} ${product.isOnSale ? 'on-sale' : ''}`;
    card.onclick = (e) => {
      if (e.target.closest('.admin-card-actions') || e.target.closest('.add-cart-btn') || e.target.closest('.carousel-btn') || e.target.closest('.carousel-dots')) return;
      window.openProductDetailModal(product.id);
    };

    let imagesList = Array.isArray(product.images) && product.images.length > 0 ? product.images : ["https://via.placeholder.com/300x200?text=Sem+Imagem"];
    const slidesHTML = imagesList.map(img => `<img src="${img}" alt="${product.name}" class="carousel-img">`).join('');
    const hasMultipleImages = imagesList.length > 1;
    const dotsHTML = hasMultipleImages ? `<div class="carousel-dots">${imagesList.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}" onclick="event.stopPropagation(); setCarouselSlide('${product.id}',${i})"></span>`).join('')}</div>` : '';
    const navButtons = hasMultipleImages ? `<button type="button" class="carousel-btn prev" onclick="event.stopPropagation(); moveCarousel('${product.id}', -1)"><i class="fa-solid fa-chevron-left"></i></button><button type="button" class="carousel-btn next" onclick="event.stopPropagation(); moveCarousel('${product.id}', 1)"><i class="fa-solid fa-chevron-right"></i></button>` : '';
    let adminControls = window.isAdminLoggedIn ? `<div class="admin-card-actions" style="display: flex; gap: 8px;"><button class="btn-edit-prod" onclick="event.stopPropagation(); openProductModal('${product.id}')">Editar</button><button class="btn-delete-prod" onclick="event.stopPropagation(); deleteProduct('${product.id}')">Excluir</button></div>` : "";
    
    const buyButton = product.isOutOfStock ? `<button class="add-cart-btn btn-disabled" disabled><i class="fa-solid fa-ban"></i> Esgotado</button>` : `<button class="add-cart-btn" onclick="event.stopPropagation(); addToCart('${product.id}')"><i class="fa-solid fa-plus"></i> Adicionar</button>`;
    
    let priceHTML = ""; let saleBadge = "";
    if (product.isOnSale && product.promoPrice && Number(product.promoPrice) < Number(product.price)) {
      const discountPercent = Math.round(((Number(product.price) - Number(product.promoPrice)) / Number(product.price)) * 100);
      saleBadge = `<span class="badge-on-sale">-${discountPercent}% OFF</span>`;
      priceHTML = `<div class="price-container"><span class="old-price">R$ ${Number(product.price).toFixed(2)}</span><span class="product-price promo">R$ ${Number(product.promoPrice).toFixed(2)} <small>/ ${product.unit}</small></span></div>`;
    } else { priceHTML = `<div class="product-price">R$ ${Number(product.price).toFixed(2)} <small>/ ${product.unit}</small></div>`; }

    card.innerHTML = `<div class="carousel-container" id="carousel-${product.id}" data-index="0" data-total="${imagesList.length}">
        ${product.isOutOfStock ? `<span class="badge-out-of-stock">ESGOTADO</span>` : ''}${saleBadge}
        <div class="carousel-slide" id="slide-${product.id}">${slidesHTML}</div>${navButtons}${dotsHTML}</div>
      <div class="product-info"><h3 class="product-title">${product.name}</h3><p class="product-desc">${product.desc || ''}</p>${priceHTML}${buyButton}${adminControls}</div>`;
    container.appendChild(card);
  });
};

window.filterCategory = function(category) {
  window.currentCategory = category;
  document.querySelectorAll("#sec-catalogo .filter-btn").forEach(btn => btn.classList.remove("active"));
  if (window.event && window.event.currentTarget) window.event.currentTarget.classList.add("active");
  window.renderProducts(window.allProducts);
};

window.openProductModal = function(productId = null) {
  const modal = document.getElementById("admin-modal");
  const form = document.getElementById("product-form");
  if (productId) {
    const prod = window.allProducts.find(p => p.id === productId);
    if (!prod) return;
    document.getElementById("prod-id").value = prod.id; document.getElementById("prod-name").value = prod.name;
    document.getElementById("prod-category").value = prod.category; document.getElementById("prod-price").value = prod.price;
    document.getElementById("prod-promo-price").value = prod.promoPrice || ""; document.getElementById("prod-unit").value = prod.unit;
    document.getElementById("prod-desc").value = prod.desc || ""; document.getElementById("prod-out-of-stock").checked = !!prod.isOutOfStock;
    document.getElementById("prod-on-sale").checked = !!prod.isOnSale; window.currentProductImages = prod.images ? [...prod.images] : [];
  } else {
    if (form) form.reset(); document.getElementById("prod-id").value = ""; window.currentProductImages = [];
  }
  window.togglePromoInput(); window.renderImagePreviews();
  if (modal) modal.classList.add("open");
};

window.closeProductModal = () => document.getElementById("admin-modal")?.classList.remove("open");
window.togglePromoInput = () => { const promoRow = document.getElementById("promo-price-row"); if (promoRow) promoRow.style.display = document.getElementById("prod-on-sale")?.checked ? "flex" : "none"; };

window.handleProductSubmit = async function(e) {
  e.preventDefault();
  if (!auth.currentUser) return alert("Acesso negado.");
  if (window.currentProductImages.length === 0) return alert("Adicione pelo menos uma imagem.");
  
  const isOnSale = document.getElementById("prod-on-sale").checked;
  const promoPriceVal = parseFloat(document.getElementById("prod-promo-price").value);
  if (isOnSale && (isNaN(promoPriceVal) || promoPriceVal <= 0)) return alert("Preço de promoção inválido.");

  const saveBtn = document.getElementById("btn-save-product");
  if (saveBtn) { saveBtn.innerText = "Salvando..."; saveBtn.disabled = true; }

  const id = document.getElementById("prod-id").value;
  const prodData = {
    name: document.getElementById("prod-name").value.toUpperCase(), category: document.getElementById("prod-category").value,
    price: parseFloat(document.getElementById("prod-price").value), promoPrice: isOnSale ? promoPriceVal : null,
    unit: document.getElementById("prod-unit").value, images: window.currentProductImages,
    desc: document.getElementById("prod-desc").value, isOutOfStock: document.getElementById("prod-out-of-stock").checked, isOnSale
  };

  try {
    if (id) await updateDoc(doc(db, "products", id), prodData);
    else await addDoc(collection(db, "products"), prodData);
    alert("Produto salvo com sucesso!"); window.closeProductModal();
  } catch (error) { alert(`Erro: ${error.message}`); } finally { if (saveBtn) { saveBtn.innerText = "Salvar Produto"; saveBtn.disabled = false; } }
};

window.deleteProduct = async function(id) {
  if (!auth.currentUser) return alert("Ação não permitida.");
  if (!confirm("Tem certeza que deseja excluir este produto?")) return;
  try { await deleteDoc(doc(db, "products", id)); alert("Produto removido!"); } catch (error) { alert("Erro: " + error.message); }
};

window.openProductDetailModal = function(productId) {
  const prod = window.allProducts.find(p => p.id === productId); if (!prod) return;
  const modal = document.getElementById("product-detail-modal");
  document.getElementById("modal-product-title").innerText = prod.name; document.getElementById("modal-product-desc").innerText = prod.desc || "Sem descrição disponível.";
  const mediaContainer = document.getElementById("modal-product-media");
  let imagesList = Array.isArray(prod.images) && prod.images.length > 0 ? prod.images : ["https://via.placeholder.com/300x200?text=Sem+Imagem"];
  const slidesHTML = imagesList.map(img => `<img src="${img}" alt="${prod.name}" class="carousel-img" style="object-fit:cover;">`).join('');
  const dotsHTML = imagesList.length > 1 ? `<div class="carousel-dots">${imagesList.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}" onclick="setModalCarouselSlide(${i})"></span>`).join('')}</div>` : '';
  const navButtons = imagesList.length > 1 ? `<button type="button" class="carousel-btn prev" onclick="moveModalCarousel(-1)"><i class="fa-solid fa-chevron-left"></i></button><button type="button" class="carousel-btn next" onclick="moveModalCarousel(1)"><i class="fa-solid fa-chevron-right"></i></button>` : '';

  mediaContainer.innerHTML = `<div class="carousel-container" id="modal-carousel" data-index="0" data-total="${imagesList.length}"><div class="carousel-slide" id="modal-carousel-slide">${slidesHTML}</div>${navButtons}${dotsHTML}</div>`;
  mediaContainer.querySelectorAll('.carousel-img').forEach(img => window.setupImageZoom(img));
  
  const priceContainer = document.getElementById("modal-product-price");
  if (prod.isOnSale && prod.promoPrice && Number(prod.promoPrice) < Number(prod.price)) priceContainer.innerHTML = `<div class="price-container"><span class="old-price">R$ ${Number(prod.price).toFixed(2)}</span><span class="product-price promo">R$ ${Number(prod.promoPrice).toFixed(2)} <small>/ ${prod.unit}</small></span></div>`;
  else priceContainer.innerHTML = `<div class="product-price">R$ ${Number(prod.price).toFixed(2)} <small>/ ${prod.unit}</small></div>`;

  const buyBtn = document.getElementById("modal-product-buy-btn");
  if (prod.isOutOfStock) { buyBtn.className = "add-cart-btn btn-disabled"; buyBtn.disabled = true; buyBtn.innerHTML = `<i class="fa-solid fa-ban"></i> Esgotado`; }
  else { buyBtn.className = "add-cart-btn"; buyBtn.disabled = false; buyBtn.innerHTML = `<i class="fa-solid fa-cart-shopping"></i> Adicionar ao Carrinho`; buyBtn.onclick = () => { window.addToCart(prod.id); window.closeProductDetailModal(); }; }
  modal?.classList.add("open");
};

window.closeProductDetailModal = () => document.getElementById("product-detail-modal")?.classList.remove("open");

// -- CARRINHO E CHECKOUT --
window.addToCart = function(productId) {
  const product = window.allProducts.find(p => p.id === productId);
  if (product && product.isOutOfStock) return alert("Produto esgotado.");
  const finalPrice = (product.isOnSale && product.promoPrice) ? Number(product.promoPrice) : Number(product.price);
  const existingItem = window.cart.find(item => item.id === productId);
  if (existingItem) existingItem.quantity += 1; else window.cart.push({ ...product, price: finalPrice, quantity: 1 });
  window.updateCartUI(); window.toggleCart(true);
};

window.updateQuantity = (index, value) => { window.cart[index].quantity = parseFloat(value) || 1; window.updateCartUI(); };
window.removeFromCart = (index) => { window.cart.splice(index, 1); window.updateCartUI(); };
window.toggleCart = (forceOpen = false) => {
  const sidebar = document.getElementById("cart-sidebar"); const overlay = document.getElementById("cart-overlay");
  if (!sidebar || !overlay) return;
  if (forceOpen || !sidebar.classList.contains("open")) { sidebar.classList.add("open"); overlay.classList.add("open"); } 
  else { sidebar.classList.remove("open"); overlay.classList.remove("open"); }
};

window.toggleDeliveryFields = () => {
  const type = document.getElementById("checkout-type")?.value;
  const deliveryFields = document.getElementById("delivery-fields");
  if (deliveryFields) deliveryFields.style.display = type === "entrega" ? "block" : "none";
  window.updateCartUI();
};
window.toggleTrocoField = () => { document.getElementById("troco-group").style.display = document.getElementById("checkout-pagamento")?.value === "dinheiro" ? "block" : "none"; };
window.toggleNoNumber = (checkbox) => { const numInput = document.getElementById("checkout-numero"); if (numInput) { numInput.value = checkbox.checked ? "S/N" : ""; numInput.disabled = checkbox.checked; } };

window.fetchAddressByCEP = async function() {
  const cep = document.getElementById("checkout-cep")?.value.replace(/\D/g, ""); if (cep?.length !== 8) return;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`); const data = await response.json();
    if (data.erro) return alert("CEP não encontrado.");
    document.getElementById("checkout-cidade").value = `${data.localidade} - ${data.uf}`;
    document.getElementById("checkout-bairro").value = data.bairro || ""; document.getElementById("checkout-rua").value = data.logradouro || "";
  } catch (error) { alert("Não foi possível consultar o CEP."); }
};

window.openDeliveryModal = () => { if (window.cart.length === 0) return alert("Seu carrinho está vazio!"); window.toggleCart(false); document.getElementById("delivery-modal")?.classList.add("open"); window.updateCartUI(); };
window.closeDeliveryModal = () => document.getElementById("delivery-modal")?.classList.remove("open");

window.applyDiscountCoupon = async function(couponCode, cartSubtotal) {
  if (!couponCode) return { success: false, message: "Digite um código de cupom." };
  try {
    const q = query(collection(db, "coupons"), where("code", "==", couponCode.toUpperCase().trim()));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return { success: false, message: "Cupom inválido ou não encontrado." };
    const couponData = querySnapshot.docs[0].data();
    if (!couponData.isActive) return { success: false, message: "Este cupom está inativo." };
    if (couponData.minPurchase && cartSubtotal < couponData.minPurchase) return { success: false, message: `Valor mínimo é de R$ ${couponData.minPurchase.toFixed(2)}.` };
    let discountValue = couponData.type === "percent" ? (cartSubtotal * couponData.value) / 100 : couponData.value;
    return { success: true, discount: Math.min(discountValue, cartSubtotal), couponCode: couponData.code, message: `Desconto de R$ ${discountValue.toFixed(2)} aplicado!` };
  } catch (error) { return { success: false, message: "Erro ao validar o cupom." }; }
};

window.sendOrderToWhatsApp = async function() {
  if (window.cart.length === 0) return alert("Carrinho vazio!");
  const deliveryType = document.getElementById("checkout-type")?.value;
  let deliveryDetails = ""; const taxaDelivery = deliveryType === "entrega" ? 5.00 : 0;
  if (deliveryType === "entrega") {
    const cep = document.getElementById("checkout-cep")?.value.trim(); const cidade = document.getElementById("checkout-cidade")?.value.trim();
    const bairro = document.getElementById("checkout-bairro")?.value.trim(); const rua = document.getElementById("checkout-rua")?.value.trim();
    const numero = document.getElementById("checkout-numero")?.value.trim(); const referencia = document.getElementById("checkout-referencia")?.value.trim();
    if (!cep || !cidade || !bairro || !rua || !numero || !referencia) return alert("Preencha todos os campos obrigatórios.");
    deliveryDetails = `\n*Tipo:* Entrega\n*CEP:* ${cep}\n*Cidade:* ${cidade}\n*Bairro:* ${bairro}\n*Rua:* ${rua}, Nº ${numero}\n*Ref:* ${referencia}`;
  } else { deliveryDetails = `\n*Tipo:* Retirada no Balcão`; }

  const pagamento = document.getElementById("checkout-pagamento")?.value.toUpperCase();
  const troco = document.getElementById("checkout-troco")?.value.trim();
  if (!pagamento) return alert("Selecione a forma de pagamento.");
  if (pagamento === "DINHEIRO" && !troco) return alert("Informe se precisa de troco.");

  let itemsSubtotal = window.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  let discountAmount = 0; let activeCoupon = null;
  const couponInput = document.getElementById("coupon-input")?.value;
  if (couponInput) {
    const couponResult = await window.applyDiscountCoupon(couponInput, itemsSubtotal);
    if (couponResult.success) { discountAmount = couponResult.discount; activeCoupon = couponResult.couponCode; } else return alert(couponResult.message);
  }

  const totalGeral = (itemsSubtotal - discountAmount) + taxaDelivery;
  if (window.saveOrderToClientAccount) await window.saveOrderToClientAccount(window.cart, totalGeral, deliveryType, discountAmount, activeCoupon);

  let message = "*NOVO PEDIDO*\n\n*ITENS:*\n" + window.cart.map(i => `• *${i.name}* - Qtd: ${i.quantity} ${i.unit} | R$ ${(i.price * i.quantity).toFixed(2)}\n`).join('');
  message += `\nSubtotal: R$ ${itemsSubtotal.toFixed(2)}`;
  if (discountAmount > 0) message += `\nDesconto: -R$ ${discountAmount.toFixed(2)}`;
  if (taxaDelivery > 0) message += `\nTaxa de Entrega: R$ ${taxaDelivery.toFixed(2)}`;
  message += `\n*Total:* R$ ${totalGeral.toFixed(2)}\n\n*ENTREGA:*${deliveryDetails}\n\n*PAGAMENTO:*\n*Forma:* ${pagamento}`;
  if (pagamento === "DINHEIRO" && troco) message += `\n*Troco para:* ${troco}`;

  window.open(`https://wa.me/5528999868639?text=${encodeURIComponent(message)}`, "_blank");
};

window.updateCartUI = function() {
  const cartItemsContainer = document.getElementById("cart-items"); const cartCount = document.getElementById("cart-count");
  const cartTotal = document.getElementById("cart-total-price"); const modalTotal = document.getElementById("modal-total-price");
  if (!cartItemsContainer) return;
  cartItemsContainer.innerHTML = ""; let itemsSubtotal = 0, itemCount = 0;
  window.cart.forEach((item, index) => {
    const itemTotal = item.price * item.quantity; itemsSubtotal += itemTotal; itemCount += 1;
    cartItemsContainer.innerHTML += `
      <div class="cart-item">
        <div class="cart-item-header"><span>${item.name}</span><span>R$ ${itemTotal.toFixed(2)}</span></div>
        <div class="cart-item-controls">
          <label>Qtd:</label><input type="number" step="0.1" min="0.1" value="${item.quantity}" onchange="updateQuantity(${index}, this.value)">
          <button onclick="removeFromCart(${index})" style="color:#76190f; background:none; border:none; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
  });
  const taxa = (document.getElementById("checkout-type")?.value || "entrega") === "entrega" ? 5.00 : 0;
  if (cartCount) cartCount.innerText = itemCount;
  if (cartTotal) cartTotal.innerText = `R$ ${itemsSubtotal.toFixed(2)}`;
  if (modalTotal) modalTotal.innerText = `R$ ${(itemsSubtotal + taxa).toFixed(2)}`;
};

// Imagens Upload Produto
window.setupProductDragAndDrop = () => {
  if (window.setupSingleDragAndDrop) {
    window.setupSingleDragAndDrop("drop-zone", async (files) => {
      for (const file of Array.from(files)) if (file.type.startsWith('image/')) window.currentProductImages.push(await window.compressImage(file));
      window.renderImagePreviews();
    });
  }
};
window.handleImageFileSelect = async (e) => {
  for (const file of Array.from(e.target.files)) if (file.type.startsWith('image/')) window.currentProductImages.push(await window.compressImage(file));
  window.renderImagePreviews();
};
window.renderImagePreviews = () => {
  const container = document.getElementById("images-preview"); if (!container) return; container.innerHTML = "";
  window.currentProductImages.forEach((img, index) => container.innerHTML += `<div class="preview-thumb"><img src="${img}"><button type="button" class="preview-thumb-remove" onclick="removeImagePreview(${index})">&times;</button></div>`);
};
window.removeImagePreview = (index) => { window.currentProductImages.splice(index, 1); window.renderImagePreviews(); };