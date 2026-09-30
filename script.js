import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCFCl3E2bnDc6iHHsfyctXPPCPOJ_zdm34",
  authDomain: "kingfish-pescados.firebaseapp.com",
  projectId: "kingfish-pescados",
  storageBucket: "kingfish-pescados.firebasestorage.app",
  messagingSenderId: "1004059536924",
  appId: "1:1004059536924:web:75dfdf348728a0634df9d9",
  measurementId: "G-7QZZ64PSS2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let cart = [];
let allProducts = [];
let currentCategory = "todos";
let isAdminLoggedIn = false;
let currentProductImages = [];

// Monitorar autenticação
onAuthStateChanged(auth, (user) => {
  const adminBar = document.getElementById("admin-bar");
  if (user) {
    isAdminLoggedIn = true;
    if (adminBar) adminBar.style.display = "flex";
  } else {
    isAdminLoggedIn = false;
    if (adminBar) adminBar.style.display = "none";
  }
  renderProducts(allProducts);
});

document.addEventListener("DOMContentLoaded", () => {
  checkAdminRouteAccess();
  setupDragAndDrop();
  loadProducts();
});

function checkAdminRouteAccess() {
  const isAdminHash = window.location.hash === "#admin";

  // Se o usuário acessar a URL com #admin e não estiver logado, abre a modal de login
  if (isAdminHash && !auth.currentUser) {
    document.getElementById("login-modal").classList.add("open");
  }
}

// Abre o login se o utilizador alterar o hash diretamente na barra de endereço
window.addEventListener("hashchange", checkAdminRouteAccess);

window.handleAdminLogin = async function(e) {
  e.preventDefault();
  const email = document.getElementById("admin-email").value;
  const password = document.getElementById("admin-password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    document.getElementById("login-modal").classList.remove("open");
    alert("Login realizado com sucesso!");
  } catch (error) {
    console.error("Erro no login:", error);
    alert("E-mail ou senha inválidos.");
  }
};

window.adminLogout = async function() {
  try {
    await signOut(auth);
    window.location.href = window.location.pathname;
  } catch (error) {
    console.error("Erro ao sair:", error);
  }
};

window.closeLoginModal = function() {
  document.getElementById("login-modal").classList.remove("open");
};

function loadProducts() {
  const productsRef = collection(db, "products");

  onSnapshot(productsRef, (snapshot) => {
    allProducts = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.images) {
        data.images = data.image ? [data.image] : ["https://via.placeholder.com/300x200?text=Sem+Imagem"];
      }
      
      // Armazena o ID REAL do documento Firestore (garantindo que não seja sobrescrito pelo data.id interno)
      allProducts.push({ ...data, id: docSnap.id });
    });

    renderProducts(allProducts);
  }, (error) => {
    console.error("Erro ao carregar produtos:", error);
  });
}

// Função para mostrar/esconder o campo de preço promocional no modal
window.togglePromoInput = function() {
  const isChecked = document.getElementById("prod-on-sale").checked;
  const promoRow = document.getElementById("promo-price-row");
  if (promoRow) {
    promoRow.style.display = isChecked ? "flex" : "none";
  }
};

