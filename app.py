from flask import Flask, send_from_directory, jsonify, request
import os
import pyodbc
import csv
import io
from datetime import datetime

app = Flask(__name__, static_folder='static')

APP_CONFIG = {
    "sftp_folder": "C:\\SFTP\\Toyota\\",
    "db_server": "HILO-000", 
    "db_name": "BAL",
    "db_user": "",
    "db_pass": ""
}

def obtener_conexion_db():
    cadena_conexion = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={APP_CONFIG['db_server']};"
        f"DATABASE={APP_CONFIG['db_name']};"
    )
    if APP_CONFIG['db_user']:
        cadena_conexion += f"UID={APP_CONFIG['db_user']};PWD={APP_CONFIG['db_pass']};"
    else:
        cadena_conexion += "Trusted_Connection=yes;"
    return pyodbc.connect(cadena_conexion)

def get_sublinea_id(linea, desc):
    L = str(linea).upper()
    D = str(desc).upper()
    if 'ARMREST' in L: return 6
    if 'FILTRO' in L: return 7
    if 'GARNISH' in L: return 8
    if 'DOOR' in L: return 5
    if 'SEAT' in L:
        if 'TIP-UP' in D or 'TUP' in D: return 2
        if 'TUMBLE' in D: return 4
        if 'SUV' in D or '3RA' in D: return 3
        return 1
    return 1

def validar_secuencia(cursor, letra, secuencia, fecha, padre_calculado):
    """Lanza ValueError si se viola duplicado, saltos o lista negra, respetando el tope individual del lector."""
    cursor.execute("SELECT tope_secuencia, validar_saltos, padres_restringidos FROM c_mapeo_columnas_txt WHERE letra_archivo = ?", (letra,))
    mapping_row = cursor.fetchone()
    tope = mapping_row[0] if mapping_row else 9999
    validar_saltos = mapping_row[1] if mapping_row else True
    padres_rest = mapping_row[2] if mapping_row else ""

    lista_ignorados = [p.strip().upper() for p in padres_rest.split(',') if p.strip()]
    if padre_calculado in lista_ignorados:
        raise ValueError(f"Ignorado (Restricción de Códigos Padre Activa para el Lector {letra})")

    # Si el usuario desactivó las validaciones explícitamente para este lector, skip lineares.
    if not validar_saltos:
        return

    cursor.execute("""
        SELECT COUNT(1) 
        FROM t_solicitudes_recepcion 
        WHERE nro_secuencia = ? AND fecha_txt = ? AND SUBSTRING(nombre_archivo_sftp, 1, 1) = ?
    """, (secuencia, fecha, letra))
    if cursor.fetchone()[0] > 0:
        raise ValueError("Rechazado: Secuencia y Fecha Duplicada para este Lector")

    cursor.execute("""
        SELECT TOP 1 nro_secuencia 
        FROM t_solicitudes_recepcion 
        WHERE SUBSTRING(nombre_archivo_sftp, 1, 1) = ? 
        ORDER BY id_solicitud DESC
    """, (letra,))
    row = cursor.fetchone()
    if row:
        try:
            last_seq = int(row[0])
            curr_seq = int(secuencia)
            if curr_seq != last_seq + 1 and not (curr_seq == 1 and last_seq >= tope):
                raise ValueError(f"Rechazado: Salto de Secuencia. Se esperaba {last_seq + 1}, llegó {curr_seq} (Tope Reader {letra}: {tope}).")
        except ValueError as ve:
            if "invalid literal" not in str(ve) and "invalid base" not in str(ve):
                raise ve

