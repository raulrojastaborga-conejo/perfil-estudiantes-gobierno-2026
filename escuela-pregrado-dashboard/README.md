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

Este filtro permite seleccionar todos, uno, varios o ninguno de los tipos de matrícula.

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
