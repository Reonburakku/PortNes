#!/usr/bin/env node
/*
 * Prueba de determinismo del núcleo (SPEC.md §4.1 y §11). Requisito para el modo online.
 *
 *   node tools/determinism-test.js <rom> [cuadros]
 *
 * Simula lo que hace el online: dos instancias con historias distintas reciben el mismo
 * estado (como en la sincronización inicial) y después las mismas entradas aleatorias de
 * todos los jugadores. Deben terminar idénticas cuadro a cuadro. Sale con código 1 si no.
 *
 * Solo usa el contrato de EmulatorCore, así que sirve para cualquier núcleo: para otro
 * sistema, cambia las dos líneas de "Carga del núcleo".
 */
'use strict';
const fs = require('fs');
const path = require('path');

// --- Carga del núcleo (equivalente a las etiquetas <script> del núcleo en index.html) ---
globalThis.jsnes = require('jsnes');
require(path.join(__dirname, '..', 'cores', 'nes.js'));
// ---------------------------------------------------------------------------------------

const CORE = globalThis.EmulatorCore;
const [romPath, framesArg] = process.argv.slice(2);
if (!romPath) { console.error('Uso: node tools/determinism-test.js <rom> [cuadros]'); process.exit(2); }
const FRAMES = parseInt(framesArg, 10) || 5000;
const rom = new Uint8Array(fs.readFileSync(romPath));
const invalid = CORE.validate(rom);
if (invalid) { console.error(invalid); process.exit(2); }

const { players, buttons } = CORE.info;
const BTN = Object.fromEntries(buttons.map((n, i) => [n, i]));
const make = () => { const c = CORE.create({ onFrame() {}, onAudioSample() {} }); c.load(rom); return c; };
const hash = c => { const m = c.workRam(); let h = 0x811c9dc5; for (let i = 0; i < m.length; i++) { h ^= m[i]; h = Math.imul(h, 0x01000193); } return h >>> 0; };
let seed = 12345;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const zeros = () => new Array(players).fill(0);

// Anfitrión: juega un rato y luego reinicia (como al empezar una partida online).
const A = make();
for (let i = 0; i < 300; i++) { const m = zeros(); if (rnd() < 0.1) m[0] = 1 << (BTN.START ?? 0); A.setInputs(m); A.runFrame(); }
A.reset();
const json = JSON.stringify(A.saveState());

// Invitado: con una historia diferente, para comprobar que el estado lo sobrescribe todo.
const B = make();
for (let i = 0; i < 77; i++) { const m = zeros(); m[0] = 1; B.setInputs(m); B.runFrame(); }

// Ambos aplican el mismo estado (el anfitrión también, como en el online).
A.loadState(JSON.parse(json));
B.loadState(JSON.parse(json));

// Entradas: Select y Start al principio para entrar en el juego, luego aleatorias para todos.
const SYS = ((1 << (BTN.START ?? 31)) | (1 << (BTN.SELECT ?? 31))) >>> 0;
let diverged = -1;
for (let f = 0; f < FRAMES; f++) {
  let m = zeros();
  if (f === 200 && 'SELECT' in BTN) m[0] = 1 << BTN.SELECT;
  else if (f === 230 && 'START' in BTN) m[0] = 1 << BTN.START;
  else if (f > 400) m = m.map(() => Math.floor(rnd() * (1 << buttons.length)) & ~SYS);
  A.setInputs(m); A.runFrame();
  B.setInputs(m); B.runFrame();
  if (hash(A) !== hash(B)) { diverged = f; break; }
}

const sameState = JSON.stringify(A.saveState()) === JSON.stringify(B.saveState());
const kb = (json.length / 1024) | 0;
if (diverged < 0 && sameState) {
  console.log(`OK: ${FRAMES} cuadros idénticos con ${players} jugadores; estado final idéntico. Estado serializado: ${kb} KB`);
} else {
  console.log(diverged >= 0 ? `DESINCRONIZADO en el cuadro ${diverged}` : 'RAM igual pero estado final distinto');
  process.exit(1);
}
