# Diccionario de datos — Dashboard Escuela de Pregrado

## Hoja `Matricula 2026 a 2016`

Campos usados por el tablero:

| Campo | Uso |
|---|---|
| `AÑO MATRICULA` | Año de matrícula. |
| `carrera` | Carrera. Se limpia el código inicial cuando viene como `40 ADMINISTRACIÓN PÚBLICA`. |
| `descripcion` | Filtro central de matrícula. |
| `SEXO` | Filtro demográfico. |
| `TIPO` | Nuevo/a o antiguo/a, según la base. |
| `TIPO INGRESO` | Tipo de ingreso. |
| `TIPO ESTABLECIMIENTO` | Tipo de establecimiento de origen. |
| `Cohorte` | Cohorte. |

## Hoja `Titulados`

Campos usados por el tablero:

| Campo | Uso |
|---|---|
| `MATRICULA` | Parte de la llave de deduplicación. No se muestra. |
| `RUT` | Parte de la llave de deduplicación. No se muestra. |
| `FECHA_RESOLUCION` | Año de titulación y parte de la llave de deduplicación. |
| `CARRERA` | Carrera. |
| `SEXO` | Filtro demográfico. |
| `COHORTE` | Cohorte. |
| `ESTADO` | Estado. |
| `TESIS` | Tipo de actividad final/examen/tesis. |
| `NOTA_FINAL` | Promedio por año/carrera cuando existe dato. |

## Regla metodológica

La hoja `Titulados` puede contener varias filas por estudiante, porque registra profesores o roles de comisión. Para evitar sobreconteo, el dashboard deduplica por:

```text
MATRICULA + RUT + FECHA_RESOLUCION
```

## Regla de privacidad

El Excel se procesa localmente en el navegador. El repositorio no almacena nombres, RUT, correos ni la base original.
