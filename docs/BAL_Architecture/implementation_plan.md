# Goal Description
The system must unified the ingestion structure for all TASA Broadcasts (E, H, F, A, J) because they all share the exact same intrinsic data structure (Sequence, Date, Chassis, Parent Code).
Furthermore, the system needs a dedicated **Buscador de Secuencias** (Sequence History List) to globally track the real-time drops of these TXT files.

## Architectural Correction (Unified Ingestion)
Previously, the backend hardcoded Lector `H` as a "Dispatch Event" and Lector `E` as a "Production Event", routing them to different tables.
Based on production reality:
- **Lector E:** Triggers production of Seats.
- **Lector H:** Triggers production of Doors (and acts as a dispatch timing signal).
- Both must land directly in `t_solicitudes_recepcion` as unified broadcast arrivals from TASA.

## Proposed Changes

### 1. Unified Table Routing
#### [MODIFY] [app.py](file:///c:/Users/artez/.gemini/antigravity/scratch/tbar_sync/app.py)
- Refactor `procesar_carpeta_sftp()`: Remove the restrictive `elif letra == 'H'` block.
- **ALL LETTERS (E, H, A, F, J)** will instantly generate a record in `t_solicitudes_recepcion`.
- The system will query the BOM (`c_bom_recetas`) and queue the respective internal orders into `t_ordenes_internas` regardless of the letter. If `H` brings Door recipes, they will be queued correctly.

### 2. View Historical Sequences
#### [MODIFY] [app.py](file:///c:/Users/artez/.gemini/antigravity/scratch/tbar_sync/app.py)
- Create `/api/secuencias` endpoint.
- Since everything is now unified, the query is a simple, ultra-fast `SELECT` directly against `t_solicitudes_recepcion` joined with `c_productos_cliente`. No complex `UNION ALL` needed anymore!
- Can easily filter by `nombre_archivo_sftp LIKE 'E%'` or `'H%'`.

#### [MODIFY] [static/index.html](file:///c:/Users/artez/.gemini/antigravity/scratch/tbar_sync/static/index.html)
- Inject `<main id="historial-view">` with a native `<table>` interface.
- Includes a primary filter dropdown: `Todos`, `Lector E`, `Lector H`.

#### [MODIFY] [static/script.js](file:///c:/Users/artez/.gemini/antigravity/scratch/tbar_sync/static/script.js)
- Build dynamic Javascript filtering loop mapping directly against the unified JSON payload.

## User Review Required
> [!IMPORTANT]
> - Since both `E` and `H` are now just production requests inserted into the same master table, how exactly does a component logically transition to "Despachado"? 
> - If `E` makes Seats and `H` makes Doors, does reading an `H` TXT automatically mean the corresponding Seat for that sequence should be marked as Shipped? Or do the operators use a completely different physical scanner gun to dispatch both into the trucks?

## Verification Plan
### Automated Tests
- Drop an `H` TXT and an `E` TXT into the SFTP simulator.
- Verify both appear smoothly on the same chronological timeline in the History View.
