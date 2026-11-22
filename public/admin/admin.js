// public/admin/admin.js
console.log("✅ admin.js cargado");

const API = ''; // Misma origen
let token = localStorage.getItem('admin_token');
let currentUser = null;
let currentWork = null;
let zones = [];

// ==========================================
// UTILIDADES
// ==========================================
function show(el, hidden = false) { el.hidden = hidden; }
function showError(elId, msg) {
  const el = document.getElementById(elId);
  el.textContent = msg;
  show(el, false);
}
function clearError(elId) { show(document.getElementById(elId), true); }

async function apiCall(path, options = {}) {
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.hidden = true);
  document.getElementById(viewId).hidden = false;
}

// ==========================================
// AUTENTICACIÓN
// ==========================================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    show(document.getElementById('form-login'), tab !== 'login');
    show(document.getElementById('form-register'), tab !== 'register');
  });
});

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError('login-error');
  try {
    const data = await apiCall('/api/admin/login', {
      method: 'POST',
      body: {
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value
      }
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('admin_token', token);
    loadDashboard();
  } catch (err) {
    showError('login-error', err.message);
  }
});

document.getElementById('form-register').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError('reg-error');
  try {
    const data = await apiCall('/api/admin/register', {
      method: 'POST',
      body: {
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value,
        realName: document.getElementById('reg-realname').value,
        username: document.getElementById('reg-username').value
      }
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('admin_token', token);
    loadDashboard();
  } catch (err) {
    showError('reg-error', err.message);
  }
});

document.getElementById('btn-logout').addEventListener('click', () => {
  token = null;
  currentUser = null;
  localStorage.removeItem('admin_token');
  showView('view-auth');
});

// ==========================================
// DASHBOARD
// ==========================================
async function loadDashboard() {
  try {
    const data = await apiCall('/api/admin/me');
    currentUser = data.user;
    document.getElementById('user-display-name').textContent = currentUser.username || currentUser.realName;
    document.getElementById('user-role').textContent = currentUser.role;

    const worksData = await apiCall('/api/admin/works');
    renderWorks(worksData.works || []);
    showView('view-dashboard');
  } catch (err) {
    console.error(err);
    showView('view-auth');
  }
}

