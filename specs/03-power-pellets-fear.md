# SPEC 03 — Power Pellets y modo Fear

> **Status:** Aprobado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-08-06
> **Objective:** Añadir 4 power pellets en los extremos del laberinto que, al ser comidos, activan durante 5 s el modo Fear: Pac-Man un 25% más rápido y los fantasmas un 50% más lentos huyendo, pudiendo ser devueltos a la jaula al tocarlos.

## Scope

**In:**

- 4 power pellets en las celdas `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)` (hoy dots), con nuevo tile `4` en `MAZE` y símbolo de maze `o`.
- Al comer un pellet: activa un temporizador global de 5 s, Pac-Man +25% velocidad, fantasmas liberados entran en estado `frightened` (azul oscuro, 50% más lentos, huyen de Pac-Man) e invierten su dirección.
- Comer a un fantasma en Fear suma 200 pts y lo devuelve a la jaula (teleporte) con `released=false` y temporizador de salida rearrancado; el fantasma vuelve a normal.
- Al agotarse el temporizador, todos los fantasmas y Pac-Man vuelven a su estado normal.
- El pellet consumido desaparece (celda a `0`).
- Render: power pellet con color representativo y parpadeo; fantasmas en Fear en azul oscuro.

**Out of scope (para futuros specs):**

- Ciclos scatter/chase.
- Velocidades variables por fantasma o por nivel.
- Puntos de fruta/bonus.
- Puntos que escalan con cada fantasma comido en la misma ráfaga (siempre 200).

## Data model

```js
// src/js/maze.js — leyenda: 'o' = power pellet (4). parseTile: 'o' -> 4.
// Las filas 3 y 23 pasan su '.' en (1,3), (26,3), (1,23), (26,23) a 'o'.

// src/js/game.js — constantes nuevas.
const POWER_PELLET_DURATION = 300; // frames (5 s a 60 fps)
const FEAR_PACMAN_MULT = 1.25;     // Pac-Man: 0.0625 * 1.25
const FEAR_GHOST_MULT = 0.5;       // Fantasmas: 0.05 * 0.5

// createGame() gana:
//   game.fearTimer: 0        // frames restantes de Fear
//   cada ghost gana:
//     g.frightened: false    // ¿en estado Fear?

// Velocidad efectiva (se fija en update()):
//   p.speed = fearTimer > 0 ? PACMAN_SPEED * 1.25 : PACMAN_SPEED
//   g.speed = g.frightened  ? GHOST_SPEED * 0.5  : GHOST_SPEED
```

Notas de integración:

- `dotsRemaining` cuenta tanto `2` como `4` (ambos se comen y decrementan), para que la condición de victoria siga siendo alcanzable.
- La guarda de pen/puerta de SPEC 02 se mantiene intacta en Fear: ni Pac-Man ni fantasmas entran a la jaula; solo entran por el teleporte de ser comidos.
- Sin nueva persistencia; estado en memoria reiniciado por `createGame()`.

## Implementation plan

1. **maze.js:** en `MAZE_STR`, reemplazar por `o` los `.` de `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)`. Añadir `'o' -> 4` en `parseTile` y actualizar el comentario de leyenda.
2. **game.js — constantes y estado:** añadir `POWER_PELLET_DURATION`, `FEAR_PACMAN_MULT`, `FEAR_GHOST_MULT`. En `createGame()`, añadir `fearTimer: 0`, `g.frightened: false` por fantasma, y que el contador de `dotsRemaining` incluya el valor `4`.
3. **game.js — comer pellet:** en `movePacman`, si `grid[p.y][p.x] === 4`, poner la celda a `0`, `game.fearTimer = POWER_PELLET_DURATION`, y para cada fantasma `released` poner `frightened = true` e invertir dirección `dir = OPPOSITE[dir]`. Decrementar `dotsRemaining`.
4. **game.js — velocidades y cuenta atrás:** en `update()`, fijar `p.speed` y cada `g.speed` según los multiplicadores de Fear, decrementar `game.fearTimer` cada frame y, al llegar a `0`, limpiar `frightened` en todos los fantasmas.
5. **game.js — decidir en Fear:** en `decideGhost`, si `g.frightened`, fijar `flee = true` (maximizar distancia a Pac-Man) antes del `switch`, conservando la guarda de pen/puerta. Mantener sin cambios las personalidades.
6. **game.js — colisión:** en el bucle de colisiones de `update()`, si el fantasma está `frightened`: sumar 200 pts, teletransportarlo a su `GHOST_STARTS[i]`, `dir='up'`, `released=false`, `releaseAt = game.frame + RELEASE_GAP`, `frightened=false`; continuar (sin perder vida). Si no está en Fear: comportamiento actual (perder vida / reset).
7. **render.js:** dibujar el tile `4` como power pellet (radio mayor que el dot, p. ej. 6 px) con color representativo y parpadeo según `frame`. En `draw()`, elegir color del fantasma: `g.frightened ? FEAR_COLOR : GHOST_COLORS[kind]`, con `FEAR_COLOR` azul oscuro.
8. **Verificación manual:** abrir `src/index.html`, jugar y comprobar los criterios de aceptación.

