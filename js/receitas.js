// /js/receitas.js
import { db, auth } from './firebase.js';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

window.loadRecipes = function() {
  onSnapshot(collection(db, "recipes"), (snapshot) => {
    window.allRecipes = [];
    snapshot.forEach((docSnap) => window.allRecipes.push({ ...docSnap.data(), id: docSnap.id }));
    window.renderRecipes(window.allRecipes);
  });
};

window.filterRecipeCategory = function(category) {
  window.currentRecipeCategory = category;
  document.querySelectorAll("#recipe-filters .filter-btn").forEach(btn => btn.classList.remove("active"));
  if (window.event && window.event.currentTarget) window.event.currentTarget.classList.add("active");
  window.renderRecipes(window.allRecipes);
};

window.renderRecipes = function(recipes) {
  const container = document.getElementById("recipes-container");
  if (!container) return; container.innerHTML = "";
  let listToRender = window.currentRecipeCategory === "todos" ? [...recipes] : recipes.filter(r => r.category === window.currentRecipeCategory);
  if (listToRender.length === 0) { container.innerHTML = `<p style="text-align:center; width:100%; color:#666;">Nenhuma receita encontrada.</p>`; return; }

  listToRender.forEach((recipe) => {
    const card = document.createElement("div"); card.className = "recipe-card";
    card.onclick = (e) => { if (e.target.closest('.admin-card-actions') || e.target.closest('.carousel-btn') || e.target.closest('.carousel-dots')) return; window.openRecipeDetailModal(recipe.id); };
    let imagesList = Array.isArray(recipe.imagesGroup1) && recipe.imagesGroup1.length > 0 ? recipe.imagesGroup1 : ["https://via.placeholder.com/300x200?text=Receita"];
    const slidesHTML = imagesList.map(img => `<img src="${img}" alt="${recipe.title}" class="carousel-img">`).join('');
    const hasMultipleImages = imagesList.length > 1;
    const dotsHTML = hasMultipleImages ? `<div class="carousel-dots">${imagesList.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}" onclick="event.stopPropagation(); setCarouselSlide('recipe-${recipe.id}',${i})"></span>`).join('')}</div>` : '';
    const navButtons = hasMultipleImages ? `<button type="button" class="carousel-btn prev" onclick="event.stopPropagation(); moveCarousel('recipe-${recipe.id}', -1)"><i class="fa-solid fa-chevron-left"></i></button><button type="button" class="carousel-btn next" onclick="event.stopPropagation(); moveCarousel('recipe-${recipe.id}', 1)"><i class="fa-solid fa-chevron-right"></i></button>` : '';
    let adminControls = window.isAdminLoggedIn ? `<div class="admin-card-actions" style="display: flex; gap: 8px;"><button class="btn-edit-prod" onclick="event.stopPropagation(); editRecipe('${recipe.id}')">Editar</button><button class="btn-delete-prod" onclick="event.stopPropagation(); deleteRecipe('${recipe.id}')">Excluir</button></div>` : "";

    card.innerHTML = `<div class="carousel-container" id="carousel-recipe-${recipe.id}" data-index="0" data-total="${imagesList.length}">
        <div class="carousel-slide" id="slide-recipe-${recipe.id}">${slidesHTML}</div>${navButtons}${dotsHTML}</div>
      <div class="recipe-content"><h3 class="recipe-title">${recipe.title}</h3>
        <p class="recipe-desc">${recipe.ingredients ? `<strong>Ingredientes:</strong><br>${recipe.ingredients.replace(/\n/g, '<br>')}` : ''}</p>
        <p class="recipe-desc" style="margin-top: 8px;">${recipe.instructions ? `<strong>Modo de Preparo:</strong><br>${recipe.instructions.replace(/\n/g, '<br>')}` : ''}</p>${adminControls}</div>`;
    container.appendChild(card);
  });
};

window.openRecipeModal = function() {
  document.getElementById("recipe-id-input").value = ""; document.getElementById("recipe-form").reset();
  window.currentRecipeImages1 = []; window.currentRecipeImages2 = []; window.currentRecipeVideo = null;
  window.renderRecipeImagePreviews1(); window.renderRecipeImagePreviews2(); window.renderRecipeVideoPreview();
  window.populateRecipeProductSelect(""); document.getElementById("recipe-modal")?.classList.add("open");
};

window.closeRecipeModal = () => document.getElementById("recipe-modal")?.classList.remove("open");

window.editRecipe = function(recipeId) {
  const recipe = window.allRecipes.find(r => r.id === recipeId); if (!recipe) return;
  document.getElementById("recipe-category").value = recipe.category || ""; window.populateRecipeProductSelect(recipe.category || "");
  document.getElementById("recipe-id-input").value = recipe.id; document.getElementById("recipe-title").value = recipe.title || "";
  document.getElementById("recipe-desc-input").value = recipe.description || ""; document.getElementById("recipe-prod-select").value = recipe.relatedProduct || "";
  document.getElementById("recipe-ingredients").value = recipe.ingredients || ""; document.getElementById("recipe-instructions").value = recipe.instructions || "";
  window.currentRecipeImages1 = Array.isArray(recipe.imagesGroup1) ? [...recipe.imagesGroup1] : [];
  window.currentRecipeImages2 = Array.isArray(recipe.imagesGroup2) ? [...recipe.imagesGroup2] : [];
  window.currentRecipeVideo = recipe.video || null;
  window.renderRecipeImagePreviews1(); window.renderRecipeImagePreviews2(); window.renderRecipeVideoPreview();
  window.closeRecipeDetailModal(); document.getElementById("recipe-modal")?.classList.add("open");
};

window.handleRecipeSubmit = async function(e) {
  e.preventDefault();
  if (!auth.currentUser) return;
  const saveBtn = document.getElementById("btn-save-recipe");
  if (saveBtn) { saveBtn.innerText = "Salvando..."; saveBtn.disabled = true; }
  const recipeId = document.getElementById("recipe-id-input").value;
  const recipeData = {
    title: document.getElementById("recipe-title").value.toUpperCase(), description: document.getElementById("recipe-desc-input").value,
    category: document.getElementById("recipe-category").value, relatedProduct: document.getElementById("recipe-prod-select").value,
    ingredients: document.getElementById("recipe-ingredients").value, instructions: document.getElementById("recipe-instructions").value,
    imagesGroup1: window.currentRecipeImages1, imagesGroup2: window.currentRecipeImages2, video: window.currentRecipeVideo
  };
  try {
    if (recipeId) { await updateDoc(doc(db, "recipes", recipeId), recipeData); alert("Receita atualizada!"); } 
    else { await addDoc(collection(db, "recipes"), recipeData); alert("Receita criada!"); }
    window.closeRecipeModal();
  } catch (error) { alert(`Erro ao salvar: ${error.message}`); } finally { if (saveBtn) { saveBtn.innerText = "Salvar Receita"; saveBtn.disabled = false; } }  
};

window.openRecipeDetailModal = function(recipeId) {
  const recipe = window.allRecipes.find(r => r.id === recipeId); if (!recipe) return;
  const modal = document.getElementById("recipe-detail-modal"); document.getElementById("modal-recipe-title").innerText = recipe.title;

  const configureCarousel = (trackId, carouselId, images) => {
    const track = document.getElementById(trackId); const carousel = document.getElementById(carouselId);
    if (track) {
      track.innerHTML = ''; track.dataset.index = "0"; track.style.transform = "translateX(0px)";
      if (images && images.length > 0) {
        images.forEach(img => track.innerHTML += `<img src="${img}" style="min-width:100%; width:100%; max-height:250px; object-fit:cover; border-radius:8px;">`);
        carousel.style.display = 'block';
      } else { carousel.style.display = 'none'; }
    }
  };
  configureCarousel('carousel-images-1', 'recipe-carousel-1', recipe.imagesGroup1);
  configureCarousel('carousel-images-2', 'recipe-carousel-2', recipe.imagesGroup2);

  const descElement = document.getElementById("modal-recipe-desc");
  if (recipe.description) { descElement.innerText = recipe.description; descElement.style.display = "block"; } else descElement.style.display = "none";
  document.getElementById("modal-recipe-ingredients").innerHTML = recipe.ingredients ? recipe.ingredients.replace(/\n/g, '<br>') : "";
  document.getElementById("modal-recipe-instructions").innerHTML = recipe.instructions ? recipe.instructions.replace(/\n/g, '<br>') : "";
  
  const videoContainer = document.getElementById("modal-recipe-video-container");
  if (recipe.video) { videoContainer.innerHTML = `<video controls src="${recipe.video}" style="width:100%; max-height:220px; border-radius:8px; object-fit:contain; background:#000;"></video>`; videoContainer.style.display = "block"; } 
  else { videoContainer.innerHTML = ""; videoContainer.style.display = "none"; }
  modal?.classList.add("open");
};

window.closeRecipeDetailModal = function() {
  document.getElementById("recipe-detail-modal")?.classList.remove("open");
  const videoContainer = document.getElementById("modal-recipe-video-container");
  if (videoContainer) videoContainer.innerHTML = "";
};

window.deleteRecipe = async function(id) {
  if (!auth.currentUser) return alert("Ação não permitida.");
  if (!confirm("Tem certeza que deseja excluir esta receita?")) return;
  try { await deleteDoc(doc(db, "recipes", id)); alert("Receita removida!"); } catch (error) { alert("Erro: " + error.message); }
};

window.populateRecipeProductSelect = function(categoryFilter = null) {
  const select = document.getElementById("recipe-prod-select"); if (!select) return;
  select.innerHTML = '<option value="">Nenhum produto associado</option>';
  let filteredProducts = window.allProducts;
  if (categoryFilter) filteredProducts = window.allProducts.filter(p => p.category === categoryFilter);
  filteredProducts.forEach(prod => select.innerHTML += `<option value="${prod.name}">${prod.name}</option>`);
};

// -- UPLOAD PARA RECEITAS --
window.setupRecipeDragAndDrop = () => {
  if (window.setupSingleDragAndDrop) {
    window.setupSingleDragAndDrop("recipe-drop-zone-1", async (files) => { for (const file of Array.from(files)) if (file.type.startsWith('image/')) window.currentRecipeImages1.push(await window.compressImage(file)); window.renderRecipeImagePreviews1(); });
    window.setupSingleDragAndDrop("recipe-drop-zone-2", async (files) => { for (const file of Array.from(files)) if (file.type.startsWith('image/')) window.currentRecipeImages2.push(await window.compressImage(file)); window.renderRecipeImagePreviews2(); });
  }
};
window.handleRecipeImages1Select = async (e) => { for (const file of Array.from(e.target.files)) if (file.type.startsWith('image/')) window.currentRecipeImages1.push(await window.compressImage(file)); window.renderRecipeImagePreviews1(); };
window.handleRecipeImages2Select = async (e) => { for (const file of Array.from(e.target.files)) if (file.type.startsWith('image/')) window.currentRecipeImages2.push(await window.compressImage(file)); window.renderRecipeImagePreviews2(); };

window.renderRecipeImagePreviews1 = () => { const container = document.getElementById("recipe-images-1-preview"); if (!container) return; container.innerHTML = ""; window.currentRecipeImages1.forEach((img, index) => container.innerHTML += `<div class="preview-thumb"><img src="${img}"><button type="button" class="preview-thumb-remove" onclick="removeRecipeImage1(${index})">&times;</button></div>`); };
window.renderRecipeImagePreviews2 = () => { const container = document.getElementById("recipe-images-2-preview"); if (!container) return; container.innerHTML = ""; window.currentRecipeImages2.forEach((img, index) => container.innerHTML += `<div class="preview-thumb"><img src="${img}"><button type="button" class="preview-thumb-remove" onclick="removeRecipeImage2(${index})">&times;</button></div>`); };

window.removeRecipeImage1 = (index) => { window.currentRecipeImages1.splice(index, 1); window.renderRecipeImagePreviews1(); };
window.removeRecipeImage2 = (index) => { window.currentRecipeImages2.splice(index, 1); window.renderRecipeImagePreviews2(); };

window.handleRecipeVideoFileSelect = function(event) {
  const file = event.target.files[0]; if (!file || !file.type.startsWith('video/')) return;
  if (file.size > 800 * 1024) return alert("O vídeo selecionado é muito grande (Limite máximo ~800KB).");
  const reader = new FileReader(); reader.onload = (e) => { window.currentRecipeVideo = e.target.result; window.renderRecipeVideoPreview(); };
  reader.readAsDataURL(file);
};
window.renderRecipeVideoPreview = () => { const container = document.getElementById("recipe-video-preview"); if (!container) return; container.innerHTML = window.currentRecipeVideo ? `<div class="preview-thumb" style="width: 140px; height: 90px; border-radius: 8px;"><video src="${window.currentRecipeVideo}" style="width:100%; height:100%; object-fit:cover;"></video><button type="button" class="preview-thumb-remove" onclick="removeRecipeVideo()">&times;</button></div>` : ""; };
window.removeRecipeVideo = () => { window.currentRecipeVideo = null; document.getElementById("recipe-video-input").value = ""; window.renderRecipeVideoPreview(); };