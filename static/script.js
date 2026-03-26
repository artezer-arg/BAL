// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    cargarConfiguracion();
    cargarMapeoTXT('E');
    cargarReglasLector('E');
});

// Navegación Sidebar
function switchView(viewName, e) {
    if (e) e.preventDefault();
    document.querySelectorAll('.menu a').forEach(a => a.classList.remove('active'));
    document.getElementById(`nav-${viewName}`).classList.add('active');

    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('config-view').classList.add('hidden');
    document.getElementById('catalog-view').classList.add('hidden');
    document.getElementById('mapping-view').classList.add('hidden');
    document.getElementById('readers-view').classList.add('hidden');

    document.getElementById(`${viewName}-view`).classList.remove('hidden');
}

// ==========================
// Módulo de Catálogo BOM
// ==========================
async function guardarAltaManual() {
    const boton = document.getElementById('btn-save-cat');
    const msg = document.getElementById('cat-msg');
    
    const payload = {
        padre: document.getElementById('cat-padre').value,
        linea: document.getElementById('cat-linea').value,
        hijo: document.getElementById('cat-hijo').value,
        desc: document.getElementById('cat-desc').value,
        mano: document.getElementById('cat-mano').value,
        tasa: document.getElementById('cat-tasa').value
    };

    if (!payload.padre || !payload.hijo || !payload.linea) {
        msg.innerHTML = '<span style="color:#f44336">Padre, Hijo y Línea son obligatorios.</span>';
        return;
    }

    try {
        boton.disabled = true;
        boton.textContent = "Guardando...";
        
        const respuesta = await fetch('/api/catalog/manual', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        
        const data = await respuesta.json();
        if (data.status === 'success') {
            msg.innerHTML = `<span style="color:#4CAF50">✓ Ruta BOM guardada OK.</span>`;
        } else {
            msg.innerHTML = `<span style="color:#f44336">Error: ${data.message}</span>`;
        }
    } catch (e) {
        msg.innerHTML = `<span style="color:#f44336">Error de conexión.</span>`;
    } finally {
        boton.disabled = false;
        boton.textContent = "Registrar en BOM";
        setTimeout(() => msg.innerHTML = '', 5000);
    }
}

// Drag & Drop / Selección File
let selectedFile = null;

function manejarArchivo(input) {
    const file = input.files[0];
    if (!file) return;
    
    if (file.name.endsWith('.csv')) {
        selectedFile = file;
        document.getElementById('drop-text').textContent = `Seleccionado: ${file.name}`;
        document.getElementById('btn-upload-csv').disabled = false;
        document.getElementById('drop-zone').classList.add('ready');
    } else {
        alert("Por favor, selecciona un archivo CSV.");
        input.value = "";
    }
}

async function subirCsvMasivo() {
    if (!selectedFile) return;

    const boton = document.getElementById('btn-upload-csv');
    const msg = document.getElementById('upload-msg');
    
    boton.disabled = true;
    boton.textContent = "Procesando Archivo (puede demorar)...";
    
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
        const respuesta = await fetch('/api/catalog/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await respuesta.json();
        if (data.status === 'success') {
            msg.innerHTML = `<span style="color:#4CAF50">✓ Archivo procesado con éxito. Se insertaron múltiples recetas.</span>`;
        } else {
            msg.innerHTML = `<span style="color:#f44336">Error: ${data.message}</span>`;
        }
    } catch (e) {
        msg.innerHTML = `<span style="color:#f44336">Falló la comunicación con el servidor.</span>`;
    } finally {
        boton.textContent = "Subir y Procesar Masivamente";
        document.getElementById('drop-zone').classList.remove('ready');
        document.getElementById('drop-text').textContent = "Haz clic para buscar tu archivo .CSV";
        selectedFile = null;
        document.getElementById('file-uploader').value = "";
    }
}

// ==========================
// Módulo de Configuración Global
// ==========================
async function cargarConfiguracion() {
    try {
        const respuesta = await fetch('/api/config');
        const data = await respuesta.json();
        
        if(data.sftp_folder) document.getElementById('folder-path').value = data.sftp_folder;
        if(data.db_server) document.getElementById('cfg-server').value = data.db_server;
        if(data.db_name) document.getElementById('cfg-dbname').value = data.db_name;
        if(data.db_user !== undefined) document.getElementById('cfg-user').value = data.db_user;
        if(data.db_pass !== undefined) document.getElementById('cfg-pass').value = data.db_pass;

    } catch (e) {
        console.error("Error conectando con el backend BAL", e);
    }
}

async function guardarConfigGeneral() {
    const boton = document.getElementById('btn-save-cfg');
    const folder = document.getElementById('folder-path').value;
    const server = document.getElementById('cfg-server').value;
    const dbname = document.getElementById('cfg-dbname').value;
    const user = document.getElementById('cfg-user').value;
    const pass = document.getElementById('cfg-pass').value;

    try {
        boton.textContent = "Guardando...";
        const respuesta = await fetch('/api/config', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ sftp_folder: folder, db_server: server, db_name: dbname, db_user: user, db_pass: pass })
        });
        
        const data = await respuesta.json();
        if(data.status === 'success') {
            boton.textContent = "Configuración OK ✓";
            boton.style.background = "#4CAF50";
            setTimeout(() => { boton.textContent = "Guardar Generales"; boton.style.background = ""; }, 2000);
        }
    } catch (e) {
        alert("Error al guardar la configuración general.");
    }
}

