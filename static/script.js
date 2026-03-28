// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    cargarConfiguracion();
    cargarMapeoTXT('E');
    cargarReglasLector('E');
});

// Navegación Sidebar
let despachoInterval = null;

function switchView(viewName, e) {
    if (e) e.preventDefault();
    document.querySelectorAll('.menu a').forEach(a => a.classList.remove('active'));
    const nav = document.getElementById(`nav-${viewName}`);
    if(nav) nav.classList.add('active');

    document.querySelectorAll('main.dashboard').forEach(m => m.classList.add('hidden'));

    const view = document.getElementById(`${viewName}-view`);
    if(view) view.classList.remove('hidden');
    
    if (viewName === 'dashboard') {
        renderDashboardTopMetrics();
        if (!window.dashInterval) window.dashInterval = setInterval(renderDashboardTopMetrics, 10000);
    } else {
        if (window.dashInterval) { clearInterval(window.dashInterval); window.dashInterval = null; }
    }
    
    if (viewName === 'despacho') {
        renderTrucks();
        if (!despachoInterval) despachoInterval = setInterval(renderTrucks, 3000);
    } else {
        if (despachoInterval) { clearInterval(despachoInterval); despachoInterval = null; }
    }
    
    if (viewName === 'historial') {
        renderHistorial();
    }
    
    if (viewName === 'buffer') {
        renderBuffer();
        if (!window.bufInterval) window.bufInterval = setInterval(renderBuffer, 3000);
    } else {
        if (window.bufInterval) { clearInterval(window.bufInterval); window.bufInterval = null; }
    }
}

async function renderTrucks() {
    try {
        const res = await fetch('/api/despacho');
        const data = await res.json();
        if(data.status === 'success') {
            const container = document.getElementById('truck-container');
            container.innerHTML = '';
            data.trucks.forEach(t => {
                const seatP = Math.min((t.seat_done / t.capacidad) * 100, 100);
                const doorP = Math.min((t.door_done / t.capacidad) * 100, 100);
                const fullBorder = t.lleno ? '#4CAF50' : 'var(--accent)';
                const statusIcon = t.lleno ? '<span style="color:#4CAF50; font-size:0.75rem; font-weight:800; position:absolute; top:1rem; right:1.5rem; padding: 4px 8px; background: rgba(76, 175, 80, 0.1); border-radius: 4px;">LISTO PARA SALIR ✔</span>' : '';
                
                container.innerHTML += `
                <section class="glass-card" style="border-left: 5px solid ${fullBorder}; position:relative;">
                    ${statusIcon}
                    <h3 style="margin-bottom:0.25rem;">Camión Semirremolque #${t.id}</h3>
                    <p style="opacity:0.7; font-family:var(--font-mono); font-size:0.85rem;">Lote de Producción: [ ${t.rango} ]</p>
                    
                    <div style="margin-top: 1.5rem;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem; font-size:0.9rem;">
                            <strong>SEAT SETS (Completos)</strong> <span style="font-family:var(--font-mono);">${t.seat_done} / ${t.capacidad}</span>
                        </div>
                        <div style="background:rgba(255,255,255,0.05); height:12px; border-radius:6px; overflow:hidden; margin-bottom: 1.5rem; border: 1px solid rgba(255,255,255,0.1);">
                            <div style="background: ${t.seat_done >= t.capacidad ? '#4CAF50' : 'var(--accent)'}; width:${seatP}%; height:100%; transition: width 0.5s ease-out;"></div>
                        </div>
                        
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem; font-size:0.9rem;">
                            <strong>DOOR SETS (Completos)</strong> <span style="font-family:var(--font-mono);">${t.door_done} / ${t.capacidad}</span>
                        </div>
                        <div style="background:rgba(255,255,255,0.05); height:12px; border-radius:6px; overflow:hidden; border: 1px solid rgba(255,255,255,0.1);">
                            <div style="background: ${t.door_done >= t.capacidad ? '#4CAF50' : 'var(--accent)'}; width:${doorP}%; height:100%; transition: width 0.5s ease-out;"></div>
                        </div>
                    </div>
                </section>
                `;
            });
        }
    } catch(e) { console.error(e); }
}

