// /js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

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

export { app, db, auth };