"use client";
import { useActionState } from "react";
import { saveSettings } from "./actions";

type Settings = { glue_grams_per_pot: number; glue_grams_per_feather: number; holographic_rods_per_kg: number; fiberglass_segments_per_rod: number };
export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState(saveSettings, {});
  return <form action={action} className="form tile">
    <label htmlFor="pot">Gramos de pegamento por pote</label><input id="pot" name="pot" type="number" min="0.001" step="0.001" defaultValue={settings.glue_grams_per_pot} required/>
    <label htmlFor="glue">Gramos de pegamento estimados por pluma</label><input id="glue" name="glue" type="number" min="0.001" step="0.001" defaultValue={settings.glue_grams_per_feather} required/>
    <label htmlFor="rods">Varillas holográficas estimadas por kilogramo</label><input id="rods" name="rods" type="number" min="0.001" step="0.001" defaultValue={settings.holographic_rods_per_kg} required/>
    <label htmlFor="segments">Segmentos por varilla de fibra de vidrio</label><input id="segments" name="segments" type="number" min="1" step="1" defaultValue={settings.fiberglass_segments_per_rod} required/>
    <button disabled={pending}>{pending ? "Guardando…" : "Guardar configuración"}</button><p role="status">{state.message}</p>
  </form>;
}
