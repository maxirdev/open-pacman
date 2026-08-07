// render.js
// Dibujo arcade sobre canvas. Usa game.grid (no MAZE) para reflejar dots comidos.

const TILE = 20;
const WALL_COLOR = '#2121ff';
const DOOR_COLOR = '#ffb8ff';
const DOT_COLOR = '#ffb897';
const PELLET_COLOR = '#ffd700';
const FEAR_COLOR = '#0000cc';

function cellCenter( x, y ) {
  return { cx: x * TILE + TILE / 2, cy: y * TILE + TILE / 2 };
}

// Paredes estilo arcade: lineas finas redondeadas que conectan los centros
// de celdas-pared adyacentes. Produce el trazado continuo del original.
function drawWalls( ctx, grid ) {
  const H = grid.length;
  const W = grid[ 0 ].length;
  ctx.strokeStyle = WALL_COLOR;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for ( let y = 0; y < H; y++ ) {
    for ( let x = 0; x < W; x++ ) {
      if ( grid[ y ][ x ] !== 1 ) continue;
      const { cx, cy } = cellCenter( x, y );
      // Conectar solo hacia derecha y abajo evita trazos duplicados.
      if ( x + 1 < W && grid[ y ][ x + 1 ] === 1 ) {
        ctx.moveTo( cx, cy );
        ctx.lineTo( cx + TILE, cy );
      }
      if ( y + 1 < H && grid[ y + 1 ][ x ] === 1 ) {
        ctx.moveTo( cx, cy );
        ctx.lineTo( cx, cy + TILE );
      }
      // Celda-pared aislada (sin vecino): punto corto para que se vea.
      const lone =
        ( x + 1 >= W || grid[ y ][ x + 1 ] !== 1 ) &&
        ( x - 1 < 0 || grid[ y ][ x - 1 ] !== 1 ) &&
        ( y + 1 >= H || grid[ y + 1 ][ x ] !== 1 ) &&
        ( y - 1 < 0 || grid[ y - 1 ][ x ] !== 1 );
      if ( lone ) {
        ctx.moveTo( cx - 3, cy );
        ctx.lineTo( cx + 3, cy );
      }
    }
  }
  ctx.stroke();
}

function drawDoor( ctx, grid ) {
  const H = grid.length;
  const W = grid[ 0 ].length;
  ctx.strokeStyle = DOOR_COLOR;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for ( let y = 0; y < H; y++ ) {
    for ( let x = 0; x < W; x++ ) {
      if ( grid[ y ][ x ] !== 3 ) continue;
      const px = x * TILE;
      const py = y * TILE + TILE / 2;
      ctx.moveTo( px, py );
      ctx.lineTo( px + TILE, py );
    }
  }
  ctx.stroke();
}

function drawDots( ctx, grid ) {
  ctx.fillStyle = DOT_COLOR;
  for ( let y = 0; y < grid.length; y++ ) {
    for ( let x = 0; x < grid[ 0 ].length; x++ ) {
      if ( grid[ y ][ x ] !== 2 ) continue;
      const { cx, cy } = cellCenter( x, y );
      ctx.beginPath();
      ctx.arc( cx, cy, 2.5, 0, Math.PI * 2 );
      ctx.fill();
    }
  }
}

// Power pellets: mas grandes que los dots y con parpadeo segun el frame.
function drawPellets( ctx, grid, frame ) {
  for ( let y = 0; y < grid.length; y++ ) {
    for ( let x = 0; x < grid[ 0 ].length; x++ ) {
      if ( grid[ y ][ x ] !== 4 ) continue;
      const { cx, cy } = cellCenter( x, y );
      const pulse = ( Math.sin( frame * 0.1 ) + 1 ) / 2; // 0..1
      ctx.fillStyle = PELLET_COLOR;
      ctx.beginPath();
      ctx.arc( cx, cy, 6, 0, Math.PI * 2 );
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc( cx, cy, 2.5 * ( 1 - pulse * 0.5 ), 0, Math.PI * 2 );
      ctx.fill();
    }
  }
}