function renderWorks(works) {
  const container = document.getElementById('works-list');
  container.innerHTML = '';
  if (works.length === 0) {
    container.innerHTML = '<p>Aún no tienes obras. ¡Crea la primera!</p>';
    return;
  }
  works.forEach(work => {
    const card = document.createElement('div');
    card.className = 'work-card';
    card.innerHTML = `
      <img src="${work.imagePath ? `/api/media/${work.id}/imagen` : ''}" alt="${work.author}">
      <h3>${work.author || 'Sin autor'}</h3>
      <p>${work.exhibitionPlace || ''}</p>
      <p><small>${work.isPublished ? '✅ Publicada' : '📝 Borrador'}</small></p>
      <div class="work-actions">
        <button class="btn-secondary" onclick="editWork('${work.id}')">Editar</button>
        <button class="btn-secondary" onclick="deleteWork('${work.id}')">🗑️</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// Hacer funciones globales para los onclick inline
window.editWork = (id) => openEditor(id);
window.deleteWork = async (id) => {
  if (!confirm('¿Eliminar esta obra?')) return;
  try {
    await apiCall(`/api/admin/works/${id}`, { method: 'DELETE' });
    loadDashboard();
  } catch (err) {
    alert(err.message);
  }
};

document.getElementById('btn-new-work').addEventListener('click', () => openEditor(null));

// ==========================================
// EDITOR DE OBRA
// ==========================================
async function openEditor(workId) {
  clearError('work-error');
  clearError('work-success');
  zones = [];
  document.getElementById('form-work').reset();
  document.getElementById('image-editor').hidden = true;
  document.getElementById('zones-container').innerHTML = '';
  document.getElementById('zones-list').innerHTML = '';

  if (workId) {
    // Cargar obra existente (reutilizamos el endpoint público de works)
    const data = await apiCall(`/api/admin/works/${workId}`);
    currentWork = data.work;
    document.getElementById('editor-title').textContent = 'Editar obra';
    document.getElementById('work-author').value = currentWork.author || '';
    document.getElementById('work-exhibition').value = currentWork.exhibitionPlace || '';
    document.getElementById('work-description').value = currentWork.aiDescription || '';
    zones = currentWork.zones || [];
    if (currentWork.imagePath) {
      await loadImagePreview(`/api/media/${workId}/imagen`);
    }
  } else {
    currentWork = null;
    document.getElementById('editor-title').textContent = 'Nueva obra';
  }

  showView('view-editor');
  renderZones();
}

document.getElementById('btn-back').addEventListener('click', loadDashboard);

// Subida de imagen y preview
document.getElementById('work-image').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => loadImagePreview(ev.target.result, file.type);
  reader.readAsDataURL(file);
});

async function loadImagePreview(src, mimeType = 'image/jpeg') {
  const img = document.getElementById('preview-image');
  img.src = src;
  img.dataset.mimeType = mimeType;
  document.getElementById('image-editor').hidden = false;
  await new Promise(r => img.onload = r);
  renderZones();
}

// Renderizar zonas sobre la imagen
function renderZones() {
  const container = document.getElementById('zones-container');
  const list = document.getElementById('zones-list');
  container.innerHTML = '';
  list.innerHTML = '';

  zones.forEach((zone, idx) => {
    // Caja sobre la imagen
    const box = document.createElement('div');
    box.className = 'zone-box';
    box.style.left = `${zone.bounds[0] * 100}%`;
    box.style.top = `${zone.bounds[1] * 100}%`;
    box.style.width = `${zone.bounds[2] * 100}%`;
    box.style.height = `${zone.bounds[3] * 100}%`;
    box.title = zone.label;
    box.dataset.idx = idx;
    makeDraggable(box, idx);
    container.appendChild(box);

    // Lista editable
    const item = document.createElement('div');
    item.className = 'zone-item';
    item.innerHTML = `
      <strong>Zona ${idx + 1}: ${zone.label || 'Sin nombre'}</strong>
      <div><small>Posición: [${zone.bounds.map(b => b.toFixed(2)).join(', ')}]</small></div>
      <textarea placeholder="Descripción de la zona..." data-zone-idx="${idx}">${zone.text || ''}</textarea>
    `;
    list.appendChild(item);
  });

  // Listener para actualizar texto de zona
  list.querySelectorAll('textarea').forEach(ta => {
    ta.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.zoneIdx);
      zones[idx].text = e.target.value;
    });
  });
}

// Drag básico para mover zonas
function makeDraggable(box, idx) {
  let isDragging = false, startX, startY, startLeft, startTop;
  const img = document.getElementById('preview-image');

  box.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseFloat(box.style.left);
    startTop = parseFloat(box.style.top);
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = ((e.clientX - startX) / img.offsetWidth) * 100;
    const dy = ((e.clientY - startY) / img.offsetHeight) * 100;
    let newLeft = Math.max(0, Math.min(100 - parseFloat(box.style.width), startLeft + dx));
    let newTop = Math.max(0, Math.min(100 - parseFloat(box.style.height), startTop + dy));
    box.style.left = `${newLeft}%`;
    box.style.top = `${newTop}%`;
    zones[idx].bounds[0] = newLeft / 100;
    zones[idx].bounds[1] = newTop / 100;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      renderZones(); // Actualizar lista con nuevas coords
    }
  });
}

// Generar IA
document.getElementById('btn-generate-ai').addEventListener('click', async () => {
  if (!currentWork) {
    showError('work-error', 'Primero guarda la obra como borrador.');
    return;
  }
  try {
    const data = await apiCall(`/api/admin/works/${currentWork.id}/generate-narration`, { method: 'POST' });
    currentWork = data.work;
    document.getElementById('work-description').value = currentWork.aiDescription || '';
    zones = currentWork.zones || [];
    renderZones();
    showError('work-success', '✅ Descripción y zonas generadas con IA');
    document.getElementById('work-success').textContent = '✅ Descripción y zonas generadas';
    show(document.getElementById('work-success'), false);
  } catch (err) {
    showError('work-error', err.message);
  }
});

// Generar audio ElevenLabs
document.getElementById('btn-generate-audio').addEventListener('click', async () => {
  if (!currentWork) {
    showError('work-error', 'Primero guarda la obra como borrador.');
    return;
  }
  try {
    const data = await apiCall(`/api/admin/works/${currentWork.id}/generate-narration`, { method: 'POST' });
    currentWork = data.work;
    show(document.getElementById('work-success'), false);
    document.getElementById('work-success').textContent = '✅ Audio generado con ElevenLabs';
  } catch (err) {
    showError('work-error', err.message);
  }
});

// Guardar obra
document.getElementById('form-work').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError('work-error');
  clearError('work-success');

  try {
    const imageInput = document.getElementById('work-image');
    let imageData = null, imageType = null;

    if (imageInput.files[0]) {
      const file = imageInput.files[0];
      imageType = file.type;
      const base64 = await new Promise(r => {
        const reader = new FileReader();
        reader.onload = () => r(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
      });
      imageData = base64;
    }

    const body = {
      author: document.getElementById('work-author').value,
      exhibitionPlace: document.getElementById('work-exhibition').value,
      zones: zones,
      aiDescription: document.getElementById('work-description').value,
      imageType,
      imageData
    };

    if (currentWork) {
      await apiCall(`/api/admin/works/${currentWork.id}`, { method: 'PUT', body });
      show(document.getElementById('work-success'), false);
      document.getElementById('work-success').textContent = '✅ Obra actualizada';
    } else {
      const data = await apiCall('/api/admin/works', { method: 'POST', body });
      currentWork = data.work;
      show(document.getElementById('work-success'), false);
      document.getElementById('work-success').textContent = '✅ Obra creada. Ahora puedes generar IA y audio.';
    }
  } catch (err) {
    showError('work-error', err.message);
  }
});

// ==========================================
// INICIALIZACIÓN
// ==========================================
if (token) {
  loadDashboard();
} else {
  showView('view-auth');
}