"use client";
import {useActionState,useId} from "react";
import {createCollaborator,updateCollaborator} from "./actions";
export function CreateCollaboratorForm({configured}:{configured:boolean}) {
  const [state,action,pending]=useActionState(createCollaborator,{});
  return <form action={action} className="form tile"><h2>Alta de colaboradora</h2><p>Creá una cuenta con correo y contraseña. Compartí las credenciales por un canal seguro.</p>{!configured && <p>Para habilitar el alta, falta configurar la clave de servidor de Supabase.</p>}<label htmlFor="new-worker-name">Nombre</label><input id="new-worker-name" name="name" maxLength={100} autoComplete="name" required/><label htmlFor="new-worker-email">Correo electrónico</label><input id="new-worker-email" name="email" type="email" maxLength={254} autoComplete="off" required/><label htmlFor="new-worker-password">Contraseña inicial (mínimo 12 caracteres)</label><input id="new-worker-password" name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required/><button disabled={!configured || pending || state.ok}>{pending ? "Creando…":"Crear colaboradora"}</button><p role="status">{state.message}</p>{state.ok && <a href="/colaboradoras">Crear otra colaboradora</a>}</form>;
}
export function EditCollaboratorForm({item}:{item:{id:string;display_name:string;active:boolean}}) {
  const [state,action,pending]=useActionState(updateCollaborator,{}); const id=useId();
  return <form action={action} className="form" onSubmit={e=>{const data=new FormData(e.currentTarget);if(item.active && data.get("active")!=="on" && !window.confirm("¿Confirmás la baja? La colaboradora perderá acceso a los datos de la aplicación.")) e.preventDefault();}}><input type="hidden" name="id" value={item.id}/><label htmlFor={`${id}-name`}>Nombre</label><input id={`${id}-name`} name="name" defaultValue={item.display_name} maxLength={100} required/><label className="check-label"><input type="checkbox" name="active" defaultChecked={item.active}/> Acceso activo (desmarcá para dar de baja)</label><button disabled={pending}>{pending ? "Guardando…":"Guardar cambios"}</button><p role="status">{state.message}</p></form>;
}
