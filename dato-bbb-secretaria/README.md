# Dato BBB Secretaria

Pagina experimental para centralizar productos BBB.

Categorias:

- Ropa casual
- Ropa de vestir
- Make up
- Productos capilares

Cada producto muestra:

- foto
- nombre
- tienda de origen
- precio actual
- precio anterior
- descuento
- estrellas Bueno, Bonito y Barato
- puntaje BBB total
- boton para ir a la oferta original

Archivos principales:

- `index.html`: estructura de la pagina
- `style.css`: diseno visual
- `app.js`: filtros y tarjetas
- `data/productos.json`: productos mostrados
- `scripts/actualizar_productos.py`: actualizador experimental desde Mercado Libre Chile

Formula BBB inicial:

`BBB = Bueno 40% + Barato 40% + Bonito 20%`

El workflow `.github/workflows/dato-bbb.yml` queda disponible para actualizar el archivo de productos todos los dias o de forma manual.