// ==========================
// Historial de Secuencias
// ==========================
async function renderHistorial() {
    try {
        const trgLector = document.getElementById('flt-lector').value;
        const res = await fetch('/api/secuencias');
        const data = await res.json();
        
        if (data.status === 'success') {
            const tbody = document.getElementById('historial-body');
            tbody.innerHTML = '';
            
            let filtered = data.data;
            if (trgLector !== 'ALL') {
                filtered = filtered.filter(row => row.lector === trgLector);
            }
            
            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; opacity: 0.6;">No se encontraron secuencias físicas</td></tr>`;
                return;
            }
            
            filtered.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><span class="status-ok" style="background:rgba(255,255,255,0.05); color:white; border:none; border-radius:4px; padding:2px 6px;">${row.fecha}</span></td>
                    <td><strong>${row.lector}</strong></td>
                    <td style="font-family:var(--font-mono); font-size:1.1rem; color:var(--accent); font-weight:bold;">${row.secuencia}</td>
                    <td style="font-family:var(--font-mono);">${row.chasis}</td>
                    <td style="color:#2196F3; font-weight:bold;">${row.padre}</td>
                    <td style="font-size:0.8rem; opacity:0.8;">${row.archivo}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        console.error(e);
    }
}

// ==========================
// Buffer Operations
// ==========================
async function renderBuffer() {
    try {
        const selCam = document.getElementById('buf-sel-camion');
        const currentVal = selCam ? selCam.value : '';
        
        const res = await fetch('/api/buffer' + (currentVal ? '?camion_id=' + currentVal : ''));
        const data = await res.json();
        if (data.status !== 'success') return;
        
        const bPend = document.getElementById('buf-pendientes-body');
        bPend.innerHTML = '';
        data.pendientes.forEach(p => {
            bPend.innerHTML += `<tr>
                <td>${p.linea}</td>
                <td style="font-weight:bold; color:var(--accent);">${p.seq}</td>
                <td><strong style="color:#2196F3">${p.hijo}</strong></td>
                <td><button class="btn btn-primary" style="padding:3px 8px; font-size:0.8rem;" onclick="escanearIngreso(${p.id})">Entrar ↑</button></td>
            </tr>`;
        });
        
        if (selCam && (selCam.innerHTML === '' || selCam.options.length !== data.camiones.length)) {
            selCam.innerHTML = data.camiones.map(c => `<option value="${c.id}">Camión #${c.id} (Sec ${c.rango})</option>`).join('');
            if (currentVal && data.camiones.some(c => c.id == currentVal)) {
                selCam.value = currentVal;
            } else if (data.camiones.length > 0 && !currentVal) {
                selCam.value = data.camiones[0].id;
                renderBuffer(); return;
            }
        }
        
        const bReal = document.getElementById('buf-real-body');
        bReal.innerHTML = '';
        data.buffer.forEach(b => {
            bReal.innerHTML += `<tr>
                <td style="color:#2196F3;">${b.fecha}</td>
                <td style="opacity:0.8; font-family:var(--font-mono);">${b.seq}</td>
                <td><strong style="color:#2196F3">${b.padre}</strong></td>
                <td><button class="btn btn-secondary" style="padding:3px 8px; font-size:0.8rem; border-color:#2196F3; color:#2196F3;" onclick="escanearDespacho(${b.id_inv})">Al Camión →</button></td>
            </tr>`;
        });

        const bManifest = document.getElementById('buf-manifest-body');
        if (bManifest) {
            bManifest.innerHTML = '';
            if (data.manifest && data.manifest.length > 0) {
                data.manifest.forEach(m => {
                    let st = m.estado === 'Despachado' ? '<span style="color:#4CAF50">✅ Completo</span>' : '<span style="color:var(--accent)">⏳ Esperando</span>';
                    bManifest.innerHTML += `<tr>
                        <td style="font-family:var(--font-mono);">[H] ${m.seq_h}</td>
                        <td><strong style="color:#4CAF50">${m.modelo}</strong></td>
                        <td>${st}</td>
                    </tr>`;
                });
            } else {
                bManifest.innerHTML = '<tr><td colspan="3" style="opacity:0.5; text-align:center;">Seleccione un camión con pedidos H</td></tr>';
            }
        }
    } catch(e) { console.error(e); }
}

