# Arquitectura: Editor de Etiquetas Avanzado (Multitipo)

## Visión General
El editor visual actuamente posiciona 6 "campos de base de datos" específicos. Para convertirlo en un diseñador de tickets completo, daremos al usuario una "Caja de Herramientas" para instanciar elementos arbitrarios geométricos y tipográficos.

## 1. Tipificación de Nodos (`config.json`)
Agregaremos una propiedad `type` a cada elemento dentro del archivo JSON. De esta manera, el diccionario híbrido soportará N-cantidad de elementos.

### Estructura Propuesta de Elementos:
1. **Campos Fijos JIT:** `{"type": "field", "id": "modelo", "x": 50, ...}`
2. **Textos Estáticos:** `{"type": "static", "text": "ENSAMBLE TBAR", "size": 2, ...}`
3. **Líneas Horizontales:** `{"type": "hline", "width": 80, "thickness": 2, ...}` (El anchor XY será el centro).
4. **Líneas Verticales:** `{"type": "vline", "height": 60, "thickness": 2, ...}`

## 2. Caja de Herramientas UI (Frontend Javascript)
Se añadirá una barra de herramientas arriba del lienzo en la web con botones:
`[ + Texto Estático ]` `[ + Línea Horizontal ]` `[ + Línea Vertical ]`.

- Al seleccionar un "Texto Estático" agregado, el menú izquierdo mostrará un `<input text>` para que el usuario escriba arbitrariamente lo que quiera que diga esa etiqueta.
- Al seleccionar una Línea, el slider de "Tamaño" pasará a representar el "Grosor" (Thickness), y aparecerá un slider adicional dictando el "Largo" de esa línea (Width/Height en %).

## 3. Traducción de Geometría al Servidor (`printer.py`)

Python aprenderá a leer un nodo y dibujar geometrías:

### En ZPL (Zebra)
Utilizaremos el comando nativo `^GB` (Graphic Box) de Zebra, el cual sirve precisamente para líneas y rectángulos puros en dot-matrix:
- H-Line: `^FO{x},{y}^GB{width_dots},{thickness},{thickness}^FS`
- V-Line: `^FO{x},{y}^GB{thickness},{height_dots},{thickness}^FS`
- Text Fijo: Comando de texto normal `^A0N` inyectando el string literal que el usuario guardó en el `type: "static"`.

### En PDF (`reportlab`)
Utilizaremos el `canvas.rect(x, y, w, h, fill=1)` para rellenar polígonos puros de color negro sólido que simularán el grosor perfecto dictado en el diseñador Web.