## Acceptance criteria

- [ ] Existen 4 power pellets en `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)` representados con un color distinto y más grandes que los dots.
- [ ] Comer un pellet activa Fear durante 5 s y el pellet desaparece de la grilla.
- [ ] Durante Fear, Pac-Man se mueve a `0.0625 * 1.25` y los fantasmas liberados a `0.05 * 0.5`, dibujados en azul oscuro y huyendo de Pac-Man.
- [ ] Los fantasmas liberados invierten su dirección al activarse el Fear.
- [ ] Tocar a un fantasma en Fear suma 200 pts y lo devuelve a su celda inicial sin perder vida; el fantasma queda en `released=false` con `releaseAt` rearrancado y ya no azul.
- [ ] Al terminar los 5 s, todos los fantasmas y Pac-Man vuelven a su velocidad y estado normales.
- [ ] Los fantasmas en la pen nunca son comidos ni entran/salen por el teleporte durante Fear.
- [ ] Comer todos los dots y pelletes sigue disparando la condición de victoria (`state = 'won'`).
- [ ] `MAZE` original permanece pristino (solo cambia en la definición, no se muta en runtime).
- [ ] `update()` y `draw()` siguen expuestos en `window`; el bucle de `main.js` funciona sin cambios.

## Decisions

- **Yes:** 4 pellets en las celdas clásicas. Coherentes con la simetría y con el Pac-Man original.
- **Yes:** Tile nuevo `4` (símbolo `o`). Evita confundir power pellets con dots y con paredes/puertas.
- **Yes:** Temporizador global de 5 s (300 frames) compartido por los 4 pellets. Simple y coincidente con `RELEASE_GAP`.
- **Yes:** Ambos efectos a la vez (Pac-Man +25% y fantasmas -50%). Lo pidió explícitamente el usuario, aunque el Pac-Man original no acelere a Pac-Man.
- **Yes:** Fantasmas huyen maximizando distancia a Pac-Man, reutilizando la rama `flee` del `wanderer`. Sin nuevo pathfinding.
- **Yes:** Teleporte a la jaula al ser comido. Más simple que la animación de ojos; el fantasma vuelve a normal al volver.
- **Yes:** 200 pts fijos por fantasma comido. Valor clásico y sin estados extra.
- **No:** Animación de ojos camino a la jaula. Más fiel pero añade estados; queda para otro spec.
- **No:** Puntos escalados (200, 400, 800…). Requiere contador de ráfaga; fuera de scope.
- **Yes:** Mantener la guarda de pen/puerta de SPEC 02 durante Fear. Evita comportamientos raros y reentradas.
- **Yes:** `dotsRemaining` cuenta también los pelletes. Mantiene la condición de victoria alcanzable.
- **No:** Scatter/chase. No entra en este spec.

## Risks

| Riesgo                                           | Mitigación                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| Pellete comido justo cuando `fearTimer` se agota | La cuenta atrás y la activación se ordenan en `update()`; el timer se decrementa después de procesar la comida. |
| Fantasma en Fear devuelto a la jaula conservando `frightened` | En el paso 6 se fuerza `frightened=false` al teletransportar. |
| Dots no comibles por contar mal los pelletes      | `dotsRemaining` cuenta `2` y `4`; comer cualquiera lo decrementa. |

## What is **not** in this spec

- Ciclos scatter/chase.
- Velocidades variables por nivel.
- Puntos de fruta/bonus.
- Puntos escalados por ráfaga.
- Animación de ojos al volver a la jaula.

Cada uno, si llega, va en su propio spec.