// ==========================
// Módulo de Mapeo TXT POSICIONAL
// ==========================
async function cargarMapeoTXT(letra, btnClicked = null) {
    document.getElementById('map-current-letter-txt').value = letra;
    if (btnClicked) {
        document.getElementById('tabs-letras-map').querySelectorAll('.btn-tab').forEach(b => b.classList.remove('active'));
        btnClicked.classList.add('active');
    } else {
        document.getElementById('tabs-letras-map').querySelectorAll('.btn-tab').forEach(b => {
            if (b.textContent.includes(letra)) b.classList.add('active');
            else b.classList.remove('active');
        });
    }

    try {
        const respuesta = await fetch(`/api/mapping?letra=${letra}`);
        const data = await respuesta.json();

        if (data.status === 'success' && data.mapeo) {
            const m = data.mapeo;
            document.getElementById('map-sec-i').value = m.inicio_secuencia;   document.getElementById('map-sec-a').value = m.ancho_secuencia;
            document.getElementById('map-suf-i').value = m.inicio_suffix;      document.getElementById('map-suf-a').value = m.ancho_suffix;
            document.getElementById('map-col-i').value = m.inicio_color;       document.getElementById('map-col-a').value = m.ancho_color;
            document.getElementById('map-mod-i').value = m.inicio_modelo;      document.getElementById('map-mod-a').value = m.ancho_modelo;
            document.getElementById('map-cha-i').value = m.inicio_chasis;      document.getElementById('map-cha-a').value = m.ancho_chasis;
            document.getElementById('map-fec-i').value = m.inicio_fecha;       document.getElementById('map-fec-a').value = m.ancho_fecha;
        } else {
            document.getElementById('mapping-view').querySelectorAll('.mapping-table input').forEach(inp => inp.value = '');
        }
    } catch (e) {
        console.error("Error pidiendo mapeos", e);
    }
}

async function guardarMapeoTXT() {
    const letra = document.getElementById('map-current-letter-txt').value;
    const boton = document.getElementById('btn-save-map-txt');

    const mapeo = {
        letra: letra,
        inicio_secuencia: parseInt(document.getElementById('map-sec-i').value) || 0,   ancho_secuencia: parseInt(document.getElementById('map-sec-a').value) || 0,
        inicio_suffix: parseInt(document.getElementById('map-suf-i').value) || 0,      ancho_suffix: parseInt(document.getElementById('map-suf-a').value) || 0,
        inicio_color: parseInt(document.getElementById('map-col-i').value) || 0,       ancho_color: parseInt(document.getElementById('map-col-a').value) || 0,
        inicio_modelo: parseInt(document.getElementById('map-mod-i').value) || 0,      ancho_modelo: parseInt(document.getElementById('map-mod-a').value) || 0,
        inicio_chasis: parseInt(document.getElementById('map-cha-i').value) || 0,      ancho_chasis: parseInt(document.getElementById('map-cha-a').value) || 0,
        inicio_fecha: parseInt(document.getElementById('map-fec-i').value) || 0,       ancho_fecha: parseInt(document.getElementById('map-fec-a').value) || 0
    };

    try {
        boton.textContent = "Guardando...";
        const respuesta = await fetch('/api/mapping', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(mapeo)
        });
        
        const data = await respuesta.json();
        if(data.status === 'success') {
            boton.textContent = "Offsets Guardados ✓";
            boton.style.background = "#4CAF50";
            setTimeout(() => { boton.textContent = "Guardar Offsets para esta Letra"; boton.style.background = ""; }, 2000);
        }
    } catch (e) {
        alert("Error al guardar mapeo posicional.");
    }
}

