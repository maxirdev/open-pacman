# SPEC 02 — Corrección de la salida de fantasmas de la pen

> **Status:** Aprobado
> **Depends on:** SPEC 01
> **Date:** 2026-08-06
> **Objective:** Corregir el bug por el que los fantasmas liberados se mueven pero nunca terminan de salir de la pen, y evitar que, una vez fuera, vuelvan a entrar a la cárcel o la puerta.

## Scope

**In:**

- Corregir la lógica de salida de la pen en `src/js/game.js` (`moveGhost`).
- Impedir que el AI de `decideGhost` elija entrar a la cárcel o a la puerta (reentrada).
- Aplicar esa guarda a todas las ramas de `decideGhost`, incluida la por defecto (aleatoria).

**Out of scope (para futuros specs):**

- Ciclos scatter/chase.
- Estados nuevos de fantasma (p. ej. `leaving`) o cambios de modelo de datos.
- Cambios en el render o en la geometría del laberinto.
- Power pellets / modo asustado.

## Data model

No se añaden campos nuevos al estado del fantasma. Solo lógica nueva en `src/js/game.js`:

```js
// Pen interior + fila de la puerta (y=12). Celda "vedada" para la reentrada.
function isPenArea( x, y ) {
  return x >= 13 && x <= 14 && y >= 12 && y <= 15;
}
```

## Implementation plan

1. **game.js — helper:** añadir `isPenArea( x, y )` (pen + puerta) y reutilizarlo en `moveGhost` y `decideGhost`.
2. **game.js — salida (C):** en `moveGhost`, mientras el fantasma liberado esté dentro de la pen **o** en la fila de la puerta (`y === 12`), forzar `dir = 'up'` y devolver sin `decideGhost`, hasta quedar por encima de la puerta (`y < 12`). Así arranca su AI desde una celda de suelo, no sobre la puerta.
3. **game.js — no reentrada (A):** en `decideGhost`, filtrar de `options` toda dirección cuyo destino `(g.x + d.x, g.y + d.y)` cumpla `isPenArea`, para que el AI nunca elija voluntariamente volver a la pen/puerta. Aplicar en todas las ramas (personalidades y `default`).
4. **game.js — fallback:** si el filtro vacía `options`, mantener el fallback existente (giro de 180° / `OPPOSITE`).
5. **Verificación manual:** abrir `src/index.html`, jugar y comprobar los criterios de aceptación.

## Acceptance criteria

- [ ] Los 4 fantasmas salen de la pen en su turno de liberación y quedan circulando libremente.
- [ ] Ningún fantasma, una vez fuera, vuelve a entrar a la cárcel o a la puerta persiguiendo a Pac-Man hacia abajo.
- [ ] `decideGhost` sigue respetando la personalidad de cada fantasma (hunter/ambusher/flanker/wanderer).
- [ ] La guarda de pen/puerta aplica también a la rama por defecto (aleatoria).
- [ ] No se añaden campos nuevos al estado; `createGame()` y `resetPositions()` no cambian su contrato.
- [ ] `MAZE` original permanece pristino.
- [ ] `update()` y `draw()` siguen expuestos en `window`; el bucle de `main.js` funciona sin cambios.

## Decisions

- **Yes:** Estrategia A + C: forzar salida hasta suelo seguro **y** prohibir reentrada en `decideGhost`. Doble protección y salida determinista.
- **Yes:** Guarda de pen/puerta en todas las ramas. Coherencia total, evita casos raros con la rama aleatoria.
- **Yes:** Solo lógica, sin campo de estado nuevo. Cambio mínimo y fácil de revertir.
- **Yes:** Filtrar por celda destino `isPenArea`, no por dirección. Más preciso y robusto ante cambios de geometría.
- **No:** Estado `leaving` guionizado. Más fiel al Pac-Man real, pero innecesario y añade estados que mantener.
- **No:** Solo extender `inPen` (C a secas). El fantasma saldría pero podría reentrar después.

## What is **not** in this spec

- Scatter/chase y estados nuevos de fantasma.
- Cambios de render o geometría.
- Power pellets / modo asustado.
