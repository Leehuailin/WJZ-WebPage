/**
 * Life Gallery — app.js
 * Personal photo journal using IndexedDB for storage
 */

'use strict';

/* ============================================================
   IndexedDB Setup
   ============================================================ */
const DB_NAME    = 'LifeGalleryDB';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        const store = d.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('uploadedAt', 'uploadedAt', { unique: false });
        store.createIndex('date',       'date',       { unique: false });
      }
    };

    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror   = (e) => reject(e.target.error);
  });
}

function dbGetAll() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

function dbAdd(photo) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(photo);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

function dbUpdate(photo) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(photo);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

function dbDelete(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

/* ============================================================
   State
   ============================================================ */
let allPhotos       = [];   // all records from DB
let filteredPhotos  = [];   // currently displayed subset
let currentFilter   = { tag: '', date: '', search: '' };
let lightboxIndex   = 0;    // index in filteredPhotos

/* ============================================================
   DOM refs
   ============================================================ */
const photoGrid      = document.getElementById('photoGrid');
const emptyState     = document.getElementById('emptyState');
const photoCountEl   = document.getElementById('photoCount');
const filterDate     = document.getElementById('filterDate');
const tagFiltersEl   = document.getElementById('tagFilters');
const searchInput    = document.getElementById('searchInput');

// Upload modal
const openUploadBtn  = document.getElementById('openUpload');
const uploadModal    = document.getElementById('uploadModal');
const closeUploadBtn = document.getElementById('closeUpload');
const cancelUpload   = document.getElementById('cancelUpload');
const uploadForm     = document.getElementById('uploadForm');
const dropZone       = document.getElementById('dropZone');
const fileInput      = document.getElementById('fileInput');
const previewContainer = document.getElementById('previewContainer');
const dropZoneContent  = document.getElementById('dropZoneContent');
const photoDateInput = document.getElementById('photoDate');
const photoDescInput = document.getElementById('photoDesc');
const photoTagsInput = document.getElementById('photoTags');
const submitText     = document.getElementById('submitText');

// Lightbox
const lightbox       = document.getElementById('lightbox');
const closeLightboxBtn = document.getElementById('closeLightbox');
const lightboxImg    = document.getElementById('lightboxImg');
const lightboxDate   = document.getElementById('lightboxDate');
const lightboxDesc   = document.getElementById('lightboxDesc');
const lightboxTags   = document.getElementById('lightboxTags');
const lightboxPrev   = document.getElementById('lightboxPrev');
const lightboxNext   = document.getElementById('lightboxNext');
const editPhotoBtn   = document.getElementById('editPhoto');
const deletePhotoBtn = document.getElementById('deletePhoto');

// Edit modal
const editModal      = document.getElementById('editModal');
const closeEditBtn   = document.getElementById('closeEdit');
const cancelEditBtn  = document.getElementById('cancelEdit');
const editForm       = document.getElementById('editForm');
const editPhotoId    = document.getElementById('editPhotoId');
const editDate       = document.getElementById('editDate');
const editDesc       = document.getElementById('editDesc');
const editTags       = document.getElementById('editTags');

// Toast
const toast          = document.getElementById('toast');

/* ============================================================
   Toast helper
   ============================================================ */
let toastTimer = null;
function showToast(msg, duration = 2400) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

/* ============================================================
   Render helpers
   ============================================================ */
function formatDate(dateStr) {
  if (!dateStr) return '';
  // Validate YYYY-MM-DD format before parsing
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function buildTagChips(tags, forLightbox = false) {
  if (!tags || tags.length === 0) return '';
  return tags.map(t => `<span class="tag-chip">${escHtml(t)}</span>`).join('');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ============================================================
   Render photo grid
   ============================================================ */
function renderGrid() {
  const hasPhotos = filteredPhotos.length > 0;
  emptyState.style.display = hasPhotos ? 'none' : 'flex';
  photoGrid.style.display  = hasPhotos ? '' : 'none';

  if (!hasPhotos) return;

  // Sort: newest upload first
  const sorted = [...filteredPhotos].sort((a, b) => b.uploadedAt - a.uploadedAt);

  photoGrid.innerHTML = sorted.map((p) => {
    const dateStr  = p.date ? formatDate(p.date) : '';
    const descHtml = p.description ? `<p class="photo-card-desc">${escHtml(p.description)}</p>` : '';
    const tagsHtml = p.tags && p.tags.length
      ? `<div class="photo-card-tags">${buildTagChips(p.tags)}</div>` : '';

    return `
      <article class="photo-card" data-id="${p.id}" role="button" tabindex="0" aria-label="查看照片${p.description ? ': ' + escHtml(p.description) : ''}">
        <div class="photo-card-img-wrap">
          <img src="${p.dataUrl}" alt="${p.description ? escHtml(p.description) : '照片'}" loading="lazy" />
        </div>
        ${(dateStr || descHtml || tagsHtml) ? `
        <div class="photo-card-body">
          ${dateStr ? `<p class="photo-card-date">${dateStr}</p>` : ''}
          ${descHtml}
          ${tagsHtml}
        </div>` : ''}
      </article>`;
  }).join('');

  // Re-attach click events
  photoGrid.querySelectorAll('.photo-card').forEach((card) => {
    card.addEventListener('click', () => openLightbox(Number(card.dataset.id)));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(Number(card.dataset.id));
      }
    });
  });

  // Update filtered array order to match sorted for lightbox navigation
  filteredPhotos = sorted;
}

