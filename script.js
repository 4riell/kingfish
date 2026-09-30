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
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD4dEBSPXtMP8eMf8IhwvISaumUCuTnR9o",
  authDomain: "pescadoscaparao.firebaseapp.com",
  projectId: "pescadoscaparao",
  storageBucket: "pescadoscaparao.firebasestorage.app",
  messagingSenderId: "935622122822",
  appId: "1:935622122822:web:ca67b6ed4759573bd89947",
  measurementId: "G-DTWKYV6E4G"
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
let allCategories = [];
let currentCategory = "todos";
let currentRecipeCategory = "todos";
let isAdminLoggedIn = false;
let isAuthResolved = false;
let currentProductImages = [];
let currentRecipeImages = [];
let currentRecipeVideo = null;

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
  loadCategories(); // <--- AQUI
});

// FUNÇÃO DE ZOOM PARA IMAGENS
window.setupImageZoom = function(imgElement) {
  if(!imgElement) return;
  imgElement.style.transition = "transform 0.15s ease-out";
  imgElement.style.cursor = "zoom-in";
  
  imgElement.addEventListener("mousemove", (e) => {
    const rect = imgElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    imgElement.style.transformOrigin = `${x}% ${y}%`;
    imgElement.style.transform = "scale(2.2)"; 
  });

  imgElement.addEventListener("mouseleave", () => {
    imgElement.style.transformOrigin = "center center";
    imgElement.style.transform = "scale(1)";
  });
};

function renderCategories() {
  const catalogFilters = document.getElementById("catalog-filters");
  const recipeFilters = document.getElementById("recipe-filters");
  const selectProd = document.getElementById("prod-category");
  const selectRecipe = document.getElementById("recipe-category");
  const listContainer = document.getElementById("category-list");
  
  // 1. Lista na Modal do Admin
  if (listContainer) {
    listContainer.innerHTML = "";
    allCategories.forEach(cat => {
      listContainer.innerHTML += `
        <li style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee; align-items:center;">
          <strong>${cat.name}</strong>
          <button onclick="deleteCategory('${cat.id}')" style="color:#e74c3c; background:none; border:none; cursor:pointer; font-size:1.1rem;"><i class="fa-solid fa-trash"></i></button>
        </li>
      `;
    });
  }

  // 2. Filtros do Catálogo
  if (catalogFilters) {
    catalogFilters.innerHTML = `
      <button class="filter-btn active" onclick="filterCategory('todos')">Todos</button>
      <button class="filter-btn" onclick="filterCategory('promocoes')"><i class="fa-solid fa-tag"></i> Promoções</button>
    `;
    allCategories.forEach(cat => {
      catalogFilters.innerHTML += `<button class="filter-btn" onclick="filterCategory('${cat.name}')">${cat.name}</button>`;
    });
  }

  // 3. Filtros de Receitas
  if (recipeFilters) {
    recipeFilters.innerHTML = `<button class="filter-btn active" onclick="filterRecipeCategory('todos')">Todas</button>`;
    allCategories.forEach(cat => {
      recipeFilters.innerHTML += `<button class="filter-btn" onclick="filterRecipeCategory('${cat.name}')">${cat.name}</button>`;
    });
  }

  // 4. Selects de Formulários (Produto e Receita)
  const currentProdVal = selectProd ? selectProd.value : "";
  const currentRecipeVal = selectRecipe ? selectRecipe.value : "";
  
  let optionsHTML = `<option value="">Selecione...</option>`;
  allCategories.forEach(cat => {
    optionsHTML += `<option value="${cat.name}">${cat.name}</option>`;
  });

  if (selectProd) {
    selectProd.innerHTML = optionsHTML;
    if (currentProdVal) selectProd.value = currentProdVal;
  }
  if (selectRecipe) {
    selectRecipe.innerHTML = optionsHTML;
    if (currentRecipeVal) selectRecipe.value = currentRecipeVal;
  }
}

function loadCategories() {
  const catRef = collection(db, "categories"); // Nova coleção unificada
  onSnapshot(catRef, (snapshot) => {
    allCategories = [];
    snapshot.forEach(doc => {
      allCategories.push({ id: doc.id, ...doc.data() });
    });
    renderCategories();
  });
}

window.addCategory = async function() {
  const input = document.getElementById("new-category-name");
  const name = input.value.trim();
  if (!name) return;
  try {
    await addDoc(collection(db, "categories"), { name: name });
    input.value = "";
  } catch (error) {
    alert("Erro ao adicionar categoria: " + error.message);
  }
};

window.deleteCategory = async function(id) {
  if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;
  try {
    await deleteDoc(doc(db, "categories", id));
  } catch (error) {
    alert("Erro ao excluir: " + error.message);
  }
};

