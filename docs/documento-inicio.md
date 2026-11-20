# PROMPT MAESTRO — ESTRELLA GESTIÓN

## 1. Rol y objetivo

Actuá como un ingeniero de software senior especializado en sistemas de gestión empresarial, inventarios, producción, contabilidad operativa, PostgreSQL, Supabase, seguridad RLS y desarrollo full-stack.

Tu tarea es diseñar e implementar una plataforma web funcional llamada **Estrella Gestión**, destinada a la administración interna del emprendimiento argentino **Estrella Carnaval**, dedicado a la fabricación artesanal y comercialización de plumas artificiales para carnaval.

La plataforma debe permitir administrar:

- Inventario de materias primas.
- Compras y proveedores.
- Producción de plumas.
- Distribución de materiales entre colaboradoras.
- Producción diaria y tareas pendientes.
- Costos de fabricación.
- Remuneraciones y pagos a colaboradoras.
- Pedidos de clientes.
- Ingresos, gastos y rentabilidad.
- Estadísticas e indicadores del negocio.

La aplicación será utilizada inicialmente por un administrador y cuatro colaboradoras, pero debe permitir agregar más usuarios en el futuro.

**Objetivo principal:** disponer de información actualizada y confiable sobre los materiales comprados, los materiales disponibles, los materiales distribuidos, la producción realizada, los pedidos pendientes y el dinero generado o gastado.

No construir un prototipo meramente visual. Implementar un sistema real con persistencia, autenticación, autorización, operaciones transaccionales y funcionalidades conectadas entre sí.

---

## 2. Stack tecnológico

Utilizar preferentemente:

- Next.js con App Router.
- TypeScript en modo estricto.
- Tailwind CSS.
- shadcn/ui para componentes.
- Lucide Icons.
- Supabase PostgreSQL.
- Supabase Auth.
- Supabase Row Level Security.
- Supabase Storage si resulta necesario.
- React Hook Form + Zod.
- Recharts para estadísticas.
- Vercel como plataforma de despliegue.

Elegir versiones estables y compatibles al momento de implementar, según documentación oficial.

La arquitectura debe permitir mantenimiento, ampliaciones y despliegues sucesivos sin perder información.

Idioma de la interfaz: español de Argentina.

Moneda inicial: ARS.

Zona horaria: America/Argentina/Buenos_Aires.

Diseñar para escritorio y dispositivos móviles, con especial atención a la experiencia móvil de las colaboradoras.

---

## 3. Identidad visual

La aplicación pertenece a Estrella Carnaval.

Aplicar una estética minimalista, moderna y profesional.

Lineamientos:

- Fondo principal claro, preferentemente blanco.
- Textos oscuros de alto contraste.
- Colores celeste y naranja como acentos moderados.
- Tarjetas con bordes suaves.
- Tablas legibles.
- Iconografía simple.
- Interfaz ordenada, sin saturación visual.
- Adaptación responsive.
- Sidebar para administración en escritorio.
- Menú de navegación móvil para colaboradoras.
- Estados vacíos, indicadores de carga, validaciones y mensajes de confirmación.

Preparar la estructura para incorporar posteriormente el logotipo oficial del emprendimiento.

---

## 4. Autenticación y usuarios

Implementar Supabase Auth con acceso mediante correo electrónico y contraseña, usando un flujo seguro de invitaciones o creación administrada.

Existirán dos roles iniciales:

### ADMINISTRADOR

Puede:

- Acceder a toda la información empresarial.
- Crear, invitar, activar y desactivar usuarios.
- Registrar y modificar materiales.
- Registrar compras y proveedores.
- Configurar costos y rendimientos.
- Gestionar entregas de materiales.
- Consultar y corregir registros de producción.
- Gestionar pedidos de clientes.
- Definir tarifas de remuneración.
- Registrar pagos.
- Consultar finanzas y rentabilidad.
- Acceder a estadísticas e historial de auditoría.

### COLABORADORA

Puede:

