# SPEC — Plantilla de emulador web (basada en PortNes)

Este documento describe **qué hace PortNes y cómo está construido**, para reutilizarlo como plantilla de otros
emuladores web (Game Boy, SNES, Master System, Mega Drive, etc.). Distingue entre:

- **Shell** (reutilizable tal cual): interfaz, bucle, audio, entrada, catálogo, almacenamiento, netplay y despliegue.
- **Núcleo** (cambia por sistema): la emulación en sí, conectada al shell mediante el contrato de la sección 4.

Las palabras **DEBE**, **DEBERÍA** y **PUEDE** indican requisito obligatorio, recomendado u opcional.

---

## 1. Objetivos

1. Jugar a juegos de una consola en el navegador, sin instalar nada, desde un hosting estático (GitHub Pages).
2. Elegir juegos de un catálogo (`games.json`) cuyas ROMs se descargan por URL, o abrir un archivo local.
3. Partida online de 2 jugadores P2P, sin servidor de juego propio.
4. Funcionar con teclado, mando (Gamepad API) y pantalla táctil.
5. No distribuir ROMs en el repositorio.

**Fuera de alcance:** cuentas de usuario, servidor propio, más de 2 jugadores online, rollback netcode.

---

## 2. Arquitectura

Página única (`index.html`) sin build ni framework. Todo el JavaScript está en un `<script>` en línea dentro de una
IIFE; las librerías se sirven desde `vendor/` (copiadas de npm, sin CDN en tiempo de ejecución).

```
┌────────────────────────── index.html ──────────────────────────┐
│ UI: barra superior · pantalla (canvas) · panel de controles    │
│     · panel online (modal) · controles táctiles · toast        │
├────────────────────────────────────────────────────────────────┤
│ Bucle principal (requestAnimationFrame + acumulador de tiempo) │
│   ├─ offline: entradas locales → core.runFrame()              │
│   └─ online:  lockstep (netStep) → core.runFrame()            │
├──────────┬──────────┬───────────┬───────────┬─────────────────┤
│ Vídeo    │ Audio    │ Entrada   │ Catálogo  │ Almacenamiento  │
│ canvas   │ WebAudio │ teclado,  │ games.json│ IndexedDB (ROM) │
│ 2D       │ + buffer │ mando,    │ + fetch   │ localStorage    │
│          │ circular │ táctil    │           │ (estado, volumen)│
├──────────┴──────────┴───────────┴───────────┴─────────────────┤
│ Netplay: PeerJS (WebRTC DataChannel) + protocolo propio (§9)   │
├────────────────────────────────────────────────────────────────┤
│ NÚCLEO DEL EMULADOR (vendor/<core>.js) ← contrato §4           │
└────────────────────────────────────────────────────────────────┘
```

### 2.1 Estructura de archivos

| Archivo | Rol | ¿Cambia por sistema? |
|---|---|---|
| `index.html` | Shell completo (HTML, CSS y JS) | Solo la configuración (§3) y el adaptador del núcleo (§4) |
| `games.json` | Catálogo de juegos | Sí (contenido) |
| `vendor/<core>.js` + licencia | Núcleo del emulador | Sí |
| `vendor/peerjs.min.js` + licencia | WebRTC | No |
| `server.js` | Servidor estático local sin dependencias (respeta `PORT`) | No |
| `start.bat` | Arranque local en Windows | No |
| `.nojekyll` | GitHub Pages sin Jekyll | No |
| `.gitignore` | Excluye `rom/`, ROMs, `node_modules/`, `.claude/` | Añadir las extensiones del sistema |
| `rom/` | ROM local opcional para desarrollo (ignorada por git) | — |
| `README.md`, `SPEC.md` | Documentación | Sí |

---

## 3. Configuración por emulador

Al crear un emulador nuevo a partir de la plantilla, se DEBEN revisar estos valores (hoy repartidos en `index.html`;
DEBERÍAN agruparse en un único objeto `CONFIG` al inicio del script):

