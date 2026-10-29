# nudo-tsl — Fase de catálogo: nodos nuevos y Master Physical

Fecha: 2026-10-28 · Estado: aprobado (2026-10-28). Lo revisó un builder y sus preguntas quedaron resueltas como decisiones del autor (§4.1, §4.3, §4.4, §4.5 y §5).

Complementa el diseño principal (`2026-10-26-nudo-tsl-design.md`). Todo lo que este documento no cambia sigue valiendo tal como está ahí: facade genérica, paridad entre preview y export, teclado completo e i18n EN/ES.

---

## 1. Qué es y por qué

El catálogo se cerró en la fase 2 con 45 nodos funcionales, y el roadmap no tiene más nodos planeados: la fase 4 solo trae Code Node y subgraphs. Al portar templates aparecieron los huecos:

- **Shaders de spite** (`github.com/spite/sketch`, MIT): hatching, scribble, halftone y blueprint necesitan proyección triplanar, posterizado, módulo y la dirección de la luz de la escena.
- **Shaders estilizados de Blender** (`Shaders_style.blend`, que trajo el usuario): todos siguen la misma receta. Luz con normales rotas por un Voronoi 3D, después Color Ramp de 5–6 paradas y encima una textura en Overlay. Sin Color Ramp, sin modos de fusión y sin Voronoi 3D, no salen.
- **Expectativa del usuario de Unity o Blender:** busca Sqrt, Atan2, Cross, Reflect, Tiling & Offset, Polar Coordinates, Vertex Color... Si no están, nudo parece incompleto.
- **Materiales físicos:** el vidrio, el barniz, las telas y la iridiscencia necesitan entradas de `MeshPhysicalNodeMaterial` que el Master no expone.

**Qué es tener éxito:** los templates de spite y de Blender se arman con nodos y no con cadenas de selects y fórmulas a mano, y alguien que viene de Unity o Blender encuentra los nodos que espera.

## 2. Objetivos, no-objetivos, anti-objetivos

**Objetivos**
- Sumar 37 tipos de nodo nuevos, mejorar 2 existentes (Voronoi y Noise) y agregar el modo **Physical** al Master. Todo en tres tandas, cada una en su propio PR.
- Sumar un chequeo que compile cada ejemplo en un renderer real, para que un error de shader se detecte en CI y no en el preview.

**No-objetivos**
- **Nodos de nicho:** formas procedurales (Ellipse, Rectangle, Polygon), Wave, Brick y Magic de Blender, matrices, cubemap, parallax, flipbook y Normal Blend. Se suman de a uno cuando un template o un usuario los pida. El camino general para lo de nicho es el Code Node y los subgraphs (fase 4) y los plugins de la comunidad (fase 5).
- **Post-processing y render multipass:** inverted hull, Sobel, Kuwahara, bloom. Es una fase propia y se decide aparte.
- **Triplanar procedural:** evaluar un subgrafo tres veces requiere subgraphs. Acá el Triplanar es solo para texturas.
- Entradas físicas fuera de esta lista: anisotropy, specular, dispersion y attenuation.
- Pasar los ejemplos existentes a los nodos nuevos. Queda como seguimiento opcional (ver §9).

**Anti-objetivos (sería un fracaso aunque funcione)**
- Que un grafo existente cambie de aspecto. En particular, el Pond usa Voronoi y tiene que verse igual.
- Que un archivo viejo necesite migración o deje de abrir.
- Que editar las paradas del Color Ramp recompile el shader en cada arrastre.
- Que algo nuevo, como el editor de gradiente, necesite mouse.
- Que el preview y el código exportado se comporten distinto.

## 3. Alcance por tanda

Cada tanda va en su propio PR, en este orden. La tanda 1 arranca con el chequeo de compilación (§6.2), así protege a todo lo que viene después.

### Tanda 1: imprescindibles + Master Physical (7 nuevos, 2 mejoras)