- Consultar únicamente sus datos.
- Visualizar su producción pendiente.
- Consultar materiales asignados.
- Registrar plumas terminadas por día.
- Consultar tareas y lotes asignados.
- Solicitar o confirmar recepción de materiales.
- Consultar remuneraciones devengadas.
- Consultar pagos recibidos y saldo por cobrar.

No puede:

- Acceder a datos de otras colaboradoras.
- Modificar sus propias tarifas.
- Modificar registros financieros empresariales.
- Consultar costos generales, ingresos o ganancias.
- Registrar pagos a sí misma.
- Alterar movimientos históricos de inventario.
- Modificar políticas de permisos.

El registro público debe estar deshabilitado.

El primer administrador se creará mediante un procedimiento de inicialización seguro y explícito. No establecer usuarios administradores a partir de datos editables por el cliente.

---

## 5. Inventario de materiales

Desarrollar un módulo de inventario con materiales configurables.

Materiales iniciales:

1. Tela sublimada.
2. Pegamento.
3. Varillas holográficas.
4. Varillas de fibra de vidrio.
5. Otros materiales agregados por el administrador.

Cada material tendrá:

- Identificador.
- Nombre.
- Categoría.
- Descripción.
- Unidad principal.
- Unidad de compra.
- Factor de conversión.
- Costo unitario.
- Stock mínimo.
- Estado activo/inactivo.
- Fecha de creación.
- Fecha de actualización.

### 5.1 Tela sublimada

La tela se mide según la cantidad de plumas que permite fabricar.

Ejemplo: una compra o preparación de tela suficiente para 500 plumas se registra como 500 unidades equivalentes de tela.

La aplicación debe permitir registrar diferentes colores, diseños, tamaños y lotes cuando corresponda.

### 5.2 Pegamento

El pegamento se compra en potes.

Parámetros iniciales:

- Peso de cada pote: 250 gramos.
- Rendimiento estimado: 1,2 potes por cada 100 plumas.
- Consumo equivalente: 3 gramos por pluma.

Es fundamental permitir cantidades fraccionarias.

Ejemplo: fabricar 50 plumas consume aproximadamente 0,6 potes, equivalentes a 150 gramos.

Utilizar gramos como unidad interna de inventario y convertir a potes equivalentes para la visualización.

No redondear el consumo de cada producción a potes enteros.

Registrar la capacidad y cantidad de potes por compra.

### 5.3 Varillas holográficas

Estas varillas se compran habitualmente por kilogramo.

Parámetro inicial:

**1 kg = aproximadamente 600 varillas.**

Al registrar una compra:

- Ingresar kilogramos comprados.
- Calcular unidades estimadas.
- Registrar precio total.
- Calcular costo estimado por unidad.

También permitir configurar directamente el peso promedio de una varilla en gramos, por tipo o longitud.

Si existe un peso por unidad personalizado, usarlo para la conversión de ese tipo de varilla.

La equivalencia de 600 unidades por kilogramo debe ser el valor inicial y no un dato fijo en el código.

El sistema debe distinguir cantidades estimadas de cantidades físicamente contadas.

Si una compra produce una cantidad fraccionaria estimada de varillas, conservar la información original de peso y registrar las unidades enteras estimadas según una regla explícita de redondeo hacia abajo.

### 5.4 Fibra de vidrio

Las varillas originales de fibra de vidrio generalmente se cortan en tres partes.

Parámetro inicial:

**1 varilla original = 3 segmentos utilizables para 3 plumas.**

El sistema debe permitir:

- Registrar varillas originales compradas.
- Registrar unidades o segmentos disponibles.
- Controlar cortes o conversiones.
- Registrar pérdidas o desperdicios.
- Configurar el rendimiento por varilla.

Evitar descontar un tercio de una varilla física de manera incorrecta.

Modelar las varillas originales y sus segmentos como unidades distintas relacionadas mediante una operación de transformación.

Una operación de corte transforma una varilla original en tres segmentos utilizables, salvo que se registre otro rendimiento.

### 5.5 Inventario por ubicación

