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

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCFCl3E2bnDc6iHHsfyctXPPCPOJ_zdm34",
  authDomain: "kingfish-pescados.firebaseapp.com",
  projectId: "kingfish-pescados",
  storageBucket: "kingfish-pescados.firebasestorage.app",
  messagingSenderId: "1004059536924",
  appId: "1:1004059536924:web:75dfdf348728a0634df9d9",
  measurementId: "G-7QZZ64PSS2"
};

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Garante que o login permaneça salvo no localStorage do navegador/celular
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Erro na persistência de login:", error);
});

// Variáveis de Estado Global
let cart = [];
let allProducts = [];
let allRecipes = [];
let currentCategory = "todos";
let isAdminLoggedIn = false;
let isAuthResolved = false; // Flag para aguardar restauração da sessão do Firebase

// ==========================================
// 1. GERENCIAMENTO DE AUTENTICAÇÃO E ADMIN
// ==========================================

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

function checkAdminRouteAccess() {
  if (!isAuthResolved) return;
  const isAdminHash = window.location.hash === "#admin";
  if (isAdminHash && !auth.currentUser) {
    const loginModal = document.getElementById("login-modal");
    if (loginModal) loginModal.classList.add("open");
  }
}

window.addEventListener("hashchange", checkAdminRouteAccess);

window.handleLogin = async function(e) {
  if (e) e.preventDefault();
  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");

  if (!emailInput || !passwordInput) return;

  try {
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    document.getElementById("login-modal")?.classList.remove("open");
    emailInput.value = "";
    passwordInput.value = "";
    alert("Login realizado com sucesso!");
  } catch (error) {
    console.error("Erro no login:", error);
    alert("Falha ao autenticar. Verifique email e senha.");
  }
};

window.handleLogout = async function() {
  try {
    await signOut(auth);
    alert("Você saiu do modo administrativo.");
    if (window.location.hash === "#admin") {
      window.location.hash = "";
    }
  } catch (error) {
    console.error("Erro ao deslogar:", error);
  }
};

// ==========================================
// 2. BUSCA AUTOMÁTICA DE CEP (VIACEP) E FORMULÁRIO
// ==========================================

window.fetchAddressByCEP = async function() {
  const cepInput = document.getElementById("checkout-cep");
  if (!cepInput) return;
  
  const cep = cepInput.value.replace(/\D/g, "");
  if (cep.length !== 8) {
    if (cep.length > 0) alert("CEP inválido! Digite os 8 números.");
    return;
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await response.json();

    if (data.erro) {
      alert("CEP não encontrado. Preencha os campos de endereço manualmente.");
      return;
    }

    const cidadeInput = document.getElementById("checkout-cidade");
    const bairroInput = document.getElementById("checkout-bairro");
    const ruaInput = document.getElementById("checkout-rua");

    if (cidadeInput) cidadeInput.value = `${data.localidade} - ${data.uf}`;
    if (bairroInput) bairroInput.value = data.bairro || "";
    if (ruaInput) ruaInput.value = data.logradouro || "";
  } catch (error) {
    console.error("Erro ao buscar CEP:", error);
    alert("Erro ao consultar CEP. Por favor, preencha o endereço manualmente.");
  }
};

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

// ==========================================
// 3. CARRINHO DE COMPRAS E ATUALIZAÇÃO DA UI
// ==========================================

window.toggleCart = function() {
  const cartSidebar = document.getElementById("cart-sidebar");
  if (cartSidebar) {
    cartSidebar.classList.toggle("open");
  }
};

window.addToCart = function(id, name, price, unit) {
  const existingItem = cart.find(item => item.id === id);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ id, name, price: parseFloat(price), unit, quantity: 1 });
  }
  updateCartUI();
  const cartSidebar = document.getElementById("cart-sidebar");
  if (cartSidebar && !cartSidebar.classList.contains("open")) {
    cartSidebar.classList.add("open");
  }
};

