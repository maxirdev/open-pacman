# AGENTS.md

Juego Pac-Man en vanilla JS (HTML + CSS + canvas). Sin build, sin bundler, sin `package.json`, sin tests, sin linter. Proyecto de aprendizaje para Spec Driven Development.

## Cómo ejecutar

Abrir `src/index.html` directamente en el navegador. No hay servidor de desarrollo ni paso de build. Los cambios se ven recargando la página.

## Arquitectura

- `src/index.html` carga los scripts en **orden estricto** mediante `<script>` clásicos (sin módulos): `maze.js → game.js → render.js → main.js`.
- Comunicación entre archivos **por globales** expuestos en `window`: `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS` (maze.js); `createGame`, `update`, `DIRS` (game.js); `draw` (render.js). No romper estos nombres al renombrar.
- `main.js` contiene el bucle (`requestAnimationFrame`), teclado y overlay. Llama a `createGame()`, `update(game)` y `draw(ctx, game, frame)`.
- El laberinto (`maze.js`) son 31 strings de 28 chars parseados a números. Leyenda de símbolos: `#`=pared(1), `.`=dot(2), ` `-vacio(0), `-`=puerta(3). Coordenadas (x,y) con origen arriba-izquierda, x∈[0,27], y∈[0,30]. Simétrico respecto al eje entre cols 13 y 14.
- `MAZE` numérico es **pristino**: `createGame()` lo copia para mutar dots sin alterar el original. No mutar `MAZE` directamente.
- Reglas de movimiento sutiles: los fantasmas atraviesan la puerta de la cárcel (3) pero Pac-Man no. El túnel está en la fila 14 (extremos abiertos). Velocidades: Pac-Man 1/8 celda/frame, fantasmas 1/10; el alineamiento entre celdas depende de esos valores.
- `render.js` dibuja sobre canvas usando `game.grid` (no `MAZE`) para reflejar dots ya comidos. `TILE=20` pixeles por celda.

## Convenciones de código

- Estilo: comillas simples, espacios dentro de `( ... )` y `[ ... ]`, sin punto y coma. Mantenlo al editar.
- Comentarios del código y literales de UI en **español**.

## Workflow: Spec Driven Development

Este repo practica desarrollo guiado por specs. Usa los comandos `/spec` y `/spec-impl` (skills en `.agents/skills/`).

- Las specs viven en `specs/` como `NN-slug.md` (p. ej. `01-mvp-arkanoid.md`).
- `/spec-impl` solo avanza si el campo `**Estado:**` / `**Status:**` del spec **significa "Approved"** (`Aprobado`, `Approved`, etc.). Cualquier otro valor (`Draft`/`Borrador`, `En revisión`) detiene la implementación.
- `/spec-impl` crea/switch a la rama `spec-NN-slug` (ej. `spec-01-mvp-arkanoid`) por defecto (`AutoCreateBranch: true`), configurable en `specs/.spec-config.yml`.
- Implementar paso a paso según el plan del spec, pausando tras cada paso para que el usuario revise el diff. **Nunca commitear automáticamente**; el commit lo decide el usuario. Cuando el usuario pida algo fuera del scope del spec, sugerir dejarlo para el siguiente spec en lugar de implementarlo.
- Al terminar, verificar los criterios de aceptación y (si pasan) marcar el estado del spec como `Implemented`/`Implementado`.

No hay snapshots ni fixtures de tests porque no hay suite de tests.