Distinguir materiales disponibles en:

- Depósito principal.
- Custodia de cada colaboradora.
- Materiales en tránsito.
- Materiales consumidos.
- Materiales desperdiciados.

El stock total del emprendimiento debe poder calcularse sin duplicar cantidades.

Una transferencia a una colaboradora no representa consumo: representa movimiento entre ubicaciones.

### 5.6 Movimientos de stock

Registrar:

- Compra.
- Ingreso inicial.
- Transferencia.
- Confirmación de recepción.
- Consumo por producción.
- Devolución.
- Ajuste positivo.
- Ajuste negativo.
- Desperdicio.
- Transformación de material.
- Reversión de operaciones.

Cada movimiento debe tener fecha, usuario responsable, tipo, cantidad, material, ubicación, referencia de origen y observaciones.

No permitir eliminar movimientos históricos confirmados.

---

## 6. Compras y proveedores

Crear gestión de proveedores.

Datos:

- Nombre.
- Contacto.
- Teléfono.
- Correo electrónico.
- Observaciones.

Cada compra tendrá:

- Proveedor.
- Fecha.
- Número de comprobante opcional.
- Materiales comprados.
- Cantidad y unidad.
- Precio unitario.
- Precio total.
- Gastos adicionales.
- Estado de recepción.
- Estado de pago.
- Observaciones.

Una compra puede incluir varios materiales.

Distinguir entre:

1. Compra registrada.
2. Material recibido.
3. Pago realizado.

Los materiales deben ingresar al stock cuando se confirme su recepción.

El costo debe distribuirse correctamente entre las unidades adquiridas.

Mantener el costo histórico por lote.

---

## 7. Catálogo de productos y recetas

Permitir crear productos según:

- Modelo de pluma.
- Tamaño.
- Color.
- Descripción.
- Precio de venta sugerido.
- Estado activo/inactivo.

Ejemplos: Faisán Lady de 90 cm natural, Faisán Lady de 70 cm naranja, etc.

Cada producto tendrá una receta de fabricación configurable.

La receta indica materiales y cantidades necesarias para fabricar una unidad.

Parámetros iniciales de referencia:

- Tela preparada: 1 unidad.
- Pegamento: 3 gramos.
- Varilla holográfica: 1 unidad, cuando corresponda.
- Segmento de fibra de vidrio: 1 unidad, cuando corresponda.

No asumir que todos los productos utilizan necesariamente ambos tipos de varillas.

Las recetas deben admitir variaciones según modelo y tamaño.

Las modificaciones futuras de recetas no deben cambiar el cálculo histórico de producciones ya registradas.

Guardar versión o snapshot de la receta aplicada a cada registro de producción.

---

## 8. Producción

Desarrollar un módulo de producción con seguimiento por colaboradora.

El proceso puede incluir:

1. Corte o preparación.
2. Pegado o armado.
3. Colocación de varillas.
4. Terminación.
5. Control.

Sin embargo, la colaboradora registrará principalmente la cantidad de plumas terminadas en el día, sin necesidad de informar cada etapa.

El administrador podrá registrar y seguir las etapas cuando sea necesario.

### 8.1 Asignaciones de producción

Crear órdenes o lotes de trabajo.

Ejemplo:

- Colaboradora: María.
- Producto: Faisán Lady 90 cm natural.
- Cantidad asignada: 500.
- Fecha de asignación.
- Fecha objetivo opcional.
- Estado.

Calcular:

**Pendiente de fabricar = cantidad asignada − cantidad producida válida.**

No permitir que la producción válida supere la cantidad asignada, salvo modificación autorizada por el administrador.

### 8.2 Registro diario

Formulario para colaboradoras:

- Fecha de producción.
- Orden o lote asignado.
- Producto.
- Cantidad terminada.
- Observaciones opcionales.

Al confirmar:

1. Validar autenticación y pertenencia del lote.
2. Validar cantidad positiva.
3. Verificar pendiente de fabricación.
4. Calcular materiales según receta.
5. Verificar materiales disponibles en custodia de la colaboradora.
6. Registrar producción.
7. Descontar materiales automáticamente.
8. Actualizar pendientes.
9. Generar remuneración devengada según configuración.
10. Actualizar indicadores.

Toda esta operación debe ser atómica en PostgreSQL.

Si ocurre un error, no debe registrarse una producción parcial ni descontarse materiales incorrectamente.

### 8.3 Ajustes manuales

El administrador puede registrar diferencias de consumo.

Ejemplo: una colaboradora utilizó más pegamento del esperado.

Registrar:

- Consumo teórico.
- Consumo real ajustado.
- Diferencia.
- Motivo.
- Responsable.

No modificar movimientos históricos directamente.

Realizar ajustes compensatorios y mantener auditoría.

### 8.4 Entrega de producción terminada

Diferenciar plumas fabricadas de plumas entregadas físicamente.

El administrador debe poder registrar cuántas plumas terminadas recibió de cada colaboradora.

Indicadores:

- Cantidad asignada.
- Cantidad fabricada.
- Pendiente de fabricar.
- Cantidad entregada.
- Cantidad fabricada pendiente de entrega.

Las entregas no deben generar producción duplicada.

---

## 9. Portal de colaboradoras

Implementar una interfaz simple y optimizada para teléfonos.

### Pantalla principal

Mostrar prominentemente dos tarjetas:

**PLUMAS PENDIENTES**

Cantidad que todavía debe fabricar según asignaciones activas.

**SALDO POR COBRAR**

Importe devengado pendiente de pago.

Debajo incluir:

- Producción acumulada.
- Producción del mes.
- Materiales disponibles.
- Tareas asignadas.
- Últimos registros.
- Pagos recibidos.

### Registrar producción

Formulario accesible desde la pantalla principal.

Mostrar el stock necesario y advertencias cuando los materiales sean insuficientes.

No solicitar campos innecesarios.

### Mis materiales

Mostrar cantidades asignadas y disponibles.

Permitir consultar:

- Material.
- Cantidad recibida.
- Cantidad consumida.
- Cantidad restante.
- Entregas pendientes de confirmación.

### Mi dinero

Mostrar:

- Remuneración por producción.
- Remuneración por tareas o jornadas, si aplica.
- Total devengado.
- Pagos recibidos.
- Ajustes autorizados.
- Saldo pendiente.

La colaboradora no podrá modificar importes.

---

## 10. Entregas de materiales

Implementar un sistema de transferencias con confirmación.

Flujo principal:

1. Administrador crea una entrega.
2. Selecciona colaboradora.
3. Selecciona materiales y cantidades.
4. Confirma despacho.
5. La colaboradora recibe una notificación dentro de la aplicación.
6. Confirma las cantidades recibidas.
7. El material queda registrado como disponible en su custodia.

Permitir que una colaboradora solicite materiales o informe una recepción pendiente de confirmación administrativa.

Diferenciar material en tránsito de material efectivamente recibido.

No duplicar existencias.

Permitir registrar diferencias de entrega, rechazos y devoluciones.

---

## 11. Remuneraciones y pagos

Implementar un módulo flexible de remuneraciones.

Modalidades:

- Pago por pluma terminada.
- Pago por tarea completada.
- Pago por jornada.
- Pagos extraordinarios o bonificaciones.

Permitir definir tarifas diferentes por colaboradora, producto o tipo de tarea.

Cuando se registra producción válida, calcular la remuneración correspondiente según la tarifa vigente.

Guardar la tarifa aplicada en cada liquidación histórica.

Las modificaciones posteriores de tarifas no deben alterar pagos o remuneraciones anteriores.

Definir como comportamiento inicial que la remuneración se devenga al registrar producción válida.

Agregar configuración futura para remuneración devengada al confirmar entrega física.

Registrar pagos:

- Colaboradora.
- Fecha.
- Importe.
- Medio de pago.
- Concepto.
- Observaciones.
- Comprobante opcional.