window.removeFromCart = function(index) {
  cart.splice(index, 1);
  updateCartUI();
};

window.updateQuantity = function(index, value) {
  const quantity = parseFloat(value);
  if (isNaN(quantity) || quantity <= 0) {
    removeFromCart(index);
  } else {
    cart[index].quantity = quantity;
    updateCartUI();
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
        <strong>${item.name}</strong>
        <span>R$ ${itemTotal.toFixed(2)}</span>
      </div>
      <div class="cart-item-controls">
        <label>Qtd (${item.unit}):</label>
        <input type="number" step="0.1" min="0.1" value="${item.quantity}" onchange="updateQuantity(${index}, this.value)">
        <button onclick="removeFromCart(${index})" style="color:#76190f; background:none; border:none; cursor:pointer;" title="Remover"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
    cartItemsContainer.appendChild(div);
  });

  const deliveryType = document.getElementById("checkout-type")?.value || "entrega";
  const taxaVal = parseFloat(document.getElementById("checkout-taxa")?.value) || 0;
  const taxa = deliveryType === "entrega" ? taxaVal : 0;
  const totalGeral = itemsSubtotal + taxa;

  if (cartCount) cartCount.innerText = itemCount;
  if (cartTotal) cartTotal.innerText = `R$ ${totalGeral.toFixed(2)}`;
}

// ==========================================
// 4. ENVIO DE PEDIDO PARA O WHATSAPP
// ==========================================