/* ============================================================
   Filtering
   ============================================================ */
function applyFilters() {
  filteredPhotos = allPhotos.filter((p) => {
    const tagOk    = !currentFilter.tag  || (p.tags && p.tags.includes(currentFilter.tag));
    const dateOk   = !currentFilter.date || (p.date && p.date.startsWith(currentFilter.date));
    const searchOk = !currentFilter.search ||
      (p.description && p.description.toLowerCase().includes(currentFilter.search)) ||
      (p.tags && p.tags.some(t => t.toLowerCase().includes(currentFilter.search)));
    return tagOk && dateOk && searchOk;
  });
  renderGrid();
}

/* ============================================================
   Filter UI — Tags & Dates
   ============================================================ */
function rebuildFilterUI() {
  // Update photo count
  photoCountEl.textContent = `${allPhotos.length} 张照片`;

  // Collect all unique tags
  const tagSet = new Set();
  allPhotos.forEach(p => (p.tags || []).forEach(t => tagSet.add(t)));

  // Rebuild tag buttons
  const currentTag = currentFilter.tag;
  tagFiltersEl.innerHTML = `<button class="tag-btn${!currentTag ? ' active' : ''}" data-tag="">全部</button>`;
  [...tagSet].sort().forEach((tag) => {
    const btn = document.createElement('button');
    btn.className = `tag-btn${currentTag === tag ? ' active' : ''}`;
    btn.dataset.tag = tag;
    btn.textContent = tag;
    tagFiltersEl.appendChild(btn);
  });

  // Rebuild date options (by year-month)
  const monthSet = new Set();
  allPhotos.forEach(p => { if (p.date) monthSet.add(p.date.slice(0, 7)); });

  const savedDate = filterDate.value;
  filterDate.innerHTML = '<option value="">全部时间</option>';
  [...monthSet].sort().reverse().forEach((ym) => {
    const [y, m] = ym.split('-');
    const label  = `${y}年${parseInt(m, 10)}月`;
    const opt = document.createElement('option');
    opt.value = ym;
    opt.textContent = label;
    if (ym === savedDate) opt.selected = true;
    filterDate.appendChild(opt);
  });
}

tagFiltersEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.tag-btn');
  if (!btn) return;
  currentFilter.tag = btn.dataset.tag;
  rebuildFilterUI();
  applyFilters();
});

filterDate.addEventListener('change', () => {
  currentFilter.date = filterDate.value;
  applyFilters();
});

searchInput.addEventListener('input', () => {
  currentFilter.search = searchInput.value.trim().toLowerCase();
  applyFilters();
});

/* ============================================================
   Load all photos from DB
   ============================================================ */
async function loadPhotos() {
  allPhotos = await dbGetAll();
  rebuildFilterUI();
  applyFilters();
}

/* ============================================================
   Upload Modal
   ============================================================ */
let pendingFiles = []; // FileList items selected for upload

function openUploadModal() {
  pendingFiles = [];
  previewContainer.innerHTML = '';
  dropZoneContent.style.display = '';
  uploadForm.reset();
  photoDateInput.value = new Date().toISOString().slice(0, 10);
  uploadModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeUploadModal() {
  uploadModal.classList.remove('open');
  document.body.style.overflow = '';
}

openUploadBtn.addEventListener('click', openUploadModal);
closeUploadBtn.addEventListener('click', closeUploadModal);
cancelUpload.addEventListener('click', closeUploadModal);

uploadModal.addEventListener('click', (e) => {
  if (e.target === uploadModal) closeUploadModal();
});

/* Drop zone */
dropZone.addEventListener('click', (e) => {
  if (e.target.tagName !== 'BUTTON') fileInput.click();
});

dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => handleFiles(fileInput.files));

function handleFiles(files) {
  if (!files || files.length === 0) return;
  pendingFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (pendingFiles.length === 0) {
    showToast('请选择图片文件');
    return;
  }
  // Show previews
  previewContainer.innerHTML = '';
  dropZoneContent.style.display = 'none';
  pendingFiles.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = document.createElement('img');
      img.src = ev.target.result;
      img.className = 'preview-thumb';
      img.alt = file.name;
      previewContainer.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
  submitText.textContent = pendingFiles.length > 1 ? `保存 ${pendingFiles.length} 张照片` : '保存照片';
}