function checkAdminRouteAccess() {
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

window.recoverPassword = async function() {
  const email = document.getElementById("admin-email").value;
  if(!email) {
    alert("Por favor, digite o e-mail no campo acima primeiro.");
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    alert("Um e-mail de recuperação de senha foi enviado para você!");
  } catch(error) {
    alert("Erro ao enviar e-mail de recuperação: " + error.message);
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

// GERENCIAMENTO DE CATEGORIAS DINÂMICAS PARA RECEITAS
function loadRecipeCategories() {
  const catRef = collection(db, "recipe_categories");
  onSnapshot(catRef, (snapshot) => {
    allRecipeCategories = [];
    snapshot.forEach(doc => {
      allRecipeCategories.push({ id: doc.id, ...doc.data() });
    });
    renderRecipeCategories();
  });
}

function renderRecipeCategories() {
  const filterContainer = document.getElementById("recipe-filters");
  const selectContainer = document.getElementById("recipe-category");
  const listContainer = document.getElementById("category-list");
  
  if (listContainer) {
    listContainer.innerHTML = "";
    allRecipeCategories.forEach(cat => {
      listContainer.innerHTML += `
        <li style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee; align-items:center;">
          <strong>${cat.name}</strong>
          <button onclick="deleteRecipeCategory('${cat.id}')" style="color:#e74c3c; background:none; border:none; cursor:pointer; font-size:1.1rem;"><i class="fa-solid fa-trash"></i></button>
        </li>
      `;
    });
  }

  if (filterContainer) {
    filterContainer.innerHTML = `<button class="filter-btn active" onclick="filterRecipeCategory('todos')">Todas</button>`;
    allRecipeCategories.forEach(cat => {
      filterContainer.innerHTML += `<button class="filter-btn" onclick="filterRecipeCategory('${cat.name}')">${cat.name}</button>`;
    });
  }

  if (selectContainer) {
    const currentVal = selectContainer.value;
    selectContainer.innerHTML = `<option value="">Selecione...</option>`;
    allRecipeCategories.forEach(cat => {
      selectContainer.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
    });
    if (currentVal) selectContainer.value = currentVal;
  }
}

window.openCategoryModal = function() {
  document.getElementById("category-modal").classList.add("open");
};

window.closeCategoryModal = function() {
  document.getElementById("category-modal").classList.remove("open");
};

window.addRecipeCategory = async function() {
  const input = document.getElementById("new-category-name");
  const name = input.value.trim();
  if (!name) return;
  try {
    await addDoc(collection(db, "recipe_categories"), { name: name });
    input.value = "";
  } catch (error) {
    alert("Erro ao adicionar categoria: " + error.message);
  }
};

window.deleteRecipeCategory = async function(id) {
  if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;
  try {
    await deleteDoc(doc(db, "recipe_categories", id));
  } catch (error) {
    alert("Erro ao excluir: " + error.message);
  }
};

function loadProducts() {
  const productsRef = collection(db, "products");
  onSnapshot(productsRef, (snapshot) => {
    allProducts = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.images) data.images = data.image ? [data.image] : ["https://via.placeholder.com/300x200?text=Sem+Imagem"];
      allProducts.push({ ...data, id: docSnap.id });
    });
    renderProducts(allProducts);
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
  });
}

window.filterRecipeCategory = function(category) {
  currentRecipeCategory = category;
  const recipeFilters = document.getElementById("recipe-filters");
  if (recipeFilters) {
    recipeFilters.querySelectorAll(".filter-btn").forEach(btn => btn.classList.remove("active"));
  }
  if (window.event && window.event.currentTarget) {
    window.event.currentTarget.classList.add("active");
  }
  renderRecipes(allRecipes);
};

