# Estrella Gestión

Aplicación interna de Estrella Carnaval en desarrollo. **Todavía no está lista para operar el negocio.** Consultar el [alcance actual](docs/alcance-actual.md), el [documento de inicio](docs/documento-inicio.md) y el [estado de migraciones](docs/estado-migraciones.md). No se incluyen datos comerciales de ejemplo.

## Requisitos y ejecución

Se necesita Node.js 20.9 o posterior, npm y un proyecto Supabase. Copiar `.env.example` a `.env.local` y completar la URL y la clave publicable del proyecto.

Para habilitar la creación de cuentas de colaboradoras desde la web, completar también `SUPABASE_SERVICE_ROLE_KEY` con una clave de servidor del mismo proyecto. Esta clave es privilegiada: debe guardarse solo en el entorno del servidor, nunca en una variable `NEXT_PUBLIC_`, en el código ni en Git. Sin ella, se pueden consultar y modificar perfiles existentes, pero la creación de cuentas desde la web estará deshabilitada.

```sh
npm ci
npm run dev
npm run lint
npm run build
npm run test:db:isolated
npm run test:conversions
npm run test:csv
```

Abrir http://localhost:3000. No incluir `.env.local` en Git ni compartir las claves.

## Supabase y primer administrador

1. Crear un proyecto Supabase. Deshabilitar el registro público y el inicio anónimo en Authentication.
2. Aplicar las migraciones en orden y probarlas primero en una base aislada. Si la base ya contiene objetos, revisar [estado de migraciones](docs/estado-migraciones.md) antes de proceder. No editar migraciones ya aplicadas.
3. Crear manualmente el primer usuario confirmado mediante el panel seguro de Supabase Authentication. Usar una contraseña robusta y copiar su UUID.
4. Como propietario de la base, ejecutar en el editor SQL con los valores propios:

```sql
insert into public.profiles (id, display_name, role, active)
values ('UUID_DEL_USUARIO', 'Nombre', 'admin', true);
```

5. En Authentication > URL Configuration definir la URL de producción y únicamente las redirecciones necesarias. Incluir localhost solo para desarrollo.

La administración puede acceder a **Cargas y ABM** para crear y mantener datos. El alta de colaboradoras crea una cuenta en Auth desde el servidor y un perfil con rol de colaboradora; la contraseña inicial se entrega por un canal seguro. Si se interrumpe la operación y la aplicación no puede verificar su resultado, revisar el correo en el panel de Supabase antes de reintentar. No hay flujo de invitación ni recuperación de contraseña implementado.

Desactivar una colaboradora bloquea su acceso a los datos protegidos de la aplicación y conserva su historial. No desactiva la cuenta de Auth; para impedir también el inicio de sesión, deshabilitar la cuenta en Supabase. El ABM de colaboradoras no permite cambiar roles ni modificar administradores.

## Pruebas y despliegue

`npm run test:db:isolated` prueba migraciones y reglas básicas en PGlite. No reemplaza las pruebas pgTAP con Supabase completo ni las pruebas con conexiones concurrentes. Con Supabase CLI y Docker configurados, ejecutar `supabase start` y `supabase test db` en una instancia aislada. No ejecutar datos de prueba ni reinicios en producción.

Para Vercel, subir el código a un repositorio privado y configurar las variables públicas y, si se usa el alta de cuentas, la clave de servidor para cada entorno. La clave privilegiada no debe estar disponible en el navegador. Aplicar migraciones verificadas antes de habilitar usuarios; este repositorio no despliega ni modifica la base remota automáticamente.
