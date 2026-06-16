# Diccionario de datos — Dashboard Escuela de Pregrado

## Hoja `Matricula 2026 a 2016`

Campos usados por el tablero:

| Campo | Uso |
|---|---|
| `AÑO MATRICULA` | Año de matrícula. |
| `carrera` | Carrera. Se limpia el código inicial cuando viene como `40 ADMINISTRACIÓN PÚBLICA`. |
| `descripcion` | Filtro central de matrícula. No se usa como gráfico ni como eje. |
| `SEXO` | Filtro demográfico. |
| `TIPO` | Identifica `NUEVO/A` o `ANTIGUO/A`. Se usa para calcular matrícula nueva por año. |
| `TIPO INGRESO` | Tipo de ingreso. Se usa como filtro y como gráfico. |
| `REGION` | Región de origen principal. |
| `REGION PSU` | Respaldo para región cuando `REGION` viene vacía o como `0`. |
| `TIPO ESTABLECIMIENTO` | Tipo de establecimiento de origen. Disponible para futuras vistas. |
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

## Reglas metodológicas

### Matrícula nueva

La matrícula nueva se calcula con registros cuya columna `TIPO` contiene `NUEVO`.

### Región de origen

La región se toma desde `REGION`. Si el valor está vacío, es `0` o no usable, se usa `REGION PSU` como respaldo y se convierte el código a nombre de región.

### Titulados/as

La hoja `Titulados` puede contener varias filas por estudiante, porque registra profesores o roles de comisión. Para evitar sobreconteo, el dashboard deduplica por:

```text
MATRICULA + RUT + FECHA_RESOLUCION
```

## Regla de privacidad

El Excel se procesa localmente en el navegador. El repositorio no almacena nombres, RUT, correos ni la base original.
