# TBAR Sync - Boshoku Argentina Link (BAL)

Sistema de sincronización logística **JIS/JIT (Just-In-Sequence / Just-In-Time)** desarrollado para acoplar la lectura de señales (Archivos SFTP `.txt`) de la planta con la cadena de montaje y el despacho de camiones.

## 🚀 Arquitectura del Proyecto

El sistema se divide en tres pilares operacionales:
1. **Unificador de Línea:** Lectores seriales (`E`, `H`, `F`, `A`, `J`) depositan secuencias en el servidor. El backend las rutea y transforma dinámicamente en órdenes de trabajo bajo demanda de la base de datos SQL Server.
2. **Buffer de Despacho (3 Columnas):** Interfaz Web Desacoplada donde los operadores asocian manualmente el inventario físico inyectado (Lector E) contra el Manifiesto inmutable requerido por el Camión (Lector H).
3. **Spooler JIT de Etiquetas:** Motor en un hilo asíncrono que intercepta un match de ingreso, extrae su configuración visual desde `templates.json` y dibuja milimétricamente las coordenadas matemáticas enviando sentencias puras *GraphicBox* ZPL al Puerto `9100` (Impresoras Zebra Industriales) o volcando un respaldo fotográfico PDF.

## 📂 Organización del Workspace

```text
/tbar_sync
│
├── app.py                   # Nucleo Flask y Enrutador SFTP/API
├── config.json              # Credenciales y path de monitoreo 
├── templates.json           # Vectores gráficos visuales de Etiquetas (Guardados desde UI)
├── tbar_sync.code-workspace # Entorno VS Code pre-configurado
│
├── /static                  # VanillaJS, VanillaCSS, Panel WYSIWYG
│   ├── index.html           # SPA Dashboard, Buffer y Editor Etiquetas
│   ├── script.js            # Reactividad DOM Drag&Drop
│   └── style.css            # Geometría del Canvas flex
│
├── /utils
│   └── printer.py           # Polimorfismo ZPL TCP Socket y PDF Reportlab
│
├── /docs                    # Documentación Funcional de Arquitectura
│   └── /BAL_Architecture    # Walkthroughs, Analysis y Task Boards
│
└── /tickets_pdf             # Almacén de PDFs dinámicos generados
```

## 🛠 Instalación y Despliegue

### Requisitos
- **Python 3.8+**
- Drivers de **SQL Server** o `pyodbc`.

### Dependencias
```bash
pip install flask pyodbc reportlab qrcode pillow
```

### Ejecutar Servidor Local
```bash
python app.py
```
> El servidor levantará un web socket en `http://127.0.0.1:5000`.

## ⚙️ Módulo Editor Gráfico
Para editar la posición XY o Grosor de líneas y Textos Dinámicos de un Ticket Zebra sin interrupcción de línea:
1. Ingresar al Menú **Editor Etiquetas** en la Web.
2. Seleccionar el Lector a afectar.
3. Arrastrar y soltar los elementos requeridos.
4. Presionar "Guardar". `templates.json` se actualizará pasivamente e inyectará los offset instantáneamente en el siguiente TXT leído.
