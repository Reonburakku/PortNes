# Contra (NES) en el navegador

Emulador NES en JavaScript ([jsnes](https://github.com/bfirsh/jsnes)) que carga `rom/contra.nes` y lo ejecuta en un `<canvas>`.

## Jugar online (GitHub Pages)

Abre la página y carga tu propia ROM de Contra (`.nes`) con el botón **ROM…** o arrastrándola.
La ROM **no se incluye** en este repositorio (copyright de Konami). Se guarda solo en tu navegador (IndexedDB)
para no tener que cargarla cada vez; **Olvidar ROM** la borra.

## Jugar en local

Copia tu ROM a `rom/contra.nes` (la carpeta está en `.gitignore`) y ejecuta `start.bat`, o:

```
node server.js 8080
```

y abre http://localhost:8080/.

## Publicar en GitHub Pages

Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)`.

## Controles

| Acción | Jugador 1 | Jugador 2 |
|---|---|---|
| Mover | Flechas / WASD | Numpad 8 4 5 6 |
| Disparar (B) | J / Z | Numpad 1 |
| Saltar (A) | K / X | Numpad 2 |
| Start / Select | Enter / Shift | Numpad Enter / Numpad + |

`P` pausa · `M` sonido · `F` pantalla completa · `F5` guardar · `F9` cargar (se guarda en `localStorage`).
Mandos USB/Bluetooth funcionan vía Gamepad API (primer mando = J1, segundo = J2). En móvil aparecen controles táctiles.

## Estructura

- `index.html`: interfaz, vídeo, audio (WebAudio), entrada y guardado de estado
- `vendor/jsnes.min.js`: núcleo del emulador (CPU 6502, PPU, APU, mapper 2/UxROM)
- `rom/contra.nes`: tu ROM, solo en local (ignorada por git)
- `server.js`: servidor estático mínimo sin dependencias