function drawPacman( ctx, p, frame ) {
  const { cx, cy } = cellCenter( p.x, p.y );
  let rot = 0;
  if ( p.dir === 'right' ) rot = 0;
  else if ( p.dir === 'down' ) rot = Math.PI / 2;
  else if ( p.dir === 'left' ) rot = Math.PI;
  else if ( p.dir === 'up' ) rot = -Math.PI / 2;

  // Boca animada: abre/cierra con el frame.
  const open = ( Math.sin( frame * 0.3 ) * 0.5 + 0.5 ) * 0.28 + 0.02;

  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.moveTo( cx, cy );
  ctx.arc( cx, cy, TILE / 2 - 1, rot + open * Math.PI, rot - open * Math.PI );
  ctx.closePath();
  ctx.fill();
}

function drawGhost( ctx, g, color ) {
  const { cx, cy } = cellCenter( g.x, g.y );
  const r = TILE / 2 - 1;
  const top = cy - r;
  const bottom = cy + r;
  const left = cx - r;
  const right = cx + r;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc( cx, cy - 1, r, Math.PI, 0, false ); // cabeza
  ctx.lineTo( right, bottom );

  // Variacion de forma segun kind.
  if ( g.kind === 'hunter' ) {
    // Puntiagudo: 2 picos marcados.
    ctx.lineTo( cx + r * 0.5, bottom - 5 );
    ctx.lineTo( cx, bottom );
    ctx.lineTo( cx - r * 0.5, bottom - 5 );
  } else if ( g.kind === 'ambusher' ) {
    // Con flecha: pico central hacia abajo.
    ctx.lineTo( right, bottom );
    ctx.lineTo( cx + r * 0.5, bottom - 3 );
    ctx.lineTo( cx, bottom + 3 );
    ctx.lineTo( cx - r * 0.5, bottom - 3 );
  } else if ( g.kind === 'flanker' ) {
    // Con aletas: 2 ondas suaves a los lados.
    ctx.lineTo( right, bottom - 3 );
    ctx.lineTo( cx + r * 0.5, bottom );
    ctx.lineTo( cx, bottom - 2 );
    ctx.lineTo( cx - r * 0.5, bottom );
    ctx.lineTo( left, bottom - 3 );
  } else if ( g.kind === 'wanderer' ) {
    // Redondeado: falda en curva continua.
    ctx.quadraticCurveTo( cx + r * 0.5, bottom + 2, cx, bottom );
    ctx.quadraticCurveTo( cx - r * 0.5, bottom + 2, left, bottom - 1 );
  } else {
    ctx.lineTo( cx, bottom );
  }
  ctx.closePath();
  ctx.fill();

  // ojos mirando segun direccion
  const dir = DIRS[ g.dir ] || { x: 0, y: 0 };
  const ex = dir.x * 1.6;
  const ey = dir.y * 1.6;
  for ( const off of [ -3.5, 3.5 ] ) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc( cx + off, cy - 1, 3, 0, Math.PI * 2 );
    ctx.fill();
    ctx.fillStyle = '#0000bb';
    ctx.beginPath();
    ctx.arc( cx + off + ex, cy - 1 + ey, 1.5, 0, Math.PI * 2 );
    ctx.fill();
  }
}

function drawHUD( ctx, game, W ) {
  ctx.fillStyle = '#fff';
  ctx.font = '14px "Courier New", monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText( 'SCORE ' + game.score, 8, 4 );
  ctx.textAlign = 'right';
  ctx.fillText( 'VIDAS ' + game.lives, W * TILE - 8, 4 );
}

const GHOST_COLORS = {
  hunter: '#ff0000',
  ambusher: '#ffb8ff',
  flanker: '#00ffff',
  wanderer: '#ffb852',
};

function draw( ctx, game, frame ) {
  const grid = game.grid;
  const W = grid[ 0 ].length;
  const H = grid.length;

  ctx.fillStyle = '#000';
  ctx.fillRect( 0, 0, W * TILE, H * TILE );

  drawWalls( ctx, grid );
  drawDoor( ctx, grid );
  drawDots( ctx, grid );
  drawPellets( ctx, grid, frame );
  drawPacman( ctx, game.pacman, frame );
  game.ghosts.forEach( ( g ) =>
    drawGhost( ctx, g, g.frightened ? FEAR_COLOR : GHOST_COLORS[ g.kind ] || '#ff0000' )
  );
  drawHUD( ctx, game, W );
}

window.draw = draw;
