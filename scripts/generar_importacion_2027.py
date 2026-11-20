"""Generate an idempotent SQL transaction from the reviewed 2027 manifest.

The output contains customer data and must be kept outside the repository.
Generating it does not connect to Supabase or run any SQL.
"""
import argparse
import base64
import json
import os
from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid5


NAMESPACE = UUID("7673b34d-d01f-5b7d-a190-fe71d1041f45")
ROOT = Path(__file__).resolve().parent.parent


def key(value):
    return str(uuid5(NAMESPACE, value))


def build(manifest, admin):
    if manifest.get("origen", {}).get("hoja") != "2027":
        raise ValueError("El manifiesto debe proceder exclusivamente de la hoja 2027.")
    orders, expenses = manifest["pedidos"], manifest["gastos"]
    if not orders or not expenses:
        raise ValueError("El manifiesto no contiene pedidos y gastos para importar.")
    prepared_orders = []
    for order in orders:
        row = order["fila"]
        qty = Decimal(order["cantidad"])
        price = Decimal(order["precio_unitario"])
        deposit = Decimal(order["sena"])
        if qty != qty.to_integral_value() or qty <= 0 or qty * price != Decimal(order["total_calculado"]):
            raise ValueError(f"Cantidad o total inválido en pedido fila {row}.")
        if not order["cliente"] or not order["producto_original"] or order["pagado_total_original"] not in ("SI", "NO") or order["entregado_original"] not in ("SI", "NO"):
            raise ValueError(f"Datos incompletos en pedido fila {row}.")
        if deposit < 0 or deposit > qty * price or (deposit and (order["fecha_sena"] != order["fecha_original"] or not order["fecha_sena_provisoria"])):
            raise ValueError(f"Seña inconsistente en pedido fila {row}.")
        balance = order.get("saldo_adicional_confirmado")
        paid = deposit + (Decimal(balance["importe"]) if balance else 0)
        if balance and (Decimal(balance["importe"]) <= 0 or paid > qty * price):
            raise ValueError(f"Saldo confirmado inconsistente en fila {row}.")
        if order["pagado_total_original"] == "SI" and paid != qty * price:
            raise ValueError(f"Pedido marcado pagado sin importe suficiente en fila {row}.")
        client_identity = json.dumps([order["cliente"], order["telefono"]], ensure_ascii=False, separators=(",", ":"))
        prepared_orders.append({**order, "cantidad": int(qty), "customer_id": key("cliente:" + client_identity),
            "product_id": key("producto:" + order["producto_original"]), "order_key": key(f"pedido:2027:{row}"),
            "deposit_key": key(f"sena:2027:{row}"), "balance_key": key(f"saldo:2027:{row}"), "delivery_key": key(f"entrega:2027:{row}")})
    if len({o["fila"] for o in orders}) != len(orders):
        raise ValueError("Hay filas de pedidos duplicadas.")
    expense_rows = [e.get("fila", (e.get("filas_origen") or [None])[0]) for e in expenses]
    if None in expense_rows or len(set(expense_rows)) != len(expense_rows):
        raise ValueError("Hay filas de gastos duplicadas o sin origen.")
    prepared_expenses = [{**e, "expense_key": key(f"gasto:2027:{row}")} for e, row in zip(expenses, expense_rows)]
    payload = base64.b64encode(json.dumps({"orders": prepared_orders, "expenses": prepared_expenses}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).decode("ascii")
    return f"""-- Contiene datos personales. No subir a Git ni compartir públicamente.
-- Importa exclusivamente hoja 2027. Ejecutar como administrador SQL con migración 023 aplicada.
begin;
do $estrella_2027$
declare
  data jsonb := convert_from(decode('{payload}', 'base64'), 'UTF8')::jsonb;
  item jsonb; v_actor uuid := '{admin}'::uuid; v_order uuid; v_customer uuid; v_product uuid;
  v_name text; v_phone text; v_product_name text; v_description text;
begin
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  if not public.is_active_admin() then raise exception 'La cuenta indicada no es administradora activa'; end if;
  perform pg_advisory_xact_lock(hashtextextended('estrella-importacion-2027',0));
  for item in select value from jsonb_array_elements(data->'orders') loop
    v_customer := (item->>'customer_id')::uuid; v_name := item->>'cliente'; v_phone := nullif(item->>'telefono','');
    if not exists(select 1 from public.customers where id=v_customer) and exists(select 1 from public.customers where lower(trim(name))=lower(trim(v_name))) then
      raise exception 'Ya existe un cliente con ese nombre; conciliar el catálogo antes de importar';
    end if;
    insert into public.customers(id,name,phone) values(v_customer,v_name,v_phone) on conflict(id) do nothing;
    if not exists(select 1 from public.customers where id=v_customer and name=v_name and phone is not distinct from v_phone and active) then
      raise exception 'El cliente histórico ya existe con datos diferentes o está inactivo';
    end if;
    v_product := (item->>'product_id')::uuid; v_product_name := item->>'producto_original';
    v_description := 'Descripción histórica de la planilla 2027; no implica existencia inicial ni desglose de inventario.';
    if not exists(select 1 from public.products where id=v_product) and exists(select 1 from public.products where lower(trim(name))=lower(trim(v_product_name))) then
      raise exception 'Ya existe un producto con ese nombre; conciliar el catálogo antes de importar';
    end if;
    insert into public.products(id,name,description) values(v_product,v_product_name,v_description) on conflict(id) do nothing;
    if not exists(select 1 from public.products where id=v_product and name=v_product_name and description=v_description and active) then
      raise exception 'El producto histórico ya existe con datos diferentes o está inactivo';
    end if;
    v_order := public.create_sales_order((item->>'order_key')::uuid,v_customer,v_product,(item->>'fecha_original')::date,null,(item->>'cantidad')::integer,(item->>'precio_unitario')::numeric,'Planilla 2027, fila ' || (item->>'fila') || '. Descripción original: ' || v_product_name);
    if (item->>'sena')::numeric > 0 then
      perform public.record_historical_customer_payment((item->>'deposit_key')::uuid,v_order,(item->>'fecha_sena')::date,(item->>'sena')::numeric,'Desconocido','Seña de planilla 2027; fecha provisoria tomada del pedido por indicación del usuario.');
    end if;
    if item->'saldo_adicional_confirmado' is not null then
      perform public.record_historical_customer_payment((item->>'balance_key')::uuid,v_order,(item->'saldo_adicional_confirmado'->>'fecha')::date,(item->'saldo_adicional_confirmado'->>'importe')::numeric,'Desconocido',case when item->'saldo_adicional_confirmado'->>'fecha' is null then 'Saldo cobrado confirmado por el usuario; fecha de cobro desconocida.' else 'Saldo cobrado confirmado por el usuario.' end);
    end if;
    if item->>'entregado_original' = 'SI' then
      perform public.record_historical_order_delivery((item->>'delivery_key')::uuid,v_order,(item->>'cantidad')::integer,'Entrega histórica indicada en la planilla 2027; fecha desconocida.');
    end if;
  end loop;
  for item in select value from jsonb_array_elements(data->'expenses') loop
    perform public.record_other_cash((item->>'expense_key')::uuid,(item->>'fecha_original')::date,'expense',(item->>'importe')::numeric,item->>'descripcion',case when item ? 'filas_origen' then 'Planilla 2027, filas ' || (select string_agg(value, ' y ' order by ordinality) from jsonb_array_elements_text(item->'filas_origen') with ordinality) || '; importe unificado corregido por el usuario.' else 'Planilla 2027, fila ' || (item->>'fila') || '.' end);
  end loop;
end
$estrella_2027$;
commit;
"""


def main():
    parser = argparse.ArgumentParser(description="Generar SQL local para importar la hoja 2027, sin ejecutarlo.")
    parser.add_argument("manifiesto", type=Path)
    parser.add_argument("--administrador", required=True, type=UUID, help="UUID de una cuenta administradora activa")
    parser.add_argument("--salida", required=True, type=Path, help="Ruta del SQL fuera del repositorio")
    args = parser.parse_args()
    output = args.salida.resolve()
    if output == args.manifiesto.resolve() or output == ROOT or ROOT in output.parents:
        raise ValueError("La salida debe estar fuera del repositorio y no reemplazar el manifiesto.")
    manifest = json.loads(args.manifiesto.read_text(encoding="utf-8"))
    sql = build(manifest, args.administrador)
    output.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(str(output), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(sql)
    print("SQL preparado localmente; no se ejecutó ninguna importación.")


if __name__ == "__main__":
    main()
