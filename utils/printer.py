import socket
import logging
import os
import json
from datetime import datetime

try:
    import qrcode
    from reportlab.pdfgen import canvas
    from reportlab.lib.units import mm
except ImportError:
    pass

PDF_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tickets_pdf')
os.makedirs(PDF_DIR, exist_ok=True)
TEMPLATE_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'templates.json')

def get_template(letra):
    default = {
        "format": "10x6",
        "elements": {
            "secuencia": { "x": 50, "y": 20, "size": 2.5 },
            "linea": { "x": 20, "y": 35, "size": 1.0 },
            "modelo": { "x": 20, "y": 50, "size": 1.5 },
            "desc": { "x": 20, "y": 70, "size": 0.8 },
            "fecha": { "x": 20, "y": 80, "size": 0.6 },
            "qr": { "x": 80, "y": 50, "size": 1.0 }
        }
    }
    if os.path.exists(TEMPLATE_FILE):
        with open(TEMPLATE_FILE, 'r') as f:
            data = json.load(f)
            if letra in data: return data[letra]
    return default

def get_dimensions(fmt):
    if fmt == "A5": return (148, 210)
    if fmt == "10x10": return (100, 100)
    return (100, 60)

def generar_zpl_dinamico(secuencia, linea, modelo, descripcion, fecha, id_orden, letra):
    tpl = get_template(letra)
    els = tpl["elements"]
    w_mm, h_mm = get_dimensions(tpl["format"])
    
    w_dots = int(w_mm * 8)
    h_dots = int(h_mm * 8)
    
    zpl = f"^XA\n^PW{w_dots}\n^LL{h_dots}\n"
    
    def get_xy(el, base_font_size):
        x = int((el["x"] / 100) * w_dots)
        y = int((el["y"] / 100) * h_dots)
        w_est = base_font_size * 0.6 * 5 
        h_est = base_font_size
        return max(0, x - w_est), max(0, y - h_est)
    
    fields = {
        "secuencia": f"SEQ: {secuencia}",
        "linea": linea,
        "modelo": modelo,
        "desc": descripcion,
        "fecha": fecha
    }
    base_sizes = { "secuencia": 40, "linea": 20, "modelo": 30, "desc": 16, "fecha": 12 }
    
    for el_id, el in els.items():
        tipo = el.get('type', 'field')
        
        if tipo == 'field':
            if el_id in fields:
                val = fields[el_id]
                fsize = int(base_sizes.get(el_id, 20) * el["size"])
                vx, vy = get_xy(el, fsize)
                zpl += f"^FO{vx},{vy}^A0N,{fsize},{fsize}^FD{val}^FS\n"
        
        elif tipo == 'static':
            val = el.get('text', '')
            fsize = int(24 * el["size"])
            vx, vy = get_xy(el, fsize)
            zpl += f"^FO{vx},{vy}^A0N,{fsize},{fsize}^FD{val}^FS\n"
            
        elif tipo == 'qr':
            qr_size = max(1, min(10, int(3 * el["size"])))
            x = int((el["x"] / 100) * w_dots)
            y = int((el["y"] / 100) * h_dots)
            vx, vy = max(0, x - (qr_size*15)), max(0, y - (qr_size*15))
            zpl += f"^FO{vx},{vy}^BQN,2,{qr_size}^FDA,{id_orden}^FS\n"
            zpl += f"^FO{vx},{vy + (qr_size*30)}^A0N,20,20^FDID: {id_orden}^FS\n"
            
        elif tipo == 'hline':
            l_pct = float(el.get('length', 50))
            thickness = int(float(el.get('size', 2)) * 2) 
            width = int((l_pct / 100) * w_dots)
            x = int((el["x"] / 100) * w_dots) - (width // 2)
            y = int((el["y"] / 100) * h_dots) - (thickness // 2)
            zpl += f"^FO{max(0,x)},{max(0,y)}^GB{width},{thickness},{thickness}^FS\n"
            
        elif tipo == 'vline':
            l_pct = float(el.get('length', 50))
            thickness = int(float(el.get('size', 2)) * 2)
            height = int((l_pct / 100) * h_dots)
            x = int((el["x"] / 100) * w_dots) - (thickness // 2)
            y = int((el["y"] / 100) * h_dots) - (height // 2)
            zpl += f"^FO{max(0,x)},{max(0,y)}^GB{thickness},{height},{thickness}^FS\n"

    zpl += "^XZ"
    return zpl

def enviar_zpl_red(ip_impresora, zpl_data, puerto=9100):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1.5)
        s.connect((ip_impresora, puerto))
        s.sendall(zpl_data.encode('utf-8'))
        s.close()
        return True, "ZPL OK"
    except Exception as e:
        err = f"Timeout Zebra IP {ip_impresora}: {e}"
        logging.error(err)
        return False, err

def generar_pdf_dinamico(secuencia, linea, modelo, descripcion, fecha, id_orden, letra):
    tpl = get_template(letra)
    els = tpl["elements"]
    w_mm, h_mm = get_dimensions(tpl["format"])
    
    filename = f"TICKET_{id_orden}_SEQ{secuencia}_L{letra}.pdf"
    filename = "".join(c for c in filename if c.isalnum() or c in " ._-")
    filepath = os.path.join(PDF_DIR, filename)

    try:
        c = canvas.Canvas(filepath, pagesize=(w_mm*mm, h_mm*mm))
        
        fields = {
            "secuencia": f"SEQ: {secuencia}",
            "linea": linea,
            "modelo": modelo,
            "desc": descripcion,
            "fecha": fecha
        }
        base_sizes = { "secuencia": 24, "linea": 14, "modelo": 20, "desc": 10, "fecha": 8 }
        bold_fields = ["secuencia", "modelo"]

        for el_id, el in els.items():
            tipo = el.get('type', 'field')
            
            if tipo == 'field':
                if el_id in fields:
                    text = fields[el_id]
                    should_bold = el.get('bold', el_id in bold_fields)
                    font_name = "Helvetica-Bold" if should_bold else "Helvetica"
                    fsize = base_sizes.get(el_id, 14) * el["size"]
                    c.setFont(font_name, fsize)
                    x_pos = (el["x"] / 100) * w_mm * mm
                    y_pos = h_mm*mm - ((el["y"] / 100) * h_mm * mm)
                    c.drawCentredString(x_pos, y_pos - (fsize/3), text)
                    
            elif tipo == 'static':
                text = el.get('text', '')
                fsize = 16 * el["size"]
                should_bold = el.get('bold', False)
                c.setFont("Helvetica-Bold" if should_bold else "Helvetica", fsize)
                x_pos = (el["x"] / 100) * w_mm * mm
                y_pos = h_mm*mm - ((el["y"] / 100) * h_mm * mm)
                c.drawCentredString(x_pos, y_pos - (fsize/3), text)
                
            elif tipo == 'qr':
                qr = qrcode.QRCode(version=1, box_size=10, border=1)
                qr.add_data(str(id_orden))
                qr.make(fit=True)
                img = qr.make_image(fill_color="black", back_color="white")
                qr_path = os.path.join(PDF_DIR, f"temp_qr_{id_orden}.png")
                img.save(qr_path)
                
                qr_size_mm = 20 * el["size"]
                x_pos = (el["x"] / 100) * w_mm * mm - (qr_size_mm * mm / 2)
                y_pos = h_mm*mm - ((el["y"] / 100) * h_mm * mm) - (qr_size_mm * mm / 2)
                c.drawImage(qr_path, x_pos, y_pos, width=qr_size_mm*mm, height=qr_size_mm*mm)
                
                c.setFont("Helvetica-Bold", 8)
                c.drawCentredString(x_pos + (qr_size_mm*mm/2), y_pos - 3*mm, f"ID: {id_orden}")
                if os.path.exists(qr_path): os.remove(qr_path)
                
            elif tipo == 'hline':
                l_pct = float(el.get('length', 50))
                thickness = float(el.get('size', 2)) * 0.8
                width_mm = (l_pct / 100) * w_mm
                x_pos = ((el["x"] / 100) * w_mm - (width_mm/2)) * mm
                y_pos = h_mm*mm - ((el["y"] / 100) * h_mm * mm)
                c.setFillColorRGB(0,0,0)
                c.rect(x_pos, y_pos - (thickness/2)*mm, width_mm*mm, thickness*mm, stroke=0, fill=1)
                
            elif tipo == 'vline':
                l_pct = float(el.get('length', 50))
                thickness = float(el.get('size', 2)) * 0.8
                height_mm = (l_pct / 100) * h_mm
                x_pos = ((el["x"] / 100) * w_mm) * mm
                y_pos = h_mm*mm - ((el["y"] / 100) * h_mm * mm) - (height_mm/2)*mm
                c.setFillColorRGB(0,0,0)
                c.rect(x_pos - (thickness/2)*mm, y_pos, thickness*mm, height_mm*mm, stroke=0, fill=1)
            
        c.save()
        return True, f"PDF OK: {filepath}"
    except Exception as e:
        err = f"Error PDF {filename}: {e}"
        logging.error(err)
        return False, err

def procesar_impresion(secuencia, linea, modelo, descripcion, fecha, id_orden, modo, ip_impresora, letra="E"):
    print(f"--> [PRINTER LOG] Solicitud ({modo}): {linea} - Mod: {modelo} [{letra}]")
    if modo == "ZPL":
        if not ip_impresora:
            return False, "IP Zebra Vacia"
        zpl = generar_zpl_dinamico(secuencia, linea, modelo, descripcion, fecha, id_orden, letra)
        # Modo Test consola:
        print(f"----- START ZPL TO {ip_impresora} -----")
        print(zpl)
        print("----- END ZPL -----")
        return enviar_zpl_red(ip_impresora, zpl)
    elif modo == "PDF":
        return generar_pdf_dinamico(secuencia, linea, modelo, descripcion, fecha, id_orden, letra)
    else:
        return False, "Modo OFF"