window.sendOrderToWhatsApp = function() {
  if (cart.length === 0) {
    alert("Seu carrinho está vazio!");
    return;
  }

  const deliveryType = document.getElementById("checkout-type")?.value;
  let deliveryDetails = "";
  let taxaDelivery = 0;

  if (deliveryType === "entrega") {
    const cep = document.getElementById("checkout-cep")?.value.trim();
    const cidade = document.getElementById("checkout-cidade")?.value.trim();
    const bairro = document.getElementById("checkout-bairro")?.value.trim();
    const rua = document.getElementById("checkout-rua")?.value.trim();
    const numero = document.getElementById("checkout-numero")?.value.trim();
    const complemento = document.getElementById("checkout-complemento")?.value.trim();
    const referencia = document.getElementById("checkout-referencia")?.value.trim();
    taxaDelivery = parseFloat(document.getElementById("checkout-taxa")?.value) || 0;

    if (!cep || !cidade || !rua || !numero) {
      alert("Por favor, preencha todos os campos obrigatórios de endereço (CEP, Cidade, Rua e Número).");
      return;
    }

    deliveryDetails = `
*Tipo:* Entrega
*CEP:* ${cep}
*Cidade:* ${cidade}
*Bairro:* ${bairro || "Não informado"}
*Rua:* ${rua}, Nº ${numero}
*Complemento:* ${complemento || "Nenhum"}
*Ponto de Referência:* ${referencia || "Nenhum"}`;
  } else {
    deliveryDetails = `\n*Tipo:* Retirada no Balcão`;
  }

  const pagamento = document.getElementById("checkout-pagamento")?.value.toUpperCase();
  const troco = document.getElementById("checkout-troco")?.value.trim();
  const obs = document.getElementById("checkout-obs")?.value.trim();

  let message = "*NOVO PEDIDO - PESCADOS CAPARAÓ*\n\n*ITENS DO PEDIDO:*\n";
  let itemsTotal = 0;

  cart.forEach(item => {
    const subtotal = item.price * item.quantity;
    itemsTotal += subtotal;
    message += `• *${item.name}*\n  Qtd/Peso: ${item.quantity} ${item.unit} | R$ ${subtotal.toFixed(2)}\n`;
  });

  const totalGeral = itemsTotal + (deliveryType === "entrega" ? taxaDelivery : 0);

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
    message += `\n*Troco para:* R$ ${troco}`;
  }

  if (obs) {
    message += `\n\n*OBSERVAÇÕES:*\n${obs}`;
  }

  const phoneNumbers = ["5528999868639"];
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${phoneNumbers[0]}?text=${encodedMessage}`;
  
  window.open(whatsappUrl, "_blank");
};

// ==========================================
// 5. FIRESTORE: CARREGAMENTO E RENDERIZAÇÃO
// ==========================================

function loadProducts() {
  const productsRef = collection(db, "products");
  onSnapshot(productsRef, (snapshot) => {
    allProducts = [];
    snapshot.forEach((doc) => {
      allProducts.push({ id: doc.id, ...doc.data() });
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
    snapshot.forEach((doc) => {
      allRecipes.push({ id: doc.id, ...doc.data() });
    });
    renderRecipes(allRecipes);
  }, (error) => {
    console.error("Erro ao carregar receitas:", error);
  });
}

function renderProducts(products) {
  const grid = document.getElementById("products-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const filtered = currentCategory === "todos" 
    ? products 
    : products.filter(p => p.category === currentCategory);

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #666;">Nenhum produto cadastrado nesta categoria.</p>`;
    return;
  }

  filtered.forEach((product) => {
    const card = document.createElement("div");
    card.className = "product-card";
    
    const imageSrc = (product.images && product.images.length > 0) ? product.images[0] : (product.imageUrl || 'https://via.placeholder.com/300x200?text=Sem+Imagem');

    card.innerHTML = `
      ${isAdminLoggedIn ? `
        <div class="admin-actions">
          <button onclick="editProduct('${product.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button onclick="deleteProduct('${product.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        </div>
      ` : ''}
      <img src="${imageSrc}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p class="product-desc">${product.description || ''}</p>
        <div class="product-price">
          R$ ${parseFloat(product.price).toFixed(2)} <small>/ ${product.unit || 'kg'}</small>
        </div>
        <button class="add-to-cart-btn" onclick="addToCart('${product.id}', '${product.name}', ${product.price}, '${product.unit || 'kg'}')">
          <i class="fa-solid fa-cart-plus"></i> Adicionar
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderRecipes(recipes) {
  const grid = document.getElementById("recipes-grid");
  if (!grid) return;
  grid.innerHTML = "";

  if (recipes.length === 0) {
    grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #666;">Nenhuma receita encontrada.</p>`;
    return;
  }

  recipes.forEach((recipe) => {
    const card = document.createElement("div");
    card.className = "recipe-card";
    const imageSrc = (recipe.images && recipe.images.length > 0) ? recipe.images[0] : (recipe.imageUrl || 'https://via.placeholder.com/300x200?text=Sem+Imagem');

    card.innerHTML = `
      ${isAdminLoggedIn ? `
        <div class="admin-actions">
          <button onclick="editRecipe('${recipe.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button onclick="deleteRecipe('${recipe.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        </div>
      ` : ''}
      <img src="${imageSrc}" alt="${recipe.title}">
      <div class="recipe-info">
        <h3>${recipe.title}</h3>
        <p>${recipe.description || ''}</p>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Filtros por Categoria
window.filterCategory = function(category, btnElement) {
  currentCategory = category;
  document.querySelectorAll(".category-btn").forEach(btn => btn.classList.remove("active"));
  if (btnElement) btnElement.classList.add("active");
  renderProducts(allProducts);
};

// ==========================================
// 6. OPERAÇÕES DE CRUD (PRODUTOS E RECEITAS)
// ==========================================

window.deleteProduct = async function(id) {
  if (confirm("Tem certeza que deseja excluir este produto?")) {
    try {
      await deleteDoc(doc(db, "products", id));
      alert("Produto excluído com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir produto:", error);
    }
  }
};

window.deleteRecipe = async function(id) {
  if (confirm("Tem certeza que deseja excluir esta receita?")) {
    try {
      await deleteDoc(doc(db, "recipes", id));
      alert("Receita excluída com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir receita:", error);
    }
  }
};

// ==========================================
// 7. INICIALIZAÇÃO
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  loadRecipes();
});