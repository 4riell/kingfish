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
  setPersistence,
  browserLocalPersistence,
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

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Erro na persistência de login:", error);
});

let cart = [];
let allProducts = [];
let allRecipes = [];
let currentCategory = "todos";
let isAdminLoggedIn = false;
let isAuthResolved = false;
let currentProductImages = [];
let currentRecipeImages = [];

// OBSERVADOR DE AUTENTICAÇÃO DO FIREBASE (CORREÇÃO DE LOGIN PERDIDO NO REFRESH)
onAuthStateChanged(auth, (user) => {
  isAuthResolved = true;
  const adminBar = document.getElementById("admin-bar");
  
  if (user) {
    isAdminLoggedIn = true;
    if (adminBar) adminBar.style.display = "flex";
  } else {
    isAdminLoggedIn = false;
    if (adminBar) adminBar.style.display = "none";
  }
  
  checkAdminRouteAccess();
  renderProducts(allProducts);
  renderRecipes(allRecipes);
});

document.addEventListener("DOMContentLoaded", () => {
  setupDragAndDrop();
  setupRecipeDragAndDrop();
  loadProducts();
  loadRecipes();
});

function checkAdminRouteAccess() {
  // Executa apenas após o Firebase verificar o estado de login salvo
  if (!isAuthResolved) return;
  const isAdminHash = window.location.hash === "#admin";
  if (isAdminHash && !auth.currentUser) {
    const loginModal = document.getElementById("login-modal");
    if (loginModal) loginModal.classList.add("open");
  }
}

window.addEventListener("hashchange", checkAdminRouteAccess);

window.handleAdminLogin = async function(e) {
  e.preventDefault();
  const email = document.getElementById("admin-email").value;
  const password = document.getElementById("admin-password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    const loginModal = document.getElementById("login-modal");
    if (loginModal) loginModal.classList.remove("open");
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
  const loginModal = document.getElementById("login-modal");
  if (loginModal) loginModal.classList.remove("open");
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
      allProducts.push({ ...data, id: docSnap.id });
    });

    renderProducts(allProducts);
  }, (error) => {
    console.error("Erro ao carregar produtos:", error);
  });
}

function loadRecipes() {
  const recipesRef = collection(db, "recipes");

  onSnapshot(recipesRef, (snapshot) => {
    allRecipes = [];
    snapshot.forEach((docSnap) => {
      allRecipes.push({ ...docSnap.data(), id: docSnap.id });
    });
    renderRecipes(allRecipes);
  }, (error) => {
    console.error("Erro ao carregar receitas:", error);
  });
}

