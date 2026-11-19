# Estado de migraciones

En la comprobación del 19 de noviembre de 2026, el proyecto remoto vinculado contenía la tabla `public.profiles`, el tipo `app_role`, la función `is_active_admin` y las políticas de perfiles, pero su historial de migraciones no registraba `202611190001`. Esto es compatible con una aplicación manual previa; todavía debe compararse la definición completa antes de marcarla como aplicada.

La simulación `supabase db push --remote --dry-run` indicó que intentaría aplicar las migraciones 001, 002 y 003. Ejecutar ese comando sin `--dry-run` en ese estado intentaría recrear objetos existentes. No se reparó el historial ni se aplicaron las migraciones automáticamente.

Antes de desplegar: comprobar la equivalencia completa de la migración 001 con el esquema remoto, probar todas las migraciones y políticas en una base aislada y solo entonces reconciliar el historial y aplicar las migraciones pendientes. `supabase test db` necesita un entorno local con Docker u otra base de prueba aislada. No usar datos ficticios ni comandos de reinicio en producción.