def procesar_ruta_bom(cursor, padre_code, hijo_code, linea, desc, mano, tasa):
    padre_code = str(padre_code).upper().strip()
    hijo_code = str(hijo_code).upper().strip()
    
    cursor.execute("SELECT id_producto_cliente FROM c_productos_cliente WHERE codigo_padre = ?", (padre_code,))
    row_p = cursor.fetchone()
    if row_p: id_padre = row_p[0]
    else:
        cursor.execute("INSERT INTO c_productos_cliente (id_cliente, codigo_padre, descripcion) OUTPUT INSERTED.id_producto_cliente VALUES (1, ?, ?)", (padre_code, f"Auto {padre_code}"))
        id_padre = cursor.fetchone()[0]

    id_sublinea = get_sublinea_id(linea, desc)

    cursor.execute("""
        SELECT id_producto_interno FROM c_productos_internos 
        WHERE codigo_sd = ? AND (descripcion = ? OR (descripcion IS NULL AND ? IS NULL))
        AND (posicion_mano = ? OR (posicion_mano IS NULL AND ? IS NULL))
        AND (codigo_tasa = ? OR (codigo_tasa IS NULL AND ? IS NULL))
    """, (hijo_code, desc, desc, mano, mano, tasa, tasa))
    row_h = cursor.fetchone()
    
    if row_h: id_hijo = row_h[0]
    else:
        cursor.execute("""
            INSERT INTO c_productos_internos (id_sublinea, codigo_sd, descripcion, posicion_mano, codigo_tasa) 
            OUTPUT INSERTED.id_producto_interno
            VALUES (?, ?, ?, ?, ?)
        """, (id_sublinea, hijo_code, desc, mano, tasa))
        id_hijo = cursor.fetchone()[0]

    cursor.execute("SELECT id_bom FROM c_bom_recetas WHERE id_producto_cliente = ? AND id_producto_interno = ?", (id_padre, id_hijo))
    row_bom = cursor.fetchone()
    if row_bom:
        cursor.execute("UPDATE c_bom_recetas SET cantidad = cantidad + 1 WHERE id_bom = ?", (row_bom[0],))
    else:
        cursor.execute("INSERT INTO c_bom_recetas (id_producto_cliente, id_producto_interno, cantidad) VALUES (?, ?, 1)", (id_padre, id_hijo))

# ==========================================
# RUTAS CATÁLOGO BOM (ABM y CSV)
# ==========================================
@app.route('/api/catalog/manual', methods=['POST'])
def api_catalog_manual():
    try:
        data = request.json
        conn = obtener_conexion_db()
        cursor = conn.cursor()
        procesar_ruta_bom(cursor, data.get('padre'), data.get('hijo'), data.get('linea'), data.get('desc'), data.get('mano'), data.get('tasa'))
        conn.commit()
        return jsonify({"status": "success"})
    except Exception as e:
        if 'conn' in locals(): conn.rollback()
        return jsonify({"status": "error", "message": str(e)})
    finally:
        if 'conn' in locals(): conn.close()

@app.route('/api/catalog/upload', methods=['POST'])
def api_catalog_upload():
    if 'file' not in request.files: return jsonify({"status": "error", "message": "No file uploaded"})
    file = request.files['file']
    if file.filename == '': return jsonify({"status": "error", "message": "No file selected"})

    try:
        stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
        csv_input = csv.DictReader(stream)
        conn = obtener_conexion_db()
        cursor = conn.cursor()
        count = 0
        for row in csv_input:
            padre = row.get('Padre', row.get('PADRE', ''))
            hijo = row.get('Hijo', row.get('HIJO', row.get('Codigo SD', '')))
            desc = row.get('Descripcion', row.get('DESCRIPCION', ''))
            mano = row.get('PosicionMano', row.get('Mano', ''))
            tasa = row.get('Codigo TASA', row.get('Codigo', ''))
            linea = row.get('Linea', row.get('LINEA', ''))
            if padre and hijo:
                procesar_ruta_bom(cursor, padre, hijo, linea, desc, mano, tasa)
                count += 1
            if count % 500 == 0: conn.commit()
        conn.commit()
        return jsonify({"status": "success", "inserted": count})
    except Exception as e:
        if 'conn' in locals(): conn.rollback()
        return jsonify({"status": "error", "message": str(e)})
    finally:
        if 'conn' in locals(): conn.close()

# ==========================================
# RUTAS DE LA APLICACIÓN WEB
# ==========================================
@app.route('/')
def home():
    return send_from_directory('static', 'index.html')

@app.route('/api/config', methods=['GET', 'POST'])
def api_config():
    if request.method == 'POST':
        APP_CONFIG.update(request.json)
        if not os.path.exists(APP_CONFIG['sftp_folder']):
            try: os.makedirs(APP_CONFIG['sftp_folder'])
            except Exception as e: return jsonify({"status": "error", "message": str(e)}), 400
        return jsonify({"status": "success", "config": APP_CONFIG})
    return jsonify(APP_CONFIG)

