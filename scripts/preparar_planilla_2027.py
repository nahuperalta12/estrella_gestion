"""Prepare a private review manifest from worksheet 2027 only; never writes to Supabase."""
import argparse
import json
from collections import Counter
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parent.parent


def text(value):
    if value is None:
        return None
    if isinstance(value, (date, datetime)):
        return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def money(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        number = Decimal(str(value))
    except InvalidOperation:
        return None
    return str(number) if number.is_finite() else None


def main():
    parser = argparse.ArgumentParser(description="Preparar solo la hoja 2027 sin importar datos.")
    parser.add_argument("archivo", type=Path)
    parser.add_argument("--salida", type=Path, required=True, help="Ruta privada para el JSON de revisión")
    parser.add_argument("--aclaraciones", type=Path, help="JSON local con decisiones sobre saldos, señas y gastos")
    args = parser.parse_args()
    output_path = args.salida.resolve()
    if output_path == args.archivo.resolve() or output_path == ROOT or ROOT in output_path.parents:
        raise ValueError("La salida debe estar fuera del repositorio y no reemplazar el archivo original.")
    workbook = load_workbook(args.archivo, read_only=True, data_only=False)
    cached_workbook = load_workbook(args.archivo, read_only=True, data_only=True)
    try:
        if "2027" not in workbook.sheetnames:
            raise ValueError("No existe la hoja 2027.")
        sheet, cached = workbook["2027"], cached_workbook["2027"]
        header = [sheet.cell(1, i).value for i in range(1, 12)]
        if [str(x).strip().lower() for x in header] != ["fecha", "nombre", "telefono", "tipo de pluma", "cantidad", "precio", "total", "seña", "pendiente", "pagado total", "entregado"]:
            raise ValueError("La cabecera de pedidos no coincide; revisar antes de preparar la carga.")
        decisions = json.loads(args.aclaraciones.read_text(encoding="utf-8-sig")) if args.aclaraciones else {}
        provisional = decisions.get("usar_fecha_pedido_para_senas", False)
        orders, expenses = [], []
        for row_number, cells in enumerate(sheet.iter_rows(min_row=2, max_col=19), start=2):
            values = [c.value for c in cells]
            if any(value is not None for value in values[:11]):
                qty, price, deposit = (money(values[i]) for i in (4, 5, 7))
                total = str(Decimal(qty) * Decimal(price)) if qty is not None and price is not None else None
                orders.append({"fila": row_number, "fecha_original": text(values[0]), "cliente": text(values[1]), "telefono": text(values[2]), "producto_original": text(values[3]), "cantidad": qty, "precio_unitario": price, "total_calculado": total, "total_cache_excel": money(cached.cell(row_number, 7).value), "sena": deposit, "fecha_sena": text(values[0]) if provisional and deposit is not None and Decimal(deposit) > 0 else None, "fecha_sena_provisoria": bool(provisional and deposit is not None and Decimal(deposit) > 0), "saldo_formula_cache": money(cached.cell(row_number, 9).value), "pagado_total_original": text(values[9]), "entregado_original": text(values[10])})
            if row_number >= 3 and any(values[i] is not None for i in (12, 13, 14)):
                expenses.append({"fila": row_number, "fecha_original": text(values[12]), "descripcion": text(values[13]), "importe": money(values[14])})
        duplicate_counts = Counter((e["fecha_original"], e["descripcion"], e["importe"]) for e in expenses)
        for item in expenses:
            item["coincidencias_exactas"] = duplicate_counts[(item["fecha_original"], item["descripcion"], item["importe"])]
        original_expenses = [dict(e) for e in expenses]
        for decision in decisions.get("saldos", []):
            order = next((o for o in orders if o["fila"] == decision["fila"]), None)
            amount = Decimal(str(decision["importe"]))
            if not order or order["pagado_total_original"] != "SI" or amount <= 0 or Decimal(order["sena"]) + amount != Decimal(order["total_calculado"]):
                raise ValueError("El saldo indicado no coincide con el pedido; revisar la aclaración.")
            order["saldo_adicional_confirmado"] = {"importe": str(amount), "fecha": decision.get("fecha"), "origen": "Aclaración del usuario."}
        for decision in decisions.get("gastos_unificados", []):
            rows = decision["filas"]
            duplicate = [e for e in expenses if e["fila"] in rows]
            amount = Decimal(str(decision["importe"]))
            if len(rows) < 2 or len(duplicate) != len(rows) or amount <= 0 or len({(e["fecha_original"], e["descripcion"], e["importe"]) for e in duplicate}) != 1:
                raise ValueError("Los gastos indicados no coinciden; revisar la aclaración.")
            expenses = [e for e in expenses if e["fila"] not in rows]
            expenses.append({"filas_origen": rows, "fecha_original": duplicate[0]["fecha_original"], "descripcion": duplicate[0]["descripcion"], "importe": str(amount), "origen_importe": "Aclaración del usuario."})
        expenses.sort(key=lambda e: e.get("fila", e.get("filas_origen", [0])[0]))
        output = {"origen": {"archivo": args.archivo.name, "hoja": "2027"}, "estado": "revision_sin_importar", "pedidos": orders, "gastos_origen": original_expenses, "gastos": expenses, "pendientes": ["Revisar fechas desconocidas, productos mixtos y entregas históricas."]}
        args.salida.parent.mkdir(parents=True, exist_ok=True)
        args.salida.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Preparadas {len(orders)} filas de pedidos y {len(expenses)} filas de gastos para revisión. No se importaron datos.")
    finally:
        workbook.close()
        cached_workbook.close()


if __name__ == "__main__":
    main()
