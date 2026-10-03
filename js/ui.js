// /js/ui.js
window.showSection = (sectionId) => {
  document.querySelectorAll(".content-section").forEach(sec => sec.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
  document.getElementById(`sec-${sectionId}`)?.classList.add("active");
  if (window.event && window.event.currentTarget) window.event.currentTarget.classList.add("active");
  document.getElementById("main-nav")?.classList.remove("show");
};

window.toggleMobileMenu = (event) => {
  if (event) event.stopPropagation();
  document.getElementById("main-nav")?.classList.toggle("show");
};

window.closeLoginModal = () => document.getElementById("login-modal")?.classList.remove("open");
window.openCategoryModal = () => document.getElementById("category-modal")?.classList.add("open");
window.closeCategoryModal = () => document.getElementById("category-modal")?.classList.remove("open");
window.openAboutModal = () => document.getElementById("about-modal")?.classList.add("open");
window.closeAboutModal = () => document.getElementById("about-modal")?.classList.remove("open");

// Gerenciamento de Cliques Fora do Modal
let clickedInsideModal = false;
document.addEventListener("mousedown", (event) => {
  clickedInsideModal = !!(event.target.closest(".modal-content") || event.target.closest(".modal-dialog"));
});

window.addEventListener("click", (event) => {
  const nav = document.getElementById("main-nav");
  const toggleBtn = document.getElementById("menu-toggle-btn");
  if (nav && nav.classList.contains("show") && !nav.contains(event.target) && (!toggleBtn || !toggleBtn.contains(event.target))) {
    nav.classList.remove("show");
  }
  if (event.target.classList.contains("modal-overlay") && !clickedInsideModal) {
    event.target.classList.remove("open");
  }
  clickedInsideModal = false;
});

// Carrosséis Unificados
window.moveCarousel = function(itemId, direction) {
  const carousel = document.getElementById(`carousel-${itemId}`);
  if (!carousel) return;
  const total = parseInt(carousel.getAttribute("data-total")) || 1;
  let currentIndex = parseInt(carousel.getAttribute("data-index")) || 0;
  currentIndex = (currentIndex + direction + total) % total;
  window.setCarouselSlide(itemId, currentIndex);
};

window.setCarouselSlide = function(itemId, index) {
  const carousel = document.getElementById(`carousel-${itemId}`);
  const slide = document.getElementById(`slide-${itemId}`);
  if (!carousel || !slide) return;
  carousel.setAttribute("data-index", index);
  slide.style.transform = `translateX(-${index * 100}%)`;
  carousel.querySelectorAll(".carousel-dot").forEach((dot, i) => dot.classList.toggle("active", i === index));
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

window.moveRecipeModalCarousel = function(trackId, direction) {
  const track = document.getElementById(trackId);
  if (!track) return;
  const slides = track.children;
  const total = slides.length;
  if (total <= 1) return;
  let currentIndex = parseInt(track.dataset.index || "0");
  currentIndex = (currentIndex + direction + total) % total;
  window.setRecipeModalCarouselSlide(trackId, currentIndex);
};

window.setRecipeModalCarouselSlide = function(trackId, index) {
  const track = document.getElementById(trackId);
  if (!track) return;
  track.dataset.index = index;
  track.style.transform = `translateX(-${index * 100}%)`;
  const parentContainer = track.closest('.recipe-carousel');
  if (parentContainer) {
    parentContainer.querySelectorAll(".carousel-dot").forEach((dot, i) => dot.classList.toggle("active", i === index));
  }
};

// Utils de Imagem e Drag Drop
window.setupImageZoom = function(imgElement) {
  if (!imgElement || window.matchMedia("(pointer: coarse)").matches) return;
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

window.compressImage = function(file, maxWidth = 800, quality = 0.7) {
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
        if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
    };
  });
};

window.setupSingleDragAndDrop = function(elementId, onDropCallback) {
  const dropZone = document.getElementById(elementId);
  if (!dropZone) return;
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => dropZone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); }, false));
  ['dragenter', 'dragover'].forEach(evt => dropZone.addEventListener(evt, () => dropZone.classList.add('dragover'), false));
  ['dragleave', 'drop'].forEach(evt => dropZone.addEventListener(evt, () => dropZone.classList.remove('dragover'), false));
  dropZone.addEventListener('drop', async (e) => await onDropCallback(e.dataTransfer.files), false);
};