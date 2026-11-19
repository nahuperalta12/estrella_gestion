"use client";
import { useActionState, useId } from "react";
import { saveSupplier } from "./actions";

export type Supplier = { id: string; name: string; contact: string | null; phone: string | null; email: string | null; notes: string | null; active: boolean };
export function SupplierForm({ supplier }: { supplier?: Supplier }) {
  const [state, action, pending] = useActionState(saveSupplier, {});
  const id = useId();
  return <form action={action} className="form tile"><h2>{supplier ? "Editar proveedor" : "Nuevo proveedor"}</h2><input type="hidden" name="id" value={supplier?.id ?? ""}/>
    <label htmlFor={`${id}-name`}>Nombre</label><input id={`${id}-name`} name="name" defaultValue={supplier?.name ?? ""} maxLength={120} required/>
    <label htmlFor={`${id}-contact`}>Contacto</label><input id={`${id}-contact`} name="contact" defaultValue={supplier?.contact ?? ""} maxLength={120}/>
    <label htmlFor={`${id}-phone`}>Teléfono</label><input id={`${id}-phone`} name="phone" type="tel" defaultValue={supplier?.phone ?? ""} maxLength={40}/>
    <label htmlFor={`${id}-email`}>Correo electrónico</label><input id={`${id}-email`} name="email" type="email" defaultValue={supplier?.email ?? ""} maxLength={254}/>
    <label htmlFor={`${id}-notes`}>Observaciones</label><textarea id={`${id}-notes`} name="notes" defaultValue={supplier?.notes ?? ""} maxLength={2000} rows={3}/>
    <label className="check-label"><input type="checkbox" name="active" defaultChecked={supplier?.active ?? true}/> Activo</label>
    <button disabled={pending || (!supplier && state.ok)}>{pending ? "Guardando…" : "Guardar proveedor"}</button><p role="status">{state.message}</p>{!supplier && state.ok && <a href="/proveedores">Agregar otro proveedor</a>}
  </form>;
}
