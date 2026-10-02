import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// Configuração do Observador de Estado de Autenticação do Cliente
export function setupClientAuth(app, db, auth) {
  onAuthStateChanged(auth, async (user) => {
    const clientNavBtn = document.getElementById("client-auth-btn");
    if (user) {
      if (clientNavBtn) {
        clientNavBtn.textContent = "Minha Conta";
        clientNavBtn.onclick = () => openClientAccountModal(); 
      }
      await loadClientData(user, db);
    } else {
      if (clientNavBtn) {
        clientNavBtn.textContent = "Entrar / Cadastrar";
        clientNavBtn.onclick = () => openAuthModal(); 
      }
      window.currentClientData = null;
    }
  });
}

// Login com Google
export async function loginWithGoogle(auth, db) {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    await ensureClientDocExists(user, db, user.displayName, "");
    alert("Login realizado com sucesso!");
    closeAuthModal();
  } catch (error) {
    console.error("Erro no login com Google:", error);
    alert("Erro ao entrar com Google.");
  }
}

// Login com E-mail e Senha
export async function loginWithEmail(auth, email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert("Login efetuado com sucesso!");
    closeAuthModal();
  } catch (error) {
    alert("Erro ao fazer login: Verifique seu e-mail e senha.");
  }
}

// Cadastro com E-mail, Senha e Validação de Telefone (OTP)
export async function registerWithEmail(auth, db, name, email, password, confirmPassword, phone, verificationCodeInput) {
  if (password !== confirmPassword) {
    alert("As senhas não coincidem!");
    return;
  }
  
  // Validação do código de confirmação do número
  const expectedCode = window.currentVerificationCode;
  if (!expectedCode || verificationCodeInput !== expectedCode) {
    alert("Código de confirmação do número inválido ou não verificado!");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await ensureClientDocExists(userCredential.user, db, name, phone);
    alert("Cadastro realizado com sucesso!");
    closeAuthModal();
  } catch (error) {
    alert("Erro no cadastro: " + error.message);
  }
}

// Envio de código de confirmação para o WhatsApp/Telefone
window.sendPhoneVerificationCode = function() {
  const phoneInput = document.getElementById("reg-phone");
  const phone = phoneInput ? phoneInput.value : "";
  
  if (!phone || phone.length < 8) {
    alert("Digite um número de telefone válido primeiro.");
    return;
  }
  
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  window.currentVerificationCode = code;
  alert(`[WHATSAPP / SMS] Seu código de confirmação para o número ${phone} é: ${code}`);
  
  const confirmGroup = document.getElementById("phone-verification-group");
  if (confirmGroup) confirmGroup.style.display = "block";
};

// Garantir que o documento do cliente existe no Firestore
async function ensureClientDocExists(user, db, name = "Cliente", phone = "") {
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

// Carregar dados do cliente logado
export async function loadClientData(user, db) {
  const userRef = doc(db, "clients", user.uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    window.currentClientData = snap.data();
  }
}

// Controle dos Modais de Autenticação
export function openAuthModal() {
  const modal = document.getElementById("client-auth-modal");
  if (modal) modal.classList.add("open");
}

export function closeAuthModal() {
  const modal = document.getElementById("client-auth-modal");
  if (modal) modal.classList.remove("open");
}

export function openClientAccountModal() {
  const modal = document.getElementById("client-account-modal");
  if (modal) modal.classList.add("open");
  
  // Preenche dados atuais se existirem
  if (window.currentClientData) {
    document.getElementById("client-profile-name").value = window.currentClientData.name || "";
    document.getElementById("client-profile-phone").value = window.currentClientData.phone || "";
    document.getElementById("client-order-count").innerText = window.currentClientData.orderCount || 0;
  }
}

export function closeClientAccountModal() {
  const modal = document.getElementById("client-account-modal");
  if (modal) modal.classList.remove("open");
}

export async function clientLogout(auth) {
  try {
    await signOut(auth);
    closeClientAccountModal();
    alert("Você saiu da sua conta.");
  } catch (error) {
    console.error("Erro ao sair:", error);
  }
}

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