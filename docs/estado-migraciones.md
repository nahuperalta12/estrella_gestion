# Estado de migraciones

En la comprobación del 19 de noviembre de 2026, el proyecto remoto vinculado contenía la tabla `public.profiles`, el tipo `app_role`, la función `is_active_admin` y las políticas de perfiles, pero su historial de migraciones no registraba `202611190001`. Esto es compatible con una aplicación manual previa; todavía debe compararse la definición completa antes de marcarla como aplicada.

La simulación `supabase db push --remote --dry-run` indicó que intentaría aplicar las migraciones 001, 002 y 003. Ejecutar ese comando sin `--dry-run` en ese estado intentaría recrear objetos existentes. No se reparó el historial ni se aplicaron las migraciones automáticamente.

Antes de desplegar: comprobar la equivalencia completa de la migración 001 con el esquema remoto, probar todas las migraciones y políticas en una base aislada y solo entonces reconciliar el historial y aplicar las migraciones pendientes. `supabase test db` necesita un entorno local con Docker u otra base de prueba aislada. No usar datos ficticios ni comandos de reinicio en producción.

Posteriormente se agregaron las migraciones 004 a 008 para administración de materiales, parámetros de inventario, catálogos, compras iniciales y pedidos iniciales. No fueron aplicadas a la base remota ni probadas contra PostgreSQL desde este entorno. La simulación anterior no las incluía. Deben verificarse todas las migraciones y sus pruebas, incluyendo concurrencia para la recepción, antes de decidir su aplicación.

La migración 009 añade el flujo inicial de despacho y confirmación de transferencias. Las migraciones 001 a 009 se ejecutaron en PostgreSQL aislado mediante PGlite, junto con pruebas básicas de permisos, saldos y reintentos (`npm run test:db:isolated`). Esto no sustituye las pruebas pgTAP con Supabase completo ni las pruebas de concurrencia con conexiones independientes. No se cambió el esquema remoto ni se reconciliaron sus migraciones.

Una inspección posterior de metadatos en modo de solo lectura (`scripts/inspect-foundation.sql` y `scripts/inspect-remote-state.sql`) encontró que las columnas, valores predeterminados, restricciones, índice principal, políticas, función `is_active_admin`, RLS y valores del tipo `app_role` coinciden con la migración 001. El rol `service_role` también tiene permisos, como corresponde al entorno Supabase. Solo aparece `profiles` entre las tablas públicas; no hay disparadores de usuario en ella y la tabla de historial de migraciones no existe. Estos resultados apoyan la equivalencia de fundamentos, pero todavía no se ha reparado el historial ni aplicado cambios remotos. Antes de hacerlo siguen pendientes las pruebas en Supabase completo y concurrencia.

Las migraciones 010 y 011 incorporan producción y pagos iniciales. Se aplicaron únicamente en PGlite y pasaron pruebas aisladas básicas de propiedad, consumo, reintentos, devengamiento y pagos parciales. Sus pruebas pgTAP y de concurrencia requieren todavía un Supabase aislado completo; no están aplicadas en el entorno remoto.

La migración 012 incorpora la recepción física de producción terminada y se probó en PGlite, incluyendo reintentos y límites de cantidad. No genera aún existencias terminadas vinculadas a pedidos y tampoco se aplicó al entorno remoto.

La migración 013 incorpora cobros parciales de pedidos y su ingreso de caja. También se probó solo en PGlite; no gestiona devoluciones ni fue aplicada al entorno remoto.

La migración 014 agrega una vista de los movimientos de caja registrados, sin incluir todavía otras categorías ni saldos iniciales. Se probó en PGlite y no se aplicó al entorno remoto.

La migración 015 vincula las recepciones de producción con el stock terminado y las entregas a pedidos. Rechaza su aplicación si existen pedidos marcados manualmente como entregados: esa información anterior debe reconciliarse antes de migrar, ya que no contiene movimientos de stock. Se probó en PGlite, pero no se ejecutaron todavía pruebas concurrentes ni pgTAP con Supabase completo y no se aplicó remotamente.

La migración 016 agrega transformaciones de materiales en depósito con movimientos atómicos y reintentos idempotentes. Se probó en PGlite, pero requiere las pruebas concurrentes y pgTAP antes de desplegarse; no se aplicó remotamente.

La migración 017 agrega pagos parciales de compras y sus egresos de caja. Se probó en PGlite con reintentos y límites de saldo; no se ejecutaron las pruebas pgTAP ni concurrentes y no se aplicó remotamente.

La migración 018 permite registrar otros ingresos y gastos, con reintentos idempotentes. Se probó en PGlite, pero no permite aún anulación ni se aplicó al entorno remoto.

La migración 019 permite revertir movimientos de caja manuales mediante asientos compensatorios; no revierte pagos o cobros vinculados. La 020 agrega vistas de indicadores protegidas por las políticas del usuario. Ambas pasaron pruebas básicas en PGlite, pero aún requieren pgTAP y pruebas de concurrencia y no se aplicaron al entorno remoto.

La migración 021 incorpora reversiones completas para pagos de colaboradoras, pagos de compras y cobros de pedidos, y modifica sus saldos para excluir los registros revertidos. Se probó en PGlite incluyendo permisos, reintentos y restablecimiento de saldos; quedan pendientes pgTAP y concurrencia sobre Supabase completo. No se aplicó remotamente.

La migración 022 agrega las operaciones de perfil para el ABM de colaboradoras. Se probó en PGlite para roles, alta de perfiles y desactivación; la creación de cuentas mediante Supabase Auth aún requiere pruebas integrales aisladas. No se aplicó al entorno remoto.