| Nodo | Tipo | Categoría | Qué hace |
|---|---|---|---|
| Color Ramp | `color/color-ramp` | color | Lleva un float de 0 a 1 a un color siguiendo hasta 8 paradas. Ver §4.1. |
| Blend | `color/blend` | color | Combina Base y Blend con un modo (ver §4.2) y una Opacity. |
| Voronoi | `effects/voronoi` (mejora) | effects | Sigue siendo 2D. Suma las salidas Cell (centro de la celda) y Random (0–1 por celda) y el param Distance. Ver §4.3. |
| Voronoi 3D | `effects/voronoi-3d` | effects | El mismo Voronoi sobre un vec3 (Position por defecto): sin costuras sobre cualquier mesh. Ver §4.3. |
| Noise | `effects/noise` (mejora) | effects | Suma octavas (FBM), con Roughness y Lacunarity. Ver §4.4. |
| Triplanar | `texture/triplanar` | texture | Muestrea una textura desde los tres ejes y mezcla según la normal, sin costuras. Inputs: texture, position, normal, scale y sharpness. |
| Main Light | `input/main-light` | input | Da la dirección y el color de la luz principal de la escena, más Lambert y Half Lambert ya calculados. Ver §4.5. |
| Posterize | `math/posterize` | math | `floor(in × steps) / steps`. |
| Modulo | `math/modulo` | math | Módulo con piso, `A − B × floor(A / B)`, genérico. No usa el `%` de WGSL, que trunca y daría otro resultado en WebGPU que en WebGL. |

Además, el **Master Physical** (§5).

### Tanda 2: Math + Vector (15)

- **Math** (genéricos salvo Atan2): `math/sqrt`, `math/sign`, `math/round`, `math/ceil`, `math/saturate`, `math/tan`, `math/atan2` (floats y, x), `math/log`, `math/negate` y `math/reciprocal`.
- **Vector:**
  - `vector/cross` y `vector/reflect` (vec3).
  - `vector/refract`: vec3 incidente, normal y eta.
  - `vector/transform`: param `from` y `to` (object, world o view) y param `kind` (position o direction).
  - `vector/rotate-about-axis`: in, axis y angle en radianes.

### Tanda 3: UV, Color, Input y otros (15)

- **UV:** es una categoría nueva, `uv`. Ver §4.6.
  - `uv/tiling-offset`: uv, tiling y offset.
  - `uv/polar-coordinates`: uv, center, radial scale y length scale. Devuelve un vec2 (radio, ángulo de 0 a 1).
  - `uv/twirl` y `uv/spherize`: uv, center, strength y offset.
- **Color:**
  - `color/hsv-adjust`: hue shift, saturation y value.
  - `color/brightness-contrast`.
- **Input:**
  - `input/vertex-color`.
  - `input/tangent`.
  - `input/object-position`: el origen del objeto en world.
  - `input/screen-position`: dos salidas, la coordenada en píxeles y el tamaño de pantalla.
  - `scene/scene-depth`: la profundidad lineal de la escena detrás, como Depth Fade pero cruda.
- **Otros:**
  - `normal/normal-map`: textura y strength, devuelve una normal para el Master.
  - `logic/boolean`: param op (and, or, xor o not) sobre valores 0/1.
  - `math/derivative`: param ddx, ddy o fwidth.
  - `math/random`: hash de un vector a un número de 0 a 1.

**Total:** 37 tipos nuevos, 2 mejoras y el modo Physical. Al final quedan unos 82 nodos funcionales.

## 4. Decisiones de diseño por nodo

Las decisiones que tomé sin consultar están marcadas **(decisión del autor)**.

### 4.1 Color Ramp: las paradas son inputs, no un param nuevo **(decisión del autor)**

Hoy los params solo pueden ser `string`, `number`, `boolean` o `enum`, y cambiar un param recompila. En cambio, los inputs sin conectar son `uniform()` y no recompilan. Por eso las paradas se modelan como **inputs fijos**:

- 8 pares de inputs: `stopNPosition` (float) y `stopNColor` (vec3 con widget color), de N = 0 a 7.
- Un param `count` (number, de 2 a 8, por defecto 2): cuántas paradas se usan. Las demás se ignoran.
- Un param `interpolation` (enum): linear, constant o smooth.

**Por qué así:**
- Arrastrar una parada solo cambia un uniform, así que no recompila (anti-objetivo).
- No hace falta tocar el formato de archivo ni migrar.
- Cada parada se puede **conectar**: por ejemplo, el color de una parada puede salir de una property o de otro nodo. Ni Unity ni Blender permiten eso.
- Cambiar `count` o `interpolation` sí recompila, pero son cambios estructurales.

**Orden de las paradas (decisión del autor):** el build asume que las posiciones crecen con el índice. El editor lo garantiza: mover una parada con el teclado o el campo numérico la frena en la posición de su vecina, no la deja pasarla. Para reordenar, se usan botones "subir" y "bajar", que intercambian posición y color (los valores, no los cables). Si una posición viene conectada y el valor no respeta el orden, el resultado no está definido. La descripción del puerto lo avisa.

