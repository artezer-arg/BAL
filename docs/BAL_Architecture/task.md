# Task Breakdown: Database Paradigm Shift (Supply/Demand)
- [x] Write Python SQL migration scripts to natively inject `t_camiones_despacho` and `t_inventario_buffer`
- [x] Apply schema modifiers securely against the live pyodbc environment
- [x] Refactor `app.py` engine so `H` requests spawn hardcoded truck manifests in `t_camiones_despacho`
- [x] Build `<main id="buffer-view">` allowing dual manual barcode operations: "Ingreso a Racks" and "Carga a Semi"
- [x] Create specialized `/api/buffer/scan` Python endpoint connecting barcode scanning events to internal orders
- [ ] Connect Visual Despacho UI strictly against the new physical Pick quantities
