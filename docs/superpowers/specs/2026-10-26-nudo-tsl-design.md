# nudo-tsl — Diseño

Fecha: 2026-10-26 · Estado: aprobado (2026-10-26), incluye P1–P4

Documento interno de diseño. La especificación pública del formato de archivo (fase 4) se escribe aparte y en inglés.

---

## 1. Qué es y por qué

Editor visual de shaders basado en nodos (estilo Unity Shader Graph / Blender) que produce **código TSL portable** para three.js y React Three Fiber.

Diferencial: en Unity el shader queda encerrado en Unity. Acá el output es código TSL limpio, y el proyecto se puede volver a abrir para seguir editando.

**Público**
- Primario: creative developers three.js/R3F. Ellos mandan en las decisiones técnicas: código limpio, tipado y un export de calidad.
- Secundario: gente aprendiendo shaders. Necesita previews por nodo, tooltips, ejemplos y ver el código.
- Terciario: artistas sin código. Necesitan presets y una UI amable.
- Divulgación progresiva: lo avanzado (ver código, subgraphs, Code Node) aparece cuando el usuario lo busca.

**Principio rector:** el grafo es la fuente de verdad. El código TSL es un artefacto generado. Nunca se parsea JavaScript arbitrario para reconstruir un grafo.

## 2. Objetivos, no-objetivos, anti-objetivos

**Objetivos**
- Armar shaders conectando nodos, con preview en tiempo real (WebGPU con fallback automático a WebGL2).
- Exportar `.tsl.js` legible, comentado y listo para pegar en un proyecto three.js/R3F.
- Re-importar exactamente lo exportado (bloque `@graph`).
- Hacer el editor completamente operable con teclado.
- Tener una API de nodos simple para que la comunidad agregue los suyos.

**No-objetivos (por ahora)**
- Publicar paquetes en npm. Todo queda privado en el monorepo; se revisa en la fase 4 (ver §10).
- Backend, cuentas de usuario o almacenamiento en la nube. Todo corre en el cliente.
- SSR/SEO del editor.
- Parsear código TSL escrito a mano para convertirlo en grafo.

**Anti-objetivos (sería un fracaso aunque funcione)**
- Que el preview y el código exportado se comporten distinto.
- Que mover un slider recompile el shader o trabe la UI.
- Que la lógica de negocio quede dentro de componentes React.
- Que un error de compilación rompa la app en vez de marcar el nodo.
- Que haga falta un mouse para algo.
- Que un proyecto viejo deje de abrir al cambiar el formato.

## 3. Decisiones tomadas (aprobadas en chat el 2026-10-26)

| # | Decisión | Elección |
|---|---|---|
| 1 | Framework del editor | **React + Vite** (SPA). Se elimina el scaffold de Next.js actual. Si más adelante hace falta un sitio de docs o galería, va en `apps/site` por separado. |
| 2 | Paridad preview ↔ export | **Facade genérica `TslFacade<E>`**: cada nodo escribe un único `build<E>`. El backend live pasa una facade sobre `three/tsl`; el backend codegen pasa una que emite código. |
| 3 | Backend live | Vive en `packages/runtime` desde la fase 1. El editor lo consume para el preview (dogfooding). |
| 4 | Sistema de tipos | `float, vec2, vec3, vec4, texture`. `color` es un hint de widget, no un tipo. Hay puertos genéricos estilo Unity y conversiones automáticas explícitas en el código generado. |
| 5 | Fuente de verdad en el editor | `Graph` del core en Zustand, del que se derivan nodos y edges de React Flow. Undo/redo con zundo, solo sobre el grafo. |
| 6 | Build de paquetes internos | Los paquetes exportan el TS fuente y Vite lo consume directo. No hay build de paquetes hasta que haga falta. |
| 7 | Nombres | Scope interno `@nudo-tsl/*`. Todos los paquetes con `"private": true`. |
| 8 | Design system | El de **joyco/gltf** (ver §8). |

## 4. Arquitectura

### 4.1 Monorepo

pnpm workspaces + Turborepo, TypeScript estricto (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).