**Build:** se arma con operaciones que la facade ya tiene (`mix`, `smoothstep`, `step`, `clamp`), parada por parada. No hace falta un método nuevo en la facade.

**UI:**
- El cuerpo del nodo muestra la barra del gradiente y una lista de paradas, cada una con su posición numérica y su color.
- Hay botones para agregar y quitar paradas. Agregar o quitar cambia `count`. Si se quita una parada del medio, las siguientes se corren un lugar.
- Requisito de teclado: con Tab se recorre cada parada. Las flechas mueven la posición seleccionada (con Shift, en pasos más grandes). Enter abre el color picker. Delete quita la parada.
- En el canvas se ven solo los puertos de las paradas activas, para conectarlas. El mecanismo para ocultar los puertos de las paradas inactivas queda a criterio del builder: hoy `InputDefinition` no tiene visibilidad condicional.
- Para eso hay que agregar al editor un campo para params `number`. Hoy `param-field.tsx` solo dibuja enum y boolean. El mismo campo sirve para las octavas de Noise (§4.4).

### 4.2 Blend

- **Modos:** multiply, screen, overlay, soft light, linear light, color burn, color dodge, darken, lighten, difference, add y subtract.
- three trae `BlendModes` (burn, dodge, screen, overlay). El resto se arma con la facade.
- **Inputs:** Base, Blend (genéricos) y Opacity (float, por defecto 1). El resultado es `mix(base, modo(base, blend), opacity)`.

### 4.3 Voronoi: el 2D no cambia y el 3D es un nodo aparte **(decisión del autor)**

Primero se pensó en hacer genérico el input `uv` del Voronoi actual. El revisor mostró que eso rompe archivos: hoy ese input acepta cualquier vector (lo trunca a vec2) y un float (lo replica). Un genérico limitado a vec2 o vec3 rechazaría los floats y los vec4, y haría 3D, sin avisar, a los grafos que hoy conectan un vec3. Por eso:

- **`effects/voronoi` sigue siendo 2D.** El input `uv` no cambia de tipo.
  - Suma las salidas `cell` (vec2, el centro de la celda más cercana) y `random` (float de 0 a 1 por celda, para colorear cada celda distinto).
  - Suma el param `distance`: euclidean (por defecto), manhattan o chebyshev.
- **`effects/voronoi-3d` es un nodo nuevo.** Su input `position` es vec3, con Position en object space como fallback. Tiene las mismas salidas, con `cell` en vec3, y el mismo param `distance`.
- **Requisito:** con distancia euclidean, F1, F2 y Edge del Voronoi 2D tienen que dar exactamente lo mismo que hoy (`mx_worley_noise_vec2`). La forma más segura es seguir usando `mx_worley` para esas salidas en ese caso. Si el builder lo reemplaza, tiene que demostrar que el Pond y los ejemplos se ven igual.
- Las salidas de celda no las da MaterialX, así que van como helper propio en los dos backends. Lleva el mismo chequeo de fuente idéntica que simplex (`parity.test.ts`, helpers locales).

### 4.4 Noise: octavas sin romper nada

- **Param nuevo** `octaves`: number de 1 a 8, por defecto **1**. Con 1, el resultado es exactamente el de hoy.
- **Inputs nuevos:** `roughness` (por defecto 0.5) y `lacunarity` (por defecto 2).
- **Normalizado, como en Blender (decisión del autor):** la suma de octavas se divide por la suma de las amplitudes, así el rango sigue siendo -1…1 con cualquier cantidad de octavas. Los umbrales y las rampas copiadas de los `.blend` funcionan sin retocar.
- **Implementación:** perlin puede usar `mx_fractal_noise_float` y dividir por la suma de amplitudes. Simplex necesita un bucle desenrollado en un helper. Las octavas son un param porque el bucle se arma al compilar.

### 4.5 Main Light **(decisión del autor)**

TSL no trae un "main light", así que el nodo lee **dos uniforms compartidos**: `mainLightDirection` (vec3, normalizado, en world) y `mainLightColor` (vec3).