| Clave | Valor en PortNes | Notas |
|---|---|---|
| Nombre (título, `<h1>`) | `PortNes` | |
| Extensiones de ROM | `.nes` | `accept` del `<input type=file>` y validación de cabecera |
| Resolución nativa | 256 × 240 | Tamaño del `<canvas>` y `aspect-ratio` del CSS |
| Frecuencia de cuadro | `60.0988` Hz (NTSC) | `FRAME_MS = 1000 / fps` |
| Frecuencia de audio del núcleo | `44100` Hz fija | Ver §6: no depender del dispositivo |
| Jugadores | 2 | |
| Botones | 8: A, B, Select, Start, Arriba, Abajo, Izquierda, Derecha | Máscara de bits (§7) |
| Mapa de teclado | §7.2 | |
| Prefijo de sala online | `contra-web-reonburakku-` | DEBE ser único por emulador y autor |
| Claves de almacenamiento | `contra-web` (IndexedDB), `nes-state-<rom>`, `contra-volume` | Nombres heredados; en un emulador nuevo usar `<app>-…` |
| Ruta de ROM local por defecto | `rom/contra.nes` | Solo desarrollo |
| Rango de RAM para detectar desincronización | `cpu.mem[0x000–0x7FF]` | La RAM de trabajo del sistema |

---

## 4. Contrato del núcleo (adaptador)

El shell solo habla con el núcleo a través de estas operaciones. Para portar otro sistema hay que escribir un
adaptador que las implemente sobre la librería elegida.

```ts
interface EmulatorCore {
  // Carga una ROM. Lanza un Error con mensaje legible si no es válida o no está soportada.
  load(bytes: Uint8Array): void;
  // Vuelve al estado de encendido con la ROM actual.
  reset(): void;
  // Fija el estado de los botones para el próximo cuadro. masks[i] = máscara de bits del jugador i+1.
  setInputs(masks: number[]): void;
  // Emula exactamente un cuadro. Durante la llamada entrega vídeo y audio por los callbacks.
  runFrame(): void;
  // Estado completo serializable a JSON, SIN la ROM. Restaurarlo debe dar una emulación idéntica.
  saveState(): object;
  loadState(state: object): void;
  // Memoria que se usa para comparar ambos lados en online (barata de leer).
  workRam(): Uint8Array;
}
// Callbacks que el shell pasa al crear el núcleo:
//   onFrame(pixels: Uint32Array /* ancho×alto, 0x00BBGGRR */)
//   onAudioSample(left: number, right: number /* -1..1 */)
```

### 4.1 Requisitos del núcleo

- **DEBE ser determinista:** mismas entradas por cuadro + mismo estado inicial ⇒ mismo estado, en cualquier navegador
  y equipo. Sin `Math.random`, `Date.now`, ni dependencias del reloj o de la frecuencia de audio del dispositivo.
- **DEBE** permitir avanzar **un cuadro por llamada** (no un bucle interno con temporizador).
- **DEBE** serializar y restaurar su estado (`saveState`/`loadState`). Si el estado no incluye algún subsistema
  (en jsnes la APU no se serializa), ambos lados DEBEN aplicar el mismo estado para quedar idénticos (§9.4).
- **DEBERÍA** funcionar en el hilo principal a velocidad completa en un PC modesto.

### 4.2 Implementación actual (jsnes 1.2.1)

| Contrato | jsnes |
|---|---|
| `load` | `nes.loadROM(binaryString)` (convertir `Uint8Array` a cadena binaria por bloques de 32 KB) |
| `reset` | `nes.reloadROM()` |
| `setInputs` | `nes.buttonDown/buttonUp(jugador, botón)` por cada bit (`applyInputs`) |
| `runFrame` | `nes.frame()` |
| `saveState` | `nes.toJSON()` con `romData = null` |
| `loadState` | `s.romData = nes.romData; nes.fromJSON(s)` |
| `workRam` | `nes.cpu.mem.subarray(0, 0x800)` |

Validación de cabecera: los 4 primeros bytes DEBEN ser `4E 45 53 1A` (iNES). Otros sistemas: validar su formato.

---

## 5. Interfaz

### 5.1 Disposición

