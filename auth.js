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
  getDoc 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

export function setupClientAuth(app, db, auth) {
  onAuthStateChanged(auth, async (user) => {
    const clientNavBtn = document.getElementById("client-auth-btn");
    if (user) {
      if (clientNavBtn) clientNavBtn.textContent = "Minha Conta";
      loadClientData(user, db);
    } else {
      if (clientNavBtn) clientNavBtn.textContent = "Entrar / Cadastrar";
    }
  });
}

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

export async function loginWithEmail(auth, email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert("Login efetuado com sucesso!");
    closeAuthModal();
  } catch (error) {
    alert("Erro ao fazer login: Verifique seu e-mail e senha.");
  }
}

export async function registerWithEmail(auth, db, name, email, password, confirmPassword, phone) {
  if (password !== confirmPassword) {
    alert("As senhas não coincidem!");
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
      coupons: ["BEMVINDO10"],
      createdAt: new Date().toISOString()
    });
  }
}

export async function loadClientData(user, db) {
  const userRef = doc(db, "clients", user.uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    window.currentClientData = snap.data();
  }
}

export function openAuthModal() {
  document.getElementById("client-auth-modal")?.classList.add("open");
}

export function closeAuthModal() {
  document.getElementById("client-auth-modal")?.classList.remove("open");
}

// Alternar abas do Modal (Login <-> Cadastro)
window.switchAuthTab = function(tab) {
  const loginForm = document.getElementById("form-login");
  const registerForm = document.getElementById("form-register");
  const loginBtn = document.getElementById("tab-login-btn");
  const registerBtn = document.getElementById("tab-register-btn");
  const modalTitle = document.getElementById("auth-modal-title");

  if (tab === 'login') {
    loginForm.style.display = "block";
    registerForm.style.display = "none";
    loginBtn.style.background = "white";
    loginBtn.style.fontWeight = "bold";
    registerBtn.style.background = "transparent";
    registerBtn.style.fontWeight = "normal";
    modalTitle.innerText = "Entrar na sua Conta";
  } else {
    loginForm.style.display = "none";
    registerForm.style.display = "block";
    registerBtn.style.background = "white";
    registerBtn.style.fontWeight = "bold";
    loginBtn.style.background = "transparent";
    loginBtn.style.fontWeight = "normal";
    modalTitle.innerText = "Criar Nova Conta";
  }
};