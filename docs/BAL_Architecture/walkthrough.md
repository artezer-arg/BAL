# Walkthrough: Sincronización JIT BAL

## Hitos Logrados

### 1. Desacople y Resiliencia del Despacho (Buffer vs Demanda)
- **Eliminación del Match Automático:** Originalmente, cada lectura de E alteraba el estado de la demanda H, rompiendo el inventario.
- **Inmutabilidad:** Las secuencias H (Demandas del Camión) ahora dictan una norma de solo-lectura irrompible. 
- **Flujo Visual (3 Columnas):** La UI ahora soporta una vista de "Salida de Línea E", "Buffer Físico" y "Manifiesto Camión H", en la cual el operador cruza el inventario remanente contra la demanda explícita.

### 2. Imprenta Automática Nativa (ZPL/PDF)
- **Sockets TCP (Zebra):** Se introdujo capacidad de inyección cruda ZPL vía Puerto 9100, evitando colas de impresión de Windows.
- **Backend Híbrido:** Se sumó una variante para exportar los tickets a [Archivos PDF Locales] empleando `reportlab` para facilitar pruebas visuales. 
- Todo ticket imprime el código `id_orden_interna` encapsulado en un Códivo QR nativo.

### 3. Diseñador Avanzado de Etiquetas (WYSIWYG Web)
- **Módulo Visual:** Panel Drag & Drop dentro de la Web que permite diseñar tickets parametrizados por Papel (10x6, A5, etc) y por Lector.
- **Nodos Inteligentes:** Se abstrajeron Textos Libres (Estáticos) y Líneas Vectoriales (Horizontales y Verticales).
- **Control Milimétrico:** Posicionamiento exacto por inputs numéricos (X/Y) y switches tipográficos (Negrita).
- **Procesador Polimórfico en Python:** Convierte las dimensiones porcentuales `%` arrastradas desde JS en coordenadas de pixeles limpios para el `GraphicBox` (`^GB`) de Zebra y del reporte fotográfico local.

## Correcciones Menores
- Se solventó el bug de la Pantalla en Blanco que impedía mostrar el Editor al fallar el ocultamiento del antiguo menú `catalog-view`.