- **Barra superior** (`<header>`, envuelve en varias líneas si no cabe): nombre, botón **Online** e indicador de
  estado de red, **Pausa**, **Reset**, **Guardar**, **Cargar**, control de **volumen**, **Pantalla completa**,
  **lista desplegable de juegos**, **Olvidar ROM**.
- **Zona principal** (`<main>`): pantalla del juego a la izquierda y **panel de controles** (`<aside id="help">`,
  ~270 px) a la derecha.
- **Superposición** sobre la pantalla para mensajes (cargando, pulsa una tecla, errores).
- **Panel online** modal, **toast** para avisos breves y **controles táctiles** debajo del juego.

### 5.2 Reglas de tamaño (obligatorias)

- El canvas DEBE escalar al espacio libre real sin tapar la barra ni el panel, aunque la barra ocupe varias líneas.
  Se consigue con *container queries*: `#stage { container-type: size }` y
  `canvas { width: min(100cqw, 100cqh * ANCHO / ALTO); aspect-ratio: ANCHO / ALTO }`.
- Escalado de píxeles nítido: `image-rendering: pixelated`.
- **≤ 820 px de ancho:** el panel pasa debajo del juego y la página puede desplazarse en vertical.
- **Puntero táctil** (`pointer: coarse`): se oculta el panel de controles y se muestran los botones táctiles, que
  DEBEN caber en 375 px sin desplazamiento horizontal (tamaños con `clamp()`).
- El panel de controles DEBE desplazarse por dentro si no cabe en alto, sin empujar al juego.

### 5.3 Panel de controles

Lista con un elemento por control, agrupada en **Jugador 1**, **Jugador 2** y **Opciones**, más una nota sobre mandos
y online. Los nombres de botón DEBEN ser los del sistema (A/B en NES), no los de un juego concreto.

### 5.4 Estilo

Tema oscuro con variables CSS en `:root` (`--bg`, `--panel`, `--text`, `--muted`, `--accent`, `--ok`, `--border`).
Para otro emulador basta con cambiar `--accent` y el nombre.

---

## 6. Bucle, vídeo y audio

### 6.1 Bucle principal

- `requestAnimationFrame` + acumulador: se ejecutan tantos cuadros como correspondan al tiempo transcurrido
  (`FRAME_MS`), de modo que la velocidad es correcta con pantallas de 60, 120 o 144 Hz.
- El tiempo acumulado por llamada se limita (100 ms) para no ejecutar ráfagas tras cambiar de pestaña.
- El canvas solo se redibuja (`putImageData`) si se emuló al menos un cuadro.

### 6.2 Vídeo

`onFrame` copia los píxeles a un `ImageData` (`Uint32Array`, `0xFF000000 | color`), que se pinta en un `<canvas>`
de resolución nativa y se escala con CSS.

### 6.3 Audio

- `AudioContext` creado tras la primera interacción del usuario (requisito de los navegadores), mostrando antes
  «Pulsa cualquier tecla o toca la pantalla para empezar».
- El núcleo genera audio a una **frecuencia fija** (`EMU_RATE = 44100`). En jsnes la frecuencia de muestreo altera la
  temporización interna de la APU: si cada equipo usara la suya, el online se desincronizaría.
- Se intenta `new AudioContext({ sampleRate: EMU_RATE })`; si el dispositivo usa otra, se **remuestrea** al reproducir.
- Buffer circular de 16384 muestras estéreo entre el núcleo y un `ScriptProcessorNode` (1024 muestras). Si se llena,
  se descartan muestras; si se vacía, silencio.
- **Volumen:** `GainNode` con curva cuadrática (`(v/100)²`), deslizador 0–100 %, silencio, teclas `M`, `-`, `+`.
  Se guarda en `localStorage`.

---

## 7. Entrada

### 7.1 Modelo

- Cada jugador tiene una **máscara de bits** (un bit por botón: en NES A=0, B=1, Select=2, Start=3, Arriba=4,
  Abajo=5, Izquierda=6, Derecha=7).