- **En el editor:** el runtime los actualiza desde la key light del preview (`preview-scene.tsx`).
- **En el export:** el `.tsl.js` los expone como uniforms, con un comentario que muestra cómo sincronizarlos con una `DirectionalLight` en three/R3F. Los valores por defecto coinciden con la key light del preview, para que el export se vea igual sin tocar nada.
- **Input `normal` (opcional, decisión del autor):** vec3 en **world space**, con la normal del mesh como fallback. Sirve para iluminar con normales alteradas, como hacen los `.blend` con el Voronoi 3D. La descripción del puerto avisa que Normal From Height y Normal Map entregan normales en el espacio que espera el Master, no en world. Para enchufarlas acá hay que pasarlas por `vector/transform` (tanda 2).
- **Salidas:** `direction`, `color`, `lambert` (`max(N·L, 0)`) y `halfLambert` (`N·L × 0.5 + 0.5`).
- **`color` incluye la intensidad (decisión del autor):** color de la luz × intensidad, como lo usa three. Con la key light actual da (2.5, 2.5, 2.5). `lambert` y `halfLambert` no se escalan: quedan siempre en 0…1, que es lo que necesitan las rampas toon.
- El helper `examples/build/light-shade.ts` hace a mano lo mismo que Half Lambert. Pasar los ejemplos a este nodo es un seguimiento opcional (§9).

### 4.6 Categoría nueva `uv`

`NodeCategory` es una lista cerrada en `packages/core/src/types/node-definition.ts`. Hay que sumar `uv` ahí, en la agrupación del menú de agregar nodo, en ⌘K y en los textos EN/ES de las categorías.

### 4.7 Inputs que dependen del mesh

`vertex-color` y `tangent` dependen de atributos que las primitivas del preview pueden no tener.

- **Requisito:** que no den error de compilación sobre ninguna forma del preview, incluida Suzanne y un GLB cargado. Vertex Color sin atributo devuelve blanco. Tangent sin atributo se calcula o tiene un fallback.
- Cómo se resuelve queda a criterio del builder, pero el comportamiento tiene que ser el mismo en el export.

## 5. Master Physical

- **Lighting** suma la opción `physical`. Usa `MeshPhysicalNodeMaterial` tanto en el runtime como en el codegen.
- **Inputs nuevos del Master** (al final de la lista actual, para no mover los ids existentes):

| Input | Tipo | Default | Slot de three |
|---|---|---|---|
| transmission | float | 0 | `transmissionNode` |
| ior | float | 1.5 | `iorNode` |
| thickness | float | 0 | `thicknessNode` |
| clearcoat | float | 0 | `clearcoatNode` |
| clearcoatRoughness | float | 0 | `clearcoatRoughnessNode` |
| sheen | vec3 (color) | negro | `sheenNode` |
| sheenRoughness | float | 1 | `sheenRoughnessNode` |
| iridescence | float | 0 | `iridescenceNode` |
| iridescenceIOR | float | 1.3 | `iridescenceIORNode` |

- **Un interruptor por función (decisión del autor):** el revisor mostró que en three r186 basta con asignar `transmissionNode` (aunque valga 0) para que el material pase a la lista transparente y pague el render extra. Lo mismo ocurre con clearcoat, sheen e iridescence. Por eso el Master suma 4 params boolean que solo se ven en Physical: `useTransmission`, `useClearcoat`, `useSheen` y `useIridescence`, todos apagados por defecto.
  - Prender o apagar uno recompila (es estructural). Los valores siguen siendo uniforms, así que moverlos no recompila.
  - Cada interruptor habilita sus inputs: transmission, ior y thickness; clearcoat y clearcoatRoughness; sheen y sheenRoughness; iridescence e iridescenceIOR. Con el interruptor apagado, esos inputs se muestran deshabilitados y no se asignan.
  - Estos inputs **no** usan `optional: true`, porque en el código eso significa "sin campo editable y no se asigna si no está conectado". Tienen campo inline y se asignan cuando su interruptor está prendido, conectados o no.
- **En Standard y Unlit**, los inputs físicos y los interruptores se ocultan o se deshabilitan con un aviso, igual que hoy pasa con `node.unlitIgnores`. Unlit sigue ignorando metalness, roughness y normal.
- **Lugares que hay que tocar:** `MasterLighting`, `LIGHTING_VALUES`, `masterMaterialAssignments` y `compileMaster` (core), `buildMaterial` (runtime), `materialClassOf` y `MaterialClass` (codegen), `node-port-layout.ts` (editor), y los tests que fijan los inputs y las opciones del Master (`nodes.test.ts`, `catalog-b.test.ts`, `parity.test.ts`).
- **UI:** con 9 inputs más, el Master se alarga mucho. Los inputs físicos van en un grupo propio, "Physical", que se puede colapsar y que en Standard o Unlit arranca colapsado. Cómo se ve queda a criterio del builder.
- **Rendimiento:** con `useTransmission` prendido, three renderiza la escena de fondo una vez más. La descripción del interruptor lo avisa.
- **Archivos:** sumar una opción de enum y sumar inputs no requiere migración, porque lo que falta toma su valor por defecto (confirmado en `parse-entities.ts`).

