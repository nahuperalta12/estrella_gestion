"use client";
import {useActionState,useId} from "react";
import {reversePayment} from "./actions";
export function PaymentReversalForm({kind,id,date,operationKey}:{kind:"collaborator"|"customer"|"supplier";id:string;date:string;operationKey:string}) {
  const [state,action,pending]=useActionState(reversePayment,{}); const field=useId();
  return <details><summary>Revertir este movimiento</summary><form action={action} className="form" onSubmit={e=>{if(!window.confirm("¿Confirmás que este registro fue incorrecto o que la devolución de dinero ya se realizó? La reversión modificará el saldo y registrará un movimiento contrario en caja.")) e.preventDefault();}}><input type="hidden" name="key" value={operationKey}/><input type="hidden" name="kind" value={kind}/><input type="hidden" name="payment" value={id}/><label htmlFor={`${field}-date`}>Fecha de reversión</label><input id={`${field}-date`} type="date" name="date" defaultValue={date} required/><label htmlFor={`${field}-reason`}>Motivo</label><textarea id={`${field}-reason`} name="reason" maxLength={500} required/><button disabled={pending || state.ok}>{pending ? "Registrando…":"Confirmar reversión"}</button><p role="status">{state.message}</p></form></details>;
}