function renderProducts(products) {
  const container = document.getElementById("products-container");
  if (!container) return;
  container.innerHTML = "";

  const listToRender = currentCategory === "todos" 
    ? products 
    : currentCategory === "promocoes"
      ? products.filter(p => p.isOnSale)
      : products.filter(p => p.category === currentCategory);

  listToRender.forEach((product) => {
    const card = document.createElement("div");
    card.className = `product-card ${product.isOutOfStock ? 'out-of-stock' : ''} ${product.isOnSale ? 'on-sale' : ''}`;
    
    const imagesList = (product.images && product.images.length > 0) 
      ? product.images 
      : [product.image || "https://via.placeholder.com/300x200?text=Sem+Imagem"];

    const hasMultipleImages = imagesList.length > 1;
    const slidesHTML = imagesList.map(img => `<img src="${img}" alt="${product.name}" class="carousel-img">`).join('');
    
    const dotsHTML = hasMultipleImages 
      ? `<div class="carousel-dots">${imagesList.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}" onclick="setCarouselSlide('${product.id}',${i})"></span>`).join('')}</div>`
      : '';

    const navButtons = hasMultipleImages ? `
      <button class="carousel-btn prev" onclick="moveCarousel('${product.id}', -1)"><i class="fa-solid fa-chevron-left"></i></button>
      <button class="carousel-btn next" onclick="moveCarousel('${product.id}', 1)"><i class="fa-solid fa-chevron-right"></i></button>
    ` : '';

    let adminControls = "";
    if (isAdminLoggedIn) {
      adminControls = `
        <div class="admin-card-actions">
          <button class="btn-edit-prod" onclick="openProductModal('${product.id}')"><i class="fa-solid fa-pen"></i> Editar</button>
          <button class="btn-delete-prod" onclick="deleteProduct('${product.id}')"><i class="fa-solid fa-trash"></i> Excluir</button>
        </div>
      `;
    }

    const buyButton = product.isOutOfStock
      ? `<button class="add-cart-btn btn-disabled" disabled><i class="fa-solid fa-ban"></i> Esgotado</button>`
      : `<button class="add-cart-btn" onclick="addToCart('${product.id}')"><i class="fa-solid fa-plus"></i> Adicionar</button>`;

    // LÓGICA DE PREÇOS E DESCONTO
    let priceHTML = "";
    let saleBadge = "";

    if (product.isOnSale && product.promoPrice && Number(product.promoPrice) < Number(product.price)) {
      const originalPrice = Number(product.price);
      const promoPrice = Number(product.promoPrice);
      const discountPercent = Math.round(((originalPrice - promoPrice) / originalPrice) * 100);

      saleBadge = `<span class="badge-on-sale">-${discountPercent}% OFF</span>`;
      priceHTML = `
        <div class="price-container">
          <span class="old-price">R$ ${originalPrice.toFixed(2)}</span>
          <span class="product-price promo">R$ ${promoPrice.toFixed(2)} <small>/ ${product.unit}</small></span>
        </div>
      `;
    } else {
      priceHTML = `
        <div class="product-price">R$ ${Number(product.price).toFixed(2)} <small>/ ${product.unit}</small></div>
      `;
    }

    const outOfStockBadge = product.isOutOfStock
      ? `<span class="badge-out-of-stock">ESGOTADO</span>`
      : '';

    card.innerHTML = `
      <div class="carousel-container" id="carousel-${product.id}" data-index="0" data-total="${imagesList.length}">
        ${outOfStockBadge}
        ${saleBadge}
        <div class="carousel-slide" id="slide-${product.id}">
          ${slidesHTML}
        </div>
        ${navButtons}
        ${dotsHTML}
      </div>
      <div class="product-info">
        <h3 class="product-title">${product.name}</h3>
        <p class="product-desc">${product.desc || ''}</p>
        ${priceHTML}
        ${buyButton}
        ${adminControls}
      </div>
    `;
    container.appendChild(card);
  });
}

window.moveCarousel = function(productId, direction) {
  const carousel = document.getElementById(`carousel-${productId}`);
  const total = parseInt(carousel.getAttribute("data-total"));
  let currentIndex = parseInt(carousel.getAttribute("data-index"));

  currentIndex = (currentIndex + direction + total) % total;
  window.setCarouselSlide(productId, currentIndex);
};

window.setCarouselSlide = function(productId, index) {
  const carousel = document.getElementById(`carousel-${productId}`);
  const slide = document.getElementById(`slide-${productId}`);
  
  carousel.setAttribute("data-index", index);
  slide.style.transform = `translateX(-${index * 100}%)`;

  const dots = carousel.querySelectorAll(".carousel-dot");
  dots.forEach((dot, i) => {
    dot.classList.toggle("active", i === index);
  });
};

function setupDragAndDrop() {
  const dropZone = document.getElementById("drop-zone");
  if (!dropZone) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
  });

  dropZone.addEventListener('drop', (e) => {
    processImageFiles(e.dataTransfer.files);
  }, false);
}

window.handleImageFileSelect = function(e) {
  processImageFiles(e.target.files);
};

// FUNÇÃO PARA COMPRIMIR A IMAGEM ANTES DE GUARDAR
function compressImage(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Retorna a imagem otimizada em JPEG
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
    };
  });
}

async function processImageFiles(files) {
  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue;
    // Comprime cada imagem selecionada
    const compressedBase64 = await compressImage(file);
    currentProductImages.push(compressedBase64);
  }
  renderImagePreviews();
}

function renderImagePreviews() {
  const previewContainer = document.getElementById("images-preview");
  if (!previewContainer) return;
  previewContainer.innerHTML = "";

  currentProductImages.forEach((imgBase64, index) => {
    const thumb = document.createElement("div");
    thumb.className = "preview-thumb";
    thumb.innerHTML = `
      <img src="${imgBase64}" alt="Preview">
      <button type="button" class="preview-thumb-remove" onclick="removeImagePreview(${index})">&times;</button>
    `;
    previewContainer.appendChild(thumb);
  });
}

window.removeImagePreview = function(index) {
  currentProductImages.splice(index, 1);
  renderImagePreviews();
};

window.openProductModal = function(productId = null) {
  const modal = document.getElementById("admin-modal");
  const form = document.getElementById("product-form");
  const title = document.getElementById("modal-form-title");

  if (productId) {
    title.innerText = "Editar Produto";
    const prod = allProducts.find(p => p.id === productId);
    if (!prod) return;

    document.getElementById("prod-id").value = prod.id;
    document.getElementById("prod-name").value = prod.name;
    document.getElementById("prod-category").value = prod.category;
    document.getElementById("prod-price").value = prod.price;
    document.getElementById("prod-promo-price").value = prod.promoPrice || "";
    document.getElementById("prod-unit").value = prod.unit;
    document.getElementById("prod-desc").value = prod.desc || "";
    document.getElementById("prod-out-of-stock").checked = !!prod.isOutOfStock;
    document.getElementById("prod-on-sale").checked = !!prod.isOnSale;

    currentProductImages = prod.images ? [...prod.images] : (prod.image ? [prod.image] : []);
  } else {
    title.innerText = "Adicionar Produto";
    form.reset();
    document.getElementById("prod-id").value = "";
    document.getElementById("prod-promo-price").value = "";
    document.getElementById("prod-out-of-stock").checked = false;
    document.getElementById("prod-on-sale").checked = false;
    currentProductImages = [];
  }

  togglePromoInput();
  renderImagePreviews();
  modal.classList.add("open");
};

window.closeProductModal = function() {
  document.getElementById("admin-modal").classList.remove("open");
};

window.handleProductSubmit = async function(e) {
  e.preventDefault();

  if (!auth.currentUser) {
    alert("Você precisa estar autenticado como administrador para alterar produtos.");
    return;
  }

  if (currentProductImages.length === 0) {
    alert("Por favor, adicione pelo menos uma imagem do produto.");
    return;
  }

  const isOnSale = document.getElementById("prod-on-sale").checked;
  const promoPriceVal = parseFloat(document.getElementById("prod-promo-price").value);

  if (isOnSale && (isNaN(promoPriceVal) || promoPriceVal <= 0)) {
    alert("Por favor, insira um preço de promoção válido.");
    return;
  }

  const saveBtn = document.getElementById("btn-save-product");
  if (saveBtn) {
    saveBtn.innerText = "Salvando...";
    saveBtn.disabled = true;
  }

  const id = document.getElementById("prod-id").value;
  const prodData = {
    name: document.getElementById("prod-name").value.toUpperCase(),
    category: document.getElementById("prod-category").value,
    price: parseFloat(document.getElementById("prod-price").value),
    promoPrice: isOnSale ? promoPriceVal : null,
    unit: document.getElementById("prod-unit").value,
    images: currentProductImages,
    desc: document.getElementById("prod-desc").value,
    isOutOfStock: document.getElementById("prod-out-of-stock").checked,
    isOnSale: isOnSale
  };

  try {
    if (id && id.trim() !== "") {
      await updateDoc(doc(db, "products", id), prodData);
    } else {
      await addDoc(collection(db, "products"), prodData);
    }

    alert("Produto salvo com sucesso!");
    window.closeProductModal();
  } catch (error) {
    console.error("Detalhes do erro ao salvar:", error);
    alert(`Erro ao salvar: ${error.message}`);
  } finally {
    if (saveBtn) {
      saveBtn.innerText = "Salvar Produto";
      saveBtn.disabled = false;
    }
  }
};

window.deleteProduct = async function(id) {
  if (!auth.currentUser) {
    alert("Ação não permitida.");
    return;
  }

  if (!confirm("Tem certeza que deseja excluir este produto?")) return;

  try {
    await deleteDoc(doc(db, "products", id));
    alert("Produto removido com sucesso!");
  } catch (error) {
    console.error("Erro ao excluir produto:", error);
    alert("Erro ao excluir produto: " + error.message);
  }
};

window.filterCategory = function(category) {
  currentCategory = category;
  document.querySelectorAll(".filter-btn").forEach(btn => btn.classList.remove("active"));
  if (event && event.currentTarget) {
    event.currentTarget.classList.add("active");
  }
  renderProducts(allProducts);
};

window.addToCart = function(productId) {
  const product = allProducts.find(p => p.id === productId);
  
  if (product && product.isOutOfStock) {
    alert("Desculpe, este produto está esgotado no momento.");
    return;
  }

  // Preço final a ser considerado no carrinho
  const finalPrice = (product.isOnSale && product.promoPrice) ? Number(product.promoPrice) : Number(product.price);
  const cartProduct = { ...product, price: finalPrice };

  const existingItem = cart.find(item => item.id === productId);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ ...cartProduct, quantity: 1 });
  }

  updateCartUI();
  window.toggleCart(true);
};

function updateCartUI() {
  const cartItemsContainer = document.getElementById("cart-items");
  const cartCount = document.getElementById("cart-count");
  const cartTotal = document.getElementById("cart-total-price");

  cartItemsContainer.innerHTML = "";
  let total = 0;
  let itemCount = 0;

  cart.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;
    itemCount += 1;

    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <div class="cart-item-header">
        <span>${item.name}</span>
        <span>R$ ${itemTotal.toFixed(2)}</span>
      </div>
      <div class="cart-item-controls">
        <label>Qtd (${item.unit}):</label>
        <input type="number" step="0.1" min="0.1" value="${item.quantity}" onchange="updateQuantity(${index}, this.value)">
        <button onclick="removeFromCart(${index})" style="color:red; background:none; border:none; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
    cartItemsContainer.appendChild(div);
  });

  cartCount.innerText = itemCount;
  cartTotal.innerText = `R$ ${total.toFixed(2)}`;
}

window.updateQuantity = function(index, value) {
  cart[index].quantity = parseFloat(value) || 1;
  updateCartUI();
};

window.removeFromCart = function(index) {
  cart.splice(index, 1);
  updateCartUI();
};

window.toggleCart = function(forceOpen = false) {
  const sidebar = document.getElementById("cart-sidebar");
  const overlay = document.getElementById("cart-overlay");
  
  if (forceOpen || !sidebar.classList.contains("open")) {
    sidebar.classList.add("open");
    overlay.classList.add("open");
  } else {
    sidebar.classList.remove("open");
    overlay.classList.remove("open");
  }
};

window.sendOrderToWhatsApp = function() {
  if (cart.length === 0) {
    alert("Seu carrinho está vazio!");
    return;
  }

  const phoneNumbers = ["5528999868639"];
  let message = "*NOVO PEDIDO - PESCADOS CAPARAÓ*\n\n";

  let total = 0;
  cart.forEach(item => {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    message += `• *${item.name}*\n  Qtd/Peso: ${item.quantity} ${item.unit} | R$ ${subtotal.toFixed(2)}\n`;
  });

  message += `\n*Total Estimado:* R$ ${total.toFixed(2)}`;
  message += `\n\n_Por favor, informe seu endereço e a forma de pagamento no chat._`;

  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${phoneNumbers[0]}?text=${encodedMessage}`;
  
  window.open(whatsappUrl, "_blank");
};

window.toggleMobileMenu = function() {
  const nav = document.getElementById("main-nav");
  if (nav) nav.classList.toggle("show");
};

window.showSection = function(sectionId) {
  document.querySelectorAll(".content-section").forEach(sec => sec.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));

  document.getElementById(`sec-${sectionId}`).classList.add("active");
  if (event && event.currentTarget) {
    event.currentTarget.classList.add("active");
  }
  const nav = document.getElementById("main-nav");
  if (nav) nav.classList.remove("show");
};