function renderRecipes(recipes) {
  const container = document.getElementById("recipes-container");
  if (!container) return;
  container.innerHTML = "";

  let listToRender = currentRecipeCategory === "todos" 
    ? [...recipes] 
    : recipes.filter(r => r.category === currentRecipeCategory);

  if (listToRender.length === 0) {
    container.innerHTML = `<p style="text-align:center; width:100%; color:#666; margin-top:20px;">Nenhuma receita encontrada para esta categoria.</p>`;
    return;
  }

  listToRender.forEach((recipe) => {
    const card = document.createElement("div");
    card.className = "recipe-card";
    card.onclick = (e) => {
      if (e.target.closest('.admin-card-actions') || e.target.closest('.carousel-btn') || e.target.closest('.carousel-dots')) return;
      openRecipeDetailModal(recipe.id);
    };

    let imagesList = Array.isArray(recipe.images) && recipe.images.length > 0 ? recipe.images : (recipe.image ? [recipe.image] : ["https://via.placeholder.com/300x200?text=Receita"]);
    const hasMultipleImages = imagesList.length > 1;
    const slidesHTML = imagesList.map(img => `<img src="${img}" alt="${recipe.title}" class="carousel-img">`).join('');
    
    const dotsHTML = hasMultipleImages 
      ? `<div class="carousel-dots">${imagesList.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}" onclick="event.stopPropagation(); setCarouselSlide('recipe-${recipe.id}',${i})"></span>`).join('')}</div>`
      : '';

    const navButtons = hasMultipleImages ? `
      <button type="button" class="carousel-btn prev" onclick="event.stopPropagation(); moveCarousel('recipe-${recipe.id}', -1)"><i class="fa-solid fa-chevron-left"></i></button>
      <button type="button" class="carousel-btn next" onclick="event.stopPropagation(); moveCarousel('recipe-${recipe.id}', 1)"><i class="fa-solid fa-chevron-right"></i></button>
    ` : '';

    let adminControls = isAdminLoggedIn ? `
      <div class="admin-card-actions" style="margin-top: 15px; display: flex; gap: 8px;">
        <button class="btn-edit-prod" onclick="event.stopPropagation(); editRecipe('${recipe.id}')">
          <i class="fa-solid fa-pen"></i> Editar
        </button>
        <button class="btn-delete-prod" onclick="event.stopPropagation(); deleteRecipe('${recipe.id}')">
          <i class="fa-solid fa-trash"></i> Excluir
        </button>
      </div>
    ` : "";

    const categoryBadge = recipe.category ? `<span class="recipe-product-tag" style="background:#f1c40f; color:#333;"><i class="fa-solid fa-tag"></i> ${recipe.category.toUpperCase()}</span>` : '';
    const productBadge = recipe.relatedProduct ? `<span class="recipe-product-tag"><i class="fa-solid fa-fish"></i> ${recipe.relatedProduct}</span>` : '';

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
        <div style="display:flex; gap:5px; flex-wrap:wrap; margin-bottom:8px;">
          ${categoryBadge}
          ${productBadge}
        </div>
        <p class="recipe-desc">${recipe.ingredients ? `<strong>Ingredientes:</strong><br>${recipe.ingredients.replace(/\n/g, '<br>')}` : ''}</p>
        <p class="recipe-desc" style="margin-top: 8px;">${recipe.instructions ? `<strong>Modo de Preparo:</strong><br>${recipe.instructions.replace(/\n/g, '<br>')}` : ''}</p>
        ${adminControls}
      </div>
    `;
    container.appendChild(card);
  });
}

