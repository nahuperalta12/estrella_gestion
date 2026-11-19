"use client";
import { useActionState } from "react";
import { signIn } from "@/app/actions";
export function LoginForm() {
  const [error, action, pending] = useActionState(signIn, null);
  return <form action={action} className="form">
    <label htmlFor="email">Correo electr?nico</label><input id="email" name="email" type="email" autoComplete="email" required />
    <label htmlFor="password">Contrase?a</label><input id="password" name="password" type="password" autoComplete="current-password" required />
    {error && <p role="alert" className="error">{error}</p>}
    <button disabled={pending}>{pending ? "Ingresando?" : "Ingresar"}</button>
  </form>;
}
