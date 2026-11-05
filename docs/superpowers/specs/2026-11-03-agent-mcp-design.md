# nudo — Agent por MCP

Fecha: 2026-11-03 · Estado: aprobado (2026-11-03)

Referencia visual: Paper, archivo "nudo — redesign", página "03 Screens", artboard **"Editor · light · agent working (MCP)"** (https://app.paper.design/file/01M62E5QJN1E562Q52D2J5EAFR/p-3-0/288-0). El look es provisorio (hay un redesign en curso); lo que vale es la idea.

---

## 1. Qué es y por qué

Crear shaders hablando con un agent y verlos armarse **como nodos reales en nudo, en vivo**.

El momento: abro nudo (la versión deployada) y, en la terminal, le pido a Claude Code (que tiene el MCP de nudo cargado) "hacé un efecto dither copado". En nudo veo al agent trabajar como en Paper: aparece su cursor, se agregan nodos, se conectan wires, cambian valores y el preview se actualiza. Mientras tanto yo sigo usando el editor: navego, edito y puedo pisar lo que hizo el agent.

El grafo que arma el agent es el mismo `Graph` que edita la persona. No hay un "modo agent" ni código aparte. Esto sigue el principio rector del diseño original: el grafo es la fuente de verdad.

Es una feature **pública**: cualquiera que use nudo tiene que poder usarla sin instalar nada, y casi no debería costarle nada al proyecto.

## 2. Objetivos, no-objetivos, anti-objetivos

**Objetivos**
- Un **MCP web** (remoto, por HTTP) que cualquier cliente MCP (Claude Code, Cursor, Codex, …) pueda usar para leer y editar el grafo abierto en nudo.
- Ver el trabajo del agent en vivo, paso a paso, con el lenguaje visual del diseño de Paper (§6).
- Que la persona pueda seguir editando mientras el agent trabaja, sin bloqueos.
- Stop y Undo all desde nudo.
- Que funcione contra el nudo deployado sin instalar nada: se agrega con una URL que nudo te da para copiar.
- Costo cercano a cero: un Worker de Cloudflare sin base de datos. Cada usuario paga sus propios tokens.

**No-objetivos (por ahora)**
- Un chat dentro de nudo. El pedido se escribe siempre en el cliente del agent (la terminal).
- Cuentas de usuario, base de datos o guardar grafos en el servidor.
- Locks o resolución de conflictos fina entre persona y agent.
- El diseño visual final. Se usa el design system actual y el redesign lo resuelve después.

**Anti-objetivos (sería un fracaso aunque funcione)**
- Que alguien sin la key de una sesión pueda leer o modificar el grafo de otra persona.
- Que el servidor guarde grafos o datos de usuarios.
- Que el grafo "aparezca de golpe" y no se vea trabajar al agent.
- Que la persona quede bloqueada o pierda trabajo propio por algo que hizo el agent.
- Que un cambio del agent no se pueda deshacer.
- Que el agent rompa la app con un grafo inválido: todo pasa por las operaciones validadas del core.
- Que falle en silencio: si no hay conexión o la key es inválida, nudo lo dice y explica qué hacer.
- Que las nuevas UIs no se puedan usar con teclado (Stop, Undo all y el panel de actividad incluidos).

## 3. Decisiones tomadas

| # | Decisión | Elección | Quién |
|---|---|---|---|
| 1 | Dónde se escribe el pedido | En el cliente del agent (terminal). Nudo solo muestra y deja intervenir. | Usuario |
| 2 | Concurrencia | La persona edita libremente durante la tarea y puede pisar al agent. | Usuario |
| 3 | Target | El nudo deployado, además de `pnpm dev`. | Usuario |
| 4 | Audiencia | Pública. | Usuario |
| 5 | MCP web en vez de local | Servidor MCP remoto por HTTP (Streamable HTTP). No hay paquete npm ni `npx`. Lo propuso un compañero del equipo y el usuario lo aceptó. | Usuario |
| 6 | Hosting | **Cloudflare Workers + Durable Objects.** Para probar, en la cuenta personal del usuario (plan gratis, `*.workers.dev`). Después pasa a la cuenta de Cloudflare de JOYCO, que ya tiene Workers pago. | Usuario (cuenta); Claude (plataforma) |
| 7 | Fuente de verdad | **La pestaña de nudo.** El servidor no guarda el grafo: cada tool se convierte en un pedido a la pestaña, que lo aplica con las acciones del store. | Claude |
| 8 | Granularidad | Tools chicas, una acción visible por llamada (como `write_html` en Paper). | Claude |
| 9 | Seguridad | Key de sesión generada en nudo, que va en la URL del MCP y en la conexión de la pestaña (§5). | Claude |
| 10 | Conflictos | Sin locks. Ver §8b. | Claude |
| 11 | Identidad del agent | El label usa el `clientInfo.name` del handshake MCP ("Claude Code", "Cursor", …), no un texto hardcodeado. | Claude |
| 12 | Descartado: xmcp | Framework para escribir servidores MCP. No resuelve la conexión en tiempo real con la pestaña y lo típico es deployarlo en Vercel, que no mantiene WebSockets. | Claude |
| 13 | Descartado: MCP de joyco | Es un CLI local que requiere `joyco login`, pensado para el equipo y no para usuarios públicos. | Claude |

**Cambio respecto del diseño original:** `2026-10-26-nudo-tsl-design.md` dejaba "backend" como no-objetivo. Esta feature agrega uno chico y sin estado persistente: un Worker que solo hace de puente.

## 4. Arquitectura

```
Claude Code ──HTTPS (MCP)──▶ Worker nudo-mcp ──▶ Durable Object (uno por key) ◀──WebSocket── pestaña de nudo
                                                                                              └─ store zustand (Graph)
```

**`apps/mcp`** (Cloudflare Worker, en el repo de nudo para versionar protocolo y editor juntos)
- Endpoint MCP por Streamable HTTP, por ejemplo `/mcp/<key>`. La implementación (SDK oficial, el soporte MCP de Cloudflare o la librería que convenga) la elige el builder.
- Endpoint WebSocket `/bridge/<key>` al que se conecta la pestaña.
- **Un Durable Object por key.** Junta las dos puntas: recibe la tool del agent, se la manda a la pestaña por el WebSocket, espera la respuesta (con timeout) y la devuelve. No persiste nada además del estado efímero de la sesión: tarea activa y agent conectado.
- No conoce el catálogo de nodos: se lo pide a la pestaña, así el Worker y el nudo deployado no se desincronizan.
- Usa WebSocket Hibernation para no cobrar tiempo mientras la pestaña está inactiva.

**Protocolo puente** (TS compartido entre `apps/mcp` y el editor; dónde vive lo decide el builder)
- Mensajes JSON tipados y validados en los dos extremos: `hello` (versión de protocolo), `request`/`response` con id, y eventos `presence`.
- **Versión de protocolo.** Si no coincide, nudo muestra "Recargá nudo" y no opera. El Worker y el editor se deployan juntos.

**En el editor: `apps/editor/src/features/agent`**
- Cliente WS, gestión de la key, ejecución de pedidos contra el store y estado de presencia (en un slice nuevo, fuera del historial de undo).
- La URL del Worker sale de una variable de entorno (`VITE_NUDO_MCP_URL`) y no está hardcodeada, para poder mover el Worker de cuenta.
- La lógica (ejecutar un pedido, validar mensajes) se mantiene fuera de React, como el resto del editor.

**Varias sesiones de agent.** Varias sesiones de Claude Code pueden usar la misma URL a la vez, pero solo una tiene tarea activa (§8b).

**Varias pestañas de nudo.** Comparten la key (el browser la guarda), pero el Durable Object habla con una sola: la última que tuvo foco. Las demás muestran "El agent está trabajando en otra pestaña".

## 5. Emparejamiento y seguridad

1. **Key.** Nudo genera una key aleatoria (32 bytes, base64url) la primera vez que abrís "Conectar agent" y la guarda en el browser.
2. **Conectar.** El panel muestra el comando listo para copiar: `claude mcp add --transport http nudo https://<worker>/mcp/<key>` (más variantes para otros clientes). Lo pegás en la terminal y listo.
3. **La key es el secreto.** Quien la tenga puede controlar tu nudo mientras esté abierto. Por eso:
   - el panel lo dice en una línea;
   - hay un botón **"Generar key nueva"** que invalida la anterior (la pestaña se reconecta con la nueva, y el agent tiene que volver a agregarse);
   - el Worker nunca loguea keys;
   - el Durable Object rechaza todo lo que no llegue con la key exacta.
4. **Origin.** El WebSocket `/bridge` acepta solo conexiones con `Origin` del dominio de nudo (y `localhost:5173` para dev). El endpoint MCP no puede chequear `Origin` porque lo llama un CLI, así que ahí la key es la única protección.
5. **Browsers.** Es un WebSocket común a un dominio https: funciona en Chrome, Firefox y Safari sin permisos especiales.

## 6. Lo que ve la persona en nudo

Todo esto sale del diseño en Paper. El estilo usa el design system actual y el color propio del agent (token `--color-agent` de ese archivo).

- **Estado de conexión.** En el toolbar: desconectado, "Conectar un agent" (abre un panel con el comando para copiar y los pasos), o conectado.
- **Chip de trabajo.** En el toolbar: el paso actual más un timer (por ejemplo "Adding Voronoi 0:14").
- **Panel de actividad.** El pedido del usuario entre comillas, la lista de pasos con su estado (hecho / en curso / pendiente, con detalle tipo "4.00 → 7.50" o "step 3 of 4"), y los botones **Stop** y **Undo all**. Se cierra cuando termina la tarea; el último resumen se puede volver a abrir.
- **En el canvas:**
  - El cursor del agent con su nombre, que viaja hacia el nodo o puerto que está tocando.
  - Un tag "<Agent> · editing" sobre el nodo que está editando.
  - Un nodo fantasma ("adding…") justo antes de crear uno, y un wire punteado mientras conecta.
  - Un badge "by <Agent>" en los nodos que creó en la tarea actual.
- **Preview.** Un badge "Updating live" mientras el agent está cambiando cosas.
- **Ritmo.** Cada acción tarda al menos lo que dura su animación (cursor viajando, ghost que se materializa), para que se pueda seguir. Con `prefers-reduced-motion` no hay viaje del cursor y la acción es inmediata.
- **El viewport no se mueve solo.** El agent no le saca la cámara a la persona. Si trabaja fuera de vista, aparece un indicador en el borde del canvas que lleva hasta ahí (con teclado incluido).
- **Teclado.** Stop, Undo all, el panel y el indicador de borde funcionan con Tab/Enter, y Escape cierra el panel.

## 7. Tools del MCP (primer borrador)

Lectura:
- `get_graph`: nodos (id, tipo, posición, valores de inputs y params), edges, propiedades y errores de compilación.
- `list_node_types`: catálogo con categorías, puertos (nombre y tipo) y params. Puede filtrarse por texto o categoría.
- `get_code`: el TSL generado.
- `get_preview_image`: captura del preview principal (PNG). Le permite al agent ver si el dither "se ve copado" y corregir.

Escritura (cada una es una acción visible y una entrada de undo):
- `add_node(type, position?)`: si no se pasa `position`, nudo elige un lugar libre cerca del contexto.
- `remove_nodes(ids)`, `move_nodes(positions)`
- `connect(from, to)`, `disconnect(edgeIds)`
- `set_input(ref, value)`, `set_param(ref, value)`
- `add_property(kind, name?)`, `set_property(...)`, `remove_property(id)`
- `tidy_up()`: el mismo Tidy up del editor.
- `new_graph()` / `load_template(id)`: reemplazan el grafo, así que **piden confirmación a la persona en nudo** si el grafo tiene contenido.

Tarea y presencia:
- `start_task(prompt, steps?)` y `set_step(label, detail?)`: alimentan el panel y el chip.
- `finish_task(summary?)`: cierra la tarea. Si el agent no la cierra, se cierra sola tras un tiempo sin actividad.

Respuestas:
- Toda escritura devuelve el resultado más los errores de compilación nuevos, así el agent ve el efecto de cada paso sin pedir el grafo entero.
- Si la persona apretó **Stop**, toda tool de escritura devuelve `stopped_by_user` hasta un nuevo `start_task`.

## 8. Comportamientos

- **Escrituras.** Pasan por las mismas acciones del store que usa la UI, con sus validaciones. Cada cambio es una entrada en el historial (zundo), dispara el autosave y recompila el preview.
- **Conflictos.** Si un id ya no existe o una conexión no es válida, la tool devuelve un error con un fragmento del estado actual. Si la persona deshace un cambio del agent, el agent lo descubre en su próxima lectura o escritura. No hay locks.
- **Stop.** Corta la tarea: no se revierte nada y las escrituras siguientes se rechazan.
- **Undo all.** Vuelve el grafo a como estaba antes de `start_task`, como **una** entrada de undo (así un Ctrl+Z lo recupera). Si la persona editó durante la tarea, primero pide confirmación avisando que también se pierden esos cambios.
- **Sin conexión.** Si la pestaña se cierra a mitad de tarea, el Durable Object responde "nudo no está abierto: pedile a la persona que lo abra" y la tarea queda cortada. Cuando la pestaña vuelve, se reconecta sola con la misma key.

## 8b. Decisiones tras la revisión (calls de Claude)

- **Estado de la tarea.** Hay tres estados: `idle`, `active` y `stopped`. Una escritura sin tarea activa abre una tarea implícita ("<Agent> editando"), así siempre hay una presencia que mostrar y un snapshot para Undo all. **Stop** pasa a `stopped`, y solo la persona sale de ese estado con "Dejar continuar" en el panel. `start_task` no lo destraba. El error `stopped_by_user` le indica al agent que pare y le pregunte a la persona.
- **Un agent activo por vez.** Pueden conectarse varias sesiones, pero solo una tiene tarea activa. Las demás reciben `busy` (con el nombre del agent que está trabajando) en cualquier escritura. Así el panel, Stop y Undo all siguen siendo singulares, y Undo all nunca borra el trabajo de otro agent. Ver varios agents trabajando a la vez queda para después.
- **Conflictos: gana la última escritura.** Solo da error si el target no existe o si la operación es inválida. No hay revisiones ni valores esperados. Coincide con "puedo pisar al agent, no hay problema".
- **Animación y respuesta.** La pestaña procesa los pedidos de a uno, en cola. La animación de llegada (cursor, ghost) corre primero, después se aplica el cambio al grafo y recién ahí se responde. El agent nunca lee un estado que todavía no se ve. Con reduced motion se aplica y responde de inmediato. Los timeouts de las tools cubren la animación.

## 9. Lo que queda para el builder

- La forma exacta de los mensajes del puente y de los esquemas de las tools (con validación en los dos extremos, sin `any`).
- Dónde vive el código compartido del protocolo.
- Los timeouts.
- La allowlist de `Origin` del Worker se configura con una variable (`ALLOWED_ORIGINS`), así el dominio deployado se carga sin tocar código.
- Las duraciones y curvas de las animaciones de presencia, respetando `prefers-reduced-motion`.
- Cómo se elige la posición automática de `add_node`.
- Tests: protocolo y ejecutor de pedidos con unit tests; un e2e de Playwright que levante el Worker con `wrangler dev`, conecte el editor y arme un grafo chico.
- Documentación: sección en el README y página de instalación.

## 10. Pendientes que no son del builder

- **Dominio deployado** de nudo, para la allowlist de `Origin`.
- **Dominio del Worker.** Para probar, `*.workers.dev` en la cuenta personal. Después, la cuenta de JOYCO y, en lo posible, un dominio propio y estable (por ejemplo `mcp.<dominio-de-nudo>`), así la URL no vuelve a cambiar.

**Alcance de la v1 (decidido por el usuario):** todo lo de §6 y §7. Las piezas que el usuario marcó como centrales son el chip de trabajo en el toolbar, el tag "<Agent> · editing" con el cursor, el nodo fantasma "adding…" con su wire punteado y el panel de actividad con los pasos.