```
nudo-tsl/
├─ apps/
│  └─ editor/                      # React + Vite SPA
│     └─ src/
│        ├─ app/                   # bootstrap, providers, layout de paneles
│        ├─ features/
│        │  ├─ canvas/             # React Flow: graph-canvas, node-view, port-handle, typed-edge
│        │  ├─ add-node-menu/      # buscador por categorías (Espacio / click derecho)
│        │  ├─ master-stack/
│        │  ├─ main-preview/       # R3F + WebGPURenderer
│        │  ├─ inspector/          # fase 2
│        │  ├─ blackboard/         # fase 2
│        │  └─ code-panel/         # fase 2 (propuesta P1)
│        ├─ store/                 # graph-slice (zundo), ui-slice, compile-slice
│        └─ shared/
│           ├─ ui/                 # componentes shadcn (radix-nova + registry @joyco)
│           └─ theme/              # tokens, colores por tipo de puerto
├─ packages/
│  ├─ core/                        # CERO React / DOM / three
│  │  └─ src/
│  │     ├─ types/                 # data-type, ids, graph, node-definition, tsl-facade, result
│  │     ├─ graph/                 # operaciones puras: add-node, connect, remove-nodes, ...
│  │     ├─ validation/            # compatibilidad de tipos, detección de ciclos
│  │     ├─ type-inference/        # resolución de puertos genéricos
│  │     ├─ compiler/              # recorrido desde el target con memo, genérico sobre backend
│  │     ├─ registry/              # NodeRegistry
│  │     └─ serialization/         # schemaVersion + cadena de migraciones (base desde el día 1)
│  ├─ nodes/                       # definiciones de nodos; solo usan la facade, sin three
│  │  └─ src/{input,math,interpolation,vector,effects,texture,utility,master}/*.ts
│  ├─ runtime/                     # backend live: facade sobre three/tsl, uniforms, armado del material
│  └─ codegen/                     # backend codegen: facade que emite strings + printer
├─ docs/
├─ turbo.json  pnpm-workspace.yaml  tsconfig.base.json
└─ .github/workflows/ci.yml
```

**Dependencias permitidas**
- `core`: nada (solo devDeps de test).
- `nodes`: `core`.
- `runtime`: `core`, `nodes`, `three`.
- `codegen`: `core`, `nodes`.
- `editor`: todos.

ESLint (`no-restricted-imports`) hace cumplir estas fronteras.

### 4.2 Tipos del core

```ts
// types/data-type.ts
export const DATA_TYPES = ['float', 'vec2', 'vec3', 'vec4', 'texture'] as const;
export type DataType = (typeof DATA_TYPES)[number];
export type VectorType = Exclude<DataType, 'texture'>;

/** Concrete type, or a generic "dynamic vector" resolved by inference (Unity-style). */
export type PortTypeSpec =
  | { kind: 'concrete'; type: DataType }
  | { kind: 'generic'; group: string; allowed: readonly VectorType[] };

export type PortValue =
  | { type: 'float'; value: number }
  | { type: 'vec2'; value: readonly [number, number] }
  | { type: 'vec3'; value: readonly [number, number, number] }
  | { type: 'vec4'; value: readonly [number, number, number, number] }
  | { type: 'texture'; assetId: string | null };

// types/ids.ts
type Brand<T, B extends string> = T & { readonly __brand: B };
export type NodeId = Brand<string, 'NodeId'>;
export type EdgeId = Brand<string, 'EdgeId'>;
export type NodeTypeId = string; // namespaced: 'math/add', 'community/my-noise'

// types/graph.ts
export interface PortRef { readonly nodeId: NodeId; readonly portId: string }

export interface GraphNode {
  readonly id: NodeId;
  readonly type: NodeTypeId;
  readonly position: { readonly x: number; readonly y: number };
  /** Values for unconnected inputs. Live: uniform(). Changing them never recompiles. */
  readonly inputValues: Readonly<Record<string, PortValue>>;
  /** Structural settings (noise kind, code source). Changing them recompiles. */
  readonly params: Readonly<Record<string, ParamValue>>;
}

export interface GraphEdge { readonly id: EdgeId; readonly from: PortRef; readonly to: PortRef }

export interface Graph {
  readonly schemaVersion: 1;
  readonly nodes: Readonly<Record<NodeId, GraphNode>>;
  readonly edges: Readonly<Record<EdgeId, GraphEdge>>;
  readonly properties: readonly BlackboardProperty[];
}

// types/node-definition.ts
export interface NodeDefinition<I extends string, O extends string> {
  readonly type: NodeTypeId;
  readonly category: NodeCategory;
  readonly label: string;
  readonly description: string;          // tooltip
  readonly keywords: readonly string[];  // add-node search
  readonly inputs: readonly InputDefinition<I>[];
  readonly outputs: readonly OutputDefinition<O>[];
  /** Written once, runs on both backends. */
  build<E>(ctx: BuildContext<E, I>): Readonly<Record<O, E>>;
}

export interface BuildContext<E, I extends string> {
  readonly tsl: TslFacade<E>;
  readonly inputs: Readonly<Record<I, E>>;
  readonly resolvedTypes: Readonly<Record<I, DataType>>;
  readonly params: Readonly<Record<string, ParamValue>>;
}

// compiler
export type CompileTarget =
  | { kind: 'master' }
  | { kind: 'port'; ref: PortRef }; // per-node previews (phase 2) reuse this

export type CompileResult<E> =
  | { ok: true; slots: Partial<Record<MasterSlot, E>> }
  | { ok: false; errors: readonly CompileError[] };

export interface CompileError {
  readonly nodeId: NodeId;
  readonly code: 'missing-definition' | 'unresolved-type' | 'build-failed';
  readonly message: string;
}

export type ConnectionCheck =
  | { ok: true; conversion: Conversion | null }
  | { ok: false; reason: 'type-mismatch' | 'cycle' | 'same-node' };
```

