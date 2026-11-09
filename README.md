# Contra (NES) en el navegador

Emulador NES en JavaScript ([jsnes](https://github.com/bfirsh/jsnes)) que carga `rom/contra.nes` y lo ejecuta en un `<canvas>`.

## Jugar online (GitHub Pages)

Abre la página y carga tu propia ROM de Contra (`.nes`) con el botón **ROM…** o arrastrándola.
La ROM **no se incluye** en este repositorio (copyright de Konami). Se guarda solo en tu navegador (IndexedDB)
para no tener que cargarla cada vez; **Olvidar ROM** la borra.

## Partida online (2 jugadores)

1. **Jugador 1:** pulsa **Online → Crear partida**. Aparece un código de 5 letras y un enlace.
2. **Jugador 2:** abre el enlace, o pulsa **Online**, escribe el código y **Unirse como Jugador 2**.
3. La consola se reinicia en ambos navegadores y el Jugador 1 elige **2 PLAYERS** en el título.

Cada uno juega con los controles del Jugador 1 (teclado, mando o táctil). Ambos necesitan **la misma ROM**
(se comprueba con SHA-256); la ROM nunca se envía.

**Cómo funciona:** conexión directa P2P por WebRTC ([PeerJS](https://peerjs.com/)); el servidor público de PeerJS
solo se usa para encontrarse. Los dos navegadores emulan exactamente lo mismo (lockstep determinista) y solo
intercambian los botones de cada frame, con 2–10 frames de retardo según el ping. Al empezar, el anfitrión envía el
estado completo de la consola; cada 2 s se comparan sumas de la RAM y, si difieren, se resincroniza solo.

**Limitaciones:** sin servidor TURN, algunas redes muy restrictivas (NAT simétrico, redes corporativas) pueden no
conectar. Si un jugador cambia de pestaña, la partida se detiene para ambos hasta que vuelva. Pausa, reset y
guardar/cargar se desactivan durante la partida online.

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

- `index.html`: interfaz, vídeo, audio (WebAudio), entrada, guardado de estado y netplay
- `vendor/jsnes.min.js`: núcleo del emulador (CPU 6502, PPU, APU, mapper 2/UxROM)
- `vendor/peerjs.min.js`: conexión WebRTC para el modo online
- `rom/contra.nes`: tu ROM, solo en local (ignorada por git)
- `server.js`: servidor estático mínimo sin dependencias
