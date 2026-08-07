// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.0625; // 1/16 celda/frame -> alinea cada 16 frames
const GHOST_SPEED = 0.05;    // 1/20 celda/frame
const RELEASE_GAP = 300;    // frames entre liberaciones (~5 s a 60 fps)
const POWER_PELLET_DURATION = 300; // frames (5 s a 60 fps)
const FEAR_PACMAN_MULT = 1.25;     // Pac-Man: 0.0625 * 1.25
const FEAR_GHOST_MULT = 0.5;       // Fantasmas: 0.05 * 0.5

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    fearTimer: 0,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g, i ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      released: false,
      releaseAt: i * RELEASE_GAP,
      frightened: false,
    } ) ),
    frame: 0,
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Comer power pellet: activa el modo Fear.
    if ( grid[ p.y ][ p.x ] === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.dotsRemaining--;
      game.fearTimer = POWER_PELLET_DURATION;
      for ( const g of game.ghosts ) {
        if ( g.released ) {
          g.frightened = true;
          g.dir = OPPOSITE[ g.dir ];
        }
      }
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  const oldX = p.x;
  const oldY = p.y;
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );

  // Alineacion robusta a cualquier velocidad. La logica de giro/comer/muro
  // solo corre sobre un centro de celda (entero). Con velocidades que no
  // caen exacto en el centro (p.ej. el x1.25 del modo Fear, 5/64), Pac-Man
  // quedaba desalineado: no giraba, no comia y atravesaba paredes/bordes.
  // Aqui detectamos el cruce del centro de la celda destino y hacemos snap.
  const crossedX =
    ( d.x > 0 && Math.floor( oldX ) !== Math.floor( p.x ) ) ||
    ( d.x < 0 && Math.ceil( oldX ) !== Math.ceil( p.x ) );
  const crossedY =
    ( d.y > 0 && Math.floor( oldY ) !== Math.floor( p.y ) ) ||
    ( d.y < 0 && Math.ceil( oldY ) !== Math.ceil( p.y ) );

  // En la fila del tunel el salto por wrap falsea el cruce; no hace falta
  // alinear porque no hay muros ni dots (decisiones innecesarias).
  const inTunnelRow = Math.round( p.y ) === TUNNEL_ROW;
  if ( !inTunnelRow ) {
    if ( crossedX ) p.x = Math.round( p.x );
    if ( crossedY ) p.y = Math.round( p.y );
  }
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const p = game.pacman;

  // Excluye el giro de 180 y las celdas de la pen/puerta (reentrada).
  const options = Object.keys( DIRS ).filter( ( dir ) => {
    const d = DIRS[ dir ];
    return (
      dir !== OPPOSITE[ g.dir ] &&
      canMove( grid, g.x, g.y, dir, 'ghost' ) &&
      !isPenArea( g.x + d.x, g.y + d.y )
    );
  } );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  const px = Math.round( p.x );
  const py = Math.round( p.y );

  // Objetivo de cada personalidad y si huye (maximiza distancia) o no.
  let targetX = px;
  let targetY = py;
  let flee = false;

  // En modo Fear el fantasma huye de Pac-Man maximizando la distancia.
  if ( g.frightened ) flee = true;

  switch ( g.kind ) {
    case 'hunter': {
      targetX = px;
      targetY = py;
      break;
    }
    case 'ambusher': {
      const pd = DIRS[ p.dir ] || DIRS.up;
      targetX = px + 4 * pd.x;
      targetY = py + 4 * pd.y;
      break;
    }
    case 'flanker': {
      const blinky = game.ghosts.find( ( ghost ) => ghost.kind === 'hunter' );
      targetX = px * 2 - Math.round( blinky.x );
      targetY = py * 2 - Math.round( blinky.y );
      break;
    }
    case 'wanderer': {
      const dist = Math.abs( g.x - px ) + Math.abs( g.y - py );
      if ( dist > 8 ) {
        targetX = px;
        targetY = py;
      } else {
        flee = true;
      }
      break;
    }
    default: {
      g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
      return;
    }
  }

  // Elegir la direccion que minimiza (o maximiza si huye) la distancia
  // Manhattan al objetivo.
  let best = choices[ 0 ];
  let bestDist = flee ? -Infinity : Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - targetX ) + Math.abs( ny - targetY );
    if ( ( flee && dist > bestDist ) || ( !flee && dist < bestDist ) ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

function inPen( g ) {
  return g.x >= 13 && g.x <= 14 && g.y >= 13 && g.y <= 15;
}

// Pen interior + fila de la puerta (y=12). Celda "vedada" para la reentrada.
function isPenArea( x, y ) {
  return x >= 13 && x <= 14 && y >= 12 && y <= 15;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // Fantasma no liberado: permanece dentro de la pen sin moverse.
  if ( !g.released ) return;

  // Fantasma liberado pero aun dentro de la pen o en la fila de la puerta
  // (y >= 12): forzar dir='up' hasta quedar por encima de la puerta (y < 12).
  // Sin decideGhost, para que el AI arranque desde suelo seguro.
  if ( isPenArea( g.x, g.y ) ) {
    if ( aligned( g.x ) && aligned( g.y ) ) {
      g.x = Math.round( g.x );
      g.y = Math.round( g.y );
      g.dir = 'up';
      if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
    }
    const d = DIRS[ g.dir ];
    g.x += d.x * g.speed;
    g.y += d.y * g.speed;
    wrapTunnel( g, width );
    return;
  }

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );

  // Velocidades efectivas segun el modo Fear.
  const inFear = game.fearTimer > 0;
  game.pacman.speed = inFear ? PACMAN_SPEED * FEAR_PACMAN_MULT : PACMAN_SPEED;
  for ( const g of game.ghosts ) {
    g.speed = g.frightened ? GHOST_SPEED * FEAR_GHOST_MULT : GHOST_SPEED;
  }

  // Liberacion escalonada de fantasmas por temporizador.
  for ( const g of game.ghosts ) {
    if ( !g.released && game.frame >= g.releaseAt ) g.released = true;
  }

  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( let i = 0; i < game.ghosts.length; i++ ) {
    const g = game.ghosts[ i ];
    if ( !collides( game.pacman, g ) ) continue;

    // Fantasma en Fear: se come. Suma puntos y vuelve a la jaula.
    if ( g.frightened ) {
      game.score += 200;
      g.x = GHOST_STARTS[ i ].x;
      g.y = GHOST_STARTS[ i ].y;
      g.dir = 'up';
      g.released = false;
      g.releaseAt = game.frame + RELEASE_GAP;
      g.frightened = false;
      continue;
    }

    // Fantasma normal: pierde una vida y se reinician posiciones.
    game.lives--;
    if ( game.lives <= 0 ) {
      game.state = 'lost';
      return;
    }
    resetPositions( game );
    break;
  }

  // Cuenta atras del Fear. Se decrementa despues de procesar la comida.
  if ( game.fearTimer > 0 ) {
    game.fearTimer--;
    if ( game.fearTimer === 0 ) {
      for ( const g of game.ghosts ) g.frightened = false;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
  game.frame++;
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