**Saldo por cobrar = remuneraciones devengadas + ajustes positivos − ajustes negativos − pagos realizados.**

Permitir pagos parciales.

Evitar duplicar remuneraciones y pagos ante reintentos.

Solamente el administrador puede crear, corregir o anular pagos.

---

## 12. Gestión de pedidos

Crear registro de clientes.

Datos:

- Nombre.
- Teléfono.



Cada pedido tendrá:

- Cliente.
- Fecha.
- Productos.
- Cantidades.
- Precio unitario pactado.
- Descuentos opcionales.
- Fecha estimada de entrega.
- Estado.
- Observaciones.

Estados sugeridos:

- Pendiente.
- En producción.
- Listo.
- Entregado.
- Cancelado.

Registrar señas y pagos parciales asociados al pedido.

Calcular:

- Total pactado.
- Total cobrado.
- Saldo pendiente.

Relacionar pedidos con la producción mediante lotes u órdenes de trabajo.

No asumir que un pedido siempre corresponde a una sola colaboradora.

Prever ampliaciones para dividir pedidos entre varias personas.

Distinguir stock producido disponible, reservado y entregado.

---

## 13. Finanzas

Implementar un módulo administrativo con:

- Compras de materias primas.
- Pagos a proveedores.
- Ventas.
- Señas.
- Cobros de saldos.
- Pagos a colaboradoras.
- Otros ingresos.
- Otros gastos.

Permitir consultar movimientos por fechas y categorías.

Visualizar:

- Ingresos cobrados.
- Egresos pagados.
- Saldo neto de caja.
- Ventas pactadas.
- Cuentas por cobrar.
- Cuentas por pagar.
- Costos de producción.
- Rentabilidad estimada.

Separar claramente:

**Flujo de caja:** dinero efectivamente cobrado menos dinero efectivamente pagado.

**Costos de fabricación:** valor de los materiales consumidos y la mano de obra aplicada.

**Rentabilidad:** ingresos atribuibles a ventas menos los costos correspondientes.

No considerar automáticamente una compra de materiales como costo total de los productos vendidos, porque parte de esos materiales puede permanecer en inventario.

No duplicar un pago o cobro cuando se registra una compra o venta y posteriormente se registra su movimiento financiero.

### Costo por modelo

Estimar:

Costo de tela + costo de pegamento + costo de varillas + otros materiales + mano de obra + gastos de fabricación asignables.

Mostrar:

- Costo unitario estimado.
- Precio de venta.
- Ganancia bruta estimada por unidad.
- Margen bruto.

Conservar costos reales históricos por lote y distinguirlos de las estimaciones actuales.

Permitir configurar el criterio de valoración de inventario; utilizar promedio ponderado móvil como criterio inicial si no existe una necesidad contable distinta.

---

## 14. Panel administrativo

Crear un dashboard con las siguientes tarjetas:

- Plumas producidas.
- Plumas pendientes de fabricar.
- Plumas terminadas pendientes de recibir.
- Materiales disponibles.
- Stock bajo o insuficiente.
- Colaboradoras activas.
- Pedidos pendientes.
- Ventas del mes.
- Cobros del mes.
- Gastos del mes.
- Pagos pendientes a colaboradoras.
- Rentabilidad estimada.

Agregar gráficos:

- Producción diaria y mensual.
- Producción por colaboradora.
- Consumo de materiales.
- Evolución de ingresos y egresos.
- Costos por producto.
- Pedidos por estado.

Mostrar alertas relevantes y actividades recientes.

Todos los indicadores deben proceder de registros reales.

No dejar datos simulados conectados a pantallas de producción.

---

## 15. Proyección de materiales

Desarrollar un cálculo de necesidades de producción.

A partir de:

- Pedidos pendientes.
- Producción terminada disponible.
- Producción ya planificada.
- Recetas de productos.
- Inventario actual.
- Materiales reservados.
- Materiales distribuidos entre colaboradoras.

Calcular faltantes estimados.

Ejemplo:

Si existen pedidos pendientes por 1.000 plumas y solamente hay materiales suficientes para fabricar 600, mostrar la necesidad estimada de adquirir materiales para las 400 restantes.

Considerar cada material por separado.

Evitar contar materiales en poder de una colaboradora como disponibles inmediatamente en el depósito principal.

Distinguir disponibilidad total de disponibilidad por ubicación.

Incluir alertas de compra y cantidades sugeridas.

---

## 16. Diseño de base de datos

Implementar PostgreSQL con migraciones versionadas.

Diseñar un esquema normalizado, con claves primarias UUID, claves foráneas, restricciones, índices y timestamps.

Entidades propuestas:

### Usuarios

- profiles
- user_roles

### Inventario

- materials
- material_variants
- material_units
- material_conversions
- inventory_locations
- inventory_lots
- inventory_movements
- stock_transfers
- stock_transfer_items
- material_transformations

### Compras

- suppliers
- purchases
- purchase_items
- supplier_payments

### Producción

- products
- product_recipes
- recipe_items
- production_orders
- production_assignments
- production_records
- production_consumptions
- finished_goods_movements
- production_deliveries

### Colaboradoras

- collaborator_profiles
- compensation_rates
- compensation_ledger
- collaborator_payments

### Ventas

- customers
- sales_orders
- sales_order_items
- customer_payments

### Finanzas

- financial_categories
- financial_transactions
- financial_adjustments

### Sistema

- business_settings
- audit_logs

La lista puede ajustarse si una estructura alternativa resulta más coherente, pero deben mantenerse las responsabilidades funcionales y la trazabilidad.

Usar tipos NUMERIC adecuados para dinero y cantidades fraccionarias. Evitar FLOAT para cálculos monetarios.

Agregar restricciones para impedir cantidades negativas en existencias operativas y pagos inválidos.

Crear vistas de solo lectura para indicadores agregados cuando corresponda.

Documentar las relaciones y generar un diagrama entidad-relación.

---

## 17. Seguridad RLS — requisito obligatorio

Aplicar Row Level Security a todas las tablas expuestas mediante la API de Supabase.

Las políticas deben limitar el acceso según el usuario autenticado y su rol.

Reglas:

1. El administrador puede gestionar los datos del emprendimiento.
2. Cada colaboradora puede consultar exclusivamente su propia información autorizada.
3. Una colaboradora puede registrar producción únicamente en asignaciones que le pertenezcan.
4. Los registros de pagos y remuneraciones son de solo lectura para las colaboradoras.
5. Ninguna colaboradora puede modificar tarifas, roles, permisos o configuraciones generales.
6. Los movimientos históricos sensibles no pueden ser alterados arbitrariamente.
7. Los usuarios anónimos no tienen acceso a información empresarial.
8. Las operaciones administrativas requieren autorización verificada del lado del servidor.
9. No confiar en identificadores de usuario enviados desde el navegador como prueba de propiedad.
10. No exponer claves privilegiadas en el cliente.

Evitar que una colaboradora pueda modificar datos de otra mediante alteración manual de parámetros o solicitudes HTTP.

Implementar funciones auxiliares seguras de verificación de rol.

Evitar políticas recursivas.

Las funciones SECURITY DEFINER, cuando sean indispensables, deberán:

- Tener un propósito documentado.
- Fijar un search_path seguro.
- Utilizar nombres de objetos calificados por esquema.
- Verificar explícitamente identidad y permisos.
- Tener permisos EXECUTE limitados.
- No permitir elevación de privilegios.

La clave administrativa de Supabase solamente podrá utilizarse en un entorno de servidor controlado y nunca deberá ser accesible desde el navegador.

Crear pruebas de seguridad que verifiquen explícitamente casos permitidos y denegados para cada rol.

---

## 18. Integridad y concurrencia

Las operaciones importantes deben ejecutarse mediante transacciones PostgreSQL.

Casos obligatorios:

- Registrar una compra y confirmar ingreso de stock.
- Transferir materiales.
- Confirmar recepción.
- Registrar producción y descontar insumos.
- Registrar transformaciones de varillas.
- Generar remuneración.
- Registrar pago.
- Revertir operaciones incorrectas.

Evitar condiciones de carrera.

Ejemplo: si dos solicitudes intentan consumir simultáneamente las últimas 100 unidades de un material, solamente deben confirmarse las operaciones que puedan respaldarse con existencias suficientes.

Utilizar bloqueo de registros, restricciones y estrategias de concurrencia apropiadas.

Implementar idempotencia para operaciones susceptibles de reintentos.

No permitir que un doble clic o una repetición de solicitud duplique producciones, pagos o movimientos de stock.

---

## 19. Configuración administrativa

Crear una sección para administrar:

- Nombre del emprendimiento.
- Moneda.
- Rendimiento de pegamento.
- Peso y equivalencias de varillas.
- Rendimiento de fibra de vidrio.
- Recetas por producto.
- Tarifas de colaboradoras.
- Stocks mínimos.
- Categorías financieras.
- Unidades de medida.

Valores iniciales:



- Pegamento: 250 g por pote.
- Consumo: 3 g por pluma.
- Varilla holográfica: 600 unidades por kg.
- Fibra de vidrio: 3 segmentos por varilla.

Estos valores deben almacenarse en la base de datos y poder modificarse desde la interfaz.

No deben permanecer como constantes inmodificables dentro del código.

Los cambios de configuración no deberán modificar retrospectivamente los movimientos confirmados.

---

## 20. Pruebas

Crear pruebas automatizadas para los principales cálculos y reglas.

Escenarios mínimos:

1. Una compra de 5 kg de varillas holográficas representa aproximadamente 3.000 unidades con la equivalencia inicial.
2. La fabricación de 100 plumas requiere aproximadamente 300 gramos de pegamento.
3. La fabricación de 300 plumas requiere aproximadamente 900 gramos de pegamento.
4. Una varilla original de fibra produce tres segmentos.
5. Una transferencia entre ubicaciones no altera el inventario total.
6. Registrar producción descuenta materiales una sola vez.
7. Registrar producción actualiza los pendientes de fabricación.
8. No se puede consumir stock inexistente.
9. Una colaboradora no puede consultar producción de otra.
10. Una colaboradora no puede modificar su remuneración.
11. Los pagos parciales reducen correctamente el saldo por cobrar.
12. Modificar una tarifa no altera remuneraciones históricas.
13. Registrar una seña no duplica ingresos al registrar la venta.
14. Reintentar una operación confirmada no la duplica.
15. Las operaciones fallidas no dejan movimientos incompletos.

Agregar pruebas de integración y de políticas RLS.

---

## 21. Experiencia de usuario

La aplicación debe contar con:

- Pantalla de inicio de sesión.
-
- Dashboard según rol.
- Formularios claros y validados.
- Buscadores y filtros.
- Tablas con paginación.
- Estados vacíos.
- Notificaciones de éxito y error.
- Confirmaciones para acciones sensibles.
- Alertas de materiales insuficientes.
- Fechas y montos localizados para Argentina.
- Interfaz responsive.
- Accesibilidad básica de teclado y lectores de pantalla.

Preparar exportaciones CSV de inventario, producción, pagos y pedidos.

Priorizar facilidad de uso para las colaboradoras, evitando formularios extensos.

---

## 22. Despliegue Vercel + Supabase

Preparar el proyecto para GitHub y Vercel.

Entregar:

- Código fuente completo.
- package.json con scripts funcionales.
- Archivo .env.example sin credenciales.
- Migraciones SQL.
- Políticas RLS.
- Datos iniciales de configuración.
- Procedimiento seguro de creación del primer administrador.
- README técnico.
- Instrucciones de Supabase.
- Instrucciones de despliegue en Vercel.
- Configuración de URL de autenticación y redirecciones.
- Guía de uso para administrador y colaboradoras.

No incluir credenciales reales ni datos sensibles en el repositorio.

