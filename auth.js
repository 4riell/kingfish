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
  updateDoc, 
  arrayUnion 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// Supondo que 'app' venha inicializado ou importe do seu arquivo principal
// Aqui exportamos as funções para uso global
export function setupClientAuth(app, db, auth) {
  const googleProvider = new GoogleAuthProvider();

  // Observa o estado de autenticação do usuário cliente
  onAuthStateChanged(auth, async (user) => {
    const clientNavBtn = document.getElementById("client-auth-btn");
    const clientProfileSection = document.getElementById("client-profile-section");
    
    if (user) {
      // Usuário logado
      if (clientNavBtn) clientNavBtn.textContent = "Minha Conta";
      loadClientData(user, db);
    } else {
      // Usuário deslogado
      if (clientNavBtn) clientNavBtn.textContent = "Entrar / Cadastrar";
    }
  });
}

export async function loginWithGoogle(auth, db) {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    await ensureClientDocExists(user, db);
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
    alert("Erro ao fazer login: " + error.message);
  }
}

export async function registerWithEmail(auth, db, email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await ensureClientDocExists(userCredential.user, db);
    alert("Cadastro realizado com sucesso!");
    closeAuthModal();
  } catch (error) {
    alert("Erro no cadastro: " + error.message);
  }
}

async function ensureClientDocExists(user, db) {
  const userRef = doc(db, "clients", user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      name: user.displayName || "Cliente",
      email: user.email,
      addresses: [],
      savedOrders: [],
      coupons: ["BEMVINDO10"], // Cupom inicial de exemplo
      createdAt: new Date().toISOString()
    });
  }
}

export async function loadClientData(user, db) {
  const userRef = doc(db, "clients", user.uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    const data = snap.data();
    // Você pode popular elementos na interface do perfil do cliente aqui (ex: endereços salvos, cupons)
    window.currentClientData = data;
  }
}

export function openAuthModal() {
  document.getElementById("client-auth-modal")?.classList.add("open");
}

export function closeAuthModal() {
  document.getElementById("client-auth-modal")?.classList.remove("open");
}