- `press(p, b)` / `release(p, b)` actualizan `held[p]` y marcan `latched[p]`.
- `sample(p)` devuelve `held | latched` y limpia `latched`: **una pulsación más corta que un cuadro no se pierde**.
- Las entradas se aplican al núcleo **solo en la frontera entre cuadros** (`applyInputs` antes de `runFrame`).
- Al perder el foco o cambiar de pestaña se sueltan todos los botones.
- Las teclas se ignoran mientras el foco está en `INPUT`, `TEXTAREA` o `SELECT`, y esos controles se desenfocan
  tras usarlos para devolver el teclado al juego.

### 7.2 Mapa por defecto

| Acción | Jugador 1 | Jugador 2 |
|---|---|---|
| Cruceta | Flechas / WASD | Num 8 4 5 6 |
| B / A | J, Z / K, X | Num 1 / Num 2 |
| Start / Select | Enter / Shift | Num Enter / Num + |

Opciones: `P` pausa, `F5` guardar, `F9` cargar, `M` silenciar, `-`/`+` volumen, `F` pantalla completa.

### 7.3 Mandos y táctil

- **Gamepad API**, mapeo estándar: botón 0/3 → A, 2/1 → B, 8 → Select, 9 → Start, 12–15 o stick izquierdo
  (umbral 0,5) → cruceta. Primer mando = J1, segundo = J2. Se consulta en cada vuelta del bucle.
- **Táctil:** cruceta, Select/Start y A/B con `pointerdown/up/cancel/leave` y `touch-action: none`.

---

## 8. Juegos y almacenamiento

### 8.1 Catálogo (`games.json`)

```json
[ { "name": "Contra", "url": "https://<cuenta>.blob.core.windows.net/nes/Contra.nes" } ]
```

- Se carga con `fetch('games.json', { cache: 'no-cache' })`. Las entradas sin `name` o `url` de tipo texto se ignoran.
- La lista DEBE mostrarse **siempre en orden alfabético**, ordenando al cargar con
  `Intl.Collator('es', { sensitivity: 'base', numeric: true })`, sin distinguir mayúsculas ni tildes y con orden
  natural de números. El orden dentro del archivo no importa.
- Al final de la lista: separador y **«Abrir archivo …»**. También se puede arrastrar un archivo a la página.
- Al elegir un juego: superposición «Descargando…», `fetch(url)`, validación y arranque. Si falla, se explica la causa
  probable (CORS o red); si había un juego en marcha, el aviso se cierra con una tecla y se sigue jugando.
- **El servidor de ROMs DEBE permitir CORS** (GET, HEAD, OPTIONS) para el dominio publicado y `http://localhost:8080`.

### 8.2 Orden de arranque

1. Juego indicado en el enlace de invitación (`?juego=`), si existe en el catálogo.
2. ROM local `rom/<defecto>` (solo desarrollo; en el hosting da 404 y se ignora).
3. Último juego usado, guardado en IndexedDB.
4. Si no hay ninguno: «Elige un juego en la lista».

### 8.3 Persistencia

| Dato | Dónde | Clave |
|---|---|---|
| Última ROM (bytes y nombre) | IndexedDB | BD `contra-web`, almacén `roms`, clave `last` |
| Partida guardada (F5/F9) | localStorage | `nes-state-<nombre de ROM en minúsculas>` |
| Volumen y silencio | localStorage | `contra-volume` |

Todo acceso a almacenamiento DEBE ir en `try/catch` (modo privado, cuota llena). Un estado de jsnes ocupa ~1,8 MB.

---

## 9. Online (2 jugadores)

### 9.1 Modelo

- **Lockstep determinista con retardo de entrada:** ambos navegadores ejecutan el mismo emulador y solo intercambian
  la máscara de botones de cada cuadro. No se transmite vídeo ni audio, ni la ROM.
- El anfitrión es el **Jugador 1** y el invitado el **Jugador 2**. Cada uno juega con los controles de J1 (se unen las
  máscaras locales de J1 y J2).
- La entrada local del cuadro `f` se programa para el cuadro `f + delay` y se envía. Un cuadro solo se emula cuando
  están las entradas de ambos; si falta la remota, el bucle espera.
- `delay` se calcula al conectar: `clamp(ceil(RTT / 2 / FRAME_MS) + 1, 2, 10)`, con el RTT medio de 3 pings.
- Pausa, reset, guardar/cargar y cambiar de juego se desactivan durante la partida online.

