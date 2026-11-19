# Inventario inicial de depósito

El módulo permite al administrador crear materiales y registrar ajustes positivos o negativos con motivo. Guarda cada movimiento y mantiene un saldo de depósito no negativo; los reintentos de un ajuste usan una clave de operación. No implementa todavía compras, costos, lotes, transferencias, custodia, conversiones ni producción. No usar los ajustes como sustituto definitivo de esas operaciones.

Aplicar primero la migración de fundamentos y después `supabase/migrations/202611190002_inventory.sql`. Antes de aplicarla a producción ejecutar las pruebas de `supabase/tests` en una instancia aislada, incluida una prueba de concurrencia. La clave publicable de `.env.local` no permite aplicar migraciones; hace falta acceso administrativo a la base. La migración aún no fue aplicada ni probada contra PostgreSQL desde este entorno.

No desplegar esta entrega como sistema completo: faltan las funciones y comprobaciones indicadas en el plan de arquitectura.