// ==========================
// Módulo de Reglas y Lectores
// ==========================
async function cargarReglasLector(letra, btnClicked = null) {
    document.getElementById('map-current-letter-rules').value = letra;
    if (btnClicked) {
        document.getElementById('tabs-letras-rules').querySelectorAll('.btn-tab').forEach(b => b.classList.remove('active'));
        btnClicked.classList.add('active');
    } else {
        document.getElementById('tabs-letras-rules').querySelectorAll('.btn-tab').forEach(b => {
            if (b.textContent.includes(letra)) b.classList.add('active');
            else b.classList.remove('active');
        });
    }

    try {
        const respuesta = await fetch(`/api/mapping?letra=${letra}`);
        const data = await respuesta.json();

        if (data.status === 'success' && data.mapeo) {
            const m = data.mapeo;
            document.getElementById('rule-sec-t').value = m.tope_secuencia || 9999;
            document.getElementById('rule-sec-strict').checked = m.validar_saltos !== false;
            document.getElementById('rule-ignored').value = m.padres_restringidos || "";
        } else {
            document.getElementById('rule-sec-t').value = 9999;
            document.getElementById('rule-sec-strict').checked = true;
            document.getElementById('rule-ignored').value = "";
        }
    } catch (e) {
        console.error("Error pidiendo reglas de lectores", e);
    }
}