Verificar que el proyecto compile y que el despliegue en Vercel sea compatible con las funcionalidades implementadas.

---

## 23. Orden de implementación

Dividir el trabajo en fases funcionales.

### Fase 1 — Fundamentos

- Inicialización de proyecto.
- Arquitectura.
- Supabase.
- Migraciones.
- Autenticación.
- Roles.
- RLS.
- Diseño principal.

### Fase 2 — Inventario

- Materiales.
- Proveedores.
- Compras.
- Conversiones.
- Ubicaciones.
- Movimientos.
- Transferencias.

### Fase 3 — Producción

- Productos.
- Recetas.
- Asignaciones.
- Registro diario.
- Consumo automático.
- Entregas terminadas.

### Fase 4 — Colaboradoras

- Portal personalizado.
- Materiales disponibles.
- Producción pendiente.
- Tarifas.
- Remuneraciones.
- Pagos.

### Fase 5 — Pedidos y finanzas

- Clientes.
- Pedidos.
- Cobros.
- Gastos.
- Costos.
- Rentabilidad.

### Fase 6 — Estadísticas y estabilización

- Dashboard completo.
- Gráficos.
- Alertas.
- Exportaciones.
- Pruebas.
- Auditoría.
- Documentación y despliegue.

Cada fase debe dejar funcionalidades operativas y verificables.

No avanzar acumulando interfaces incompletas o simulaciones sin conexión a la base de datos.

---

## 24. Entregables y criterios de aceptación

El sistema estará listo para su primera utilización cuando el administrador pueda:

1. Crear cuatro colaboradoras.
2. Registrar los materiales que tiene disponibles.
3. Registrar compras de tela, pegamento y varillas.
4. Ver conversiones de kilogramos y potes.
5. Entregar materiales a las colaboradoras.
6. Crear lotes de producción.
7. Consultar las cantidades pendientes.
8. Ver la producción declarada.
9. Controlar el consumo y el stock.
10. Configurar tarifas y registrar pagos.
11. Registrar pedidos y cobros.
12. Consultar gastos e ingresos.
13. Visualizar los indicadores principales.

Y cada colaboradora pueda:

1. Iniciar sesión.
2. Ver su producción pendiente.
3. Consultar materiales disponibles.
4. Registrar plumas fabricadas.
5. Confirmar materiales recibidos.
6. Consultar remuneraciones acumuladas.
7. Consultar pagos y saldo pendiente.
8. Utilizar el sistema desde un celular.

Todas estas operaciones deben persistir correctamente en Supabase y cumplir las políticas RLS.

---

## 25. Instrucciones de trabajo para Codex

Antes de implementar:

1. Revisar el repositorio y su estado.
2. Diseñar la arquitectura y el esquema relacional.
3. Identificar dependencias entre módulos.
4. Documentar decisiones y supuestos relevantes.
5. Elaborar un plan de implementación.

Después, implementar el proyecto de manera incremental.

No limitarse a explicar cómo se programaría: crear realmente los archivos, migraciones, componentes, rutas, funciones y pruebas.

Cuando falte un dato comercial, utilizar valores configurables o marcarlo como pendiente, evitando inventar información definitiva.

No inventar compras, producciones ni pagos reales.

Los ejemplos de prueba deben estar claramente separados de los datos de producción.

No declarar una fase terminada sin haber ejecutado las verificaciones aplicables.

En cada fase informar:

- Qué se implementó.
- Qué archivos se crearon o modificaron.
- Qué migraciones deben ejecutarse.
- Qué pruebas se realizaron.
- Qué funcionalidades quedan pendientes.
- Qué decisiones necesitan confirmación del propietario.

**Comenzá diseñando la arquitectura técnica, el modelo de datos y las reglas de seguridad. Luego implementá la primera fase sobre el repositorio existente o inicializá el proyecto si está vacío.**

La prioridad absoluta es construir una plataforma segura, coherente y ampliable, con especial atención a la trazabilidad de inventario, el trabajo de las colaboradoras y la integridad de la información financiera.