### 9.2 Conexión

- **PeerJS** sobre su servidor público de señalización (`0.peerjs.com`); los datos van P2P por DataChannel
  (`reliable: true`, `serialization: 'json'`).
- Servidores ICE: STUN de Google (`stun.l.google.com:19302`, `stun1…`) y Cloudflare (`stun.cloudflare.com:3478`).
  **No usar los TURN por defecto de PeerJS**: sus DNS ya no resuelven. No hay TURN configurado (ver §12).
- **Sala:** ID de peer = `ROOM_PREFIX + código`, con código de 5 caracteres del alfabeto
  `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sin caracteres confusos). Si el ID está ocupado, se genera otro.
- **Enlace de invitación:** `?sala=CÓDIGO&juego=Nombre`. El invitado carga ese juego y se une solo.
- **Fases visibles** para el invitado: servidor de salas → buscando la sala → sala encontrada / conexión directa →
  conectado. Para el anfitrión: creando sala → esperando → Jugador 2 encontrado → conectado.
- **Tiempo límite:** si la conexión directa no se abre en 20 s (invitado) o 22 s (anfitrión), o ICE pasa a `failed`,
  se muestra un error con los candidatos ICE propios y remotos (`getStats`) y causas probables (por ejemplo, la
  política WebRTC de Brave). El anfitrión mantiene la sala abierta.
- Una sala admite un solo invitado; los siguientes reciben «La sala ya está llena».
- Si cualquiera se desconecta, ambos vuelven al modo local con un aviso.

### 9.3 Protocolo de mensajes

Todos los mensajes son objetos JSON con un campo `t`. `e` es la **época** (se incrementa en cada sincronización de
estado); los mensajes de una época antigua se descartan.

| `t` | Sentido | Campos | Significado |
|---|---|---|---|
| `hello` | inv → anf | `rom` | SHA-256 de la ROM del invitado |
| `err` | ambos | `msg` | Error fatal (ROM distinta, sala llena). El receptor sale del online |
| `ping` / `pong` | ambos | `ts` | Medición de RTT (cada 1 s) |
| `s0` | anf → inv | `e, f, d, n` | Inicio de estado: época, cuadro, retardo, nº de fragmentos |
| `sc` | anf → inv | `e, i, d` | Fragmento `i` del estado JSON (15.000 caracteres) |
| `sa` | inv → anf | `e` | Confirmación de un fragmento (control de flujo) |
| `s1` | anf → inv | `e` | Fin del estado; el invitado lo aplica |
| `s2` | inv → anf | `e` | El invitado aplicó el estado; ambos empiezan |
| `i` | ambos | `e, f, v` | Máscara de botones `v` para el cuadro `f` |
| `h` | ambos | `e, f, h` | Hash FNV-1a de la RAM de trabajo tras el cuadro `f` (cada 120 cuadros) |

### 9.4 Sincronización de estado

1. Al unirse alguien con la misma ROM, el anfitrión hace `reset()` y envía el estado completo (sin ROM).
2. El anfitrión **también aplica ese mismo estado a sí mismo**, porque `loadState` puede no restaurar todos los
   subsistemas (en jsnes, la APU), y así ambos quedan idénticos.
3. Envío **fragmentado con ventana**: como máximo 16 fragmentos sin confirmar. PeerJS en modo JSON descarta en
   silencio mensajes de más de ~16 KB, por eso cada fragmento es de 15.000 caracteres.
4. Ambos reinician el lockstep en el cuadro `f`, con las entradas de `f … f+delay-1` a 0.
5. Si los hashes de RAM difieren, el anfitrión repite la sincronización (nueva época) y avisa con un toast.

### 9.5 Indicador de estado

En la barra: «Online · Jugador N · X ms», o «Esperando al otro jugador…» si no se avanza en 600 ms o hay una
sincronización en curso.

---

## 10. Despliegue

- **Hosting estático** (GitHub Pages, rama `main`, raíz). Todas las rutas DEBEN ser relativas para funcionar en
  `usuario.github.io/<repo>/`. HTTPS necesario para `crypto.subtle`, audio y mandos.
- **Local:** `node server.js 8080` (o `start.bat`). No se puede abrir con `file://`, porque `fetch` lo bloquea.
- **ROMs:** en un almacenamiento externo con CORS (por ejemplo, Azure Blob). Nunca en el repositorio.
- Peso aproximado de la página: index.html ~45 KB, jsnes ~100 KB, PeerJS ~90 KB.

