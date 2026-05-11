# Soporte para nueva plantilla (mayo 2026) — Retroactivo Salarial

Actualizacion del parser y la boleta para soportar el nuevo formato de planilla
introducido en mayo 2026 (PLANTILLA_MAYO.xlsx / hoja ABRIL).

## Cambios en la plantilla de origen

La nueva plantilla difiere del formato anterior en los siguientes puntos clave:

- **Columna A**: ahora contiene el marcador `ENCABEZADO` en la fila de titulos
  y el identificador de banco/planilla (`Planilla BAM`) en las filas de datos.
- **Columna F** renombrada: `BONIFICACIÓN DECRETO MENSUAL` → `BONIFICACIÓN INCENTIVO`
  (concepto distinto; el parser ya la excluia por la palabra "incentivo").
- **Columna H** renombrada: `TOTAL DEVENGADO` → `RETROACTIVO SALARIAL` (nuevo concepto).
- **Columnas O–R desplazadas**: `Renta Imponible` eliminada; ISR, Otros, Liquido y
  Bonificacion Decreto corrieron una posicion a la izquierda.
- **Columna U** nueva: `TOTAL PAGADO EN EL MES` (no capturada, solo referencia).
- Columnas eliminadas: PROYECTO, SALARIO ACTUAL/NUEVO, reconciliacion IGSS (AG/AH/AI),
  hojas BOLETAS y BOLETA DE PAGO.

## Parser (`excel-parser.ts`)

- Nuevo campo `retroactivo` en `FIELD_TARGETS`, apuntando a `"retroactivo salarial"`.
- `retroactivo` agregado a la interfaz `ReceiptData`.
- `totalIngresos` ahora incluye retroactivo: `salario + bonificacionEspecial + retroactivo`.
- Comportamiento confirmado: cuando dos columnas comparten el nombre
  `BONIFICACIÓN DECRETO MENSUAL`, el parser las suma (correcto por diseno).

## Boleta (`Receipt.tsx`)

- Nueva linea **Retroactivo Salarial** en la seccion INGRESOS, entre
  Bonificacion Decreto y TOTAL INGRESOS.
- La linea se oculta cuando el valor es Q 0.00 (empleados sin retroactivo
  o planillas del formato anterior).
- Aplica a todas las salidas: pantalla, PDF y impresion.

## Base de datos

- Nueva columna `retroactivo NUMERIC(12,2) NOT NULL DEFAULT 0` en la tabla `receipts`.
- El insert desde `DashboardClient.tsx` incluye el campo.
