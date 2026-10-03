// /js/auth.js
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { 
  doc, 
  setDoc, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { db, auth } from './firebase.js';

// Observador de Estado de Autenticação do Cliente
onAuthStateChanged(auth, async (user) => {
  const clientNavBtn = document.getElementById("client-auth-btn");
  if (user) {
    if (clientNavBtn) {
      clientNavBtn.textContent = "Minha Conta";
      clientNavBtn.onclick = () => window.openClientAccountModal(); 
    }
    await loadClientData(user);
  } else {
    if (clientNavBtn) {
      clientNavBtn.textContent = "Entrar / Cadastrar";
      clientNavBtn.onclick = () => window.openAuthModal(); 
    }
    window.currentClientData = null;
  }
});

// ==========================================
// FUNÇÕES EXPOSTAS NO WINDOW (Para uso nos Onclicks do HTML)
// ==========================================

window.openAuthModal = function() {
  const modal = document.getElementById("client-auth-modal");
  if (modal) modal.classList.add("open");
};

window.closeAuthModal = function() {
  const modal = document.getElementById("client-auth-modal");
  if (modal) modal.classList.remove("open");
};

window.openClientAccountModal = function() {
  const modal = document.getElementById("client-account-modal");
  if (modal) modal.classList.add("open");
  
  if (window.currentClientData) {
    const nameEl = document.getElementById("client-profile-name");
    const phoneEl = document.getElementById("client-profile-phone");
    const countEl = document.getElementById("client-order-count");
    if (nameEl) nameEl.value = window.currentClientData.name || "";
    if (phoneEl) phoneEl.value = window.currentClientData.phone || "";
    if (countEl) countEl.innerText = window.currentClientData.orderCount || 0;
  }
};

window.closeClientAccountModal = function() {
  const modal = document.getElementById("client-account-modal");
  if (modal) modal.classList.remove("open");
};

// Login com Google
window.loginWithGoogle = async function() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    await ensureClientDocExists(user, user.displayName, "");
    alert("Login realizado com sucesso!");
    window.closeAuthModal();
  } catch (error) {
    console.error("Erro no login com Google:", error);
    alert("Erro ao entrar com Google: " + error.message);
  }
};

// Login com E-mail e Senha
window.loginWithEmail = async function(e) {
  if (e) e.preventDefault();
  const email = document.getElementById("login-email")?.value;
  const password = document.getElementById("login-password")?.value;
  
  if (!email || !password) {
    alert("Preencha todos os campos de login.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert("Login efetuado com sucesso!");
    window.closeAuthModal();
  } catch (error) {
    alert("Erro ao fazer login: Verifique seu e-mail e senha.");
  }
};

// Cadastro com E-mail, Senha e Validação de Telefone (OTP)
window.registerWithEmail = async function(e) {
  if (e) e.preventDefault();
  const name = document.getElementById("reg-name")?.value;
  const email = document.getElementById("reg-email")?.value;
  const password = document.getElementById("reg-password")?.value;
  const confirmPassword = document.getElementById("reg-confirm-password")?.value;
  const phone = document.getElementById("reg-phone")?.value;
  const verificationCodeInput = document.getElementById("reg-verification-code")?.value;

  if (password !== confirmPassword) {
    alert("As senhas não coincidem!");
    return;
  }
  
  const expectedCode = window.currentVerificationCode;
  if (!expectedCode || verificationCodeInput !== expectedCode) {
    alert("Código de confirmação do número inválido ou não verificado!");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await ensureClientDocExists(userCredential.user, name, phone);
    alert("Cadastro realizado com sucesso!");
    window.closeAuthModal();
  } catch (error) {
    alert("Erro no cadastro: " + error.message);
  }
};

// Envio de código de confirmação para o WhatsApp/Telefone de verdade
window.sendPhoneVerificationCode = function() {
  const phoneInput = document.getElementById("reg-phone");
  let phone = phoneInput ? phoneInput.value.replace(/\D/g, "") : "";
  
  if (!phone || phone.length < 10) {
    alert("Digite um número de celular válido com DDD (ex: 28999999999).");
    return;
  }

  // Adiciona o DDI do Brasil (55) caso não tenha
  if (!phone.startsWith("55")) {
    phone = "55" + phone;
  }
  
  // Gera um código numérico de 4 dígitos aleatório
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  window.currentVerificationCode = code;

  // Mensagem que vai para o WhatsApp
  const message = `*PESCADOS CAPARAÓ - VERIFICAÇÃO*\n\nOlá! Seu código de confirmação para cadastro na peixaria é: *${code}*`;

  // Abre o WhatsApp para enviar o código para o número do cliente cadastrado
  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  
  // Abre em uma nova aba para o disparo da mensagem
  window.open(whatsappUrl, "_blank");

  alert("O WhatsApp foi aberto para o envio do código de confirmação ao seu número. Verifique a mensagem recebida e digite o código abaixo.");

  const confirmGroup = document.getElementById("phone-verification-group");
  if (confirmGroup) confirmGroup.style.display = "block";
};

// Garantir que o documento do cliente existe no Firestore
async function ensureClientDocExists(user, name = "Cliente", phone = "") {
  const userRef = doc(db, "clients", user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      name: name || user.displayName || "Cliente",
      email: user.email,
      phone: phone,
      addresses: [],       
      savedOrders: [],     
      orderCount: 0,       
      coupons: ["BEMVINDO10"], 
      createdAt: new Date().toISOString()
    });
  }
}

// Carregar dados do cliente logado do banco de dados
async function loadClientData(user) {
  try {
    const userRef = doc(db, "clients", user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      window.currentClientData = snap.data();
    }
  } catch (error) {
    console.error("Erro ao carregar dados do cliente do banco:", error);
  }
}

window.clientLogout = async function() {
  try {
    await signOut(auth);
    window.closeClientAccountModal();
    alert("Você saiu da sua conta.");
  } catch (error) {
    console.error("Erro ao sair:", error);
  }
};

// Alternar abas do Modal (Login <-> Cadastro)
window.switchAuthTab = function(tab) {
  const loginForm = document.getElementById("form-login");
  const registerForm = document.getElementById("form-register");
  const loginBtn = document.getElementById("tab-login-btn");
  const registerBtn = document.getElementById("tab-register-btn");
  const modalTitle = document.getElementById("auth-modal-title");

  if (tab === 'login') {
    if (loginForm) loginForm.style.display = "block";
    if (registerForm) registerForm.style.display = "none";
    if (loginBtn) { loginBtn.style.background = "white"; loginBtn.style.fontWeight = "bold"; }
    if (registerBtn) { registerBtn.style.background = "transparent"; registerBtn.style.fontWeight = "normal"; }
    if (modalTitle) modalTitle.innerText = "Entrar na sua Conta";
  } else {
    if (loginForm) loginForm.style.display = "none";
    if (registerForm) registerForm.style.display = "block";
    if (registerBtn) { registerBtn.style.background = "white"; registerBtn.style.fontWeight = "bold"; }
    if (loginBtn) { loginBtn.style.background = "transparent"; loginBtn.style.fontWeight = "normal"; }
    if (modalTitle) modalTitle.innerText = "Criar Nova Conta";
  }
};