Ejemplo de nodo:

```ts
export const lerpNode = defineNode({
  type: 'interpolation/lerp',
  category: 'interpolation',
  label: 'Lerp',
  description: 'Linearly interpolates between A and B by T.',
  keywords: ['mix', 'blend', 'interpolate'],
  inputs: [
    { id: 'a', label: 'A', type: generic('T'), default: vec4(0) },
    { id: 'b', label: 'B', type: generic('T'), default: vec4(1) },
    { id: 't', label: 'T', type: concrete('float'), default: float(0.5) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: generic('T') }],
  build: ({ tsl, inputs }) => ({ out: tsl.mix(inputs.a, inputs.b, inputs.t) }),
});
```

**Reglas del core**
- Las operaciones del grafo son funciones puras que devuelven `Result<Graph, GraphError>`. No tiran excepciones.
- El Master Stack es un nodo con id fijo `master`. `removeNodes` lo rechaza.
- Conectar a un input ya ocupado reemplaza el edge anterior.
- Los ids se generan con `nanoid`. El `portId` es una clave estable de la definición, nunca un índice, para que las migraciones sean seguras.

### 4.3 Sistema de tipos y conversiones

- **Genéricos:** todos los puertos de un mismo `group` dentro de un nodo resuelven al tipo vectorial más ancho entre sus conexiones. Sin conexiones, resuelven al tipo de su valor por defecto. La inferencia corre en orden topológico.
- **Conversiones automáticas:**
  - `float → vecN`: splat.
  - `vecN → vecM` con M < N: truncar.
  - `vecN → vecM` con M > N: rellenar con 0, y con 1 en `w`.
  - `texture` solo conecta con `texture`.
- La conversión queda registrada en el resultado de la validación. El compilador la emite explícita en el código generado (por ejemplo `vec3(x)`) y el cable la muestra con un marcador visual.
- No se permiten ciclos (DFS desde el destino del edge propuesto).

### 4.4 Compilador

- Es genérico sobre `E` y recibe `(graph, registry, backend, target)`.
- Recorre desde el target hacia atrás con memoización por `nodeId`: cada nodo se evalúa una sola vez.
- Los inputs sin conectar se resuelven con `backend.inputValue(ref, resolvedType, value)`:
  - **Live:** `uniform(value)`, guardado en un mapa `nodeId:portId` para actualizar `.value`.
  - **Codegen:** un literal (`float(0.5)`, `vec3(...)`, `color(0x...)` cuando el hint es color).