function renderRecipes(recipes) {
  const container = document.getElementById("recipes-container");
  if (!container) return;
  container.innerHTML = "";

  if (recipes.length === 0) {
    container.innerHTML = `<p style="text-align:center; width:100%; color:#666; margin-top:20px;">Nenhuma receita cadastrada ainda.</p>`;
    return;
  }

  recipes.forEach((recipe) => {
    const card = document.createElement("div");
    card.className = "recipe-card";
    card.onclick = (e) => {
      if (e.target.closest('.admin-card-actions') || e.target.closest('.carousel-btn') || e.target.closest('.carousel-dots')) return;
      openRecipeDetailModal(recipe.id);
    };

    let imagesList = [];
    if (Array.isArray(recipe.images) && recipe.images.length > 0) {
      imagesList = recipe.images;
    } else if (recipe.image) {
      imagesList = [recipe.image];
    } else {
      imagesList = ["https://via.placeholder.com/300x200?text=Receita"];
    }

    const hasMultipleImages = imagesList.length > 1;
    const slidesHTML = imagesList.map(img => `<img src="${img}" alt="${recipe.title}" class="carousel-img">`).join('');
    
    const dotsHTML = hasMultipleImages 
      ? `<div class="carousel-dots">${imagesList.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}" onclick="event.stopPropagation(); setCarouselSlide('recipe-${recipe.id}',${i})"></span>`).join('')}</div>`
      : '';

    const navButtons = hasMultipleImages ? `
      <button type="button" class="carousel-btn prev" onclick="event.stopPropagation(); moveCarousel('recipe-${recipe.id}', -1)"><i class="fa-solid fa-chevron-left"></i></button>
      <button type="button" class="carousel-btn next" onclick="event.stopPropagation(); moveCarousel('recipe-${recipe.id}', 1)"><i class="fa-solid fa-chevron-right"></i></button>
    ` : '';

    let adminControls = "";
    if (isAdminLoggedIn) {
      adminControls = `
        <div class="admin-card-actions" style="margin-top: 15px;">
          <button class="btn-delete-prod" onclick="deleteRecipe('${recipe.id}')"><i class="fa-solid fa-trash"></i> Excluir Receita</button>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="carousel-container" id="carousel-recipe-${recipe.id}" data-index="0" data-total="${imagesList.length}">
        <div class="carousel-slide" id="slide-recipe-${recipe.id}">
          ${slidesHTML}
        </div>
        ${navButtons}
        ${dotsHTML}
      </div>
      <div class="recipe-content">
        <h3 class="recipe-title">${recipe.title}</h3>
        ${recipe.relatedProduct ? `<div class="recipe-product-tag"><i class="fa-solid fa-fish"></i> Usa: <strong>${recipe.relatedProduct}</strong></div>` : ''}
        <p class="recipe-desc">${recipe.ingredients ? `<strong>Ingredientes:</strong><br>${recipe.ingredients.replace(/\n/g, '<br>')}` : ''}</p>
        <p class="recipe-desc" style="margin-top: 8px;">${recipe.instructions ? `<strong>Modo de Preparo:</strong><br>${recipe.instructions.replace(/\n/g, '<br>')}` : ''}</p>
        ${adminControls}
      </div>
    `;
    container.appendChild(card);
  });
}

window.togglePromoInput = function() {
  const isChecked = document.getElementById("prod-on-sale")?.checked;
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
    card.onclick = (e) => {
      if (e.target.closest('.admin-card-actions') || e.target.closest('.add-cart-btn') || e.target.closest('.carousel-btn') || e.target.closest('.carousel-dots')) {
        return;
      }
      openProductDetailModal(product.id);
    };

    let imagesList = [];
    if (Array.isArray(product.images) && product.images.length > 0) {
      imagesList = product.images;
    } else if (product.image) {
      imagesList = [product.image];
    } else {
      imagesList = ["https://via.placeholder.com/300x200?text=Sem+Imagem"];
    }

    const hasMultipleImages = imagesList.length > 1;
    const slidesHTML = imagesList.map(img => `<img src="${img}" alt="${product.name}" class="carousel-img">`).join('');
    
    const dotsHTML = hasMultipleImages 
      ? `<div class="carousel-dots">${imagesList.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}" onclick="event.stopPropagation(); setCarouselSlide('${product.id}',${i})"></span>`).join('')}</div>`
      : '';

    const navButtons = hasMultipleImages ? `
      <button type="button" class="carousel-btn prev" onclick="event.stopPropagation(); moveCarousel('${product.id}', -1)"><i class="fa-solid fa-chevron-left"></i></button>
      <button type="button" class="carousel-btn next" onclick="event.stopPropagation(); moveCarousel('${product.id}', 1)"><i class="fa-solid fa-chevron-right"></i></button>
    ` : '';

    let adminControls = "";
    if (isAdminLoggedIn) {
      adminControls = `
        <div class="admin-card-actions">
          <button class="btn-edit-prod" onclick="event.stopPropagation(); openProductModal('${product.id}')"><i class="fa-solid fa-pen"></i> Editar</button>
          <button class="btn-delete-prod" onclick="event.stopPropagation(); deleteProduct('${product.id}')"><i class="fa-solid fa-trash"></i> Excluir</button>
        </div>
      `;
    }

    const buyButton = product.isOutOfStock
      ? `<button class="add-cart-btn btn-disabled" disabled><i class="fa-solid fa-ban"></i> Esgotado</button>`
      : `<button class="add-cart-btn" onclick="event.stopPropagation(); addToCart('${product.id}')"><i class="fa-solid fa-plus"></i> Adicionar</button>`;

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

// LÓGICA DO CARROSSEL NOS CARDS
window.moveCarousel = function(productId, direction) {
  const carousel = document.getElementById(`carousel-${productId}`);
  if (!carousel) return;
  const total = parseInt(carousel.getAttribute("data-total")) || 1;
  let currentIndex = parseInt(carousel.getAttribute("data-index")) || 0;

  currentIndex = (currentIndex + direction + total) % total;
  window.setCarouselSlide(productId, currentIndex);
};

window.setCarouselSlide = function(productId, index) {
  const carousel = document.getElementById(`carousel-${productId}`);
  const slide = document.getElementById(`slide-${productId}`);
  if (!carousel || !slide) return;
  
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

function setupRecipeDragAndDrop() {
  const dropZone = document.getElementById("recipe-drop-zone");
  if (!dropZone) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    processRecipeImageFiles(e.dataTransfer.files);
  }, false);
}

