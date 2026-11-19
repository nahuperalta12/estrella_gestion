# Estrella Gesti?n

Fundamentos de la aplicaci?n interna de Estrella Carnaval. Esta entrega **no est? lista para operar el negocio**: inventario, producci?n, pagos y pedidos todav?a no est?n implementados. No contiene datos comerciales de ejemplo.

## Requisitos y ejecuci?n

Node.js 20.9 o posterior, npm y un proyecto Supabase. Copiar `.env.example` a `.env.local` y completar la URL y la clave publicable (o clave anon heredada) del proyecto. Nunca usar la clave `service_role` ni una clave secreta en variables `NEXT_PUBLIC_`.

```sh
npm ci
npm run dev
npm run lint
npm run build
```

Abrir http://localhost:3000. Sin configuraci?n se muestra una indicaci?n en lugar de datos simulados.

## Supabase y primer administrador

1. Crear un proyecto Supabase. Deshabilitar **Allow new users to sign up** y el inicio an?nimo en Authentication. No existe registro p?blico en la aplicaci?n; la configuraci?n del proveedor tambi?n debe impedirlo.
2. Aplicar `supabase/migrations/202611190001_foundation.sql` mediante las migraciones de Supabase o el editor SQL. Ejecutar una sola vez en una base nueva; no editar migraciones ya aplicadas.
3. Crear manualmente el primer usuario confirmado mediante el panel seguro de Supabase Authentication. Usar una contrase?a robusta y entregar credenciales por un canal seguro. Copiar el UUID de ese usuario.
4. Como propietario de la base, ejecutar en el editor SQL, reemplazando UUID y nombre con valores propios:

```sql
insert into public.profiles (id, display_name, role, active)
values ('UUID_DEL_USUARIO', 'Nombre', 'admin', true);
```

Este procedimiento requiere acceso privilegiado al panel. La aplicaci?n no asigna privilegios a partir de metadatos editables ni permite escribir perfiles desde la API. Por ahora, el alta y la desactivaci?n de colaboradoras tambi?n requieren crear la cuenta en Auth y agregar o actualizar su perfil con `role = 'collaborator'` y `active` desde el panel SQL. La gesti?n administrada desde la interfaz es trabajo pendiente. Desactivar un perfil bloquea el acceso a los datos protegidos por las pol?ticas implementadas; desactivar tambi?n el usuario en Auth si se requiere impedir el inicio de sesi?n.

5. En Authentication > URL Configuration definir Site URL a la URL de producci?n y agregar ?nicamente las URL de redirecci?n necesarias; incluir localhost solo para desarrollo. No hay flujo de recuperaci?n ni invitaci?n implementado todav?a.

## Vercel

Subir el c?digo a un repositorio privado, importar el proyecto en Vercel y configurar las dos variables p?blicas de `.env.example` para cada entorno. Ejecutar la migraci?n antes de habilitar usuarios. No incluir `.env.local` ni credenciales en Git. El despliegue requiere un proyecto Supabase propio y no se realiza autom?ticamente por este repositorio.

## Uso actual

La persona administradora o colaboradora entra con su correo y contrase?a. Su perfil activo determina el panel visible. Los m?dulos indicados como pr?ximos no ofrecen operaciones ni indicadores ficticios. Se puede cerrar sesi?n desde el panel.

## Pruebas de pol?ticas

`supabase/tests/foundation_rls.sql` contiene pruebas pgTAP aisladas para roles, permisos de escritura y cuentas inactivas. Con Supabase CLI, Docker y el entorno local configurados, ejecutar `supabase init` para generar la configuración local, luego `supabase start` y `supabase test db` (las migraciones se aplican al iniciar la base local). No ejecutar datos de prueba en producci?n. Las pruebas de las fases futuras deber?n cubrir concurrencia, idempotencia e integridad de las transacciones antes de usarlas.

Ver [arquitectura y plan](docs/arquitectura.md).