- Las propiedades del Blackboard se resuelven con `backend.property(prop)`, que devuelve un uniform nombrado en los dos backends.
- Un `build` que tira error se captura y se convierte en un `CompileError` asociado a ese nodo. El resto de la app sigue funcionando.
- **Clave de topología:** hash de tipos de nodo, params y edges, sin valores ni posiciones. Solo se recompila si cambia esa clave, con debounce de ~150 ms. Cambiar un valor solo toca `.value`.

### 4.5 `TslFacade<E>`

Es una interfaz en `core` con el subset de TSL que usan los nodos, en estilo funcional (`tsl.mul(a, b)`, no `a.mul(b)`):
- **Aritmética y matemática:** add, sub, mul, div, pow, sin, cos, abs, fract, floor, min, max, clamp, oneMinus, remap.
- **Interpolación:** mix, step, smoothstep.
- **Vectores:** dot, length, normalize, swizzle, constructores float/vec2/vec3/vec4.
- **Builtins:** time, uv, positionLocal, positionWorld, normalWorld, normalView, positionViewDirection, screenUV.
- **Efectos:** noise y voronoi (fase 2), texture sample (fase 2).

La facade crece cuando un nodo lo necesita. Agregar una función implica implementarla en los dos backends; un test de contrato lo verifica.

El Code Node (fase 4) es la única vía de escape:
- **Live:** `new Function` con la facade real inyectada.
- **Codegen:** el texto se pega tal cual.
- **Seguridad:** un grafo que viene de una URL compartida o de un archivo importado y contiene Code Nodes **no los ejecuta** hasta que el usuario confirma. Mientras tanto, esos nodos se muestran desactivados con un aviso. El grafo marca `containsCode: true` en el manifest.

**Versión de three y helpers**
- Se fija una única versión exacta de `three` en el monorepo. El `.tsl.js` declara en el header para qué versión fue generado.
- El export puede incluir helpers `Fn(...)` inline cuando un nodo no tiene equivalente directo en `three/tsl` (por ejemplo simplex noise). Perlin y voronoi usan `mx_noise_float` / `mx_worley_noise_float` cuando alcanzan.

### 4.6 Runtime (backend live)

- Facade sobre `three/tsl` (`E` = nodo TSL).
- Registro de uniforms por `nodeId:portId` y por propiedad.
- `createMaterial(graph, registry)` devuelve `{ material: MeshStandardNodeMaterial, uniforms, errors }`.
- Mapeo del Master Stack:

| Slot | Propiedad del material |
|---|---|
| Position (vertex) | `positionNode` |
| Base Color | `colorNode` |
| Emission | `emissiveNode` |
| Metalness | `metalnessNode` |
| Roughness | `roughnessNode` |
| Normal | `normalNode` |
| Opacity | `opacityNode` (+ `transparent = true` si está conectado o si su valor inline es < 1) |

- Los slots `Position` y `Normal` sin conectar no se asignan, así el material usa su default. Los demás slots tienen un valor inline (uniform), igual que en Unity.

### 4.7 Editor

- **Store Zustand:**
  - `graph-slice`: el `Graph` del core. zundo trackea solo este slice. El arrastre de nodos registra un paso al soltar.
  - `ui-slice`: selección, viewport, paneles abiertos y tema.
  - `compile-slice`: errores por nodo y estado del compilador.
- **React Flow como vista:**
  - Nodos y edges derivados por selector memoizado.
  - Los eventos de React Flow se traducen a operaciones del core.
  - Los tipos de React Flow nunca entran en `core`.
- **Patrón contenedor-presentacional:** los contenedores hablan con el store; los componentes de vista reciben props.
- **Main Preview:**
  - R3F con `WebGPURenderer` y fallback a WebGL2.
  - Mallas: esfera, cubo, plano, torus y GLB propio.
  - Orbit controls, luz básica y fondo configurable.