window.handleImageFileSelect = function(e) {
  processImageFiles(e.target.files);
};

window.handleRecipeImageFileSelect = function(e) {
  processRecipeImageFiles(e.target.files);
};

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

        resolve(canvas.toDataURL("image/jpeg", quality));
      };
    };
  });
}

async function processImageFiles(files) {
  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue;
    const compressedBase64 = await compressImage(file);
    currentProductImages.push(compressedBase64);
  }
  renderImagePreviews();
}

async function processRecipeImageFiles(files) {
  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue;
    const compressedBase64 = await compressImage(file);
    currentRecipeImages.push(compressedBase64);
  }
  renderRecipeImagePreviews();
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

function renderRecipeImagePreviews() {
  const previewContainer = document.getElementById("recipe-images-preview");
  if (!previewContainer) return;
  previewContainer.innerHTML = "";

  currentRecipeImages.forEach((imgBase64, index) => {
    const thumb = document.createElement("div");
    thumb.className = "preview-thumb";
    thumb.innerHTML = `
      <img src="${imgBase64}" alt="Preview">
      <button type="button" class="preview-thumb-remove" onclick="removeRecipeImagePreview(${index})">&times;</button>
    `;
    previewContainer.appendChild(thumb);
  });
}

window.removeImagePreview = function(index) {
  currentProductImages.splice(index, 1);
  renderImagePreviews();
};

window.removeRecipeImagePreview = function(index) {
  currentRecipeImages.splice(index, 1);
  renderRecipeImagePreviews();
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

  window.togglePromoInput();
  renderImagePreviews();
  modal.classList.add("open");
};

window.closeProductModal = function() {
  const modal = document.getElementById("admin-modal");
  if (modal) modal.classList.remove("open");
};

window.openRecipeModal = function() {
  const modal = document.getElementById("recipe-modal");
  const form = document.getElementById("recipe-form");
  if (form) form.reset();
  currentRecipeImages = [];

  const selectProd = document.getElementById("recipe-prod-select");
  if (selectProd) {
    selectProd.innerHTML = '<option value="">-- Selecionar Produto Envolvido --</option>';
    allProducts.forEach(p => {
      selectProd.innerHTML += `<option value="${p.name}">${p.name}</option>`;
    });
  }

  renderRecipeImagePreviews();
  if (modal) modal.classList.add("open");
};

window.closeRecipeModal = function() {
  const modal = document.getElementById("recipe-modal");
  if (modal) modal.classList.remove("open");
};

window.handleRecipeSubmit = async function(e) {
  e.preventDefault();

  if (!auth.currentUser) {
    alert("Você precisa estar autenticado como administrador para adicionar receitas.");
    return;
  }

  const saveBtn = document.getElementById("btn-save-recipe");
  if (saveBtn) {
    saveBtn.innerText = "Salvando...";
    saveBtn.disabled = true;
  }

  const recipeData = {
    title: document.getElementById("recipe-title").value.toUpperCase(),
    relatedProduct: document.getElementById("recipe-prod-select").value,
    ingredients: document.getElementById("recipe-ingredients").value,
    instructions: document.getElementById("recipe-instructions").value,
    images: currentRecipeImages.length > 0 ? currentRecipeImages : []
  };

  try {
    await addDoc(collection(db, "recipes"), recipeData);
    alert("Receita adicionada com sucesso!");
    window.closeRecipeModal();
  } catch (error) {
    console.error("Erro ao salvar receita:", error);
    alert(`Erro ao salvar: ${error.message}`);
  } finally {
    if (saveBtn) {
      saveBtn.innerText = "Salvar Receita";
      saveBtn.disabled = false;
    }
  }
};