/* Submit upload */
uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (pendingFiles.length === 0) {
    showToast('请先选择照片');
    return;
  }

  const submitBtn = uploadForm.querySelector('[type="submit"]');
  submitBtn.disabled = true;
  submitText.textContent = '保存中…';

  const date  = photoDateInput.value;
  const desc  = photoDescInput.value.trim();
  const tags  = photoTagsInput.value.split(',').map(t => t.trim()).filter(Boolean);

  try {
    for (const file of pendingFiles) {
      const dataUrl = await readFileAsDataURL(file);
      await dbAdd({
        dataUrl,
        date,
        description: desc,
        tags,
        uploadedAt: Date.now(),
        filename: file.name,
      });
    }
    await loadPhotos();
    closeUploadModal();
    showToast(`已保存 ${pendingFiles.length} 张照片 ✨`);
  } catch (err) {
    console.error(err);
    showToast('保存失败，请重试');
  } finally {
    submitBtn.disabled = false;
    submitText.textContent = '保存照片';
  }
});

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e.target.error);
    reader.readAsDataURL(file);
  });
}

/* ============================================================
   Lightbox
   ============================================================ */
function openLightbox(photoId) {
  const idx = filteredPhotos.findIndex(p => p.id === photoId);
  if (idx === -1) return;
  lightboxIndex = idx;
  renderLightbox();
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

function renderLightbox() {
  const p = filteredPhotos[lightboxIndex];
  if (!p) return;
  lightboxImg.src = p.dataUrl;
  lightboxImg.alt = p.description || '照片';
  lightboxDate.textContent = p.date ? formatDate(p.date) : '';
  lightboxDesc.textContent = p.description || '';
  lightboxTags.innerHTML   = buildTagChips(p.tags || [], true);
  lightboxPrev.style.opacity = lightboxIndex > 0 ? '1' : '0.3';
  lightboxNext.style.opacity = lightboxIndex < filteredPhotos.length - 1 ? '1' : '0.3';
}

closeLightboxBtn.addEventListener('click', closeLightbox);

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});

lightboxPrev.addEventListener('click', () => {
  if (lightboxIndex > 0) {
    lightboxIndex--;
    renderLightbox();
  }
});

lightboxNext.addEventListener('click', () => {
  if (lightboxIndex < filteredPhotos.length - 1) {
    lightboxIndex++;
    renderLightbox();
  }
});

document.addEventListener('keydown', (e) => {
  if (lightbox.classList.contains('open')) {
    if (e.key === 'ArrowLeft')  { lightboxPrev.click(); return; }
    if (e.key === 'ArrowRight') { lightboxNext.click(); return; }
    if (e.key === 'Escape')     { closeLightbox(); return; }
  }
  if (uploadModal.classList.contains('open') && e.key === 'Escape') {
    closeUploadModal(); return;
  }
  if (editModal.classList.contains('open') && e.key === 'Escape') {
    closeEditModal(); return;
  }
});

/* Touch swipe for mobile lightbox */
let touchStartX = 0;
lightbox.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
lightbox.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 50) {
    if (dx < 0) lightboxNext.click();
    else lightboxPrev.click();
  }
}, { passive: true });

/* Delete */
deletePhotoBtn.addEventListener('click', async () => {
  const p = filteredPhotos[lightboxIndex];
  if (!p) return;
  if (!confirm('确定要删除这张照片吗？')) return;
  await dbDelete(p.id);
  closeLightbox();
  await loadPhotos();
  showToast('已删除照片');
});

/* ============================================================
   Edit Modal
   ============================================================ */
editPhotoBtn.addEventListener('click', () => {
  const p = filteredPhotos[lightboxIndex];
  if (!p) return;
  closeLightbox();
  openEditModal(p);
});

function openEditModal(photo) {
  editPhotoId.value = photo.id;
  editDate.value    = photo.date || '';
  editDesc.value    = photo.description || '';
  editTags.value    = (photo.tags || []).join(', ');
  editModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeEditModal() {
  editModal.classList.remove('open');
  document.body.style.overflow = '';
}

closeEditBtn.addEventListener('click', closeEditModal);
cancelEditBtn.addEventListener('click', closeEditModal);
editModal.addEventListener('click', (e) => {
  if (e.target === editModal) closeEditModal();
});

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = Number(editPhotoId.value);
  const photo = allPhotos.find(p => p.id === id);
  if (!photo) return;

  photo.date        = editDate.value;
  photo.description = editDesc.value.trim();
  photo.tags        = editTags.value.split(',').map(t => t.trim()).filter(Boolean);

  await dbUpdate(photo);
  closeEditModal();
  await loadPhotos();
  showToast('已更新照片信息');
});

/* ============================================================
   Init
   ============================================================ */
async function init() {
  try {
    await openDB();
    await loadPhotos();
  } catch (err) {
    console.error('DB init error:', err);
    emptyState.querySelector('.empty-hint').textContent =
      '无法初始化数据库，请检查浏览器设置或使用现代浏览器。';
  }
}

init();
