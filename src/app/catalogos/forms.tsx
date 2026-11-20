"use client";
import { useActionState, useId } from "react";
import { saveCustomer, saveProduct } from "./actions";

export type Customer = { id: string; name: string; phone: string | null; active: boolean };
export type Product = { id: string; name: string; size: string | null; color: string | null; description: string | null; suggested_price: number; active: boolean };
export function CustomerForm({ item }: { item?: Customer }) {
  const [state, action, pending] = useActionState(saveCustomer, {}); const id = useId();
  return <form action={action} className="form"><input type="hidden" name="id" value={item?.id ?? ""}/><label htmlFor={`${id}-name`}>Nombre</label><input id={`${id}-name`} name="name" defaultValue={item?.name ?? ""} maxLength={120} required/><label htmlFor={`${id}-phone`}>Teléfono</label><input id={`${id}-phone`} name="phone" type="tel" defaultValue={item?.phone ?? ""} maxLength={40}/><label className="check-label"><input name="active" type="checkbox" defaultChecked={item?.active ?? true}/> Activo (desmarcá para dar de baja)</label><button disabled={pending || state.created}>{pending ? "Guardando…" : "Guardar cliente"}</button><p role="status">{state.message}</p>{state.created && <a href="/catalogos">Agregar otro cliente</a>}</form>;
}
export function ProductForm({ item }: { item?: Product }) {
  const [state, action, pending] = useActionState(saveProduct, {}); const id = useId();
  return <form action={action} className="form"><input type="hidden" name="id" value={item?.id ?? ""}/><label htmlFor={`${id}-name`}>Modelo o nombre</label><input id={`${id}-name`} name="name" defaultValue={item?.name ?? ""} maxLength={120} required/><label htmlFor={`${id}-size`}>Tamaño</label><input id={`${id}-size`} name="size" defaultValue={item?.size ?? ""} maxLength={80}/><label htmlFor={`${id}-color`}>Color</label><input id={`${id}-color`} name="color" defaultValue={item?.color ?? ""} maxLength={80}/><label htmlFor={`${id}-description`}>Descripción</label><textarea id={`${id}-description`} name="description" defaultValue={item?.description ?? ""} maxLength={2000}/><label htmlFor={`${id}-price`}>Precio sugerido (ARS)</label><input id={`${id}-price`} name="price" type="number" min="0" step="0.01" defaultValue={item?.suggested_price ?? 0} required/><label className="check-label"><input name="active" type="checkbox" defaultChecked={item?.active ?? true}/> Activo (desmarcá para dar de baja)</label><button disabled={pending || state.created}>{pending ? "Guardando…" : "Guardar producto"}</button><p role="status">{state.message}</p>{state.created && <a href="/catalogos">Agregar otro producto</a>}</form>;
}