window.deleteRecipe = async function(id) {
  if (!auth.currentUser) {
    alert("Ação não permitida.");
    return;
  }

  if (!confirm("Tem certeza que deseja excluir esta receita?")) return;

  try {
    await deleteDoc(doc(db, "recipes", id));
    alert("Receita removida com sucesso!");
  } catch (error) {
    console.error("Erro ao excluir receita:", error);
    alert("Erro ao excluir receita: " + error.message);
  }
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
  
  if (window.event && window.event.currentTarget) {
    window.event.currentTarget.classList.add("active");
  }
  renderProducts(allProducts);
};

window.addToCart = function(productId) {
  const product = allProducts.find(p => p.id === productId);
  
  if (product && product.isOutOfStock) {
    alert("Desculpe, este produto está esgotado no momento.");
    return;
  }

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
// FUNÇÕES DO FORMULÁRIO DE ENTREGA / VIA CEP
window.toggleDeliveryFields = function() {
  const type = document.getElementById("checkout-type")?.value;
  const deliveryFields = document.getElementById("delivery-fields");
  if (deliveryFields) {
    deliveryFields.style.display = type === "entrega" ? "block" : "none";
  }
  updateCartUI();
};

window.toggleTrocoField = function() {
  const payment = document.getElementById("checkout-pagamento")?.value;
  const trocoGroup = document.getElementById("troco-group");
  if (trocoGroup) {
    trocoGroup.style.display = payment === "dinheiro" ? "block" : "none";
  }
};

window.toggleNoNumber = function(checkbox) {
  const numInput = document.getElementById("checkout-numero");
  if (numInput) {
    if (checkbox.checked) {
      numInput.value = "S/N";
      numInput.disabled = true;
    } else {
      numInput.value = "";
      numInput.disabled = false;
    }
  }
};

window.fetchAddressByCEP = async function() {
  const cepInput = document.getElementById("checkout-cep");
  if (!cepInput) return;
  
  const cep = cepInput.value.replace(/\D/g, "");
  if (cep.length !== 8) {
    if (cep.length > 0) alert("CEP inválido! Digite 8 números.");
    return;
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await response.json();

    if (data.erro) {
      alert("CEP não encontrado. Por favor, preencha o endereço manualmente.");
      return;
    }

    document.getElementById("checkout-cidade").value = `${data.localidade} - ${data.uf}`;
    document.getElementById("checkout-bairro").value = data.bairro || "";
    document.getElementById("checkout-rua").value = data.logradouro || "";
  } catch (error) {
    console.error("Erro ao buscar CEP:", error);
    alert("Não foi possível consultar o CEP. Preencha manualmente.");
  }
};

function updateCartUI() {
  const cartItemsContainer = document.getElementById("cart-items");
  const cartCount = document.getElementById("cart-count");
  const cartTotal = document.getElementById("cart-total-price");

  if (!cartItemsContainer) return;
  cartItemsContainer.innerHTML = "";
  let itemsSubtotal = 0;
  let itemCount = 0;

  cart.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;
    itemsSubtotal += itemTotal;
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
        <button onclick="removeFromCart(${index})" style="color:#76190f; background:none; border:none; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
    cartItemsContainer.appendChild(div);
  });

  const deliveryType = document.getElementById("checkout-type")?.value || "entrega";
  // Taxa calculada automaticamente: R$ 5,00 para entrega e R$ 0,00 para retirada no balcão
  const taxa = deliveryType === "entrega" ? 5.00 : 0;
  const totalGeral = itemsSubtotal + taxa;

  if (cartCount) cartCount.innerText = itemCount;
  if (cartTotal) cartTotal.innerText = `R$ ${totalGeral.toFixed(2)}`;
}