- **Edición de valores (desde la fase 1):** los inputs sin conectar muestran campos inline dentro del nodo, igual que en Unity: número con drag y teclado, vector y color picker. No dependen del Inspector.
- **Autosave (desde la fase 1):** el grafo se guarda en `localStorage` con `schemaVersion`, y pasa por la cadena de migraciones al cargarlo. Las texturas (fase 2) van a IndexedDB hasta que exista `.tslproj`.
- **Errores:** el nodo con error se marca con borde `destructive` y un mensaje visible (no solo por color).

## 5. Accesibilidad y teclado (requisito, no extra)

- Todo nodo es alcanzable con Tab, con focus visible usando el ring del design system.
- Con un nodo enfocado:
  - Flechas mueven el nodo (Shift = paso grande).
  - Delete / Backspace lo borra.
  - Enter entra al nodo y lleva el foco a su primer campo inline; Escape vuelve al nodo. En la fase 2, Enter también abre el inspector.
- **Conectar con teclado:** enfocar un puerto, Enter, se abre un listbox con los puertos compatibles del grafo (con buscador), Enter conecta.
- Desconectar desde el puerto con Delete.
- Espacio abre el menú de agregar nodo:
  - Es un combobox con buscador (cmdk).
  - El nodo nuevo aparece en el centro del viewport o junto al nodo enfocado.
- Atajos globales:
  - Ctrl/⌘+Z y Ctrl/⌘+Shift+Z: undo / redo.
  - Ctrl/⌘+C / V: copiar / pegar.
  - Ctrl/⌘+A: seleccionar todo.
  - F: encuadrar.
  - Escape cierra cualquier overlay y devuelve el foco a quien lo abrió.
- Los tipos de puerto se indican con color **y** texto (`1 / 2 / 3 / 4 / T`). Nunca solo con color.
- Hay una lista de atajos documentada, accesible desde la UI con `?`.

## 6. Formato de proyecto, export e import (fase 3)

**Estructura del proyecto**
- `project.json`: manifest con name, schemaVersion, editorVersion y fechas.
- `graphs/main.graph.json` y `graphs/subgraphs/*.graph.json`.
- `assets/textures/*`.
- `exports/main.tsl.js`.
- `thumbnails/main.png`.
- `.tslproj` es la misma carpeta comprimida en zip (JSZip).

**`.tsl.js`**
- Imports de `three/tsl`.
- Uniforms del Blackboard exportados con nombre.
- Shader exportado como objeto con slots listo para asignar a `MeshStandardNodeMaterial`.
- Bloque de comentario `@graph` al final, con el JSON del grafo y el hash (SHA-256) del código de arriba.

**Import**
- Abre `.tslproj`, una carpeta o un `.tsl.js`. En el `.tsl.js` solo se lee el bloque `@graph`.
- Si el hash no coincide, se avisa que se abre la versión del grafo.

**Versionado**
- `schemaVersion` en todo archivo desde el día 1.
- Migraciones encadenadas `vN → vN+1` en `core/serialization`, con test por migración.

## 7. Catálogo de nodos

**Fase 1 (10 + Master Stack):** Float, Color, Time, UV, Normal, Add, Multiply, Sin, Lerp y Fresnel.

**Fase 2 (catálogo completo):**
- Input: Vector2, Vector3, Position, View Direction, Screen UV.
- Math: Subtract, Divide, Power, Cos, Abs, Fract, Floor, Min, Max, Clamp, One Minus, Remap.
- Interpolación: Step, Smoothstep.
- Vector: Split, Combine, Dot, Length, Normalize.
- Efectos: Noise (simplex / perlin), Voronoi, Checkerboard, Gradient.
- Texture: Sample Texture 2D.
- Utilidad: Group / Comment.

**Fase 4:** Code Node y subgraphs.

Los nodos de valor (Float, Color, …) se modelan como un input con valor inline más un output de passthrough. Así todo valor editable es un uniform.

## 8. Diseño de UI: design system de joyco/gltf

Fuente: https://github.com/joyco-studio/gltf (live: https://gltf.joyco.studio).

- **Base:**
  - shadcn, estilo `radix-nova`, baseColor `neutral`, iconos `lucide`.
  - Registry `@joyco` (`https://registry.joyco.studio/r/{name}.json`).
  - Tailwind v4 + `tw-animate-css`.
