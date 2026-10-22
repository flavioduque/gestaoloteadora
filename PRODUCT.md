# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Dirección / dueño de la loteadora**: sigue inventario, ventas, caja y alertas; decide precios, aprueba excepciones.
- **Administración financiera**: registra pagos, concilia el extracto bancario, gestiona cobranza y mora.
- **Asesores comerciales (corredores)**: atienden prospectos, agendan visitas, reservan lotes; trabajan tanto en la oficina como en el loteamiento.

Los tres pasan horas por día en el sistema. Propietarios (compradores) acceden a un portal propio, de uso esporádico. Auditoría interna consulta en modo lectura.

## Product Purpose

LotIA es un SaaS de gestión para loteadoras (desarrolladoras de loteos): inventario de lotes sobre el plano, CRM comercial, reservas con bloqueo del lote, contratos con plan de financiación, cartera y cobranza, conciliación bancaria, portal del propietario y auditoría. Éxito: la loteadora deja de operar con planillas sueltas y cada lote, contrato y cuota queda trazable en un solo lugar.

## Positioning

Un sistema operativo para la loteadora: cada módulo abre como una ventana en un escritorio, varias fichas (lote, prospecto, cuenta) conviven lado a lado, y las cifras ejecutivas se calculan con reglas explícitas y auditables, no estimadas por un modelo. El nombre "LotIA" anuncia asistencia inteligente; las funciones de IA todavía no están definidas (ver Capabilities).

## Operating Context

- Uso por igual en computadora de oficina (pantallas grandes, muchas ventanas, sesiones largas) y en celular en el loteamiento (visitas, consulta rápida de disponibilidad y precio).
- Documentos y rituales reales del rubro: plano de mensura, ficha comercial del lote, seña/reserva de 7 días, contrato de compraventa con escribanía, plan de cuotas (sistema francés o cuota fija), extracto bancario, promesa de pago.
- Moneda de la demo: USD; mercado de la demo: Paraguay (teléfonos +595, SIFEN como facturación electrónica futura).

## Capabilities and Constraints

- Implementado (demo, React + TypeScript + Vite, sin backend, estado en localStorage): Dirección, Masterplan, Comercial, Reservas y contratos, Finanzas y cobranza, Agenda, Expedientes, Propietarios, Portal del propietario, Consultas, Auditoría, Sistema, Configuración; 6 roles con permisos.
- Interfaz en español (voseo rioplatense/paraguayo, como la demo de referencia).
- Modelo de escritorio: barra de menú, dock, ventanas que se mueven/redimensionan/encajan, buscador global, centro de alertas.
- **Abierto**: qué hace la "IA" de LotIA (asistente, predicción de mora, sugerencias); backend y autenticación reales; multi-empresa (tenants) del SaaS.

## Brand Commitments

- Nombre del producto: **LotIA** (marca propia del SaaS).
- **Viva Lago Country** es un cliente de demostración con datos ficticios (mock), no la marca del sistema.
- El usuario rechazó explícitamente el visual de la demo de referencia (serif Marcellus, paleta azul-lago/marfil/latón, tablas y tarjetas tradicionales) por "ridículo". No reutilizarlo.
- El usuario exige formato "sistema operativo".

## Evidence on Hand

- Demo de referencia: https://viva-lago-country-sistema.vercel.app/ (lógica de negocio válida; visual descartado).
- Datos de la demo: generados por `src/domain/seed.ts`, todos ficticios. No hay clientes, testimonios, precios del SaaS ni métricas reales; no inventarlos.

## Product Principles

1. Cada cifra muestra de dónde sale: período, definición y fuente.
2. Nada se edita ni se borra en silencio: correcciones con reversión, motivo y auditoría.
3. Cada rol ve solo lo que le corresponde.
4. Lo urgente se ve primero: alertas, vencimientos y mora antes que el detalle.
5. Igual de útil en la oficina que en el loteamiento.