## 6. Calidad y tests

### 6.1 Lo que pide cada nodo (ya lo exigen los tests actuales)

- Definición con description, keywords y `formula` (si tiene puertos genéricos; una línea de hasta 28 caracteres), y description en cada puerto, escrita como oración.
- Entrada en `NODES_ES` con todos los puertos, params y opciones (`i18n.test.ts`).
- Si la facade suma un método: va en la interfaz, en el live backend, en el codegen backend, en el recording facade, en `FACADE_OPERATIONS` (`live-facade.test.ts`) y en `TSL_IMPORT_NAMES` si imprime un nombre nuevo de `three/tsl`.
- Si suma un helper: los seis lugares que ya documenta el patrón de simplex.
- Registro en un array nuevo por tanda (`PHASE_3_CATALOG_C`, `_D`, `_E`) con su test de lista exacta, siguiendo el patrón de `catalog-a` y `catalog-b`.
- El fixture de paridad del codegen agrega cada nodo y cada opción de enum automáticamente.

### 6.2 Chequeo de compilación real (nuevo, va primero en la tanda 1)

**El caso que lo motivó:** Magma conectaba `Normal From Height` (que usa `dFdx`) a una cadena que también iba a `position`. Pasó todos los tests, porque `createMaterial` arma el grafo de nodos pero no compila el shader, y se rompió recién en el preview: `'dFdx' is not supported in the vertex stage`.

**Requisito:** un test que compile en un renderer real cada ejemplo y el grafo de catálogo, en las tres modalidades de Lighting, y que falle si three reporta un error. Tiene que correr en el e2e por defecto (WebGL2 por software, SwiftShader), así lo corre CI, y reutilizar la lógica de `validate-material.ts`. Dónde vive (spec de Playwright o similar) queda a criterio del builder.

Además, `create-material.test.ts › new catalog nodes` hoy es una lista escrita a mano. Pasa a recorrer el registro, para que ningún nodo nuevo quede sin cubrir.

### 6.3 Previews por nodo

- Los nodos que dependen de la superficie (Main Light, Transform, Tangent, Triplanar, Normal Map) se suman a `SURFACE_NODE_TYPES`.
- Si algún nodo nuevo se anima con el tiempo, va en `ANIMATED_NODE_TYPES`.

## 7. Restricciones

- three r186 (`three/webgpu`, `three/tsl`). Todo lo de este documento existe en esa versión o se arma con la facade.
- Ningún cambio de `schemaVersion`. Si algo lo exigiera, se para y se consulta.
- Código y textos de código en inglés, y textos de UI en EN y ES (reglas del repo).
- Accesibilidad: todo lo nuevo (editor de gradiente, campo number, grupo Physical) se opera con teclado y tiene foco visible.

## 8. Queda a criterio del builder

- La organización de archivos, los nombres internos y el orden de los nodos dentro de cada categoría del menú.
- Cómo se ocultan los puertos de las paradas inactivas del Color Ramp.
- Las fórmulas exactas de los modos de Blend, siempre que sigan la definición habitual (la de Photoshop o Blender).
- La implementación del Voronoi 3D y del FBM simplex, respetando §4.3 y §4.4.
- Los textos en español, siguiendo el tono de `NODES_ES`.
- Dónde vive el chequeo de compilación (§6.2).

## 9. Seguimientos posibles (fuera de alcance)

- Pasar Poster y los ejemplos que usan `light-shade.ts` a Main Light, Posterize y Color Ramp, si el grafo queda más claro.
- Templates nuevos que usan esta fase: Post Blueprint, Fuego, Cross-Hatch, Halftone y los de `Shaders_style` (`mat_12`, `mat_4`, `mat_3`, `mat_6`), con texturas CC0 de ambientCG o Poly Haven.
- La fase de post-processing (inverted hull con `ToonOutlinePassNode`, Sobel, bloom, Kuwahara), que se decide al revisar competidores al cierre de la fase 1.
