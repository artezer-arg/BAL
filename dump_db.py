import pyodbc
import json

def get_schema():
    conn_str = (
        r'DRIVER={ODBC Driver 17 for SQL Server};'
        r'SERVER=localhost\SQLEXPRESS;'
        r'DATABASE=BAL_DB_TEST;'  # I need to check the exact db name from config, wait app.py uses json file
    )
    # let's just use app.py's function
    import sys
    sys.path.append('.')
    from app import obtener_conexion_db
    try:
        conn = obtener_conexion_db()
        cursor = conn.cursor()
        tables = ['t_solicitudes_recepcion', 't_ordenes_internas', 't_inventario_buffer', 't_camiones_despacho', 'c_productos_cliente', 'c_productos_internos', 'c_bom_recetas']
        for table in tables:
            print(f"\n=== TABLE: {table} ===")
            cursor.execute(f"SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{table}'")
            for row in cursor.fetchall():
                print(f" - {row[0]}: {row[1]}")
    except Exception as e:
        print("ERROR:", e)

if __name__ == '__main__':
    get_schema()