---

## 11. Verificación (criterios de aceptación)

Al portar o modificar, comprobar como mínimo:

- [ ] **Determinismo del núcleo** (Node, sin navegador): dos instancias que cargan el mismo estado y reciben
      5000 cuadros de entradas aleatorias de 2 jugadores terminan con la misma RAM y el mismo estado de vídeo.
- [ ] La lista de juegos aparece en orden alfabético aunque `games.json` esté desordenado y con tildes.
- [ ] Un juego del catálogo se descarga y arranca; un fallo de CORS muestra el aviso y se puede cerrar.
- [ ] Una pulsación más corta que un cuadro llega al juego (por ejemplo, Start en el título).
- [ ] Guardar y cargar partida funcionan; el volumen se recuerda al recargar.
- [ ] Sin solapamientos ni desplazamiento horizontal a 1280×720, 1000×600 (barra en 2 líneas), 800×900 y móvil
      375×812 (comprobar con `getBoundingClientRect`).
- [ ] Online, con dos ventanas del mismo navegador: crear sala, unirse por código, unirse por enlace, ambos
      avanzan en el mismo cuadro, y aviso al desconectarse uno.
- [ ] Online con la conexión directa bloqueada (forzar `iceTransportPolicy: 'relay'`): ambos ven el error a los
      ~20 s y el anfitrión sigue esperando.
- [ ] Sin errores en la consola.

> Para probar el online en una sola pestaña: una página temporal con dos `<iframe>` de `index.html` lado a lado.
> Los iframes visibles reciben `requestAnimationFrame`; dos pestañas no, porque la que está oculta se pausa.

---

## 12. Problemas conocidos y lecciones aprendidas

| Problema | Causa | Solución aplicada |
|---|---|---|
| Pulsaciones rápidas perdidas | Pulsar y soltar entre dos cuadros | Latch por cuadro (§7.1) |
| Desincronización online | La frecuencia de audio del dispositivo altera la APU de jsnes | Frecuencia de emulación fija + remuestreo (§6.3) |
| El estado no llegaba al invitado | PeerJS (JSON) descarta mensajes de más de ~16 KB sin avisar | Fragmentos de 15 KB con confirmación (§9.4) |
| Brave ↔ Chrome en el mismo PC no conecta | Brave oculta la IP local y el router no hace *hairpin* | Mensaje de error explicativo; probar con el mismo navegador |
| Sin retransmisión en redes estrictas | Los TURN de PeerJS ya no existen | Pendiente: configurar un TURN propio (Cloudflare, Metered…) |
| ROMs del catálogo bloqueadas | Almacenamiento sin CORS | Regla CORS en el almacenamiento (§8.1) |
| La partida online se para | Un jugador cambia de pestaña (rAF se detiene) | Limitación conocida; indicador «Esperando…» |
| Enlaces antiguos rotos al renombrar el repo | GitHub no redirige las URLs de Pages | Avisar a los jugadores del nuevo enlace |

---

## 13. Cómo crear un emulador nuevo con esta plantilla

1. Copiar el repositorio y vaciar `games.json`.
2. Elegir un núcleo JavaScript (o WASM) que cumpla §4.1 y copiarlo a `vendor/` con su licencia.
3. Escribir el adaptador §4 y sustituir las llamadas a `nes.*` por él.
4. Ajustar la configuración (§3): nombre, extensiones, resolución, fps, botones, mapa de teclas, prefijo de sala
   y claves de almacenamiento propias.
5. Actualizar el panel de controles (§5.3) y la validación de cabecera de la ROM.
6. Pasar la prueba de determinismo (§11) **antes** de probar el online.
7. Subir las ROMs a un almacenamiento con CORS, rellenar `games.json` y publicar en GitHub Pages.
8. Recorrer la lista de verificación §11.
