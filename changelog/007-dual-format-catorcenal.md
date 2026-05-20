# Soporte para dos formatos de planilla (catorcenal IGSS)

La app ahora reconoce dos formatos de archivo Excel y elige el parser
correcto automaticamente. Se agrega soporte para planillas con formato
**catorcenal IGSS** (periodo de 14 dias) ademas del formato mensual
existente.

## Auto-deteccion de formato

- Al cargar el archivo, la app detecta el formato sin intervencion
  del usuario y muestra un banner verde:
  `✓ Formato detectado: <nombre> · Hoja: <hoja>`
- Si la deteccion falla, aparece una pantalla nueva (`FORMAT_PICK`)
  para elegir manualmente entre **Mensual** o **Catorcenal (IGSS)**.
- Boton "Cambiar formato" en la pantalla de confirmacion permite
  forzar otra seleccion.

## Formato nuevo: Catorcenal IGSS

- Hoja de datos: `MENU`.
- Encabezado en fila 9 (una sola fila, sin marcador `ENCABEZADO`).
- Filas de datos desde la fila 10 hasta la primera sin ordinal.
- Mapeo de columnas:
  - B → No. ordinal
  - C → Nombre
  - D → Puesto
  - J → Salario devengado
  - K + L → Bonificacion decreto (suma de las dos columnas)
  - N → IGSS
  - O → ISR
  - P → Otros
- Sin concepto de Anticipo 1ra Quincena (el periodo es catorcenal,
  no quincenal).
- Sin concepto de Retroactivo Salarial.
- Totales (descuentos, liquido) siempre se calculan desde los
  componentes; los totales provistos por la planilla (cols Q y R)
  se ignoran intencionalmente.

## Boletas

- La linea **Anticipo 1ra Quincena** se muestra siempre en las
  boletas del formato mensual (incluso si el valor es Q 0) y no
  aparece nunca en las catorcenales (el formato no tiene quincena).
- **Envio por correo** queda deshabilitado para lotes catorcenales.
  Solo aplica al formato mensual. Las opciones "Exportar juntos" y
  "Exportar separados" siguen disponibles para ambos formatos.

## Arquitectura

- Patron adapter en `excel-parser.ts`: dos adaptadores
  (`mensualAdapter`, `catorcenalAdapter`) detras de un dispatcher
  (`parseWorkbook`).
- `detectFormat(wb)` exportado para que la UI muestre el banner antes
  de procesar.
- `parseWorkbook(wb, { formatId, sheetName })` permite forzar el
  adaptador y la hoja (usado en la ruta manual).

## Detalles tecnicos

- Heuristica de deteccion catorcenal: la hoja `MENU` existe Y la
  celda `B4` empieza con "planilla igss" (case-insensitive,
  sin acentos).
- Heuristica de deteccion mensual: alguna hoja tiene el marcador
  `ENCABEZADO` en columna A dentro de las primeras 30 filas.
- El parser de fecha (`parseLastDate`) acepta ahora la forma
  "DEL 2026" ademas de la forma corta "2026".

## Documentos relacionados

- [`REFACTOR_DUAL_FORMAT.md`](../REFACTOR_DUAL_FORMAT.md) — plan completo
- [`REFACTOR_PROGRESS.md`](../REFACTOR_PROGRESS.md) — bitacora de
  implementacion
