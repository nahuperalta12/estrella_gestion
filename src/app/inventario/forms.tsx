"use client";
import { useActionState, useId } from "react";
import { adjustStock, createMaterial, updateMaterial } from "./actions";

export function EditMaterialForm({ material }: { material: { id: string; name: string; unit: string; minimum_stock: number; active: boolean } }) {
  const [state, action, pending] = useActionState(updateMaterial, {});
  const id = useId();
  return <form action={action} className="form"><input type="hidden" name="id" value={material.id}/><label htmlFor={`${id}-name`}>Nombre</label><input id={`${id}-name`} name="name" defaultValue={material.name} maxLength={120} required/><p>Unidad: {material.unit} (no se modifica para conservar el historial).</p><label htmlFor={`${id}-minimum`}>Stock mínimo</label><input id={`${id}-minimum`} name="minimum" type="number" min="0" step="0.001" defaultValue={material.minimum_stock} required/><label className="check-label"><input type="checkbox" name="active" defaultChecked={material.active}/> Material activo (desmarcá para dar de baja)</label><button disabled={pending}>{pending ? "Guardando…" : "Guardar cambios"}</button><p role="status">{state.error || state.success}</p></form>;
}

export function MaterialForm() {
  const [state, action, pending] = useActionState(createMaterial, {});
  return <form id="nuevo-material" action={action} className="form tile"><h2>Nuevo material</h2><label htmlFor="name">Nombre</label><input id="name" name="name" required maxLength={120}/><label htmlFor="unit">Unidad de inventario</label><input id="unit" name="unit" placeholder="Ej.: gramos o unidades" required maxLength={30}/><label htmlFor="minimum">Stock mínimo</label><input id="minimum" name="minimum" type="number" min="0" step="0.001" defaultValue="0" required/><button disabled={pending}>{pending ? "Guardando…" : "Crear material"}</button><p role="status">{state.error || state.success}</p></form>;
}
export function StockForm({materials, operationKey}: {materials: {id: string; name: string; unit: string}[]; operationKey: string}) {
  const [state, action, pending] = useActionState(adjustStock, {});
  return <form action={action} className="form tile"><h2>Registrar ajuste</h2><p className="muted">Usá valores positivos para ingresos y negativos para egresos. Indicá el motivo.</p><input type="hidden" name="key" value={operationKey}/><label htmlFor="material">Material</label><select id="material" name="material" required defaultValue=""><option value="" disabled>Seleccionar</option>{materials.map(m => <option value={m.id} key={m.id}>{m.name} ({m.unit})</option>)}</select><label htmlFor="quantity">Cantidad</label><input id="quantity" name="quantity" type="number" step="0.001" required/><label htmlFor="reason">Motivo</label><input id="reason" name="reason" maxLength={500} required/><button disabled={pending || !!state.success}>{pending ? "Registrando…" : "Registrar movimiento"}</button><p role="status">{state.error || state.success}</p>{state.success && <a href="/inventario">Registrar otro movimiento</a>}</form>;
}
