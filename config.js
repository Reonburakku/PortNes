/*
 * Configuración de PortNes. Al usar la web como plantilla para otro sistema,
 * este archivo y cores/<sistema>.js son lo que hay que cambiar (SPEC.md §3 y §13).
 * Los nombres de botón deben existir en EmulatorCore.info.buttons.
 */
window.CONFIG = {
  appName: 'PortNes',

  // Catálogo de juegos (se ordena alfabéticamente al cargar).
  catalogUrl: 'games.json',

  // ROM que se carga sola en local si existe (solo desarrollo; en el hosting da 404). null para desactivar.
  localRom: { url: 'rom/contra.nes', name: 'Contra' },

  // Claves de almacenamiento. En un emulador nuevo, usar un prefijo propio (p. ej. 'portgb-').
  // Estas conservan los nombres originales para no perder datos de quien ya usó la página.
  storage: {
    db: 'contra-web',          // IndexedDB: última ROM usada
    statePrefix: 'nes-state-', // localStorage: partida guardada por ROM
    volume: 'contra-volume',   // localStorage: volumen y silencio
  },

  // Teclado: jugador → botón → códigos de tecla (KeyboardEvent.code).
  keyboard: {
    1: {
      UP: ['ArrowUp', 'KeyW'], DOWN: ['ArrowDown', 'KeyS'], LEFT: ['ArrowLeft', 'KeyA'], RIGHT: ['ArrowRight', 'KeyD'],
      B: ['KeyJ', 'KeyZ'], A: ['KeyK', 'KeyX'], START: ['Enter'], SELECT: ['ShiftLeft', 'ShiftRight'],
    },
    2: {
      UP: ['Numpad8'], DOWN: ['Numpad5'], LEFT: ['Numpad4'], RIGHT: ['Numpad6'],
      B: ['Numpad1'], A: ['Numpad2'], START: ['NumpadEnter'], SELECT: ['NumpadAdd'],
    },
  },

  // Mandos (Gamepad API, mapeo estándar): botón → índices de botón del mando.
  // Si el sistema tiene UP/DOWN/LEFT/RIGHT, el stick izquierdo también los activa.
  gamepad: {
    buttons: { A: [0, 3], B: [2, 1], SELECT: [8], START: [9], UP: [12], DOWN: [13], LEFT: [14], RIGHT: [15] },
    axisThreshold: 0.5,
  },

  // Controles táctiles: la cruceta aparece si existen UP/DOWN/LEFT/RIGHT.
  touch: { center: ['SELECT', 'START'], face: ['B', 'A'] },

  // Panel de controles (a la derecha del juego): grupos de [texto, [teclas]].
  help: [
    { title: 'Jugador 1', items: [
      ['Mover', ['←↑→↓', 'WASD']], ['Botón B', ['J', 'Z']], ['Botón A', ['K', 'X']],
      ['Start', ['Enter']], ['Select', ['Shift']],
    ] },
    { title: 'Jugador 2', items: [
      ['Mover', ['Num 8 4 5 6']], ['Botón B', ['Num 1']], ['Botón A', ['Num 2']],
      ['Start', ['Num Enter']], ['Select', ['Num +']],
    ] },
    { title: 'Opciones', items: [
      ['Pausa', ['P']], ['Guardar partida', ['F5']], ['Cargar partida', ['F9']],
      ['Silenciar', ['M']], ['Volumen', ['-', '+']], ['Pantalla completa', ['F']],
    ] },
  ],
  helpNote: 'Mandos USB/Bluetooth compatibles. En partida online, cada jugador usa los controles del Jugador 1.',

  // Partida online (SPEC.md §9).
  netplay: {
    roomPrefix: 'contra-web-reonburakku-', // DEBE ser único por emulador y autor
    codeLength: 5,
    codeChars: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
    // STUN públicos. Los TURN que PeerJS trae por defecto ya no existen (sus DNS no resuelven).
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
    minDelay: 2, maxDelay: 10,  // retardo de entrada en cuadros
    hashEvery: 120,             // comparar la RAM cada N cuadros
    chunkSize: 15000,           // PeerJS (JSON) descarta mensajes de más de ~16 KB
    chunkWindow: 16,            // fragmentos sin confirmar como máximo
    joinTimeoutMs: 20000,
    hostTimeoutMs: 22000,
    stallMs: 600,               // mostrar «Esperando al otro jugador…»
  },
};