function renderProducts(products) {
  const container = document.getElementById("products-container");
  if (!container) return;
  container.innerHTML = "";

  let listToRender = currentCategory === "todos" 
    ? [...products] 
    : currentCategory === "promocoes"
      ? products.filter(p => p.isOnSale)
      : products.filter(p => p.category === currentCategory);

  listToRender.sort((a, b) => {
    if (a.isOutOfStock && !b.isOutOfStock) return 1;
    if (!a.isOutOfStock && b.isOutOfStock) return -1;
    if (a.isOnSale && !b.isOnSale) return -1;
    if (!a.isOnSale && b.isOnSale) return 1;
    return 0;
  });

  listToRender.forEach((product) => {
    const card = document.createElement("div");
    card.className = `product-card ${product.isOutOfStock ? 'out-of-stock' : ''} ${product.isOnSale ? 'on-sale' : ''}`;
    card.onclick = (e) => {
      if (e.target.closest('.admin-card-actions') || e.target.closest('.add-cart-btn') || e.target.closest('.carousel-btn') || e.target.closest('.carousel-dots')) {
        return;
      }
      openProductDetailModal(product.id);
    };

    let imagesList = Array.isArray(product.images) && product.images.length > 0 ? product.images : (product.image ? [product.image] : ["https://via.placeholder.com/300x200?text=Sem+Imagem"]);
    const hasMultipleImages = imagesList.length > 1;
    const slidesHTML = imagesList.map(img => `<img src="${img}" alt="${product.name}" class="carousel-img">`).join('');
    
    const dotsHTML = hasMultipleImages 
      ? `<div class="carousel-dots">${imagesList.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}" onclick="event.stopPropagation(); setCarouselSlide('${product.id}',${i})"></span>`).join('')}</div>`
      : '';
    const navButtons = hasMultipleImages ? `
      <button type="button" class="carousel-btn prev" onclick="event.stopPropagation(); moveCarousel('${product.id}', -1)"><i class="fa-solid fa-chevron-left"></i></button>
      <button type="button" class="carousel-btn next" onclick="event.stopPropagation(); moveCarousel('${product.id}', 1)"><i class="fa-solid fa-chevron-right"></i></button>
    ` : '';

    let adminControls = isAdminLoggedIn ? `
      <div class="admin-card-actions" style="margin-top: 15px; display: flex; gap: 8px;">
        <button class="btn-edit-prod" onclick="event.stopPropagation(); openProductModal('${product.id}')">
          <i class="fa-solid fa-pen"></i> Editar
        </button>
        <button class="btn-delete-prod" onclick="event.stopPropagation(); deleteProduct('${product.id}')">
          <i class="fa-solid fa-trash"></i> Excluir
        </button>
      </div>
    ` : "";

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

    const outOfStockBadge = product.isOutOfStock ? `<span class="badge-out-of-stock">ESGOTADO</span>` : '';

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
  dots.forEach((dot, i) => dot.classList.toggle("active", i === index));
};

function setupDragAndDrop() {
  const dropZone = document.getElementById("drop-zone");
  if (!dropZone) return;
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
  });
  ['dragenter', 'dragover'].forEach(eventName => { dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false); });
  ['dragleave', 'drop'].forEach(eventName => { dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false); });
  dropZone.addEventListener('drop', (e) => { processImageFiles(e.dataTransfer.files); }, false);
}

function setupRecipeDragAndDrop() {
  const dropZone = document.getElementById("recipe-drop-zone");
  if (!dropZone) return;
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
  });
  dropZone.addEventListener('drop', (e) => { processRecipeImageFiles(e.dataTransfer.files); }, false);
}

window.handleImageFileSelect = (e) => processImageFiles(e.target.files);
window.handleRecipeImageFileSelect = async (event) => {
  if (event.target.files) await processRecipeImageFiles(event.target.files);
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
  const container = document.getElementById("recipe-images-preview");
  if (!container) return;
  container.innerHTML = "";
  currentRecipeImages.forEach((imgSrc, index) => {
    const thumb = document.createElement("div");
    thumb.className = "preview-thumb";
    thumb.innerHTML = `
      <img src="${imgSrc}" alt="Previsualização">
      <button type="button" class="preview-thumb-remove" onclick="removeRecipeImage(${index})">&times;</button>
    `;
    container.appendChild(thumb);
  });
}

window.removeImagePreview = (index) => { currentProductImages.splice(index, 1); renderImagePreviews(); };
window.removeRecipeImage = (index) => { currentRecipeImages.splice(index, 1); renderRecipeImagePreviews(); };

window.openProductModal = function(productId = null) {
  const modal = document.getElementById("admin-modal");
  const form = document.getElementById("product-form");

  if (productId) {
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
    if (form) form.reset();
    document.getElementById("prod-id").value = "";
    document.getElementById("prod-promo-price").value = "";
    document.getElementById("prod-out-of-stock").checked = false;
    document.getElementById("prod-on-sale").checked = false;
    currentProductImages = [];
  }
  window.togglePromoInput();
  renderImagePreviews();
  if (modal) modal.classList.add("open");
};

window.closeProductModal = () => document.getElementById("admin-modal")?.classList.remove("open");
window.togglePromoInput = () => {
  const isChecked = document.getElementById("prod-on-sale")?.checked;
  const promoRow = document.getElementById("promo-price-row");
  if (promoRow) promoRow.style.display = isChecked ? "flex" : "none";
};

window.populateRecipeProductSelect = function(categoryFilter = null) {
  const select = document.getElementById("recipe-prod-select");
  if (!select) return;
  select.innerHTML = '<option value="">Nenhum produto associado</option>';
  let filteredProducts = allProducts;
  if (categoryFilter && categoryFilter !== "outros") {
    filteredProducts = allProducts.filter(p => p.category === categoryFilter);
  }
  filteredProducts.forEach(prod => {
    select.innerHTML += `<option value="${prod.name}" data-category="${prod.category}">${prod.name}</option>`;
  });
};

window.handleRecipeVideoFileSelect = function(event) {
  const file = event.target.files[0];
  if (!file || !file.type.startsWith('video/')) return;
  
  // O Firestore limita documentos a 1MB (~1.048.576 bytes). 
  // Avisamos o usuário caso o vídeo ultrapasse 800KB para garantir margem de segurança.
  if (file.size > 800 * 1024) {
    alert("O vídeo selecionado é muito grande para ser salvo diretamente no banco de dados (Limite máximo de ~800KB). Por favor, escolha um vídeo mais curto ou compactado.");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => { 
    currentRecipeVideo = e.target.result; 
    renderRecipeVideoPreview(); 
  };
  reader.readAsDataURL(file);
};


window.openRecipeModal = function() {
  document.getElementById("recipe-id-input").value = "";
  document.getElementById("recipe-form").reset();
  currentRecipeImages = [];
  currentRecipeVideo = null;
  renderRecipeImagePreviews();
  renderRecipeVideoPreview();
  populateRecipeProductSelect(""); 
  const modal = document.getElementById("recipe-modal");
  if (modal) modal.classList.add("open");
};

// Nova função para fechar o Modal de Receita
window.closeRecipeModal = function() {
  document.getElementById("recipe-modal")?.classList.remove("open");
};

window.editRecipe = function(recipeId) {
  const recipe = allRecipes.find(r => r.id === recipeId);
  if (!recipe) return;
  const category = recipe.category || "";
  document.getElementById("recipe-category").value = category;
  populateRecipeProductSelect(category);

  document.getElementById("recipe-id-input").value = recipe.id;
  document.getElementById("recipe-title").value = recipe.title || "";
  document.getElementById("recipe-desc-input").value = recipe.description || "";
  document.getElementById("recipe-prod-select").value = recipe.relatedProduct || "";
  document.getElementById("recipe-ingredients").value = recipe.ingredients || "";
  document.getElementById("recipe-instructions").value = recipe.instructions || "";

  currentRecipeImages = Array.isArray(recipe.images) ? [...recipe.images] : (recipe.image ? [recipe.image] : []);
  currentRecipeVideo = recipe.video || null;
  
  renderRecipeImagePreviews();
  renderRecipeVideoPreview();
  window.closeRecipeDetailModal();
  document.getElementById("recipe-modal")?.classList.add("open");
};

function renderRecipeVideoPreview() {
  const container = document.getElementById("recipe-video-preview");
  if (!container) return;
  if (currentRecipeVideo) {
    container.innerHTML = `
      <div class="preview-thumb" style="width: 140px; height: 90px; border-radius: 8px;">
        <video src="${currentRecipeVideo}" style="width:100%; height:100%; object-fit:cover;"></video>
        <button type="button" class="preview-thumb-remove" onclick="removeRecipeVideo()">&times;</button>
      </div>
    `;
  } else {
    container.innerHTML = "";
  }
}

window.removeRecipeVideo = () => {
  currentRecipeVideo = null;
  document.getElementById("recipe-video-input").value = "";
  renderRecipeVideoPreview();
};

window.handleRecipeSubmit = async function(e) {
  e.preventDefault();
  if (!auth.currentUser) return;
  const saveBtn = document.getElementById("btn-save-recipe");
  if (saveBtn) { saveBtn.innerText = "Salvando..."; saveBtn.disabled = true; }

  const recipeId = document.getElementById("recipe-id-input").value;
  const recipeData = {
    title: document.getElementById("recipe-title").value.toUpperCase(),
    description: document.getElementById("recipe-desc-input").value,
    category: document.getElementById("recipe-category").value,
    relatedProduct: document.getElementById("recipe-prod-select").value,
    ingredients: document.getElementById("recipe-ingredients").value,
    instructions: document.getElementById("recipe-instructions").value,
    images: currentRecipeImages,
    video: currentRecipeVideo
  };

  try {
    if (recipeId) {
      await updateDoc(doc(db, "recipes", recipeId), recipeData);
      alert("Receita atualizada com sucesso!");
    } else {
      await addDoc(collection(db, "recipes"), recipeData);
      alert("Receita criada com sucesso!");
    }
    window.closeRecipeModal();
  } catch (error) {
    alert(`Erro ao salvar: ${error.message}`);
  } finally {
    if (saveBtn) { saveBtn.innerText = "Salvar Receita"; saveBtn.disabled = false; }
  }  
};

window.openRecipeDetailModal = function(recipeId) {
  const recipe = allRecipes.find(r => r.id === recipeId);
  if (!recipe) return;

  const modal = document.getElementById("recipe-detail-modal");
  document.getElementById("modal-recipe-title").innerText = recipe.title;
  
  const descElement = document.getElementById("modal-recipe-desc");
  if (recipe.description) {
    descElement.innerText = recipe.description;
    descElement.style.display = "block";
  } else {
    descElement.style.display = "none";
  }

  const videoContainer = document.getElementById("modal-recipe-video-container");
  if (recipe.video) {
    // max-height alterado de 400px para 220px e object-fit para contain
    videoContainer.innerHTML = `<video controls src="${recipe.video}" style="width:100%; max-height:220px; border-radius:8px; object-fit:contain; background:#000; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"></video>`;
    videoContainer.style.display = "block";
  } else {
    videoContainer.innerHTML = "";
    videoContainer.style.display = "none";
  }

  document.getElementById("modal-recipe-tag").innerHTML = recipe.relatedProduct 
    ? `<span class="recipe-sheet-tag" style="background:#f1c40f; padding:5px 10px; border-radius:12px; font-weight:bold;"><i class="fa-solid fa-fish"></i> Ingrediente Principal: ${recipe.relatedProduct}</span>` 
    : "";

  const media1 = document.getElementById("modal-recipe-media-1");
  const media2 = document.getElementById("modal-recipe-media-2");
  
  let imagesList = Array.isArray(recipe.images) && recipe.images.length > 0 ? recipe.images : (recipe.image ? [recipe.image] : []);
  
  if (imagesList.length > 0) {
    // max-height inserido (220px) e object-fit:contain
    media1.innerHTML = `<img src="${imagesList[0]}" alt="Preparo 1" style="width: 100%; max-height: 250px; object-fit: contain; display: block; margin: 0 auto; border-radius: 8px;">`;    media1.style.display = "block";
    setupImageZoom(media1.querySelector('img'));
  } else {
    media1.style.display = "none";
  }

  if (imagesList.length > 1) {
    // max-height inserido (220px) e object-fit:contain
    media2.innerHTML = `<img src="${imagesList[imagesList.length - 1]}" alt="Prato Finalizado" style="width: 100%; max-height: 220px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); object-fit:contain; background:#f8fafc;">`;
    media2.style.display = "block";
    setupImageZoom(media2.querySelector('img'));
  } else {
    media2.style.display = "none";
  }

  document.getElementById("modal-recipe-ingredients").innerHTML = recipe.ingredients ? recipe.ingredients.replace(/\n/g, '<br>') : "";
  document.getElementById("modal-recipe-instructions").innerHTML = recipe.instructions ? recipe.instructions.replace(/\n/g, '<br>') : "";

  if (modal) modal.classList.add("open");
};

window.closeRecipeDetailModal = function() {
  const modal = document.getElementById("recipe-detail-modal");
  if (modal) modal.classList.remove("open");
  const videoContainer = document.getElementById("modal-recipe-video-container");
  if (videoContainer) videoContainer.innerHTML = "";
};

window.deleteRecipe = async function(id) {
  if (!auth.currentUser) return alert("Ação não permitida.");
  if (!confirm("Tem certeza que deseja excluir esta receita?")) return;
  try {
    await deleteDoc(doc(db, "recipes", id));
    alert("Receita removida com sucesso!");
  } catch (error) {
    alert("Erro ao excluir receita: " + error.message);
  }
};

window.handleProductSubmit = async function(e) {
  e.preventDefault();
  if (!auth.currentUser) return alert("Acesso negado.");
  if (currentProductImages.length === 0) return alert("Adicione pelo menos uma imagem.");
  
  const isOnSale = document.getElementById("prod-on-sale").checked;
  const promoPriceVal = parseFloat(document.getElementById("prod-promo-price").value);
  if (isOnSale && (isNaN(promoPriceVal) || promoPriceVal <= 0)) return alert("Preço de promoção inválido.");

  const saveBtn = document.getElementById("btn-save-product");
  if (saveBtn) { saveBtn.innerText = "Salvando..."; saveBtn.disabled = true; }

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
    if (id && id.trim() !== "") await updateDoc(doc(db, "products", id), prodData);
    else await addDoc(collection(db, "products"), prodData);
    alert("Produto salvo com sucesso!");
    window.closeProductModal();
  } catch (error) {
    alert(`Erro ao salvar: ${error.message}`);
  } finally {
    if (saveBtn) { saveBtn.innerText = "Salvar Produto"; saveBtn.disabled = false; }
  }
};

window.deleteProduct = async function(id) {
  if (!auth.currentUser) return alert("Ação não permitida.");
  if (!confirm("Tem certeza que deseja excluir este produto?")) return;
  try {
    await deleteDoc(doc(db, "products", id));
    alert("Produto removido com sucesso!");
  } catch (error) {
    alert("Erro ao excluir produto: " + error.message);
  }
};

window.filterCategory = function(category) {
  currentCategory = category;
  document.querySelectorAll("#sec-catalogo .filter-btn").forEach(btn => btn.classList.remove("active"));
  if (window.event && window.event.currentTarget) window.event.currentTarget.classList.add("active");
  renderProducts(allProducts);
};

window.addToCart = function(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (product && product.isOutOfStock) return alert("Produto esgotado.");
  const finalPrice = (product.isOnSale && product.promoPrice) ? Number(product.promoPrice) : Number(product.price);
  const cartProduct = { ...product, price: finalPrice };
  const existingItem = cart.find(item => item.id === productId);
  if (existingItem) existingItem.quantity += 1;
  else cart.push({ ...cartProduct, quantity: 1 });
  updateCartUI();
  window.toggleCart(true);
};

window.toggleDeliveryFields = () => {
  const type = document.getElementById("checkout-type")?.value;
  const deliveryFields = document.getElementById("delivery-fields");
  if (deliveryFields) deliveryFields.style.display = type === "entrega" ? "block" : "none";
  updateCartUI();
};

window.toggleTrocoField = () => {
  const payment = document.getElementById("checkout-pagamento")?.value;
  const trocoGroup = document.getElementById("troco-group");
  if (trocoGroup) trocoGroup.style.display = payment === "dinheiro" ? "block" : "none";
};

window.toggleNoNumber = (checkbox) => {
  const numInput = document.getElementById("checkout-numero");
  if (numInput) {
    if (checkbox.checked) { numInput.value = "S/N"; numInput.disabled = true; } 
    else { numInput.value = ""; numInput.disabled = false; }
  }
};

window.fetchAddressByCEP = async function() {
  const cepInput = document.getElementById("checkout-cep");
  if (!cepInput) return;
  const cep = cepInput.value.replace(/\D/g, "");
  if (cep.length !== 8) return;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await response.json();
    if (data.erro) return alert("CEP não encontrado.");
    document.getElementById("checkout-cidade").value = `${data.localidade} - ${data.uf}`;
    document.getElementById("checkout-bairro").value = data.bairro || "";
    document.getElementById("checkout-rua").value = data.logradouro || "";
  } catch (error) {
    alert("Não foi possível consultar o CEP.");
  }
};

window.sendOrderToWhatsApp = function() {
  if (cart.length === 0) return alert("Seu carrinho está vazio!");
  const deliveryType = document.getElementById("checkout-type")?.value;
  let deliveryDetails = "";
  const taxaDelivery = deliveryType === "entrega" ? 5.00 : 0;

  if (deliveryType === "entrega") {
    const cep = document.getElementById("checkout-cep")?.value.trim();
    const cidade = document.getElementById("checkout-cidade")?.value.trim();
    const bairro = document.getElementById("checkout-bairro")?.value.trim();
    const rua = document.getElementById("checkout-rua")?.value.trim();
    const numero = document.getElementById("checkout-numero")?.value.trim();
    const complemento = document.getElementById("checkout-complemento")?.value.trim();
    const referencia = document.getElementById("checkout-referencia")?.value.trim();
    if (!cep || !cidade || !bairro || !rua || !numero || !referencia) return alert("Preencha todos os campos obrigatórios.");
    deliveryDetails = `\n*Tipo:* Entrega\n*CEP:* ${cep}\n*Cidade:* ${cidade}\n*Bairro:* ${bairro}\n*Rua:* ${rua}, Nº ${numero}\n*Complemento:* ${complemento || "Nenhum"}\n*Ponto de Referência:* ${referencia}`;
  } else {
    deliveryDetails = `\n*Tipo:* Retirada no Balcão`;
  }

  const pagamento = document.getElementById("checkout-pagamento")?.value.toUpperCase();
  const troco = document.getElementById("checkout-troco")?.value.trim();
  const obs = document.getElementById("checkout-obs")?.value.trim();
  if (!pagamento) return alert("Selecione a forma de pagamento.");
  if (pagamento === "DINHEIRO" && !troco) return alert("Informe se precisa de troco.");

  let message = "*NOVO PEDIDO - PESCADOS CAPARAÓ*\n\n*ITENS DO PEDIDO:*\n";
  let itemsTotal = 0;
  cart.forEach(item => {
    const subtotal = item.price * item.quantity;
    itemsTotal += subtotal;
    message += `• *${item.name}*\n  Qtd/Peso: ${item.quantity} ${item.unit} | R$ ${subtotal.toFixed(2)}\n`;
  });
  const totalGeral = itemsTotal + taxaDelivery;

  message += `\n*RESUMO DA COMPRA:*\nSubtotal: R$ ${itemsTotal.toFixed(2)}`;
  if (deliveryType === "entrega") message += `\nTaxa de Entrega: R$ ${taxaDelivery.toFixed(2)}`;
  message += `\n*Total Geral:* R$ ${totalGeral.toFixed(2)}\n\n*DADOS DE ENTREGA:*${deliveryDetails}\n\n*PAGAMENTO:*\n*Forma:* ${pagamento}`;
  if (pagamento === "DINHEIRO" && troco) message += `\n*Troco para:* ${troco}`;
  if (obs) message += `\n\n*OBSERVAÇÕES:*\n${obs}`;

  window.open(`https://wa.me/5528999868639?text=${encodeURIComponent(message)}`, "_blank");
};