window.sendOrderToWhatsApp = function() {
  if (cart.length === 0) {
    alert("Seu carrinho está vazio!");
    return;
  }

  const deliveryType = document.getElementById("checkout-type")?.value;
  let deliveryDetails = "";
  // Taxa fixa calculada automaticamente
  const taxaDelivery = deliveryType === "entrega" ? 5.00 : 0;

  if (deliveryType === "entrega") {
    const cep = document.getElementById("checkout-cep")?.value.trim();
    const cidade = document.getElementById("checkout-cidade")?.value.trim();
    const bairro = document.getElementById("checkout-bairro")?.value.trim();
    const rua = document.getElementById("checkout-rua")?.value.trim();
    const numero = document.getElementById("checkout-numero")?.value.trim();
    const complemento = document.getElementById("checkout-complemento")?.value.trim();
    const referencia = document.getElementById("checkout-referencia")?.value.trim();

    if (!cep || !cidade || !bairro || !rua || !numero || !referencia) {
      alert("Por favor, preencha todos os campos obrigatórios de entrega.");
      return;
    }

    deliveryDetails = `
*Tipo:* Entrega
*CEP:* ${cep}
*Cidade:* ${cidade}
*Bairro:* ${bairro}
*Rua:* ${rua}, Nº ${numero}
*Complemento:* ${complemento || "Nenhum"}
*Ponto de Referência:* ${referencia}`;
  } else {
    deliveryDetails = `\n*Tipo:* Retirada no Balcão`;
  }

  const pagamento = document.getElementById("checkout-pagamento")?.value.toUpperCase();
  const troco = document.getElementById("checkout-troco")?.value.trim();
  const obs = document.getElementById("checkout-obs")?.value.trim();

  if (!pagamento) {
    alert("Por favor, selecione a forma de pagamento.");
    return;
  }

  if (pagamento === "DINHEIRO" && !troco) {
    alert("Por favor, informe se precisa de troco (ou digite 'Não precisa').");
    return;
  }

  let message = "*NOVO PEDIDO - PESCADOS CAPARAÓ*\n\n*ITENS DO PEDIDO:*\n";
  let itemsTotal = 0;

  cart.forEach(item => {
    const subtotal = item.price * item.quantity;
    itemsTotal += subtotal;
    message += `• *${item.name}*\n  Qtd/Peso: ${item.quantity} ${item.unit} | R$ ${subtotal.toFixed(2)}\n`;
  });

  const totalGeral = itemsTotal + taxaDelivery;

  message += `\n*RESUMO DA COMPRA:*`;
  message += `\nSubtotal: R$ ${itemsTotal.toFixed(2)}`;
  if (deliveryType === "entrega") {
    message += `\nTaxa de Entrega: R$ ${taxaDelivery.toFixed(2)}`;
  }
  message += `\n*Total Geral:* R$ ${totalGeral.toFixed(2)}`;

  message += `\n\n*DADOS DE ENTREGA:*${deliveryDetails}`;
  message += `\n\n*PAGAMENTO:*`;
  message += `\n*Forma:* ${pagamento}`;
  if (pagamento === "DINHEIRO" && troco) {
    message += `\n*Troco para:* ${troco}`;
  }

  if (obs) {
    message += `\n\n*OBSERVAÇÕES:*\n${obs}`;
  }

  const phoneNumber = "5528999868639";
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
  
  window.open(whatsappUrl, "_blank");
};

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
  if (!sidebar || !overlay) return;
  
  if (forceOpen || !sidebar.classList.contains("open")) {
    sidebar.classList.add("open");
    overlay.classList.add("open");
  } else {
    sidebar.classList.remove("open");
    overlay.classList.remove("open");
  }
};

window.toggleMobileMenu = function() {
  const nav = document.getElementById("main-nav");
  if (nav) nav.classList.toggle("show");
};