async function escanearIngreso(id_ord) {
    await fetch('/api/buffer/in', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id: id_ord})
    });
    renderBuffer();
}

async function escanearDespacho(id_inv) {
    const id_cam = document.getElementById('buf-sel-camion').value;
    if (!id_cam) { alert("Debe haber un camión activo seleccionado para asignar la pieza."); return; }
    await fetch('/api/buffer/out', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id_inv: id_inv, id_camion: parseInt(id_cam)})
    });
    renderBuffer();
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
        if(data.print_mode !== undefined) document.getElementById('cfg-print-mode').value = data.print_mode;
        if(data.ip_l1 !== undefined) document.getElementById('cfg-ip-l1').value = data.ip_l1;
        if(data.ip_l2 !== undefined) document.getElementById('cfg-ip-l2').value = data.ip_l2;
        if(data.db_user !== undefined) document.getElementById('cfg-user').value = data.db_user;
        if(data.db_pass !== undefined) document.getElementById('cfg-pass').value = data.db_pass;
        if(data.camion_inicio !== undefined) {
            document.getElementById('cfg-camion-i').value = data.camion_inicio;
            document.getElementById('dsp-cfg-inicio').value = data.camion_inicio;
        }
        if(data.camion_capacidad !== undefined) {
            document.getElementById('cfg-camion-c').value = data.camion_capacidad;
            document.getElementById('dsp-cfg-cap').value = data.camion_capacidad;
        }

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
    const camIni = document.getElementById('cfg-camion-i').value;
    const camCap = document.getElementById('cfg-camion-c').value;
    const pMode = document.getElementById('cfg-print-mode').value;
    const ipL1 = document.getElementById('cfg-ip-l1').value;
    const ipL2 = document.getElementById('cfg-ip-l2').value;

    try {
        boton.textContent = "Guardando...";
        const respuesta = await fetch('/api/config', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                sftp_folder: folder, db_server: server, db_name: dbname, 
                db_user: user, db_pass: pass, 
                camion_inicio: parseInt(camIni) || 1, camion_capacidad: parseInt(camCap) || 24,
                print_mode: pMode, ip_l1: ipL1, ip_l2: ipL2
            })
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

async function actualizarConfigDespacho() {
    const boton = document.getElementById('btn-save-dsp');
    const ini = document.getElementById('dsp-cfg-inicio').value;
    const cap = document.getElementById('dsp-cfg-cap').value;
    
    boton.textContent = "Aplicando...";
    boton.style.opacity = "0.7";
    try {
        await fetch('/api/config', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ camion_inicio: parseInt(ini) || 1, camion_capacidad: parseInt(cap) || 24 })
        });
        document.getElementById('cfg-camion-i').value = ini;
        document.getElementById('cfg-camion-c').value = cap;
        renderTrucks();
    } catch (e) {
        console.error(e);
    } finally {
        boton.textContent = "Aplicar Lote";
        boton.style.opacity = "1";
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
        renderDashboardTopMetrics();
    } catch (e) {
        console.error(e);
        if (!isAutoScanning) {
            boton.textContent = "ERROR. REINTENTAR.";
            boton.disabled = false;
            boton.style.opacity = "1";
        }
    }
}

// ==========================
// EDITOR VISUAL DE ETIQUETAS
// ==========================
let activeField = null;
let tplData = {};

document.addEventListener('DOMContentLoaded', () => {
    cargarTemplateBase();
    initLabelCanvas();
});

async function cargarTemplateBase() {
    try {
        const res = await fetch('/api/templates');
        if (res.ok) {
            const data = await res.json();
            if(Object.keys(data).length > 0) tplData = data;
            aplicarTemplateActual();
        }
    } catch(e) { console.error(e); }
}

