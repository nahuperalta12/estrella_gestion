"use client";
import {useActionState} from "react";
import {dispatch,confirmReceipt} from "./actions";
type Option={id:string;name:string};
export function DispatchForm({collaborators,materials,operationKey}:{collaborators:Option[];materials:(Option & {unit:string})[];operationKey:string}) {
  const [state,action,pending]=useActionState(dispatch,{});
  return <form className="form tile" action={action} onSubmit={e=>{if(!window.confirm("¿Confirmás el despacho? La cantidad saldrá del depósito y quedará en tránsito.")) e.preventDefault();}}><h2>Despachar material</h2><input type="hidden" name="key" value={operationKey}/><label htmlFor="collaborator">Colaborador</label><select id="collaborator" name="collaborator" required defaultValue=""><option value="" disabled>Seleccionar</option>{collaborators.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select><label htmlFor="material">Material</label><select id="material" name="material" required defaultValue=""><option value="" disabled>Seleccionar</option>{materials.map(m=><option value={m.id} key={m.id}>{m.name} ({m.unit})</option>)}</select><label htmlFor="quantity">Cantidad</label><input id="quantity" name="quantity" type="number" min="0.001" step="0.001" required/><label htmlFor="notes">Observaciones</label><textarea id="notes" name="notes" maxLength={500}/><button disabled={pending || state.ok || !collaborators.length || !materials.length}>{pending ? "Despachando…":"Confirmar despacho"}</button><p role="status">{state.message}</p>{state.ok && <a href="/entregas">Registrar otra entrega</a>}</form>;
}
export function ReceiptForm({id}:{id:string}) {
  const [state,action,pending]=useActionState(confirmReceipt,{});
  return <form action={action} onSubmit={e=>{if(!window.confirm("¿Confirmás que recibiste la cantidad indicada?")) e.preventDefault();}}><input type="hidden" name="id" value={id}/><button disabled={pending || state.ok}>{pending ? "Confirmando…":"Confirmar recepción"}</button><p role="status">{state.message}</p></form>;
}
