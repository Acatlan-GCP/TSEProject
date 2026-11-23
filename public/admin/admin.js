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
let selectedZoneIndex = null;

// Renderizar zonas sobre la imagen
function renderZones() {
  const container = document.getElementById('image-editor');
  if (!container) return;
  
  // Limpiar zonas anteriores (pero mantener la imagen)
  container.querySelectorAll('.zone-box').forEach(el => el.remove());
  
  const img = container.querySelector('img');
  if (!img) return;
  
  const imgWidth = img.clientWidth;
  const imgHeight = img.clientHeight;
  
  zones.forEach((zone, index) => {
    const [left, top, width, height] = zone.bounds;
    
    const box = document.createElement('div');
    box.className = 'zone-box' + (selectedZoneIndex === index ? ' selected' : '');
    box.style.left = `${left * imgWidth}px`;
    box.style.top = `${top * imgHeight}px`;
    box.style.width = `${width * imgWidth}px`;
    box.style.height = `${height * imgHeight}px`;
    box.dataset.index = index;
    
    // Etiqueta
    const label = document.createElement('div');
    label.className = 'zone-label';
    label.textContent = zone.label || `Zona ${index + 1}`;
    box.appendChild(label);
    
    // Botón eliminar (solo si está seleccionada)
    if (selectedZoneIndex === index) {
      const deleteBtn = document.createElement('div');
      deleteBtn.className = 'zone-delete';
      deleteBtn.innerHTML = '×';
      deleteBtn.title = 'Eliminar zona';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteZone(index);
      });
      box.appendChild(deleteBtn);
      
      // Handles de redimensionamiento
      ['tl', 'tr', 'bl', 'br'].forEach(corner => {
        const handle = document.createElement('div');
        handle.className = `resize-handle ${corner}`;
        handle.addEventListener('mousedown', (e) => startResize(e, index, corner));
        box.appendChild(handle);
      });
    }
    
    // Eventos de interacción
    box.addEventListener('mousedown', (e) => startDrag(e, index));
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      selectZone(index);
    });
    
    container.appendChild(box);
  });
  
  // Renderizar lista de zonas debajo
  renderZonesList();
}

function selectZone(index) {
  selectedZoneIndex = (selectedZoneIndex === index) ? null : index;
  renderZones();
}

function deleteZone(index) {
  if (!confirm(`¿Eliminar "${zones[index].label || 'Zona ' + (index + 1)}"?`)) return;
  zones.splice(index, 1);
  selectedZoneIndex = null;
  renderZones();
}



function addZone() {
  const newZone = {
    label: `Zona ${zones.length + 1}`,
    bounds: [0.1, 0.1, 0.3, 0.3], // Posición inicial: esquina superior izquierda
    text: 'Descripción de la nueva zona'
  };
  zones.push(newZone);
  selectedZoneIndex = zones.length - 1;
  renderZones();
}