window.showSection = function(sectionId) {
  document.querySelectorAll(".content-section").forEach(sec => sec.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));

  const targetSec = document.getElementById(`sec-${sectionId}`);
  if (targetSec) targetSec.classList.add("active");

  if (window.event && window.event.currentTarget) {
    window.event.currentTarget.classList.add("active");
  }
  const nav = document.getElementById("main-nav");
  if (nav) nav.classList.remove("show");
};

// MODAIS DE DETALHES (PRODUTOS E RECEITAS)
window.openProductDetailModal = function(productId) {
  const prod = allProducts.find(p => p.id === productId);
  if (!prod) return;

  const modal = document.getElementById("product-detail-modal");
  document.getElementById("modal-product-title").innerText = prod.name;
  document.getElementById("modal-product-desc").innerText = prod.desc || "Sem descrição disponível.";

  const mediaContainer = document.getElementById("modal-product-media");
  
  let imagesList = [];
  if (Array.isArray(prod.images) && prod.images.length > 0) {
    imagesList = prod.images;
  } else if (prod.image) {
    imagesList = [prod.image];
  } else {
    imagesList = ["https://via.placeholder.com/300x200?text=Sem+Imagem"];
  }

  const hasMultiple = imagesList.length > 1;
  const slidesHTML = imagesList.map(img => `<img src="${img}" alt="${prod.name}" class="carousel-img">`).join('');
  const dotsHTML = hasMultiple 
    ? `<div class="carousel-dots">${imagesList.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}" onclick="setModalCarouselSlide(${i})"></span>`).join('')}</div>`
    : '';
  const navButtons = hasMultiple ? `
    <button type="button" class="carousel-btn prev" onclick="moveModalCarousel(-1)"><i class="fa-solid fa-chevron-left"></i></button>
    <button type="button" class="carousel-btn next" onclick="moveModalCarousel(1)"><i class="fa-solid fa-chevron-right"></i></button>
  ` : '';

  mediaContainer.innerHTML = `
    <div class="carousel-container" id="modal-carousel" data-index="0" data-total="${imagesList.length}">
      <div class="carousel-slide" id="modal-carousel-slide">
        ${slidesHTML}
      </div>
      ${navButtons}
      ${dotsHTML}
    </div>
  `;

  const priceContainer = document.getElementById("modal-product-price");
  if (prod.isOnSale && prod.promoPrice && Number(prod.promoPrice) < Number(prod.price)) {
    priceContainer.innerHTML = `
      <div class="price-container">
        <span class="old-price">R$ ${Number(prod.price).toFixed(2)}</span>
        <span class="product-price promo">R$ ${Number(prod.promoPrice).toFixed(2)} <small>/ ${prod.unit}</small></span>
      </div>
    `;
  } else {
    priceContainer.innerHTML = `<div class="product-price">R$ ${Number(prod.price).toFixed(2)} <small>/ ${prod.unit}</small></div>`;
  }

  const buyBtn = document.getElementById("modal-product-buy-btn");
  if (prod.isOutOfStock) {
    buyBtn.className = "add-cart-btn btn-disabled";
    buyBtn.disabled = true;
    buyBtn.innerHTML = `<i class="fa-solid fa-ban"></i> Esgotado`;
  } else {
    buyBtn.className = "add-cart-btn";
    buyBtn.disabled = false;
    buyBtn.innerHTML = `<i class="fa-solid fa-cart-shopping"></i> Adicionar ao Carrinho`;
    buyBtn.onclick = () => {
      addToCart(prod.id);
      closeProductDetailModal();
    };
  }

  if (modal) modal.classList.add("open");
};

// CONTROLES DO CARROSSEL DENTRO DO MODAL
window.moveModalCarousel = function(direction) {
  const carousel = document.getElementById("modal-carousel");
  if (!carousel) return;
  const total = parseInt(carousel.getAttribute("data-total")) || 1;
  let currentIndex = parseInt(carousel.getAttribute("data-index")) || 0;

  currentIndex = (currentIndex + direction + total) % total;
  window.setModalCarouselSlide(currentIndex);
};

window.setModalCarouselSlide = function(index) {
  const carousel = document.getElementById("modal-carousel");
  const slide = document.getElementById("modal-carousel-slide");
  if (!carousel || !slide) return;

  carousel.setAttribute("data-index", index);
  slide.style.transform = `translateX(-${index * 100}%)`;

  const dots = carousel.querySelectorAll(".carousel-dot");
  dots.forEach((dot, i) => {
    dot.classList.toggle("active", i === index);
  });
};

window.closeProductDetailModal = function() {
  const modal = document.getElementById("product-detail-modal");
  if (modal) modal.classList.remove("open");
};

window.openRecipeDetailModal = function(recipeId) {
  const recipe = allRecipes.find(r => r.id === recipeId);
  if (!recipe) return;

  const modal = document.getElementById("recipe-detail-modal");
  document.getElementById("modal-recipe-title").innerText = recipe.title;

  const mediaContainer = document.getElementById("modal-recipe-media");
  
  let imagesList = [];
  if (Array.isArray(recipe.images) && recipe.images.length > 0) {
    imagesList = recipe.images;
  } else if (recipe.image) {
    imagesList = [recipe.image];
  } else {
    imagesList = ["https://via.placeholder.com/300x200?text=Receita"];
  }

  const hasMultiple = imagesList.length > 1;
  const slidesHTML = imagesList.map(img => `<img src="${img}" alt="${recipe.title}" class="carousel-img">`).join('');
  const dotsHTML = hasMultiple 
    ? `<div class="carousel-dots">${imagesList.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}" onclick="setModalCarouselSlide(${i})"></span>`).join('')}</div>`
    : '';
  const navButtons = hasMultiple ? `
    <button type="button" class="carousel-btn prev" onclick="moveModalCarousel(-1)"><i class="fa-solid fa-chevron-left"></i></button>
    <button type="button" class="carousel-btn next" onclick="moveModalCarousel(1)"><i class="fa-solid fa-chevron-right"></i></button>
  ` : '';

  mediaContainer.innerHTML = `
    <div class="carousel-container" id="modal-carousel" data-index="0" data-total="${imagesList.length}">
      <div class="carousel-slide" id="modal-carousel-slide">
        ${slidesHTML}
      </div>
      ${navButtons}
      ${dotsHTML}
    </div>
  `;

  const tagEl = document.getElementById("modal-recipe-tag");
  tagEl.innerHTML = recipe.relatedProduct ? `<div class="recipe-product-tag"><i class="fa-solid fa-fish"></i> Usa: <strong>${recipe.relatedProduct}</strong></div>` : '';

  document.getElementById("modal-recipe-ingredients").innerHTML = recipe.ingredients ? recipe.ingredients.replace(/\n/g, '<br>') : 'Nenhum ingrediente informado.';
  document.getElementById("modal-recipe-instructions").innerHTML = recipe.instructions ? recipe.instructions.replace(/\n/g, '<br>') : 'Nenhum modo de preparo informado.';

  if (modal) modal.classList.add("open");
};

window.closeRecipeDetailModal = function() {
  const modal = document.getElementById("recipe-detail-modal");
  if (modal) modal.classList.remove("open");
};

window.openAboutModal = function() {
  const modal = document.getElementById("about-modal");
  if (modal) modal.classList.add("open");
};

window.closeAboutModal = function() {
  const modal = document.getElementById("about-modal");
  if (modal) modal.classList.remove("open");
};
// Alterna a exibição do menu mobile evitando propagação do clique
window.toggleMobileMenu = function(event) {
  if (event) event.stopPropagation();
  const nav = document.getElementById("main-nav");
  if (nav) nav.classList.toggle("show");
};

// Evento global para fechar o menu hambúrguer ao clicar fora dele
window.addEventListener("click", (event) => {
  const nav = document.getElementById("main-nav");
  const toggleBtn = document.getElementById("menu-toggle-btn");

  if (nav && nav.classList.contains("show")) {
    // Se o clique não foi dentro da navegação nem no botão hambúrguer, fecha o menu
    if (!nav.contains(event.target) && (!toggleBtn || !toggleBtn.contains(event.target))) {
      nav.classList.remove("show");
    }
  }
});