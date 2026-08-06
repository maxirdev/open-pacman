# SPEC 01 — 4 fantasmas con personalidades distintas

> **Status:** Aprobado
> **Depends on:** —
> **Date:** 2026-08-05
> **Objective:** Ampliar a 4 fantasmas con comportamientos clásicos distintos (caza, emboscada, flanqueo, errante) y salida escalonada de la cárcel por temporizador.

## Scope

**In:**

- Ampliar `GHOST_STARTS` de 2 a 4 fantasmas en `src/js/maze.js`.
- 4 comportamientos distintos basados en los clásicos: `hunter` (persecución directa), `ambusher` (4 casillas delante de Pac-Man), `flanker` (vector Blinky→Pac-Man invertido), `wanderer` (persigue lejos / huye cerca).
- Liberación escalonada desde la pen por temporizador (~5 s entre cada salida).
- Lógica de salida de la pen: mientras el fantasma está dentro, fuerza `dir = 'up'` hasta quedar por encima de la puerta.
- Render distinto por fantasma en `src/js/render.js`: color propio + forma ligeramente diferenciada (`hunter` puntiagudo, `ambusher` con flecha, `flanker` con aletas, `wanderer` redondeado).

**Out of scope (para futuros specs):**

- Power pellets y modo asustado (comer fantasmas).
- Ciclos scatter/chase.
- Velocidad variable por fantasma o por nivel.
- Personalización de IA o debug de rutas.
- Música/sonidos por fantasma.

## Data model

```js
// src/js/maze.js — GHOST_STARTS pasa de 2 a 4, en el orden de liberación.
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'hunter' },   // liberado en t=0
  { x: 14, y: 14, kind: 'ambusher' }, // t≈5s
  { x: 13, y: 15, kind: 'flanker' },  // t≈10s
  { x: 14, y: 15, kind: 'wanderer' }, // t≈15s
];

// src/js/game.js — nuevos campos en cada ghost y constantes.
const RELEASE_GAP = 300; // frames entre liberaciones (~5 s a 60 fps)

// Cada ghost del state ganará:
//   released: false,          // ¿está fuera de la pen?
//   releaseAt: i * RELEASE_GAP // frame en que se libera
```

No hay nueva persistencia. El estado de partida sigue en memoria, reiniciado por `createGame()`.

## Implementation plan

1. **Maze:** ampliar `GHOST_STARTS` a 4 entradas con los `kind` anteriores en `src/js/maze.js`. Sin tocar la geometría ni `MAZE`.
2. **game.js — datos:** en `createGame()`, extender el mapeo de `ghosts` para añadir `released: false` y `releaseAt: i * RELEASE_GAP`. Declarar la constante `RELEASE_GAP`.
3. **game.js — liberación:** en `update()`, antes de `moveGhost`, recorrer `game.ghosts` y, si `!released` y `game.frame >= releaseAt`, poner `released = true`. Añadir contador `game.frame` (incrementado cada `update`).
4. **game.js — salida de pen:** en `moveGhost`, si el fantasma no está `released`, no moverlo (queda dentro). Si está `released` pero sigue dentro de la pen (y entre 12 y 15 y x entre 13 y 14), forzar `dir = 'up'` y devolver tras mover (sin `decideGhost`). Una vez por encima de la puerta (y < 12), comportamiento normal.
5. **game.js — decideGhost:** reemplazar la rama única `hunter` con un `switch (g.kind)`:
   - `hunter`: distancia Manhattan a `(round px, round py)`, elegir mín.
   - `ambusher`: objetivo = `pacman + 4 * dir`. Elegir la dirección que minimice la distancia al objetivo.
   - `flanker`: objetivo = `pacman.pos * 2 - blinky.pos` (Blinky = el fantasma `kind === 'hunter'`). Minimizar distancia al objetivo.
   - `wanderer`: si `dist(g, pacman) > 8`, igual que `hunter`; si no, maximizar distancia (huir).
   - Rama por defecto: aleatorio (igual que hoy).
6. **render.js — apariencia:** dibujar cada fantasma con color propio (`hunter` rojo, `ambusher` rosa, `flanker` cian, `wanderer` naranja) y una variación de forma menor por `kind`. Mantener el bucle existente; añadir un `switch` por `kind` dentro del draw de fantasma.
7. **Verificación manual:** abrir `src/index.html`, jugar, comprobar los 4 criterios de aceptación.

## Acceptance criteria

- [ ] `GHOST_STARTS` tiene 4 entradas con `kind` distintos (`hunter`, `ambusher`, `flanker`, `wanderer`).
- [ ] Al iniciar la partida solo el `hunter` está fuera de la pen; los demás salen escalonados ~5 s entre cada uno.
- [ ] `hunter` persigue directamente la celda de Pac-Man (no elige direcciones al azar cuando hay alternativa).
- [ ] `ambusher` se dirige hacia 4 casillas delante de Pac-Man según su `dir`.
- [ ] `flanker` apunta al punto simétrico de `hunter` respecto a Pac-Man.
- [ ] `wanderer` persigue a >8 casillas y huye a <8 casillas.
- [ ] Cada fantasma tiene color distinto y forma diferenciable en canvas.
- [ ] `MAZE` original permanece pristino (no se muta desde `game.js`).
- [ ] `update()` y `draw()` siguen expuestos en `window`; el bucle de `main.js` funciona sin cambios.

## Decisions

- **Yes:** 4 comportamientos clásicos. Conocidos, probados y describibles en 1 línea cada uno.
- **No:** Comportamientos inventados. Costaba más explicarlos y no aportaban valor de aprendizaje.
- **Yes:** Nombres `kind` inventados (`hunter`/`ambusher`/`flanker`/`wanderer`). Evitan confundirse con el lore clásico y describen la función.
- **No:** Nombres clásicos (`blinky`/`pinky`/`inky`/`clyde`). Más trivia, menos autoexplicativos.
- **Yes:** Solo modo persecución (sin scatter/chase). Keep it simple, coherente con el código actual.
- **No:** Scatter/chase. Duplica la complejidad; queda para otro spec.
- **Yes:** Liberación por temporizador fijo (~5 s). Predecible y fácil de ver.
- **No:** Liberación por dots comidos. Más opaco para depurar en esta fase.
- **Yes:** Forzar `dir='up'` para salir de la pen. Sin pathfinding, garantiza salida limpia.
- **No:** Pathfinding genérico. Overkill para una pen de 2×3.
- **Yes:** Power pellets fuera de scope. IA de 4 fantasmas ya es bastante para un spec.
- **No:** Incluir comer fantasmas ahora. Mezclaría spec de IA con spec de mecánica.

## What is **not** in this spec

- Power pellets y modo asustado.
- Ciclos scatter/chase.
- Velocidades variables por fantasma.
- Sonidos por fantasma.

Cada uno, si llega, va en su propio spec.