function startDrag(e, index) {
  if (e.target.classList.contains('resize-handle') || e.target.classList.contains('zone-delete')) return;
  
  e.preventDefault();
  const container = document.getElementById('image-editor');
  const img = container.querySelector('img');
  const imgWidth = img.clientWidth;
  const imgHeight = img.clientHeight;
  
  const startX = e.clientX;
  const startY = e.clientY;
  const initialBounds = [...zones[index].bounds];
  
  function onMouseMove(e) {
    const dx = (e.clientX - startX) / imgWidth;
    const dy = (e.clientY - startY) / imgHeight;
    
    let [left, top, width, height] = initialBounds;
    left = Math.max(0, Math.min(1 - width, left + dx));
    top = Math.max(0, Math.min(1 - height, top + dy));
    
    zones[index].bounds = [
      parseFloat(left.toFixed(4)),
      parseFloat(top.toFixed(4)),
      width,
      height
    ];
    renderZones();
  }
  
  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
  
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function startResize(e, index, corner) {
  e.preventDefault();
  e.stopPropagation();
  
  const container = document.getElementById('image-editor');
  const img = container.querySelector('img');
  const imgRect = img.getBoundingClientRect();
  const imgWidth = img.clientWidth;
  const imgHeight = img.clientHeight;
  
  const startX = e.clientX;
  const startY = e.clientY;
  const initialBounds = [...zones[index].bounds];
  
  function onMouseMove(e) {
    const dx = (e.clientX - startX) / imgWidth;
    const dy = (e.clientY - startY) / imgHeight;
    
    let [left, top, width, height] = initialBounds;
    
    switch (corner) {
      case 'br':
        width = Math.max(0.05, Math.min(1 - left, width + dx));
        height = Math.max(0.05, Math.min(1 - top, height + dy));
        break;
      case 'bl':
        const newLeft = Math.max(0, Math.min(left + width - 0.05, left + dx));
        width = width - (newLeft - left);
        left = newLeft;
        height = Math.max(0.05, Math.min(1 - top, height + dy));
        break;
      case 'tr':
        width = Math.max(0.05, Math.min(1 - left, width + dx));
        const newTop = Math.max(0, Math.min(top + height - 0.05, top + dy));
        height = height - (newTop - top);
        top = newTop;
        break;
      case 'tl':
        const newLeftTl = Math.max(0, Math.min(left + width - 0.05, left + dx));
        const newTopTl = Math.max(0, Math.min(top + height - 0.05, top + dy));
        width = width - (newLeftTl - left);
        height = height - (newTopTl - top);
        left = newLeftTl;
        top = newTopTl;
        break;
    }
    
    zones[index].bounds = [
      parseFloat(left.toFixed(4)),
      parseFloat(top.toFixed(4)),
      parseFloat(width.toFixed(4)),
      parseFloat(height.toFixed(4))
    ];
    renderZones();
  }
  
  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
  
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function renderZonesList() {
  const listContainer = document.getElementById('zones-list');
  if (!listContainer) return;
  
  if (zones.length === 0) {
    listContainer.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No hay zonas. Haz clic en "➕ Agregar zona" para crear una.</p>';
    return;
  }
  
  listContainer.innerHTML = zones.map((zone, index) => `
    <div class="zone-item" data-index="${index}">
      <input type="text" value="${zone.label || ''}" 
             placeholder="Nombre" 
             onchange="updateZoneLabel(${index}, this.value)"
             style="flex: 0 0 150px;">
      <textarea placeholder="Descripción" 
                onchange="updateZoneText(${index}, this.value)"
                rows="2"
                style="flex: 1;">${zone.text || ''}</textarea>
      <button class="btn-delete-zone" onclick="deleteZone(${index})">🗑️</button>
    </div>
  `).join('');
}

// ==========================================
// ACTUALIZAR DATOS DE ZONA
// ==========================================
function updateZoneLabel(index, value) {
  zones[index].label = value;
  renderZones();
}

function updateZoneText(index, value) {
  zones[index].text = value;
}


document.addEventListener('click', (e) => {
  if (!e.target.closest('.zone-box') && !e.target.closest('.zones-list') && !e.target.closest('.btn-add-zone')) {
    if (selectedZoneIndex !== null) {
      selectedZoneIndex = null;
      renderZones();
    }
  }
});

// Generar IA
document.getElementById('btn-generate-ai').addEventListener('click', async () => {
  if (!currentWork) {
    showError('work-error', 'Primero guarda la obra como borrador.');
    return;
  }
  
  clearError('work-error');
  clearError('work-success');
  
  try {
    const data = await apiCall(`/api/admin/works/${currentWork.id}/generate-description`, { method: 'POST' });
    currentWork = data.work;
    
    // Actualizar el campo de descripción
    document.getElementById('work-description').value = currentWork.aiDescription || '';
    
    // Actualizar las zonas
    zones = currentWork.zones || [];
    renderZones();
    
    // Mostrar mensaje de éxito
    document.getElementById('work-success').textContent = '✅ Descripción y zonas generadas con IA';
    show(document.getElementById('work-success'), false);
    
    console.log('✅ Descripción generada:', currentWork.aiDescription);
  } catch (err) {
    showError('work-error', err.message);
  }
});

// Generar audio ElevenLabs (solo audio)
document.getElementById('btn-generate-audio').addEventListener('click', async () => {
  if (!currentWork) {
    showError('work-error', 'Primero guarda la obra como borrador.');
    return;
  }
  
  if (!currentWork.aiDescription) {
    showError('work-error', 'Primero debes generar la descripción con IA.');
    return;
  }
  
  clearError('work-error');
  clearError('work-success');
  
  try {
    const data = await apiCall(`/api/admin/works/${currentWork.id}/generate-audio`, { method: 'POST' });
    currentWork = data.work;
    
    document.getElementById('work-success').textContent = '✅ Audio generado con ElevenLabs';
    show(document.getElementById('work-success'), false);
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

function updateAudioPlayer() {
  const container = document.getElementById('audio-player-container');
  const player = document.getElementById('audio-player');
  
  if (!container || !player || !currentWork) return;
  
  if (currentWork.narrationAudioPath) {
    // Construir URL firmada para reproducir
    player.src = `/api/media/${currentWork.id}/narracion`;
    container.style.display = 'block';
  } else {
    player.src = '';
    container.style.display = 'none';
  }
}

// ==========================================
// SUBIR AUDIO PROPIO
// ==========================================
document.getElementById('btn-upload-audio')?.addEventListener('click', async () => {
  if (!currentWork) {
    showError('audio-error', 'Primero guarda la obra como borrador.');
    return;
  }

  const audioInput = document.getElementById('work-audio');
  const file = audioInput.files[0];

  if (!file) {
    showError('audio-error', 'Selecciona un archivo de audio primero.');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showError('audio-error', 'El audio no puede superar los 10MB.');
    return;
  }

  clearError('audio-error');
  document.getElementById('audio-success').style.display = 'none';

  try {
    const uploadBtn = document.getElementById('btn-upload-audio');
    uploadBtn.disabled = true;
    uploadBtn.textContent = '⏳ Subiendo...';

    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const data = await apiCall(`/api/admin/works/${currentWork.id}/upload-audio`, {
      method: 'POST',
      body: JSON.stringify({
        audioData: base64,
        audioType: file.type || 'audio/mpeg'
      })
    });

    currentWork = data.work;
    audioInput.value = '';
    
    const successDiv = document.getElementById('audio-success');
    successDiv.textContent = '✅ Audio subido correctamente';
    successDiv.style.display = 'block';
    
    updateAudioPlayer();

  } catch (err) {
    showError('audio-error', err.message);
  } finally {
    const uploadBtn = document.getElementById('btn-upload-audio');
    uploadBtn.disabled = false;
    uploadBtn.textContent = '📤 Subir audio';
  }
});

// Llamar a updateAudioPlayer cuando se abre el editor
const originalOpenEditor = window.openEditor;
window.openEditor = async function(workId) {
  await originalOpenEditor?.(workId);
  updateAudioPlayer();
};


// ==========================================
// INICIALIZACIÓN
// ==========================================
if (token) {
  loadDashboard();
} else {
  showView('view-auth');
}