async function guardarReglasLector() {
    const letra = document.getElementById('map-current-letter-rules').value;
    const boton = document.getElementById('btn-save-rules');

    const payload = {
        letra: letra,
        tope_secuencia: parseInt(document.getElementById('rule-sec-t').value) || 9999,
        validar_saltos: document.getElementById('rule-sec-strict').checked,
        padres_restringidos: document.getElementById('rule-ignored').value
    };

    try {
        boton.textContent = "Guardando...";
        const respuesta = await fetch('/api/mapping', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        
        const data = await respuesta.json();
        if(data.status === 'success') {
            boton.textContent = "Reglas Clavadas ✓";
            boton.style.background = "#4CAF50";
            setTimeout(() => { boton.textContent = "Guardar Reglas de este Lector"; boton.style.background = ""; }, 2000);
        }
    } catch (e) {
        alert("Error al guardar reglas de seguridad.");
    }
}

// ==========================
// Simulador Manual
// ==========================
async function ejecutarSincronizacionManual() {
    const boton = document.getElementById('btn-sim-scan');
    const msg = document.getElementById('sim-msg');
    
    const simulacion = {
        letra: document.getElementById('sim-letra').value.toUpperCase(),
        padre: document.getElementById('sim-padre').value.toUpperCase(),
        secuencia: document.getElementById('sim-sec').value,
        chasis: document.getElementById('sim-chasis').value
    };

    if (!simulacion.padre || !simulacion.secuencia || !simulacion.chasis) {
        msg.innerHTML = '<span style="color:#f44336">Completá todos los campos obligatorios.</span>';
        return;
    }

    try {
        boton.disabled = true;
        boton.textContent = "Inyectando a Base de Datos...";
        
        const respuesta = await fetch('/api/manual_sync', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(simulacion)
        });
        
        const data = await respuesta.json();
        
        if (data.status === 'success') {
            msg.innerHTML = `<span style="color:#4CAF50">✓ Secuencia inyectada. Solicitud ID: ${data.id_solicitud} | Órdenes: ${data.ordenes}</span>`;
            const logsBody = document.getElementById('log-body');
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${new Date().toLocaleTimeString('es-AR')}</td><td>[MANUAL_${simulacion.letra}]</td><td>${simulacion.padre}</td><td><span class="status-ok">Simulado OK</span></td>`;
            if (logsBody.querySelector('.empty-row')) logsBody.innerHTML = '';
            logsBody.prepend(tr);

        } else {
            msg.innerHTML = `<span style="color:#f44336">Error: ${data.message}</span>`;
        }
    } catch (e) {
        msg.innerHTML = `<span style="color:#f44336">Error de red Boshoku Server.</span>`;
    } finally {
        boton.disabled = false;
        boton.textContent = "Simular Recepción Transaccional";
        setTimeout(() => msg.innerHTML = '', 5000);
    }
}

// ==========================
// Escáner Dashboard
// ==========================
let autoScanTimer = null;
let isAutoScanning = false;

function toggleAutoScan() {
    isAutoScanning = !isAutoScanning;
    const btnAuto = document.getElementById('btn-autoscan');
    const btnManual = document.getElementById('btn-scan');
    const pulse = document.getElementById('autoscan-pulse');
    
    if (isAutoScanning) {
        btnAuto.style.background = 'rgba(76, 175, 80, 0.2)';
        btnAuto.style.borderColor = '#4CAF50';
        btnAuto.style.color = '#4CAF50';
        pulse.style.display = 'inline-block';
        btnAuto.innerHTML = '';
        btnAuto.appendChild(pulse);
        btnAuto.innerHTML += ' Auto-Scan ACTIVO';
        btnManual.disabled = true;
        
        escanearDirectorio();
        autoScanTimer = setInterval(escanearDirectorio, 3000);
    } else {
        btnAuto.style.background = '';
        btnAuto.style.borderColor = '';
        btnAuto.style.color = '';
        pulse.style.display = 'none';
        btnAuto.innerHTML = '';
        btnAuto.appendChild(pulse);
        btnAuto.innerHTML += ' Activar Auto-Scan';
        btnManual.disabled = false;
        
        clearInterval(autoScanTimer);
        autoScanTimer = null;
    }
}

async function escanearDirectorio() {
    const boton = document.getElementById('btn-scan');
    const logsBody = document.getElementById('log-body');
    
    if (!isAutoScanning) {
        boton.textContent = "ESCANEANDO TXTs...";
        boton.style.opacity = "0.7";
        boton.disabled = true;
    }
    
    try {
        const respuesta = await fetch('/api/scan', { method: 'POST' });
        const data = await respuesta.json();
        
        if (!isAutoScanning) {
            boton.textContent = "ESCANEAR AHORA";
            boton.style.opacity = "1";
            boton.disabled = false;
        }
        
        if (data.status === 'error') { 
            if (!isAutoScanning) alert("Ruta inválida: " + data.message); 
            return; 
        }
        if (data.procesados === 0) { 
            if (logsBody.querySelectorAll('tr:not(.empty-row)').length === 0) {
                logsBody.innerHTML = `<tr class="empty-row"><td colspan="4">No se encontraron archivos en la carpeta SFTP. Esperando Lector...</td></tr>`;
            }
            return; 
        }
        
        if (logsBody.querySelector('.empty-row')) logsBody.innerHTML = '';
        
        data.logs.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${log.time}</td><td>${log.file}</td><td>${log.padre}</td><td><span class="status-ok">${log.status}</span></td>`;
            tr.style.opacity = 0; tr.style.transform = "translateY(-10px)"; tr.style.transition = "all 0.3s ease";
            logsBody.prepend(tr); 
            setTimeout(() => { tr.style.opacity = 1; tr.style.transform = "translateY(0)"; }, 50);
        });
    } catch (e) {
        console.error(e);
        if (!isAutoScanning) {
            boton.textContent = "ERROR. REINTENTAR.";
            boton.disabled = false;
            boton.style.opacity = "1";
        }
    }
}