function aplicarTemplateActual() {
    const lector = document.getElementById('editor-lector').value;
    const paper = document.getElementById('editor-paper');
    const cv = document.getElementById('print-canvas');
    if(!cv) return;
    
    if (!tplData[lector]) {
        tplData[lector] = {
            format: "10x6",
            elements: {
                secuencia: { type: "field", x: 50, y: 20, size: 2.5 },
                linea: { type: "field", x: 20, y: 35, size: 1.0 },
                modelo: { type: "field", x: 20, y: 50, size: 1.5 },
                desc: { type: "field", x: 20, y: 70, size: 0.8 },
                fecha: { type: "field", x: 20, y: 80, size: 0.6 },
                qr: { type: "qr", x: 80, y: 50, size: 1.0 }
            }
        };
    }
    
    // Add type if missing from old saved config
    for(const k in tplData[lector].elements) {
        if(!tplData[lector].elements[k].type) {
            tplData[lector].elements[k].type = (k === 'qr') ? 'qr' : 'field';
        }
    }
    
    paper.value = tplData[lector].format;
    cambiarPapel();
    cv.innerHTML = '';
    
    const els = tplData[lector].elements;
    for (const key in els) {
        renderNodoEnCanvas(key, els[key]);
    }
    seleccionarCampo(null);
}

function cambiarPapel() {
    const val = document.getElementById('editor-paper').value;
    const cv = document.getElementById('print-canvas');
    if(!cv) return;
    if (val === '10x6') { cv.style.width = '100mm'; cv.style.height = '60mm'; }
    if (val === '10x10') { cv.style.width = '100mm'; cv.style.height = '100mm'; }
    if (val === 'A5') { cv.style.width = '148mm'; cv.style.height = '210mm'; }
    
    const lector = document.getElementById('editor-lector').value;
    if (tplData[lector]) tplData[lector].format = val;
}

function renderNodoEnCanvas(id, data) {
    const cv = document.getElementById('print-canvas');
    let el = document.getElementById('tpl-' + id);
    if(!el) {
        el = document.createElement('div');
        el.className = 'draggable-field';
        el.id = 'tpl-' + id;
        el.dataset.id = id;
        cv.appendChild(el);
    }
    
    el.style.left = data.x + '%';
    el.style.top = data.y + '%';
    el.dataset.scale = data.size || 1;
    el.dataset.type = data.type;
    
    if(data.type === 'field' || data.type === 'static') {
        el.style.transform = `translate(-50%, -50%) scale(${data.size})`;
        el.style.width = 'auto'; el.style.height = 'auto'; el.style.background = 'transparent';
        
        let shouldBold = data.bold;
        if(shouldBold === undefined) {
            shouldBold = (id === 'secuencia' || id === 'modelo'); // Defaults
        }
        el.style.fontWeight = shouldBold ? 'bold' : 'normal';

        if(data.type === 'field') {
            if(id === 'secuencia') el.textContent = 'SEQ: 125';
            else if(id === 'linea') el.textContent = 'Línea SEAT';
            else if(id === 'modelo') el.textContent = 'LD23';
            else if(id === 'desc') el.textContent = 'Asiento Delantero RH';
            else if(id === 'fecha') el.textContent = '2026-03-26';
        } else {
            el.textContent = data.text || 'Texto Fijo';
        }
    } else if(data.type === 'qr') {
        el.style.transform = `translate(-50%, -50%) scale(${data.size})`;
        el.innerHTML = '<div style="width:100%; height:100%; border:2px solid black; display:flex; align-items:center; justify-content:center; flex-direction:column; font-size:8px; font-weight:bold;"><span>QR</span><span>ID</span></div>';
        el.style.width = '20mm'; el.style.height = '20mm'; el.style.background = 'transparent';
    } else if(data.type === 'hline') {
        el.dataset.length = data.length || 50;
        el.style.width = el.dataset.length + '%';
        el.style.height = (data.size * 2) + 'px';
        el.style.background = 'black';
        el.style.transform = `translate(-50%, -50%)`;
        el.textContent = '';
    } else if(data.type === 'vline') {
        el.dataset.length = data.length || 50;
        el.style.height = el.dataset.length + '%';
        el.style.width = (data.size * 2) + 'px';
        el.style.background = 'black';
        el.style.transform = `translate(-50%, -50%)`;
        el.textContent = '';
    }
}