- **Tokens:** copiar `app/globals.css` de joyco/gltf tal cual:
  - Escala de grises oklch neutral.
  - `--radius: 0` (esquinas rectas).
  - `--gap: 0.25rem` y componente `Cluster`.
  - Scrollbars finas.
  - Variante `hocus`.
  - Dark: background `oklch(0.1684 0 0)`, card `oklch(0.2046 0 0)`.
- **Primario:** azul eléctrico `oklch(0.452 0.313 264)`. Se reserva para la acción principal, la selección y el foco. **No** se usa como color de puerto.
- **Tipografía:**
  - Public Sans para la UI.
  - Roboto Mono para valores, labels de puerto, tipos, código y labels en mayúsculas con tracking.
  - En Vite se cargan con `@fontsource-variable/*`.
- **Lenguaje visual:**
  - Header flotante tipo `Cluster` (logo sobre bloque primario, botones `accent` size `sm`, `Kbd` para atajos).
  - Paneles con bordes de 1px y grilla visible.
  - Sin sombras pesadas.
  - Tema dark por defecto, light disponible (`next-themes` también funciona fuera de Next, o un toggle propio).
- **Colores por tipo de puerto:** paleta propia con tonos alejados del azul primario. Valores iniciales, se ajustan y validan contraste en la fase de UI:

| Tipo | Color |
|---|---|
| float | cyan `oklch(0.78 0.12 200)` |
| vec2 | verde `oklch(0.75 0.17 150)` |
| vec3 | ámbar `oklch(0.82 0.16 80)` |
| vec4 | magenta `oklch(0.72 0.2 330)` |
| texture | naranja-rojo `oklch(0.7 0.19 35)` |

- **Layout:**
  - Canvas a pantalla completa.
  - Blackboard colapsable a la izquierda.
  - Inspector y Main Preview colapsables a la derecha.
  - Header flotante arriba.
- **Proceso:** todo build de UI sigue el flujo Better Design. Se usa `extract-from-url` sobre gltf.joyco.studio solo para confirmar el acento y la fuente; los tokens vienen del repo. Después: principles, build, review (`get-review-rules`, `check-comprehension`, `inspect-spacing`) y skill `keyboard-accessibility`.

## 9. Propuestas extra (aprobadas)

- **P1. Panel de código en vivo (fase 2).** Un panel colapsable muestra el `.tsl.js` generado y se actualiza al conectar nodos. Con la facade genérica, codegen sale casi gratis, así que se adelanta un codegen básico a la fase 2 (el bloque `@graph`, el hash y la prolijidad final quedan en la fase 3). Sirve para aprender y genera confianza en el export.
- **P2. Compartir por URL (fase 3).**
  - El grafo se comprime (`CompressionStream` deflate + base64url) en el hash de la URL.
  - Funciona sin backend; es el mismo patrón que joyco/gltf con su estado compartible.
  - Las texturas no viajan: se referencian por URL o se avisa que faltan.
- **P3. El portapapeles es un fragmento de grafo JSON (fase 1, con copiar/pegar).** Copiar nodos produce JSON válido, versionado y re-pegable entre pestañas o personas (Discord, issues). Sale casi gratis porque copiar/pegar ya está en la fase 1.
- **P4. Snippet R3F en el export (fase 3).** El `.tsl.js` incluye en un comentario el uso con `<meshStandardNodeMaterial {...shader} />`.

## 10. npm: por qué no ahora

- El editor y el `.tsl.js` exportado no necesitan npm: el código generado solo importa `three/tsl`.
- El único caso con valor real es `runtime`: cargar un `.graph.json` en tu app sin exportar código.
- Un caso secundario es que la comunidad escriba nodos con tipos de `core`.
- Se decide en la fase 4. Hasta entonces todo es `private`.

## 11. Stack y tooling

- **App:** React 19 + Vite, `@xyflow/react`, Zustand + zundo, three (`three/webgpu`, `three/tsl`), `@react-three/fiber` + drei (OrbitControls), JSZip (fase 3), nanoid.
- **Calidad:** Vitest (core y nodes con cobertura alta; runtime con tests de compilación sin renderer), Playwright (e2e y teclado).
- **Lint y formato:** ESLint flat, Prettier, Husky, Commitlint (Conventional Commits).
- **CI:** GitHub Actions (lint, typecheck, test, build). Deploy en Vercel (estático).
- **Licencia:** MIT.

