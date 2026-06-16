# Dashboard Escuela de Pregrado FACGOB

Dashboard estático para visualizar matrícula y titulaciones de Administración Pública y Ciencia Política.

## Fuente esperada

El tablero está preparado para cargar un Excel con dos hojas:

- `Matricula 2026 a 2016`
- `Titulados`

## Decisión de privacidad

El repositorio público no incluye el Excel original, porque contiene nombres, RUT y correos.  
El archivo se carga manualmente desde el navegador y se procesa localmente.

## Filtro clave

Todos los reportes de matrícula consideran la columna:

```text
descripcion
```

Este campo funciona como filtro global. No se usa como eje X/Y ni como gráfico independiente.

## Reportes incluidos

- Matrícula total por año.
- Matrícula nueva por año, usando `TIPO = NUEVO/A`.
- Matrícula por región de origen.
- Matrícula por tipo de ingreso, por ejemplo PACE, ingreso regular u otras vías registradas en la base.
- Matrícula por carrera.
- Titulados/as por año.

## Región de origen

El tablero usa `REGION`. Cuando viene vacía o como `0`, usa `REGION PSU` como respaldo y la convierte a nombre de región.

## Nota sobre titulados

La hoja `Titulados` puede tener una fila por estudiante/profesor/rol de comisión.  
Para evitar sobreconteo, el tablero deduplica por:

```text
MATRICULA + RUT + FECHA_RESOLUCION
```

## Publicación en GitHub Pages

URL esperada:

```text
https://raulrojastaborga-conejo.github.io/perfil-estudiantes-gobierno-2026/escuela-pregrado-dashboard/
```

## Archivos

```text
index.html
styles.css
app.js
docs/diccionario-datos.md
```
