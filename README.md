# PortNes

Emulador de NES para el navegador, basado en [jsnes](https://github.com/bfirsh/jsnes), con modo online para 2 jugadores.

**Jugar:** https://reonburakku.github.io/PortNes/

¿Quieres crear otro emulador web a partir de este? Consulta [SPEC.md](SPEC.md): arquitectura, contrato del núcleo,
protocolo online y lista de verificación.

## Cargar un juego

Elige un juego en la **lista desplegable** de la barra superior: la ROM se descarga desde su URL y arranca.
También puedes elegir **Abrir archivo .nes…** al final de la lista, o arrastrar un `.nes` a la página.
El último juego se guarda en tu navegador (IndexedDB) para arrancar directamente; **Olvidar ROM** lo borra.

### Añadir juegos

Edita [`games.json`](games.json) y añade una entrada con el nombre que se mostrará y la URL de la ROM:

```json
{ "name": "Super Juego", "url": "https://nesroms.blob.core.windows.net/nes/SuperJuego.nes" }
```

El orden dentro del archivo no importa: la lista se ordena alfabéticamente al cargar la página (sin distinguir
mayúsculas ni tildes). El servidor de las ROMs debe permitir CORS para el dominio de la página.

En partidas online, el enlace de invitación incluye el juego (`?sala=CODIGO&juego=Nombre`), así que el
Jugador 2 lo carga automáticamente.

## Partida online (2 jugadores)

1. **Jugador 1:** pulsa **Online → Crear partida**. Aparece un código de 5 letras y un enlace.
2. **Jugador 2:** abre el enlace, o pulsa **Online**, escribe el código y **Unirse como Jugador 2**.
3. La consola se reinicia en ambos navegadores y el Jugador 1 elige el modo de 2 jugadores en el menú del juego.

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

Opcionalmente, copia una ROM a `rom/contra.nes` para que se cargue sola (la carpeta está en `.gitignore`), y ejecuta `start.bat`, o:

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

`P` pausa · `M` silenciar · `-` / `+` volumen (también con el control deslizante, se recuerda entre visitas) · `F` pantalla completa · `F5` guardar · `F9` cargar (se guarda en `localStorage`).
Mandos USB/Bluetooth funcionan vía Gamepad API (primer mando = J1, segundo = J2). En móvil aparecen controles táctiles.

## Estructura

- `index.html`: interfaz, vídeo, audio (WebAudio), entrada, guardado de estado y netplay
- `vendor/jsnes.min.js`: núcleo del emulador (CPU 6502, PPU, APU, mapper 2/UxROM)
- `vendor/peerjs.min.js`: conexión WebRTC para el modo online
- `rom/contra.nes`: tu ROM, solo en local (ignorada por git)
- `games.json`: catálogo de juegos (nombre + URL de la ROM)
- `server.js`: servidor estático mínimo sin dependencias
