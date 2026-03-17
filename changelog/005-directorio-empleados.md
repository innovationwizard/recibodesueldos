# Directorio de empleados

Nueva seccion para gestionar el listado de personal.

## Pagina de gestion (/empleados)
- Importacion de Excel con columnas: nombre, correo, empresa
- Vista previa con validacion de correos antes de guardar
- Tabla con edicion inline de correos
- Activar/desactivar empleados (rotacion de personal)
- Filtro por empresa
- Eliminacion de registros

## Auto-match en envio de correos
- Al enviar boletas, el sistema busca automaticamente los correos en el directorio segun la empresa de la planilla
- Ya no es necesario cargar un archivo de mapeo cada vez
- Opcion de fallback a carga manual si no hay coincidencias

## Base de datos
- Tabla `employees` con RLS y politicas CRUD
- Constraint unico por (usuario, empresa, nombre)
- Campo `is_active` para soft-delete

## Navegacion
- Boton "Empleados" en el header del dashboard
- Link cruzado entre dashboard y directorio