window.updateQuantity = (index, value) => { cart[index].quantity = parseFloat(value) || 1; updateCartUI(); };
window.removeFromCart = (index) => { cart.splice(index, 1); updateCartUI(); };

window.toggleCart = (forceOpen = false) => {
  const sidebar = document.getElementById("cart-sidebar");
  const overlay = document.getElementById("cart-overlay");
  if (!sidebar || !overlay) return;
  if (forceOpen || !sidebar.classList.contains("open")) { sidebar.classList.add("open"); overlay.classList.add("open"); } 
  else { sidebar.classList.remove("open"); overlay.classList.remove("open"); }
};

window.showSection = (sectionId) => {
  document.querySelectorAll(".content-section").forEach(sec => sec.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
  document.getElementById(`sec-${sectionId}`)?.classList.add("active");
  if (window.event && window.event.currentTarget) window.event.currentTarget.classList.add("active");
  document.getElementById("main-nav")?.classList.remove("show");
};

window.openProductDetailModal = function(productId) {
  const prod = allProducts.find(p => p.id === productId);
  if (!prod) return;
  const modal = document.getElementById("product-detail-modal");
  document.getElementById("modal-product-title").innerText = prod.name;
  document.getElementById("modal-product-desc").innerText = prod.desc || "Sem descrição disponível.";

  const mediaContainer = document.getElementById("modal-product-media");
  let imagesList = Array.isArray(prod.images) && prod.images.length > 0 ? prod.images : (prod.image ? [prod.image] : ["https://via.placeholder.com/300x200?text=Sem+Imagem"]);
  const slidesHTML = imagesList.map(img => `<img src="${img}" alt="${prod.name}" class="carousel-img" style="object-fit:cover;">`).join('');
  const dotsHTML = imagesList.length > 1 ? `<div class="carousel-dots">${imagesList.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}" onclick="setModalCarouselSlide(${i})"></span>`).join('')}</div>` : '';
  const navButtons = imagesList.length > 1 ? `<button type="button" class="carousel-btn prev" onclick="moveModalCarousel(-1)"><i class="fa-solid fa-chevron-left"></i></button><button type="button" class="carousel-btn next" onclick="moveModalCarousel(1)"><i class="fa-solid fa-chevron-right"></i></button>` : '';

  mediaContainer.innerHTML = `<div class="carousel-container" id="modal-carousel" data-index="0" data-total="${imagesList.length}"><div class="carousel-slide" id="modal-carousel-slide">${slidesHTML}</div>${navButtons}${dotsHTML}</div>`;

  // Aplica o Zoom nas imagens do Modal do Produto!
  const modalImgs = mediaContainer.querySelectorAll('.carousel-img');
  modalImgs.forEach(img => setupImageZoom(img));

  const priceContainer = document.getElementById("modal-product-price");
  if (prod.isOnSale && prod.promoPrice && Number(prod.promoPrice) < Number(prod.price)) {
    priceContainer.innerHTML = `<div class="price-container"><span class="old-price">R$ ${Number(prod.price).toFixed(2)}</span><span class="product-price promo">R$ ${Number(prod.promoPrice).toFixed(2)} <small>/ ${prod.unit}</small></span></div>`;
  } else {
    priceContainer.innerHTML = `<div class="product-price">R$ ${Number(prod.price).toFixed(2)} <small>/ ${prod.unit}</small></div>`;
  }

  const buyBtn = document.getElementById("modal-product-buy-btn");
  if (prod.isOutOfStock) {
    buyBtn.className = "add-cart-btn btn-disabled"; buyBtn.disabled = true; buyBtn.innerHTML = `<i class="fa-solid fa-ban"></i> Esgotado`;
  } else {
    buyBtn.className = "add-cart-btn"; buyBtn.disabled = false; buyBtn.innerHTML = `<i class="fa-solid fa-cart-shopping"></i> Adicionar ao Carrinho`;
    buyBtn.onclick = () => { addToCart(prod.id); closeProductDetailModal(); };
  }
  if (modal) modal.classList.add("open");
};

window.moveModalCarousel = (direction) => {
  const carousel = document.getElementById("modal-carousel");
  if (!carousel) return;
  const total = parseInt(carousel.getAttribute("data-total")) || 1;
  window.setModalCarouselSlide((parseInt(carousel.getAttribute("data-index")) || 0 + direction + total) % total);
};

window.setModalCarouselSlide = (index) => {
  const carousel = document.getElementById("modal-carousel");
  const slide = document.getElementById("modal-carousel-slide");
  if (!carousel || !slide) return;
  carousel.setAttribute("data-index", index);
  slide.style.transform = `translateX(-${index * 100}%)`;
  carousel.querySelectorAll(".carousel-dot").forEach((dot, i) => dot.classList.toggle("active", i === index));
};

window.closeProductDetailModal = () => document.getElementById("product-detail-modal")?.classList.remove("open");
window.openAboutModal = () => document.getElementById("about-modal")?.classList.add("open");
window.closeAboutModal = () => document.getElementById("about-modal")?.classList.remove("open");

window.toggleMobileMenu = (event) => {
  if (event) event.stopPropagation();
  document.getElementById("main-nav")?.classList.toggle("show");
};

window.addEventListener("click", (event) => {
  const nav = document.getElementById("main-nav");
  const toggleBtn = document.getElementById("menu-toggle-btn");
  if (nav && nav.classList.contains("show") && !nav.contains(event.target) && (!toggleBtn || !toggleBtn.contains(event.target))) {
    nav.classList.remove("show");
  }
  if (event.target.classList.contains("modal-overlay")) event.target.classList.remove("open");
});

window.openDeliveryModal = () => {
  if (cart.length === 0) return alert("Seu carrinho está vazio!");
  toggleCart(false);
  document.getElementById("delivery-modal")?.classList.add("open");
  updateCartUI();
};
window.closeDeliveryModal = () => document.getElementById("delivery-modal")?.classList.remove("open");

function updateCartUI() {
  const cartItemsContainer = document.getElementById("cart-items");
  const cartCount = document.getElementById("cart-count");
  const cartTotal = document.getElementById("cart-total-price");
  const modalTotal = document.getElementById("modal-total-price");
  if (!cartItemsContainer) return;
  cartItemsContainer.innerHTML = "";
  let itemsSubtotal = 0, itemCount = 0;

  cart.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;
    itemsSubtotal += itemTotal; itemCount += 1;
    cartItemsContainer.innerHTML += `
      <div class="cart-item">
        <div class="cart-item-header"><span>${item.name}</span><span>R$ ${itemTotal.toFixed(2)}</span></div>
        <div class="cart-item-controls">
          <label>Qtd (${item.unit}):</label>
          <input type="number" step="0.1" min="0.1" value="${item.quantity}" onchange="updateQuantity(${index}, this.value)">
          <button onclick="removeFromCart(${index})" style="color:#76190f; background:none; border:none; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
  });

  const taxa = (document.getElementById("checkout-type")?.value || "entrega") === "entrega" ? 5.00 : 0;
  if (cartCount) cartCount.innerText = itemCount;
  if (cartTotal) cartTotal.innerText = `R$ ${itemsSubtotal.toFixed(2)}`;
  if (modalTotal) modalTotal.innerText = `R$ ${(itemsSubtotal + taxa).toFixed(2)}`;
}