## 12. Roadmap

- **Fase 1:**
  - Monorepo y tooling.
  - `core`: tipos, operaciones, validación, inferencia, compilador y base de serialización.
  - 10 nodos + Master Stack.
  - `runtime`: facade live + material.
  - Editor: canvas, menú de agregar, Master Stack, Main Preview, undo/redo, copiar/pegar (P3), teclado completo.
- **Fase 2:**
  - Previews por nodo: un renderer compartido renderiza a render targets chicos y solo se re-renderizan los nodos afectados.
  - Blackboard, Inspector, catálogo completo y panel de código (P1).
- **Fase 3:** export `.tsl.js` final con `@graph`, `.tslproj`, import, migraciones, compartir por URL (P2) y snippet R3F (P4).
- **Fase 4:** pulido del runtime (y decisión de npm), Code Node, subgraphs, docs y spec pública del formato.
- **Fase 5:** galería de ejemplos, presets y plugins de la comunidad.

## 13. Decisiones del autor del doc (revisar)

- Autosave en `localStorage` desde la fase 1, con migraciones aplicadas al cargar.
- Edición inline de valores en el nodo desde la fase 1. Enter entra al nodo.
- Code Nodes de origen externo desactivados hasta que el usuario confirma.
- `three` fijado a una versión exacta; el export puede incluir helpers `Fn` inline.

## 14. Queda a criterio del builder

- Nombres internos de archivos y funciones dentro de la estructura de §4.1.
- La lista exacta de funciones de la facade, que crece por demanda.
- Valores por defecto de cada nodo y de los slots del Master Stack.
- Algoritmo del hash de topología.
- Detalles de animación y microinteracciones, dentro del sistema de joyco y respetando `prefers-reduced-motion`.

## 15. Fases 2–5 en detalle (agregado 2026-10-26, después de cerrar la fase 1)

El usuario pidió avanzar con todas las fases que faltan con una meta explícita: que quede **un producto increíble**. Esta sección fija el alcance. Las decisiones marcadas *(autor)* son mías; el resto viene del chat.

### 15.1 Meta de calidad: el pond de lettra

El agua ilustrada de `joyco-studio/lettra-landing` (`src/lib/scenes/models/water.ts`) es el **shader de referencia**. La fase 2 se considera completa cuando nudo puede recrear esa estética como grafo y el ejemplo está incluido en el repo:
- rosetas Voronoi, lace, stamps, banda de sol, tonos posterizados, refracción por ruido animado y viñeta en screen-space;
- material unlit;
- sin los ripples interactivos, que son una simulación con render targets y no un shader.

### 15.2 Fase 2: editor completo

**Modelo** *(autor)*
- `NodeDefinition` gana `params?: readonly ParamDefinition[]`, con tipos `enum` (opciones con label) y `boolean`. Cambiar un param recompila: ya entra en `topologyKey`.
- `BlackboardProperty = { id, name, type: 'float'|'vec2'|'vec3'|'vec4'|'texture', widget?: 'color', value: PortValue }`.
  - `name` es un identificador JS válido y único: es el nombre del uniform exportado.
  - Hay un nodo por tipo de propiedad (`property/float`, `property/vec3`, …), con param `propertyId`.
  - Live: uniform compartido por propiedad. Editar el valor solo toca `.value`.
- `schemaVersion` pasa a **2** (`properties` tipadas), con una migración v1→v2. Es la primera migración real.
- Texturas: los assets se guardan en IndexedDB y se identifican por SHA-256 del contenido. El runtime recibe un `resolveTexture(assetId)`.

