# Análisis Arquitectónico DBA: Sistema BAL (Boshoku Argentina Link)

Como Administrador de Bases de Datos (DBA), tras analizar el ciclo físico de la planta *(Lector E como Provisión de Asientos vs. Lector H como Demanda de Camión y Provisión de Puertas)*, detecto **cuatro cuellos de botella arquitectónicos** críticos en el diseño actual.

La estructura actual funciona bien para un flujo lineal y acoplado, pero es frágil frente a la naturaleza asíncrona de las líneas JIT (Just In Time) cruzadas. A continuación, presento mi auditoría técnica y la solución propuesta.

---

## 🛑 Problemas Detectados en el Esquema Actual

### 1. Ambigüedad entre Demanda y Oferta (Doble Contabilización)
Actualmente, todo ingreso (TXT) inserta automáticamente en `t_solicitudes_recepcion` y explota la matriz BOM (`c_bom_recetas`) para crear filas en `t_ordenes_internas`.
- Si el Lector **E** (Asientos) entra, crea la orden interna del Asiento.
- Si el Lector **H** (Despacho/Puertas) entra con el mismo Modelo, y el BOM no está perfectamente separado por línea, se corre el riesgo de "duplicar" la orden del asiento o de mezclar qué lector ordenó fabricar qué cosa.
*La base de datos no distingue hoy si una `t_ordenes_internas` es una "pieza fabricada" (Supply) o un "hueco vacío en el camión" (Demand).*

### 2. Ausencia de Entidad "Camión" (Truck Manifest)
El concepto físico de "Camión" hoy se infiere dinámicamente dividiendo `(Secuencia - Inicio) / Capacidad`.
Esto es muy performante pero **imposibilita el rastreo contable a futuro**. Si mañana un camión se fue incompleto por urgencia de Toyota, o un camión alojó 23 en vez de 24 piezas, la matemática en duro se rompe.
*Falta una tabla transaccional real para el Camión físico.*

### 3. Trazabilidad del "Picking" en el Buffer
El ciclo del buffer es: `Fabricado -> Almacenado físico -> Escaneado por operario -> Subido al Camión de la secuencia H`.
Actualmente usamos la misma tabla `t_ordenes_internas` cambiando un string de `'Pendiente'` a `'Despachado'`. Esto mezcla la responsabilidad de Manufactura (Hacer la pieza) con Logística (Asignar la pieza al camión).

---

## ✅ Propuesta de Arquitectura JIT Optimizada (Paradigma Supply/Demand)

Mi recomendación profesional es aplicar una **separación de dominios (Separation of Concerns)** agregando dos tablas clave y haciendo pivotear el sistema en el Lector H.

### Nueva Estructura Sugerida:

**1. `t_camiones_despacho` (Nueva Entidad)**
Reemplaza la matemática volátil por registros reales. Cuando entra el primer **Lector H**, el sistema "Abre" un registro de camión.
- `id_camion` (PK)
- `secuencia_arranque` (ej: 001)
- `secuencia_fin_esperada` (ej: 024)
- `estado` ('Abierto', 'Cargando', 'Cerrado/Enviado')

**2. `t_inventario_buffer` (Control Exacto de Oferta)**
Cuando la Operación de Manufactura (Gatillada por Lector E) termina un asiento, este no pasa a estado "Despachado" en su tabla original, sino que entra físicamente a un registro de Stock.
- `id_inventario` (PK)
- `id_orden_interna` (La orden de Lector E que le dio vida)
- `codigo_producto_interno` (El modelo)
- `estado_pieza` ('En Racks', 'Reservado', 'Enviado')
- `id_camion_asignado` (Nullable, se llena cuando el armador cruza la pieza a la Rampa)

**3. Lógica Cruzada (El Match Automático)**
- **Lector E:** Genera Supply. Puebla la producción de Asientos que terminan poblando el Buffer.
- **Lector H:** Genera Demand. Determina en qué Camión estamos, exige abrir un "Hueco" para esa secuencia en la rampa, y le exige al operador de logística escanear una pieza del Buffer del mismo modelo.
  - Al escanearla con la pistola manual, la base de datos hace el simple `UPDATE t_inventario_buffer SET id_camion_asignado = [ID Camion H actual] WHERE codigo_producto_interno = [Modelo Exigido]`.

### Beneficios del Rediseño
1. **Inmunidad al Desorden:** No importa si la Secuencia E y la H están 5 horas desfasadas o traen números distintos. Se mapean por compatibilidad de "Modelo".
2. **Auditoría Real:** Podés saber exactamente qué Asiento (id_interno único) se metió adentro de qué Camión Físico (`id_camion`), incluyendo piezas scrap, devueltas o refabricadas.
3. **Listos para Crecer:** Permite manejar múltiples turnos y cierres manuales de camión por excepciones de logística sin romper el código python.
