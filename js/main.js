// /js/main.js
import { auth } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

// Carrega todos os módulos da aplicação
import './ui.js';
import './auth.js';
import './conta.js';
import './catalogo.js';
import './receitas.js';

// ==========================================
// ESTADO GLOBAL DO APLICATIVO
// ==========================================
window.cart = [];
window.allProducts = [];
window.allRecipes = [];
window.allCategories = [];
window.currentCategory = "todos";
window.currentRecipeCategory = "todos";
window.isAdminLoggedIn = false;
window.isAuthResolved = false;
window.currentClientData = null;

// Estados para upload de mídias temporárias
window.currentProductImages = [];
window.currentRecipeImages1 = [];
window.currentRecipeImages2 = [];
window.currentRecipeVideo = null;

const ADMIN_EMAIL = "admin@teste.com";

// ==========================================
// INICIALIZAÇÃO E MONITORES
// ==========================================
onAuthStateChanged(auth, (user) => {
  window.isAuthResolved = true;
  const adminBar = document.getElementById("admin-bar");
  
  if (user && user.email === ADMIN_EMAIL) {
    window.isAdminLoggedIn = true;
    if (adminBar) adminBar.style.display = "flex";
  } else {
    window.isAdminLoggedIn = false;
    if (adminBar) adminBar.style.display = "none";
  }
  
  checkAdminRouteAccess();
  
  // Re-renderiza caso as listas já estejam carregadas para atualizar botões admin
  if (window.renderProducts) window.renderProducts(window.allProducts);
  if (window.renderRecipes) window.renderRecipes(window.allRecipes);
});

function checkAdminRouteAccess() {
  if (!window.isAuthResolved) return;
  if (window.location.hash === "#admin" && !auth.currentUser) {
    document.getElementById("login-modal")?.classList.add("open");
  }
}

window.addEventListener("hashchange", checkAdminRouteAccess);

document.addEventListener("DOMContentLoaded", () => {
  // Dispara inicializações provenientes de catalogo e receitas
  if (window.setupProductDragAndDrop) window.setupProductDragAndDrop();
  if (window.setupRecipeDragAndDrop) window.setupRecipeDragAndDrop();
  
  if (window.loadProducts) window.loadProducts();
  if (window.loadRecipes) window.loadRecipes();
  if (window.loadCategories) window.loadCategories();
});