function crearElemento(type) {
    const lector = document.getElementById('editor-lector').value;
    if(!tplData[lector]) return;
    
    const id = type + '_' + Date.now();
    const data = { type: type, x: 50, y: 50, size: 1.0 };
    if(type === 'static') data.text = "Nuevo Texto";
    if(type === 'hline' || type === 'vline') { data.length = 50; data.size = 2; }
    
    tplData[lector].elements[id] = data;
    renderNodoEnCanvas(id, data);
    seleccionarCampo(document.getElementById('tpl-' + id));
}

function eliminarElementoActual() {
    if(!activeField) return;
    const lector = document.getElementById('editor-lector').value;
    const id = activeField.dataset.id;
    if(tplData[lector] && tplData[lector].elements[id]) {
        delete tplData[lector].elements[id];
    }
    activeField.remove();
    seleccionarCampo(null);
}

function seleccionarCampo(el) {
    document.querySelectorAll('.draggable-field').forEach(f => f.classList.remove('active-field'));
    activeField = el;
    
    const pHint = document.getElementById('prop-hint');
    const pControls = document.getElementById('prop-controls');
    if (!el) {
        pHint.style.display = 'block';
        pControls.style.display = 'none';
        return;
    }
    
    el.classList.add('active-field');
    pHint.style.display = 'none';
    pControls.style.display = 'block';
    
    const type = el.dataset.type;
    const s = parseFloat(el.dataset.scale) || 1.0;
    
    document.getElementById('editor-size').value = s;
    document.getElementById('editor-size-val').textContent = s.toFixed(1) + 'x';
    
    document.getElementById('editor-x').value = parseFloat(el.style.left) || 0;
    document.getElementById('editor-y').value = parseFloat(el.style.top) || 0;
    
    const ctrlText = document.getElementById('ctrl-text');
    const ctrlLength = document.getElementById('ctrl-length');
    const ctrlBold = document.getElementById('ctrl-bold');
    
    const lector = document.getElementById('editor-lector').value;
    const data = tplData[lector].elements[el.dataset.id];
    
    if(type === 'static') {
        ctrlText.style.display = 'block';
        document.getElementById('editor-text-val').value = el.textContent;
    } else {
        ctrlText.style.display = 'none';
    }
    
    if (type === 'field' || type === 'static') {
        ctrlBold.style.display = 'block';
        let b = data.bold;
        if (b === undefined) b = (el.dataset.id === 'secuencia' || el.dataset.id === 'modelo');
        document.getElementById('editor-bold').checked = b;
    } else {
        ctrlBold.style.display = 'none';
        document.getElementById('editor-bold').checked = false;
    }
    
    if(type === 'hline' || type === 'vline') {
        ctrlLength.style.display = 'block';
        document.getElementById('lbl-editor-size').textContent = "Grosor Físico:";
        const l = parseFloat(el.dataset.length) || 50;
        document.getElementById('editor-length').value = l;
        document.getElementById('editor-length-val').textContent = l + '%';
    } else {
        ctrlLength.style.display = 'none';
        document.getElementById('lbl-editor-size').textContent = "Multiplicador de Tamaño:";
    }
    
    const btnDel = document.getElementById('btn-del-el');
    if(type === 'field' || type === 'qr') btnDel.style.display = 'none';
    else btnDel.style.display = 'block';
}

function actualizarTamanoBase() {
    if (!activeField) return;
    const type = activeField.dataset.type;
    const s = parseFloat(document.getElementById('editor-size').value);
    document.getElementById('editor-size-val').textContent = s.toFixed(1) + 'x';
    
    const nx = parseFloat(document.getElementById('editor-x').value) || 0;
    const ny = parseFloat(document.getElementById('editor-y').value) || 0;
    
    activeField.dataset.scale = s;
    const lector = document.getElementById('editor-lector').value;
    const id = activeField.dataset.id;
    const data = tplData[lector].elements[id];
    
    data.size = s;
    data.x = nx;
    data.y = ny;
    
    if(type === 'field' || type === 'static') {
        data.bold = document.getElementById('editor-bold').checked;
    }
    
    if(type === 'static') {
        data.text = document.getElementById('editor-text-val').value;
    }
    if(type === 'hline' || type === 'vline') {
        const l = parseFloat(document.getElementById('editor-length').value);
        document.getElementById('editor-length-val').textContent = l + '%';
        data.length = l;
        activeField.dataset.length = l;
    }
    
    renderNodoEnCanvas(id, data);
}

