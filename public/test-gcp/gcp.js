// public/test-gcp/gcp.js
console.log("✅ gcp.js se está cargando...");

function showResult(elementId, data, isError = false) {
  const el = document.getElementById(elementId);
  if (!el) return console.error(`No se encontró el elemento: ${elementId}`);
  el.hidden = false;
  el.className = 'result ' + (isError ? 'error' : 'success');
  el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
}

function updateStatus(elementId, status, message) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.className = 'status-item ' + status;
  el.textContent = message;
}

async function testHealth() {
  console.log("🏥 Ejecutando testHealth...");
  updateStatus('status-health', 'loading', '🏥 Probando...');
  try {
    const response = await fetch('/healthz');
    const data = await response.json();
    showResult('result-health', data);
    updateStatus('status-health', 'success', '✅ Health OK');
  } catch (error) {
    console.error("Error en health:", error);
    showResult('result-health', error.message, true);
    updateStatus('status-health', 'error', '❌ Error');
  }
}

async function testFirestore() {
  console.log("📦 Ejecutando testFirestore...");
  updateStatus('status-firestore', 'loading', '📦 Probando...');
  try {
    const writeRes = await fetch('/api/prueba', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje: 'Prueba desde gcp.js', timestamp: new Date().toISOString() })
    });
    const writeData = await writeRes.json();
    const readRes = await fetch('/api/prueba');
    const readData = await readRes.json();
    showResult('result-firestore', { escritura: writeData, lectura: readData });
    updateStatus('status-firestore', 'success', '✅ Firestore OK');
  } catch (error) {
    console.error("Error en firestore:", error);
    showResult('result-firestore', error.message, true);
    updateStatus('status-firestore', 'error', '❌ Error');
  }
}

async function testStorage() {
  console.log("☁️ Ejecutando testStorage...");
  const fileInput = document.getElementById('file-input');
  if (!fileInput || !fileInput.files[0]) {
    showResult('result-storage', '⚠️ Selecciona un archivo primero', true);
    return;
  }
  updateStatus('status-storage', 'loading', '☁️ Subiendo...');
  try {
    const formData = new FormData();
    formData.append('archivo', fileInput.files[0]);
    const response = await fetch('/api/subir', { method: 'POST', body: formData });
    const data = await response.json();
    showResult('result-storage', data);
    updateStatus('status-storage', 'success', '✅ Storage OK');
  } catch (error) {
    console.error("Error en storage:", error);
    showResult('result-storage', error.message, true);
    updateStatus('status-storage', 'error', '❌ Error');
  }
}

async function testAuth(action) {
  console.log(`🔐 Ejecutando testAuth: ${action}...`);
  const emailInput = document.getElementById('auth-email');
  const passInput = document.getElementById('auth-password');
  
  if (!emailInput || !passInput || !emailInput.value || !passInput.value) {
    showResult('result-auth', '⚠️ Ingresa correo y contraseña', true);
    return;
  }
  
  updateStatus('status-auth', 'loading', '🔐 Procesando...');
  try {
    const endpoint = action === 'register' ? '/api/account/register' : '/api/account/login';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailInput.value, password: passInput.value })
    });
    const data = await response.json();
    showResult('result-auth', data);
    updateStatus('status-auth', 'success', '✅ Auth OK');
  } catch (error) {
    console.error("Error en auth:", error);
    showResult('result-auth', error.message, true);
    updateStatus('status-auth', 'error', '❌ Error');
  }
}

async function testCatalog() {
  console.log("📚 Ejecutando testCatalog...");
  try {
    const response = await fetch('/api/catalog');
    const data = await response.json();
    showResult('result-catalog', data);
  } catch (error) {
    console.error("Error en catalog:", error);
    showResult('result-catalog', error.message, true);
  }
}

// ==========================================
// ASIGNACIÓN DE EVENTOS (Aquí es donde suele fallar)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  console.log("🟢 DOM cargado. Asignando eventos a los botones...");
  
  // 1. Auto-ejecutar health check
  testHealth();

  // 2. Botones de prueba general
  const testButtons = document.querySelectorAll('[data-test]');
  console.log(`Se encontraron ${testButtons.length} botones de prueba.`);
  
  testButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault(); // Prevenir comportamientos extraños
      const test = btn.getAttribute('data-test');
      console.log(`Clic en botón: ${test}`);
      if (test === 'health') testHealth();
      if (test === 'firestore') testFirestore();
      if (test === 'storage') testStorage();
      if (test === 'catalog') testCatalog();
    });
  });

  // 3. Botones de autenticación
  const authButtons = document.querySelectorAll('[data-auth-action]');
  console.log(`Se encontraron ${authButtons.length} botones de auth.`);
  
  authButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const action = btn.getAttribute('data-auth-action');
      console.log(`Clic en auth: ${action}`);
      testAuth(action);
    });
  });

  // 4. Input de archivo
  const fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.addEventListener('change', function(e) {
      const fileNameEl = document.getElementById('file-name');
      if (fileNameEl) {
        fileNameEl.textContent = e.target.files[0]?.name || 'Ningún archivo seleccionado';
      }
    });
  }
  
  console.log("🏁 gcp.js terminó de inicializarse correctamente.");
});