@app.route('/api/mapping', methods=['GET', 'POST'])
def api_mapping():
    try:
        conn = obtener_conexion_db()
        cursor = conn.cursor()
        if request.method == 'POST':
            data = request.json
            letra = data.get('letra', '').upper()
            
            cursor.execute("""
                SELECT inicio_secuencia, ancho_secuencia, inicio_suffix, ancho_suffix, inicio_color, ancho_color, inicio_modelo, ancho_modelo, inicio_chasis, ancho_chasis, inicio_fecha, ancho_fecha, tope_secuencia, validar_saltos, padres_restringidos 
                FROM c_mapeo_columnas_txt WHERE letra_archivo = ?
            """, (letra,))
            row = cursor.fetchone()
            
            # Default fallback values
            c = {
                "inicio_secuencia": 0, "ancho_secuencia": 0, "inicio_suffix": 0, "ancho_suffix": 0,
                "inicio_color": 0, "ancho_color": 0, "inicio_modelo": 0, "ancho_modelo": 0,
                "inicio_chasis": 0, "ancho_chasis": 0, "inicio_fecha": 0, "ancho_fecha": 0,
                "tope_secuencia": 9999, "validar_saltos": 1, "padres_restringidos": ""
            }
            if row:
                c = {
                    "inicio_secuencia": row[0], "ancho_secuencia": row[1], "inicio_suffix": row[2], "ancho_suffix": row[3],
                    "inicio_color": row[4], "ancho_color": row[5], "inicio_modelo": row[6], "ancho_modelo": row[7],
                    "inicio_chasis": row[8], "ancho_chasis": row[9], "inicio_fecha": row[10], "ancho_fecha": row[11],
                    "tope_secuencia": row[12], "validar_saltos": row[13], "padres_restringidos": row[14]
                }
            
            if "inicio_secuencia" in data: c["inicio_secuencia"] = data["inicio_secuencia"]
            if "ancho_secuencia" in data: c["ancho_secuencia"] = data["ancho_secuencia"]
            if "inicio_suffix" in data: c["inicio_suffix"] = data["inicio_suffix"]
            if "ancho_suffix" in data: c["ancho_suffix"] = data["ancho_suffix"]
            if "inicio_color" in data: c["inicio_color"] = data["inicio_color"]
            if "ancho_color" in data: c["ancho_color"] = data["ancho_color"]
            if "inicio_modelo" in data: c["inicio_modelo"] = data["inicio_modelo"]
            if "ancho_modelo" in data: c["ancho_modelo"] = data["ancho_modelo"]
            if "inicio_chasis" in data: c["inicio_chasis"] = data["inicio_chasis"]
            if "ancho_chasis" in data: c["ancho_chasis"] = data["ancho_chasis"]
            if "inicio_fecha" in data: c["inicio_fecha"] = data["inicio_fecha"]
            if "ancho_fecha" in data: c["ancho_fecha"] = data["ancho_fecha"]
            if "tope_secuencia" in data: c["tope_secuencia"] = data["tope_secuencia"]
            if "validar_saltos" in data: c["validar_saltos"] = 1 if data["validar_saltos"] else 0
            if "padres_restringidos" in data: c["padres_restringidos"] = data["padres_restringidos"]

            if row:
                cursor.execute("""
                    UPDATE c_mapeo_columnas_txt 
                    SET inicio_secuencia=?, ancho_secuencia=?, inicio_suffix=?, ancho_suffix=?, 
                        inicio_color=?, ancho_color=?, inicio_modelo=?, ancho_modelo=?, 
                        inicio_chasis=?, ancho_chasis=?, inicio_fecha=?, ancho_fecha=?, tope_secuencia=?, validar_saltos=?, padres_restringidos=?, fecha_modificacion=GETDATE()
                    WHERE letra_archivo=?
                """, (c['inicio_secuencia'], c['ancho_secuencia'], c['inicio_suffix'], c['ancho_suffix'],
                      c['inicio_color'], c['ancho_color'], c['inicio_modelo'], c['ancho_modelo'],
                      c['inicio_chasis'], c['ancho_chasis'], c['inicio_fecha'], c['ancho_fecha'], c['tope_secuencia'], 
                      c['validar_saltos'], c['padres_restringidos'], letra))
            else:
                cursor.execute("""
                    INSERT INTO c_mapeo_columnas_txt (letra_archivo, inicio_secuencia, ancho_secuencia, inicio_suffix, ancho_suffix, inicio_color, ancho_color, inicio_modelo, ancho_modelo, inicio_chasis, ancho_chasis, inicio_fecha, ancho_fecha, tope_secuencia, validar_saltos, padres_restringidos)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (letra, c['inicio_secuencia'], c['ancho_secuencia'], c['inicio_suffix'], c['ancho_suffix'], 
                      c['inicio_color'], c['ancho_color'], c['inicio_modelo'], c['ancho_modelo'], 
                      c['inicio_chasis'], c['ancho_chasis'], c['inicio_fecha'], c['ancho_fecha'], c['tope_secuencia'], c['validar_saltos'], c['padres_restringidos']))
            conn.commit()
            return jsonify({"status": "success"})
        else:
            letra = request.args.get('letra', 'E').upper()
            cursor.execute("""
                SELECT inicio_secuencia, ancho_secuencia, inicio_suffix, ancho_suffix, inicio_color, ancho_color, inicio_modelo, ancho_modelo, inicio_chasis, ancho_chasis, inicio_fecha, ancho_fecha, tope_secuencia, validar_saltos, padres_restringidos 
                FROM c_mapeo_columnas_txt WHERE letra_archivo = ?
            """, (letra,))
            row = cursor.fetchone()
            if row: 
                return jsonify({"status": "success", "mapeo": {
                    "inicio_secuencia": row[0], "ancho_secuencia": row[1], "inicio_suffix": row[2], "ancho_suffix": row[3], 
                    "inicio_color": row[4], "ancho_color": row[5], "inicio_modelo": row[6], "ancho_modelo": row[7], 
                    "inicio_chasis": row[8], "ancho_chasis": row[9], "inicio_fecha": row[10], "ancho_fecha": row[11], 
                    "tope_secuencia": row[12], "validar_saltos": True if row[13] else False, "padres_restringidos": row[14]
                }})
            else: return jsonify({"status": "error", "message": "Sin mapeo"})
    except Exception as e: return jsonify({"status": "error", "message": str(e)})
    finally:
        if 'conn' in locals(): conn.close()

@app.route('/api/manual_sync', methods=['POST'])
def manual_sync():
    data = request.json
    letra = data.get('letra', 'E').upper()
    padre_calculado = data.get('padre', '').upper()
    secuencia = data.get('secuencia', '')
    chasis = data.get('chasis', '')
    fecha = datetime.now().strftime("%Y%m%d%H%M")
    archivo = f"MANUAL_{letra}_{secuencia}.txt"

    try:
        conn = obtener_conexion_db()
        cursor = conn.cursor()
        
        validar_secuencia(cursor, letra, secuencia, fecha, padre_calculado)

        cursor.execute("SELECT id_producto_cliente FROM c_productos_cliente WHERE codigo_padre = ?", (padre_calculado,))
        padre_db = cursor.fetchone()
        if not padre_db: raise ValueError(f"Padre '{padre_calculado}' no existe en Catálogo de BOM.")
        
        id_padre = padre_db[0]
        ordenes_creadas = 0
        id_soli = "N/A"
        
        if letra in ['E', 'A', 'F', 'J']:
            cursor.execute("""
                INSERT INTO t_solicitudes_recepcion (id_cliente, id_producto_cliente, nro_secuencia, nro_chasis, fecha_txt, nombre_archivo_sftp)
                OUTPUT INSERTED.id_solicitud
                VALUES (1, ?, ?, ?, ?, ?)
            """, (id_padre, secuencia, chasis, fecha, archivo))
            id_soli = cursor.fetchone()[0]
            cursor.execute("SELECT id_producto_interno, cantidad FROM c_bom_recetas WHERE id_producto_cliente = ?", (id_padre,))
            hijos = cursor.fetchall()
            for hijo in hijos:
                for _ in range(hijo[1]):
                    cursor.execute("INSERT INTO t_ordenes_internas (id_solicitud, id_producto_interno) VALUES (?, ?)", (id_soli, hijo[0]))
                    ordenes_creadas += 1
        elif letra == 'H':
            cursor.execute("SELECT id_producto_interno FROM c_bom_recetas WHERE id_producto_cliente = ?", (id_padre,))
            hijos = cursor.fetchall()
            for hijo in hijos:
                cursor.execute("""
                    UPDATE TOP (1) t_ordenes_internas
                    SET estado_despacho = 'Despachado', nro_secuencia_camion_h = ?
                    WHERE id_producto_interno = ? AND estado_produccion = 'Producido' AND estado_despacho = 'Pendiente'
                """, (secuencia, hijo[0]))
                if cursor.rowcount > 0: ordenes_creadas += 1
        conn.commit()
        return jsonify({"status": "success", "id_solicitud": id_soli, "ordenes": ordenes_creadas})
    except Exception as e:
        if 'conn' in locals(): conn.rollback()
        return jsonify({"status": "error", "message": str(e)})
    finally:
        if 'conn' in locals(): conn.close()

@app.route('/api/scan', methods=['POST'])
def procesar_carpeta_sftp():
    carpeta = APP_CONFIG["sftp_folder"]
    if not os.path.exists(carpeta): return jsonify({"status": "error", "message": f"El directorio {carpeta} no existe."}), 400
    archivos_txt = [f for f in os.listdir(carpeta) if f.lower().endswith('.txt')]
    logs = []
    
    for archivo in archivos_txt:
        ruta_completa = os.path.join(carpeta, archivo)
        letra_codigo = archivo[0].upper()
        try:
            with open(ruta_completa, 'r', encoding='utf-8') as file:
                contenido = file.read().replace('\n', '')
            conn = obtener_conexion_db()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT inicio_secuencia, ancho_secuencia, inicio_suffix, ancho_suffix, inicio_color, ancho_color, inicio_modelo, ancho_modelo, inicio_chasis, ancho_chasis, inicio_fecha, ancho_fecha 
                FROM c_mapeo_columnas_txt WHERE letra_archivo = ?
            """, (letra_codigo,))
            fila_offsets = cursor.fetchone()
            if not fila_offsets: raise ValueError(f"Letra {letra_codigo} no configurada en BD.")
            
            secuencia = contenido[fila_offsets[0]:fila_offsets[0]+fila_offsets[1]].strip()
            suffix = contenido[fila_offsets[2]:fila_offsets[2]+fila_offsets[3]].strip()
            color = contenido[fila_offsets[4]:fila_offsets[4]+fila_offsets[5]].strip()
            modelo = contenido[fila_offsets[6]:fila_offsets[6]+fila_offsets[7]].strip()
            chasis = contenido[fila_offsets[8]:fila_offsets[8]+fila_offsets[9]].strip()
            fecha = contenido[fila_offsets[10]:fila_offsets[10]+fila_offsets[11]].strip()
            
            padre_calculado = f"{suffix}{color}{modelo}"
            
            validar_secuencia(cursor, letra_codigo, secuencia, fecha, padre_calculado)

            cursor.execute("SELECT id_producto_cliente FROM c_productos_cliente WHERE codigo_padre = ?", (padre_calculado,))
            padre_db = cursor.fetchone()
            if not padre_db: raise ValueError(f"Padre '{padre_calculado}' no existe en Catálogo de BOM.")
            id_padre = padre_db[0]
            
            if letra_codigo in ['E', 'A', 'F', 'J']:
                cursor.execute("""
                    INSERT INTO t_solicitudes_recepcion (id_cliente, id_producto_cliente, nro_secuencia, nro_chasis, fecha_txt, nombre_archivo_sftp)
                    OUTPUT INSERTED.id_solicitud
                    VALUES (1, ?, ?, ?, ?, ?)
                """, (id_padre, secuencia, chasis, fecha, archivo))
                id_soli = cursor.fetchone()[0]
                cursor.execute("SELECT id_producto_interno, cantidad FROM c_bom_recetas WHERE id_producto_cliente = ?", (id_padre,))
                hijos = cursor.fetchall()
                for hijo in hijos:
                    for _ in range(hijo[1]):
                        cursor.execute("INSERT INTO t_ordenes_internas (id_solicitud, id_producto_interno) VALUES (?, ?)", (id_soli, hijo[0]))
            elif letra_codigo == 'H':
                cursor.execute("SELECT id_producto_interno FROM c_bom_recetas WHERE id_producto_cliente = ?", (id_padre,))
                hijos = cursor.fetchall()
                for hijo in hijos:
                    cursor.execute("""
                        UPDATE TOP (1) t_ordenes_internas
                        SET estado_despacho = 'Despachado', nro_secuencia_camion_h = ?
                        WHERE id_producto_interno = ? AND estado_produccion = 'Producido' AND estado_despacho = 'Pendiente'
                    """, (secuencia, hijo[0]))
            conn.commit()
            logs.append({"time": datetime.now().strftime("%H:%M:%S"), "file": archivo, "status": f"Inyectado OK ({letra_codigo})", "padre": padre_calculado})
            
            os.rename(ruta_completa, ruta_completa + ".procesado")
            
        except Exception as e:
            if 'conn' in locals(): conn.rollback()
            logs.append({"time": datetime.now().strftime("%H:%M:%S"), "file": archivo, "status": "Fallo", "padre": str(e)})
            os.rename(ruta_completa, ruta_completa + ".error")
        finally:
            if 'conn' in locals(): conn.close()
    return jsonify({"status": "success", "procesados": len(archivos_txt), "logs": logs})

if __name__ == '__main__':
    print("=======================================")
    print(" INICIANDO BAL - BOSHOKU ARGENTINA LINK")
    print("=======================================")
    print("-> Accede al panel visual desde tu navegador web en: http://127.0.0.1:5000")
    app.run(debug=False, port=5000)