async function guardarTemplate() {
    const btn = document.getElementById('btn-save-tpl');
    const msg = document.getElementById('tpl-msg');
    try {
        btn.textContent = "Guardando...";
        const res = await fetch('/api/templates', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(tplData)
        });
        if(res.ok) {
            msg.innerHTML = '<span style="color:#4CAF50">✓ Diseño Visual respaldado OK en el Servidor.</span>';
            setTimeout(() => msg.innerHTML='', 3000);
        }
    } catch(e) {
        msg.innerHTML = '<span style="color:#F44336">Error de red.</span>';
    } finally {
        btn.textContent = "💾 Guardar Diseño PDF/ZPL";
    }
}

function initLabelCanvas() {
    const cv = document.getElementById('print-canvas');
    if(!cv) return;
    
    let isDragging = false;
    let currentDrag = null;

    cv.addEventListener('mousedown', (e) => {
        const field = e.target.closest('.draggable-field');
        if (field) {
            isDragging = true;
            currentDrag = field;
            seleccionarCampo(field);
        } else {
            seleccionarCampo(null);
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging || !currentDrag) return;
        const rect = cv.getBoundingClientRect();
        
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        x = Math.max(0, Math.min(x, rect.width));
        y = Math.max(0, Math.min(y, rect.height));
        
        const px = (x / rect.width) * 100;
        const py = (y / rect.height) * 100;
        currentDrag.style.left = px + '%';
        currentDrag.style.top = py + '%';
        
        // Update input boxes in real time
        document.getElementById('editor-x').value = px.toFixed(1);
        document.getElementById('editor-y').value = py.toFixed(1);
    });

    document.addEventListener('mouseup', () => {
        if (isDragging && currentDrag) {
            const lector = document.getElementById('editor-lector').value;
            const id = currentDrag.dataset.id;
            if(tplData[lector] && tplData[lector].elements[id]) {
                tplData[lector].elements[id].x = parseFloat(currentDrag.style.left);
                tplData[lector].elements[id].y = parseFloat(currentDrag.style.top);
            }
        }
        isDragging = false;
        currentDrag = null;
    });
}

// ==========================
// Dashboard Metrics (Chart)
// ==========================
async function renderDashboardTopMetrics() {
    try {
        const res = await fetch('/api/secuencias');
        const data = await res.json();
        if (data.status !== 'success') return;
        
        const seqs = data.data;
        const eTot = document.getElementById('dash-tot-seq');
        if(eTot) eTot.textContent = seqs.length;
        
        const counts = {};
        seqs.forEach(s => {
            const p = s.padre || "Desc.";
            counts[p] = (counts[p] || 0) + 1;
        });
        
        const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 5);
        const max = sorted.length > 0 ? sorted[0][1] : 1;
        
        const chart = document.getElementById('models-chart-container');
        if (!chart) return;
        chart.innerHTML = '';
        
        if (sorted.length === 0) {
            chart.innerHTML = '<div style="text-align:center; opacity:0.5; margin-top:2rem;">Sin datos aún</div>';
            return;
        }
        
        const colors = ['#1C8281', '#28B4B4', '#55D4D4', '#8BE4E4', '#BFFFFF']; // Teal Gradient Hydra Corps
        
        sorted.forEach(([model, qty], i) => {
            const pct = Math.max((qty / max) * 100, 5);
            const color = colors[i % colors.length];
            const tColor = i === 4 ? '#111827' : 'white'; // Dark text for lightest bar
            chart.innerHTML += `
            <div class="chart-row">
                <div class="chart-label" title="${model}">${model}</div>
                <div class="chart-bar-container">
                    <div class="chart-bar-fill" style="width:0%; background:${color}; color:${tColor};">
                        ${qty}
                    </div>
                </div>
            </div>`;
        });
        
        // Trigger reflow for animation
        setTimeout(() => {
            const fills = chart.querySelectorAll('.chart-bar-fill');
            fills.forEach((fill, i) => {
                const qty = sorted[i][1];
                const pct = Math.max((qty / max) * 100, 5);
                fill.style.width = pct + '%';
            });
        }, 50);
        
    } catch(e) { console.error("Error rendering chart", e); }
}