**Catálogo** (el de §7, más lo que pide el pond)
- **Input:** Vector2/3/4, Position (param espacio: object/world/view), View Direction, Screen UV, Camera Position, propiedades del Blackboard.
- **Math:** Subtract, Divide, Power, Cos, Abs, Fract, Floor, Min, Max, Clamp, One Minus, Remap, **Exp**, **Distance**.
- **Interpolación:** Step, Smoothstep, **AA Step** (`fwidth`).
- **Lógica:** **Select** (compara `a` contra `b` con un operador param, y elige entre dos valores T).
- **Vector:** Split, Combine, Dot, Length, Normalize, **Rotate 2D**.
- **Efectos:** Noise (simplex/perlin), Voronoi (F1, con escala y jitter), Checkerboard, Gradient (linear/radial).
- **Texture:** Sample Texture 2D (param mip: auto/level, input level).
- **Color:** **Color Space** (sRGB↔linear).
- **Utilidad:** Comment/Group (marco con título; no compila).
- **Master Stack:** param **lighting: standard | unlit**. Unlit usa `MeshBasicNodeMaterial`; los slots que no aplican se muestran deshabilitados.

**Editor**
- **Previews por nodo:**
  - un único renderer offscreen compartido;
  - cada nodo compila su target `port` a un material unlit sobre un quad, que se renderiza y se copia (`drawImage`) al canvas 2D del nodo;
  - solo se re-renderizan los nodos sucios: los afectados por topología o valores aguas arriba;
  - los nodos que dependen de Time se animan a ~20 fps y solo si están visibles en el viewport;
  - toggle de preview por nodo.
- **Blackboard** (panel izquierdo): crear, renombrar, editar valor y borrar propiedades. Se agregan al canvas arrastrando o con teclado (Enter: "Add to canvas").
- **Inspector** (derecha, sobre el preview): nodo seleccionado (descripción, params, valores, toggle de preview) o, sin selección, configuración del grafo (lighting del master).
- **Panel de código** (abajo, colapsable): TSL generado en vivo, con resaltado de sintaxis liviano y botón de copiar.
- Paneles colapsables con atajos de teclado documentados.

**Nuevo paquete `packages/codegen`:** facade que emite código, más un printer de módulos legibles:
- un `const` por salida de nodo, con nombres derivados de los labels;
- literales para valores inline y uniforms nombrados para las propiedades.

Paridad verificada en tests importando el módulo generado contra `three/tsl` real.

### 15.3 Fase 3: archivos

- Export `.tsl.js` final: header con versión de three, imports, uniforms del Blackboard exportados, objeto de slots listo para el material, snippet R3F (P4) y bloque `@graph` con SHA-256 del código.
- Import de `.tsl.js` (solo lee `@graph`; avisa si el hash no coincide), de `.tslproj` (zip con JSZip, incluye texturas) y de carpeta.
- Compartir por URL (P2): `CompressionStream` + base64url en el hash; las texturas no viajan.
- Thumbnail del preview dentro del `.tslproj`.
- Menú de archivo accesible por teclado (Nuevo, Abrir, Guardar como, Exportar, Compartir).

### 15.4 Fase 4: extensibilidad

- **Code Node:** TSL a mano con inputs/outputs declarados. Si el grafo viene de afuera (URL, import), no se ejecuta hasta que el usuario confirme (`containsCode` en el manifest).
- **Subgraphs:** colapsar una selección en un subgraph reutilizable, con sus inputs y outputs; se guardan en `graphs/subgraphs/`.
- **Runtime pulido:** API `loadGraph(json, { resolveTexture })` que devuelve `{ material, uniforms }` con uniforms nombrados. La decisión de publicar en npm se toma acá.
- **Docs:** README de cada paquete, guía para escribir nodos de la comunidad y **spec pública del formato en inglés** (`docs/format-spec.md`).

### 15.5 Fase 5: comunidad e IA

- **Galería de ejemplos** dentro del editor: el pond de lettra, agua simple, holograma, disolución, toon, fresnel glow. Cada uno es un `.graph.json` versionado.
- **Presets** para artistas: los ejemplos se abren como punto de partida.
- **Plugins de la comunidad:** registrar nodos propios con la API de `defineNode`, cargados como módulos.
- **Servidor MCP** *(idea del usuario, ver la memoria de competidores)*: para que un agente (Claude Code) lea, cree y edite grafos con las operaciones puras de `core` y el formato JSON, y el usuario retoque visualmente. Es el diferencial frente a TSL Graph.
