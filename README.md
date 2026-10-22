# Viva Lago OS

Sistema de gestión para el desarrollo inmobiliario **Viva Lago Country**, con interfaz de escritorio: barra de menú, dock, ventanas que se mueven, redimensionan, minimizan y se acomodan a media pantalla, buscador global y centro de alertas.

Basado en la demo [viva-lago-country-sistema.vercel.app](https://viva-lago-country-sistema.vercel.app/). Conserva su lógica de negocio y su identidad visual, y la lleva a un entorno multiventana.

## Ejecutar

```bash
npm install
npm run dev        # entorno de desarrollo
npm run build      # typecheck + build de producción en dist/
npm test           # motor de financiación, pruebas de integridad y consultas (sin navegador)
```

Es una demo con datos ficticios y sin backend. El estado se guarda en `localStorage` y se reinicia desde **Viva Lago → Reiniciar la demo**.

## Aplicaciones

| App | Qué hace |
|---|---|
| Dirección | Estado del negocio, alertas, inventario, caja, embudo y simulador de escenarios |
| Masterplan | Plano interactivo; cada lote abre su ficha en una ventana propia. Tiene modo comercial y comparación de hasta 3 lotes |
| Comercial | CRM con embudo, condiciones para avanzar de etapa, rendimiento y exportación CSV |
| Reservas y contratos | Reserva con control de concurrencia, formalización con plan de pagos y registro de firma |
| Finanzas y cobranza | Cartera y mora, libro inmutable, conciliación bancaria (importación CSV), cobranza y simulador |
| Agenda *(nueva)* | Visitas, vencimientos, promesas, cuotas y eventos internos en vista semana o mes |
| Expedientes *(nueva)* | Explorador de documentos por contrato y reserva, con carga versionada |
| Propietarios *(nueva)* | Bandeja de solicitudes del portal y publicación de comunicados |
| Portal del propietario | Lo que ve cada comprador: cuotas, pagos, comprobantes y solicitudes |
| Consultas | Preguntas ejecutivas calculadas con una definición explícita, con descarga CSV |
| Auditoría | Registro inmutable de acciones sensibles, con descarga CSV |
| Sistema | Pruebas de integridad, integraciones, automatizaciones y matriz de permisos |
| Configuración *(nueva)* | Tema claro/oscuro, categorías de riesgo, respaldo JSON y atajos |

El selector **Ver como** de la barra de menú cambia de rol: Dirección, Administración financiera, Gerencia comercial, Asesora, Auditoría o Propietario. Cada rol ve solo las apps y los datos que le corresponden.

## Atajos

- `Ctrl/⌘ + K`: buscar apps, lotes, prospectos y contratos.
- Doble clic en la barra de título: maximizar o restaurar.
- Arrastrar una ventana al borde izquierdo o derecho la acomoda a media pantalla; al borde superior, la maximiza.
- `Esc`: cerrar el diálogo, el buscador o las alertas.

## Estructura

```
src/domain/   reglas de negocio puras: tipos, catálogos, motor de financiación, datos demo, derivados, servidor simulado, consultas y pruebas
src/os/       escritorio: gestor de ventanas, ventana, dock, barra de menú, buscador, diálogos y avisos
src/apps/     una app por archivo, más las fichas (insp/) y los diálogos compartidos (dialogs/)
src/ui/       componentes compartidos: kit, plan de pagos, gráficos y embudo
src/styles/   base.css (lenguaje visual de la demo) y os.css (escritorio)
```
