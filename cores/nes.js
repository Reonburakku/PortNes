/*
 * Adaptador del núcleo NES (jsnes 1.2.1) para el shell de PortNes.
 * Contrato descrito en SPEC.md §4. Para otro sistema, crear cores/<sistema>.js
 * que exponga el mismo objeto `EmulatorCore` (info, validate, create).
 */
(function (root) {
  'use strict';

  // Índice = bit de la máscara de entrada. Coincide con jsnes.Controller.BUTTON_*.
  const BUTTONS = ['A', 'B', 'SELECT', 'START', 'UP', 'DOWN', 'LEFT', 'RIGHT'];
  const SAMPLE_RATE = 44100; // fija: en jsnes la frecuencia altera la temporización de la APU (necesario para el online)

  function toBinaryString(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000)
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return s;
  }

  root.EmulatorCore = {
    info: {
      system: 'NES',
      width: 256,
      height: 240,
      fps: 60.0988,              // NTSC
      sampleRate: SAMPLE_RATE,
      players: 2,
      buttons: BUTTONS,
      extensions: ['.nes'],
    },

    // Devuelve null si la ROM parece válida, o un mensaje de error.
    validate(bytes) {
      const ok = bytes.length > 16 && bytes[0] === 0x4E && bytes[1] === 0x45 && bytes[2] === 0x53 && bytes[3] === 0x1A;
      return ok ? null : 'El archivo no es una ROM iNES (.nes) válida.';
    },

    // callbacks: onFrame(pixels 0x00BBGGRR, ancho×alto) y onAudioSample(izq, der)
    create({ onFrame, onAudioSample }) {
      const jsnes = root.jsnes;
      if (!jsnes) throw new Error('jsnes no está cargado');
      const nes = new jsnes.NES({ sampleRate: SAMPLE_RATE, onFrame, onAudioSample });

      return {
        load(bytes) { nes.loadROM(toBinaryString(bytes)); },
        reset() { nes.reloadROM(); },
        setInputs(masks) {
          for (let p = 0; p < masks.length; p++)
            for (let b = 0; b < BUTTONS.length; b++)
              (masks[p] >> b) & 1 ? nes.buttonDown(p + 1, b) : nes.buttonUp(p + 1, b);
        },
        runFrame() { nes.frame(); },
        // Estado sin la ROM (cada jugador usa la suya).
        saveState() { const s = nes.toJSON(); s.romData = null; return s; },
        // Nota: jsnes no serializa la APU; aplicar el mismo estado en ambos lados los deja idénticos.
        loadState(state) { nes.fromJSON(Object.assign({}, state, { romData: nes.romData })); },
        // cpu.mem puede ser Array (tras fromJSON) o array tipado: slice funciona con ambos.
        workRam() { return nes.cpu.mem.slice(0, 0x800); },
        raw: nes, // acceso directo para depuración
      };
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
