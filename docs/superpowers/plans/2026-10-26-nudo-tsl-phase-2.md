# nudo-tsl Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the phase-1 editor into a complete shader-graph editor that can recreate the lettra pond water. It needs:
- the full node catalog, node params and Blackboard properties (with schema v2 and the first real migration);
- textures, an unlit master, per-node live previews, an Inspector and a live TSL code panel backed by a new `codegen` package.

**Architecture:**
- Core gains param definitions, Blackboard properties, schema v2 and an extended `TslFacade<E>`.
- Nodes stay facade-only, so live (runtime) and generated code (codegen) keep parity by construction.
- The editor adds three panels (Blackboard, Inspector, Code) and a shared offscreen preview renderer.

**Tech Stack:** as in phase 1, plus `idb-keyval` (texture assets in IndexedDB) and `sugar-high` (tiny syntax highlighter). three stays pinned at `0.186.1`.

**Spec:** `docs/superpowers/specs/2026-10-26-nudo-tsl-design.md` (§15.1–15.2 define this phase; §4–§8 still bind).

## Global Constraints

Everything in the phase-1 plan's Global Constraints still applies (`docs/superpowers/plans/2026-10-26-nudo-tsl-phase-1.md`): strict TS, no `any`, no `as` except `as const` plus the R1/R4/R5 sites, kebab-case files, package boundaries, Conventional Commits without `Co-Authored-By`, port colors, the Better Design steps for UI, and keyboard-only operation. Additions:

- **Package boundaries:**
  - New package `packages/codegen` (`@nudo-tsl/codegen`, private) may import only `@nudo-tsl/core` and `@nudo-tsl/nodes`. Add its ESLint boundary override.
  - The editor may import `@nudo-tsl/codegen`.
- **Schema:** `CURRENT_SCHEMA_VERSION = 2`. v1 documents (autosaves from phase 1) must open through the migration chain.
- **Focus styling (user preference, binding):**
  - Text inputs: quiet foreground border, never the thick ring.
  - Non-text controls: the two-tone ring.
  - Theme switch is instant.
- **Panel toggles** fire only when focus is on the canvas, a node or a panel header (same rule as `F`):
  - `B` Blackboard
  - `I` Inspector
  - `P` Preview
  - `C` Code (plain `C`, not `Ctrl+C`)

  They are listed in the shortcuts catalog and dialog.
- **Preview animation budget:**
  - Per-node previews of Time-dependent nodes animate at ≤ 20 fps and only while visible in the viewport.
  - Static previews re-render only when dirty.
- **lettra quality target:** the pond example must render without node errors and visually show rosettes, lace lines, toned stamps, a sun band and animated refraction. Ripples are out of scope.
- localStorage keys are unchanged. Texture assets live in IndexedDB database `nudo-tsl`, store `assets`, keyed by lowercase hex SHA-256 of the file bytes.

## Review Focus

1. **Phase-1 autosave (schemaVersion 1) opened after the upgrade.** It must migrate to v2 silently and keep all nodes, edges and values. Test in Task 1 (unit) and Task 13 (e2e).
2. **Deleting a Blackboard property that nodes on the canvas use.** The property nodes and their edges are removed in one undo step, and undo restores everything. Test in Task 1 (core) and Task 9 (e2e).
3. **Renaming a property to an invalid or duplicate identifier** (`2x`, `my var`, `class`, an existing name). Rejected with an inline, field-associated message (`aria-describedby`), and the old name kept. Test in Task 1 and Task 9.
4. **A texture asset missing from IndexedDB** (cleared storage, or a graph pasted from another browser). The sample node shows a clear "Missing texture" state, compiles with a neutral fallback, and never crashes the preview. Test in Task 5 (runtime) and Task 8 (e2e).
5. **A graph with 60+ nodes (the pond).** Dragging a node or scrubbing a value keeps the canvas responsive: preview work is throttled, value edits don't recompile and previews off-screen don't render. Test in Task 11 (unit budget test) and Task 13 (e2e that measures that scrubbing causes no compile).

---

## File Structure (new or changed)

```
packages/core/src/
  types/{param-definition,blackboard-property}.ts           (new)
  types/{graph,node-definition,tsl-facade,ids}.ts             (extend)
  graph/{set-param,add-property,rename-property,set-property-value,remove-property}.ts
  validation/is-valid-identifier.ts
  compiler/{compile-backend,compile}.ts                        (property/params/naming hook)
  serialization/{migrations,parse-entities,validate-structure}.ts (v2)
packages/nodes/src/
  input/{vector2,vector3,vector4,position,view-direction,screen-uv,camera-position}-node.ts
  property/property-nodes.ts
  math/{subtract,divide,power,cos,abs,fract,floor,min,max,clamp,one-minus,remap,exp,distance}-node.ts
  interpolation/{step,smoothstep,aa-step}-node.ts
  logic/select-node.ts
  vector/{split,combine,dot,length,normalize,rotate-2d}-node.ts
  effects/{noise,voronoi,checkerboard,gradient}-node.ts
  texture/sample-texture-2d-node.ts
  color/color-space-node.ts
  utility/comment-node.ts
  master/master-stack.ts                                       (lighting param)
packages/runtime/src/
  live-facade.ts (extend), simplex-noise.ts, live-backend.ts (properties, textures),
  create-material.ts (lighting, options), create-preview-material.ts, apply-property-value.ts
packages/codegen/                                              (new package)
  src/{index,code-facade,code-backend,print-module,naming}.ts
apps/editor/src/
  app/app-shell.tsx (panel slots)
  features/panels/{panel-frame,use-panel-shortcuts}.tsx
  features/blackboard/*  features/inspector/*  features/code-panel/*
  features/node-previews/*  features/assets/*
  features/canvas/{param-field,texture-field,comment-node-view}.tsx
  examples/{lettra-pond,simple-water}.graph.json + examples/index.ts
```

---

### Task 1: Core: params, Blackboard properties, schema v2

**Files:**
- Create: `types/param-definition.ts`, `types/blackboard-property.ts`, `graph/set-param.ts`, `graph/add-property.ts`, `graph/rename-property.ts`, `graph/set-property-value.ts`, `graph/remove-property.ts`, `validation/is-valid-identifier.ts`, `serialization/migrations.ts`.
- Modify: `types/graph.ts`, `types/node-definition.ts`, `types/ids.ts`, `graph/add-node.ts` (fill default params), `serialization/*` (v2 parse, validation of params and properties), `index.ts`.
- Test: colocated `*.test.ts`.

**Interfaces (Produces):**

```ts
type ParamDefinition =
  | { readonly id: string; readonly label: string; readonly kind: 'enum'; readonly options: readonly { value: string; label: string }[]; readonly default: string }
  | { readonly id: string; readonly label: string; readonly kind: 'boolean'; readonly default: boolean }
  | { readonly id: string; readonly label: string; readonly kind: 'string'; readonly default: string; readonly hidden?: boolean }
  | { readonly id: string; readonly label: string; readonly kind: 'number'; readonly default: number; readonly min?: number; readonly max?: number; readonly hidden?: boolean }
// hidden params are editor-managed (not shown in the node body); string/number changes still go through setParam
// NodeDefinition gains: readonly params?: readonly ParamDefinition[]; readonly reads?: 'property'
type PropertyId = Brand<string, 'PropertyId'>; const asPropertyId: (raw: string) => PropertyId  // R1 site
type PropertyType = 'float' | 'vec2' | 'vec3' | 'vec4' | 'texture'
interface BlackboardProperty { readonly id: PropertyId; readonly label: string; readonly name: string; readonly exposed: boolean; readonly type: PropertyType; readonly widget?: 'color'; readonly value: PortValue }
// label: free display text; name: JS identifier (uniform/reference name); exposed=false → codegen inlines the value as a constant
// Graph: readonly schemaVersion: 2; readonly properties: readonly BlackboardProperty[]
/** Editor-managed params every node accepts implicitly; never part of topologyKey (toggling them never recompiles). */
const UNIVERSAL_PARAMS: readonly ParamDefinition[]   // collapsed: boolean (false); previewMode: enum auto|2d|3d (auto)
const CURRENT_SCHEMA_VERSION = 2
const DEFAULT_MIGRATIONS: readonly Migration[]   // [{ from: 1, migrate: identity (properties stays []) }]
function isValidIdentifier(name: string): boolean  // JS identifier, not a reserved word, ≤ 64 chars
type PropertyError = { code: 'invalid-name'; name: string } | { code: 'duplicate-name'; name: string } | { code: 'property-not-found'; id: PropertyId } | { code: 'type-mismatch' }
function setParam(graph: Graph, registry: NodeRegistry, ref: { nodeId: NodeId; paramId: string }, value: ParamValue): Result<Graph, GraphError>
function addProperty(graph: Graph, property: BlackboardProperty): Result<Graph, PropertyError>
function renameProperty(graph: Graph, id: PropertyId, name: string): Result<Graph, PropertyError>   // reference name
function setPropertyLabel(graph: Graph, id: PropertyId, label: string): Result<Graph, PropertyError>
function setPropertyExposed(graph: Graph, id: PropertyId, exposed: boolean): Result<Graph, PropertyError>
function setPropertyValue(graph: Graph, id: PropertyId, value: PortValue): Result<Graph, PropertyError>
function removeProperty(graph: Graph, id: PropertyId): Result<Graph, PropertyError>   // also removes nodes whose params.propertyId === id, and their edges
```

- [ ] **Step 1: Failing tests.** Every assertion uses exact values:
  - `isValidIdentifier`: accepts `waveSpeed` and `_a1`; rejects `2x`, `my var`, `class` and `''`.
  - `addNode` fills enum and boolean param defaults.
  - `setParam` rejects an unknown param and an enum value outside its options; it accepts the universal params `collapsed` and `previewMode` on any node.
  - `topologyKey` ignores universal params.
  - `renameProperty` rejects a duplicate and an invalid name, and leaves the graph unchanged.
  - `removeProperty` removes the property nodes and their edges (Review Focus 2).
  - `setPropertyValue` rejects a value of the wrong type.
  - `parseGraph` migrates a v1 document (the phase-1 water fixture JSON) to v2 with identical nodes and edges (Review Focus 1).
  - `parseGraph` rejects:
    - a v2 doc with a property node whose `propertyId` is missing;
    - an unknown param id;
    - an enum value outside its options;
    - duplicate property names.
  - `serializeGraph` round-trips properties.
- [ ] **Step 2:** Run `pnpm --filter @nudo-tsl/core test`. Expected: FAIL.
- [ ] **Step 3:** Implement. Existing phase-1 tests must keep passing. Update fixtures that hardcode `schemaVersion: 1` only where they represent *current* graphs. v1 fixtures stay as migration inputs.
- [ ] **Step 4:** Run `pnpm lint && pnpm typecheck && pnpm test`. Expected: PASS. The editor still typechecks, adjusted where `schemaVersion: 1` was referenced.
- [ ] **Step 5:** Commit `feat(core): add node params, blackboard properties and schema v2`.

---

### Task 2: Core: compiler and facade extensions

**Files:**
- Modify: `types/tsl-facade.ts`, `types/node-definition.ts` (BuildContext), `compiler/compile-backend.ts`, `compiler/compile.ts`.
- Test: `compiler/compile.test.ts`.

**Interfaces (Produces):**

```ts
type Swizzle = 'x' | 'y' | 'z' | 'w' | 'xy' | 'xyz'
type BuiltinName = <phase-1 names> | 'positionView' | 'screenUV' | 'cameraPosition'
type CompareOp = 'lt' | 'lte' | 'gt' | 'gte' | 'eq'
type NoiseKind = 'perlin' | 'simplex'
type ColorSpaceDirection = 'srgb-to-linear' | 'linear-to-srgb'
interface TslFacade<E> {  // phase-1 methods plus:
  sub; div; cos; abs; fract; floor; min; max; exp; length(a); normalize(a); distance(a, b)
  step(edge: E, x: E): E; smoothstep(e0: E, e1: E, x: E): E; fwidth(x: E): E
  remap(x: E, inLow: E, inHigh: E, outLow: E, outHigh: E): E
  select(op: CompareOp, a: E, b: E, whenTrue: E, whenFalse: E): E
  noise(kind: NoiseKind, p: E): E                 // float
  voronoi(p: E, jitter: E): E                     // vec2 (F1, F2)
  checker(uv: E): E                               // float
  textureSample(texture: E, uv: E, level: E | null): E   // vec4
  colorSpace(direction: ColorSpaceDirection, color: E): E
}
// BuildContext gains: readonly params: Readonly<Record<string, ParamValue>> (already) — now filled with defaults
//                     readonly property: E | null   // set for definitions with reads: 'property'
interface CompileBackend<E> {  // plus:
  property(property: BlackboardProperty): E
  nameOutput?(node: GraphNode, definition: AnyNodeDefinition, portId: string, expression: E): E
}
// CompileError code gains 'missing-property'
```

Rules:
- Compiler calls `backend.property` once per property per compile (memoized), and passes the result to every node that reads it.
- When `nameOutput` exists, the compiler calls it once per evaluated node output after `build`, and uses the returned expression downstream. Codegen hoists consts through this hook.
- Unconnected `texture` inputs still go through `backend.inputValue`.

- [ ] **Step 1: Failing tests** with an extended string backend:
  - `property nodes compile to backend.property once per property even when used twice`.
  - `missing property yields missing-property on that node`.
  - `params reach build with defaults filled`.
  - `nameOutput is called once per evaluated output and its result flows downstream` (assert `id(lerp1.out)` appears in the master slot).
  - `select builds with op from facade`. Use a fixture node.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Update `packages/nodes/src/testing/recording-facade.ts` for every new method: same `name(args)` format; `select` prints `select(lt,a,b,t,f)`, `noise(simplex,p)`.
- [ ] **Step 4:** Run `pnpm lint && pnpm typecheck && pnpm test`. Expected: PASS. Runtime fails typecheck until Task 5, so add the new facade methods to `live-facade.ts` now as `throw new Error('not implemented: <name>')` stubs (Task 5 replaces them). Same for `property` in `live-backend.ts`.
- [ ] **Step 5:** Commit `feat(core): extend facade, properties and output naming in the compiler`.

---

### Task 3: Nodes A: math, interpolation, logic, vector

**Files:** create the files listed under `math/`, `interpolation/`, `logic/` and `vector/` in File Structure; modify `create-default-registry.ts`. Test: `nodes.test.ts` (extend) plus `catalog-a.test.ts`.

Definitions (generic `T` group = same arity, widest wins, as in phase 1):

| Type id | Inputs (default) | Output / build |
|---|---|---|
| `math/subtract` | a T `0`, b T `0` | sub |
| `math/divide` | a T `1`, b T `1` | div |
| `math/power` | a T `1`, b T `2` | pow |
| `math/cos` | in T `0` | cos |
| `math/abs`, `math/fract`, `math/floor`, `math/one-minus`, `math/exp` | in T `0` | the matching op |
| `math/min`, `math/max` | a T `0`, b T `1` | min / max |
| `math/clamp` | in T `0`, min T `0`, max T `1` | clamp |
| `math/remap` | in T `0.5`, inMin float `0`, inMax float `1`, outMin float `0`, outMax float `1` | remap |
| `math/distance` | a T `0`, b T `0` | out float = distance |
| `interpolation/step` | edge T `0.5`, in T `0` | step |
| `interpolation/smoothstep` | edge0 float `0`, edge1 float `1`, in T `0.5` | smoothstep |
| `interpolation/aa-step` | edge float `0.5`, in float `0` | `smoothstep(edge - w, edge + w, in)` with `w = max(fwidth(in), 1e-4) * 0.75` (lettra's `aastep`) |
| `logic/select` | a float `0`, b float `0`, whenTrue T `1`, whenFalse T `0`; param `op` enum lt/lte/gt/gte/eq (labels `<`, `≤`, `>`, `≥`, `=`), default `lt` | select |
| `vector/split` | in generic (vec2..vec4) `vec4(0)` | outputs x, y, z, w float via swizzle (components beyond the arity → `construct('float',[0])`) |
| `vector/combine` | x, y, z, w float `0` | outputs vec2, vec3, vec4 |
| `vector/dot` | a T `0`, b T `0` | out float |
| `vector/length` | in T `0` | out float |
| `vector/normalize` | in T `vec3(0,0,1)` | normalize |
| `vector/rotate-2d` | in vec2 `(0,0)`, angle float `0`, center vec2 `(0.5,0.5)` | rotate around center with cos/sin |

Every definition has a one-sentence `description` and `keywords` (e.g. Select: `if`, `branch`, `compare`, `condition`).

- [ ] **Step 1: Failing tests:**
  - `registry contains every catalog-A type` (an explicit list).
  - `aa-step builds lettra's formula` (exact recording string).
  - `split of a vec2 gives zero z/w`.
  - `select prints op`.
  - `rotate-2d builds around center`.
  - `every definition has description, keywords and unique type`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(nodes): add math, interpolation, logic and vector catalog`.

---

### Task 4: Nodes B: inputs, properties, effects, texture, color, utility, master lighting

**Files:** create the `input/`, `property/`, `effects/`, `texture/`, `color/` and `utility/` files from File Structure; modify `master/master-stack.ts` and `create-default-registry.ts`. Test: `catalog-b.test.ts`.

| Type id | Inputs / params | Output / build |
|---|---|---|
| `input/vector2/3/4` | components as one vecN input (default 0) | passthrough |
| `input/position` | param `space` enum object/world/view (default object) | vec3 builtin positionLocal / positionWorld / positionView |
| `input/view-direction` | — | vec3 builtin positionViewDirection |
| `input/screen-uv` | — | vec2 builtin screenUV |
| `input/camera-position` | — | vec3 builtin cameraPosition |
| `property/float`, `property/vec2`, `property/vec3`, `property/vec4`, `property/texture` | `reads: 'property'`; hidden string param `propertyId` (the parser checks it against `graph.properties`) | out = `ctx.property` |
| `effects/noise` | p vec3 default builtin-free `vec3(0)`; param kind perlin/simplex (default simplex); input scale float `1` | float = `noise(kind, p * scale)` |
| `effects/voronoi` | uv vec2 `(0,0)`, scale float `5`, jitter float `1` | outputs f1, f2, edge (f2-f1) float, from `voronoi(uv*scale, jitter)` swizzled |
| `effects/checkerboard` | uv vec2 `(0,0)`, scale float `8` | float `checker(uv*scale)` |
| `effects/gradient` | uv vec2 `(0,0)`; param mode linear-x/linear-y/radial | float: uv.x / uv.y / `clamp(length(uv - 0.5) * 2, 0, 1)` |
| `texture/sample-texture-2d` | texture texture (default `{type:'texture', assetId:null}`), uv vec2 `(0,0)`, level float `0`; param mip auto/level | outputs rgba vec4, rgb vec3, a float |
| `color/color-space` | in vec3 `(1,1,1)` widget color; param direction | colorSpace |
| `utility/comment` | no ports; params `title` string (default `Comment`), hidden numbers `width` (default 320, min 120) and `height` (default 200, min 80) | build returns {} |
| `master/stack` | adds params `lighting` enum standard/unlit (default standard), `surface` enum auto/opaque/transparent (default auto), `twoSided` boolean (default false); adds optional float slot `alphaClip` ("Alpha Clip Threshold") | unchanged |
| `input/time` (changed) | — | outputs time, sineTime, cosineTime (float), deltaTime (builtin `deltaTime`) |
| `effects/fresnel` (changed) | normal vec3 fallback normalView, viewDir vec3 fallback positionViewDirection, power float `5` | same formula using the inputs |
| `scene/scene-color` | uv vec2 fallback screenUV, offset vec2 `(0,0)` | vec3 `sceneColor(uv + offset)` |
| `scene/depth-fade` | distance float `1` | float: clamp((sceneLinearDepth − surfaceLinearDepth) / distance, 0, 1) |
| `normal/normal-from-height` | height float `0`, strength float `1` | vec3 view-space normal from height derivatives |

New facade members for these: builtins `deltaTime`; `sceneColor(uv: E): E`; `sceneDepthFade(distance: E): E`; `normalFromHeight(height: E, strength: E): E` — add to the core facade, recording facade and runtime stubs in this task (Task 5 implements them; Task 6 emits them). New categories: `scene`, `normal` in `NodeCategory`.

Unconnected UV defaults: an input whose `default` is `(0,0)` and whose definition has `widget: undefined` and id `uv` gets mesh UV. Add an `InputDefinition.fallback?: BuiltinName`: when the input is unconnected, the compiler uses `tsl.builtin(fallback)` instead of an inline uniform. The inline field shows "Mesh UV" (like "Mesh default" in phase 1). Add this to core in this task, with a compile test.

- [ ] **Step 1: Failing tests:**
  - `catalog-b types registered`.
  - `unconnected uv falls back to builtin uv`.
  - `voronoi outputs f1/f2/edge`.
  - `property node outputs ctx.property`.
  - `master has lighting param default standard`.
  - `comment node has no ports`.
  - `gradient radial formula`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement (including the core `fallback` support).
- [ ] **Step 4:** Run `pnpm lint && pnpm typecheck && pnpm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(nodes): add inputs, properties, effects, texture, color and comment nodes`.

---

### Task 5: Runtime: full live facade, properties, textures, unlit

**Files:**
- Modify: `live-facade.ts` (replace stubs), `live-backend.ts`, `create-material.ts`, `index.ts`.
- Create: `simplex-noise.ts` (TSL `Fn` port of 3D simplex noise), `apply-property-value.ts`, `create-preview-material.ts`.
- Test: extend `create-material.test.ts` and `live-facade.test.ts`; add `create-preview-material.test.ts`.

**Interfaces (Produces):**

```ts
interface MaterialOptions { resolveTexture(assetId: string): Texture | null }   // null → neutral 1×1 texture (0.5 grey, alpha 1)
function createMaterial(graph: Graph, registry: NodeRegistry, options?: MaterialOptions): MaterialBuild
// MaterialBuild gains: readonly properties: ReadonlyMap<PropertyId, LiveUniform>; readonly missingTextures: readonly string[]
// material is MeshStandardNodeMaterial | MeshBasicNodeMaterial (master lighting param)
function applyPropertyValue(build: MaterialBuild, id: PropertyId, value: PortValue): 'applied' | 'missing' | 'mismatch'
function createPreviewMaterial(graph: Graph, registry: NodeRegistry, ref: PortRef, options?: MaterialOptions): MaterialBuild
//   MeshBasicNodeMaterial, colorNode = output as vec3 (float→grey, vec2→(x,y,0), vec4→rgb), opacity 1
```

Mapping notes:
- `noise('perlin')` → `mx_noise_float`; `noise('simplex')` → the local simplex `Fn`.
- `voronoi` → `mx_worley_noise_vec2(p, jitter)`.
- `sceneColor` → `viewportSharedTexture(uv)`; `sceneDepthFade` → `viewportDepthTexture` + `linearDepth`/`perspectiveDepthToViewZ` vs the fragment's view Z; `normalFromHeight` → `bumpMap`-style derivatives (`dFdx`/`dFdy`) — verify against three 0.186 source.
- Master `surface` overrides the auto transparency (opaque → never transparent; transparent → always); `twoSided` → `side = DoubleSide`; `alphaClip` slot → `alphaTestNode`.
- `checker` → TSL `checker`.
- `colorSpace` → `sRGBTransferEOTF` / `sRGBTransferOETF`.
- `fwidth` → `fwidth`.
- `select` → `select(a.lessThan(b), …)` (or the matching comparison).
- `textureSample(t, uv, level)` → `t.sample(uv)`, plus `.level(level)` when the level is non-null.

Verify each of these names exists in three 0.186.1 (`node_modules/three/src/nodes`) before using it. If one is missing, implement it with an `Fn` and note it in the report.

- **Unlit** uses only colorNode, opacityNode, positionNode and emissive (added to color).
- **Properties** are one shared uniform each, named with `.setName(property.name)` for debugging.

- [ ] **Step 1: Failing tests:**
  - Every facade method returns a three `Node` (one table-driven test).
  - Simplex noise compiles and is deterministic at a fixed point. It needs a CPU reference only if feasible; otherwise assert it returns a Node and the material builds.
  - `unlit master builds MeshBasicNodeMaterial`.
  - `property value applies without rebuild`.
  - `missing texture uses neutral fallback and is reported` (Review Focus 4).
  - `preview material for a vec2 output maps to (x,y,0)`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `pnpm lint && pnpm typecheck && pnpm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(runtime): implement full live facade, properties, textures and unlit master`.

---

### Task 6: Codegen package

**Files:** create `packages/codegen/{package.json,tsconfig.json,vitest.config.ts}` and `src/{index,naming,code-facade,code-backend,print-module}.ts`; add the ESLint boundary override. Test: `src/codegen.test.ts`, `src/parity.test.ts`.

**Interfaces (Produces):**

```ts
interface GeneratedModule { readonly code: string; readonly errors: readonly CompileError[] }
function generateModule(graph: Graph, registry: NodeRegistry, options?: { threeVersion?: string }): GeneratedModule
```

Output contract (exact shape):

```js
// Generated by nudo-tsl from a node graph. Edit the graph, not this file.
// three r186 · MeshStandardNodeMaterial
import { float, mix, sin, time, uniform, uv, vec3 } from 'three/tsl'

export const uniforms = {
  waveSpeed: uniform(1.5),
}

const time1 = time
const sine1 = sin(time1.mul(uniforms.waveSpeed))
…
export const nodes = {
  colorNode: lerp1,
  emissiveNode: multiply2,
}

export default nodes
```

- **Names:** camelCase of the node label plus a 1-based counter per label (`lerp1`).
- **Imports:** sorted and only the ones used.
- **Inline values:** literals (`float(0.5)`, `vec3(0.1, 0.2, 0.3)`, `color(0x1a2b3c)` when the widget is color).
- **Textures:** export `textures = { name: null }` placeholders with a comment telling the user to assign a `Texture`.
- **Simplex:** emits a local `Fn` helper.
- **Unlit:** the header comment says `MeshBasicNodeMaterial`.

- [ ] **Step 1: Failing tests:**
  - `generates the exact module for the phase-1 water fixture`: a snapshot file, reviewed by eye in the report.
  - `only used imports, sorted`.
  - `property uniforms are named`.
  - **Parity:** write the generated module to a temp `.mjs` inside the package, `import()` it, and assert every exported node slot is a three `Node`. Repeat for the lettra pond fixture once Task 12 adds it; until then use a fixture exercising every catalog node.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `pnpm lint && pnpm typecheck && pnpm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(codegen): generate readable TSL modules from graphs`.

---

### Task 7: Editor: panel layout, params UI, comment nodes, master lighting

**Files:**
- Modify: `app/app-shell.tsx`, which gains slots `blackboard`, `inspector` and `codePanel` next to `previewPanel`. The right column stacks Inspector above Preview, Code is a bottom drawer, and Blackboard floats on the left.
- Create: `features/panels/{panel-frame.tsx,use-panel-shortcuts.ts,panel-state.ts}`, `features/canvas/{param-field.tsx,comment-node-view.tsx}`.
- Modify: `node-view.tsx`, `to-flow.ts`, the store (`setParam` action, panel-open state in ui-slice persisted to `nudo-tsl:panels`), `shortcut-catalog.ts`.

Behavior:
- **Panels:** collapse and expand with header buttons (`aria-expanded`) and with B/I/P/C (Global Constraints).
- **Enum params** render as a compact select in the node body (Radix Select from shared/ui, or a native `<select>` styled with joyco tokens; keyboard operable).
- **Master lighting = unlit:** Metalness, Roughness and Normal rows render disabled with the hint "Unlit ignores this".
- **Property nodes** render as compact pills: one row with the label, type chip and output port, no body.
- **Node collapse:** a chevron button in the node header (`aria-expanded`) hides unconnected ports; this is the universal param `collapsed` from Task 1 (`UNIVERSAL_PARAMS`, excluded from `topologyKey`).
- **New graph (user request):** a header button "New graph" (and `Ctrl/⌘+Alt+N`) resets to `createGraph()` as one undo step, after a confirm dialog when the graph has more than the master; the Blackboard is cleared too.
- **Preview layout modes (user request):** the preview header offers Docked (current floating panel) / Split (canvas and preview side by side, 50/50, draggable divider operable with arrow keys) / Full (preview fills the workspace; Escape or the same control returns). Shortcut `Shift+P` cycles modes. Persist the mode with the panel prefs.
- **Main Preview backdrop:** a select None / Checker room (a floor and back wall with a checker texture) so Scene Color and Depth Fade have something behind the surface. Persist it with the panel prefs.
- **Comment nodes:**
  - a resizable frame (React Flow `NodeResizer`) with an editable title (text input, quiet focus);
  - render behind other nodes;
  - selecting one does not select its contents;
  - added from the add-node menu (category Utility).

- [ ] **Step 1:** Run `get-ui-principle` and `get-ux-principle`.
- [ ] **Step 2: Failing e2e:**
  - `panels toggle with B/I/P/C and persist after reload`.
  - `select node op changes via keyboard and recompiles`.
  - `unlit disables metalness/roughness/normal rows`.
  - `property node renders as a pill`.
  - `collapsing a node hides unconnected ports and does not recompile`.
  - `checker room backdrop renders behind the preview mesh`.
  - `new graph resets to master only after confirm, and undo restores`.
  - `preview layout cycles docked → split → full with Shift+P; Escape leaves full; divider resizes with arrow keys`.
  - `comment node can be added, titled and resized by keyboard` (the resizer offers keyboard handles; otherwise width/height fields in the Inspector satisfy this in Task 10, so note that and test there).
- [ ] **Step 3:** Run. Expected: FAIL.
- [ ] **Step 4:** Implement.
- [ ] **Step 5:** Run. Expected: PASS. Then run the full gate.
- [ ] **Step 6:** Better Design review and the keyboard-accessibility audit. Fix critical/serious findings (R15 still applies). Screenshot `.context/phase-2/panels.png`.
- [ ] **Step 7:** Commit `feat(editor): add panel layout, node params, comment frames and unlit master`.

---

### Task 7b: Custom color picker (user request)

The native OS color picker (`<input type="color">`) is replaced everywhere by a custom picker in the joyco style. Color edits apply **live while dragging**, with no Enter needed.

**Files:**
- Create: `apps/editor/src/shared/components/color-picker/{color-picker.tsx,saturation-area.tsx,hue-slider.tsx,color-fields.tsx,color-math.ts,color-math.test.ts}`.
- Modify: `features/canvas/inline-field.tsx` (color field), the main-preview background control, and later consumers (Blackboard/Inspector reuse it).

**Interfaces (Produces):**

```ts
interface ColorPickerProps {
  value: readonly [number, number, number]          // linear RGB 0..1 (graph space)
  onPreview(value: readonly [number, number, number]): void   // live, every change (uses the R21 preview channel for graph inputs)
  onCommit(value: readonly [number, number, number]): void    // once per gesture / on close → one undo step
  onCancel(): void                                   // Escape restores the value at open
  label: string
}
// color-math: srgbToHsv, hsvToSrgb, hexToSrgb, srgbToHex, linearToSrgb, srgbToLinear (pure, tested)
```

Behavior:
- **Trigger:** a swatch button (`aria-haspopup="dialog"`) opens a Radix Popover with:
  - a saturation/value area (2D; arrow keys move 1%, Shift 10%);
  - a hue slider (`role="slider"`, arrows);
  - a hex text field and R/G/B fields (0–255; quiet focus style);
  - an eyedropper button only when `window.EyeDropper` exists.
- **Editing:**
  - Dragging, arrows or typing call `onPreview` immediately. The material updates live with no compile; value inputs are uniforms.
  - Closing the popover (click outside, Enter, Tab out) calls `onCommit`, which makes one undo step. Escape calls `onCancel` and returns focus to the swatch.
- **Style:** joyco tokens, sharp corners, mono labels. Sized to sit next to a node.

- [ ] **Step 1:** Run `get-ui-principle` and `get-ux-principle` for a color picker.
- [ ] **Step 2: Failing tests:**
  - unit: color-math round trips (hex↔srgb↔hsv, linear↔srgb within 1/255);
  - e2e: `dragging in the picker updates the node color and the preview without Enter` (assert `__nudoCompileCount` unchanged and the preview-apply counter rises);
  - e2e: `keyboard-only: open picker, arrows change hue, Enter commits, one undo restores`;
  - e2e: `Escape cancels and restores the original color`;
  - e2e: `hex field accepts #1a2b3c`.
- [ ] **Step 3:** Run. Expected: FAIL.
- [ ] **Step 4:** Implement, and remove every `<input type="color">` usage.
- [ ] **Step 5:** Run the full gate, including e2e.
- [ ] **Step 6:** Better Design review plus keyboard audit. Screenshot `.context/phase-2/color-picker.png`.
- [ ] **Step 7:** Commit `feat(editor): add custom live color picker`.

---

### Task 8: Editor: texture assets

**Files:**
- Create: `features/assets/{asset-store.ts,asset-store.test.ts,use-texture.ts}`, `features/canvas/texture-field.tsx`.
- Modify: the main-preview build path (pass `resolveTexture`) and `inline-field.tsx`.

**Interfaces (Produces):**

```ts
function putAsset(file: Blob): Promise<string>     // returns sha-256 hex id; dedupes
function getAsset(id: string): Promise<Blob | null>
function useTexture(id: string | null): { texture: Texture | null; state: 'empty' | 'loading' | 'ready' | 'missing' }
```

Behavior:
- **Texture field:**
  - A button "Choose image" opens a file input (png, jpg, webp, avif), then `putAsset`, then sets the value `{ type: 'texture', assetId }`.
  - Shows a 32px thumbnail.
  - A missing asset shows the "Missing texture" badge plus a "Choose image" action (Review Focus 4).
- **Live material:** `resolveTexture` returns a loaded, cached `Texture`. When a texture finishes loading, the material is rebuilt once.

- [ ] **Step 1: Failing tests:**
  - Unit: `putAsset dedupes identical bytes`, `getAsset returns null for unknown id`. Use `fake-indexeddb` in Vitest.
  - e2e: `sample texture 2d with an uploaded image tints the preview` (`setInputFiles` with a fixture PNG committed under `e2e/fixtures/`).
  - e2e: `missing asset shows badge and preview still renders`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(editor): store texture assets in IndexedDB and sample them in graphs`.

---

### Task 9: Editor: Blackboard

**Files:**
- Create: `features/blackboard/{blackboard-panel.tsx,blackboard-container.tsx,property-row.tsx,add-property-menu.tsx}`.
- Modify: the store (property actions wrapping the core ops, plus a combined `removeProperty` that is one history entry), and `to-flow.ts` (property node label = property name, with the type chip).

Behavior:
- **List:** each property shows its label, type chip and value editor (number, vector, color, texture field). Expanding a row (disclosure) shows Reference name, Exposed checkbox and default value, like Unity's Blackboard. Renaming the label suggests a matching reference name only while the reference is still the auto-generated default.
- **Add:** "+" opens a menu of types; the new property gets a unique default name (`float1`, `color1`, …).
- **Rename:** inline. Validation errors are announced and linked with `aria-describedby`; Escape reverts (Review Focus 3).
- **Delete:** a button, plus Delete on a focused row.
- **Add to canvas:** drag a row onto the canvas, or press Enter / the "Add to canvas" button. The node is placed at the viewport center and focused.
- **Live edits:** editing a property value is live: `applyPropertyValue`, with no compile.

- [ ] **Step 1: Failing e2e:**
  - `create float property, rename to waveSpeed, add to canvas by keyboard, connect, edit value without compile` (assert `__nudoCompileCount` unchanged during edits).
  - `invalid rename shows message and keeps old name` (Review Focus 3).
  - `deleting a used property removes its nodes and one undo restores them` (Review Focus 2).
  - `drag property onto canvas creates node at drop point`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Better Design review plus keyboard audit, and fix findings. Screenshot `.context/phase-2/blackboard.png`.
- [ ] **Step 6:** Commit `feat(editor): add blackboard with named shader properties`.

---

### Task 10: Editor: Inspector

**Files:** create `features/inspector/{inspector-panel.tsx,inspector-container.tsx,node-inspector.tsx,graph-inspector.tsx}`.

Behavior:
- **One node selected:** title, description, type id, params, every input value with a larger editor (reusing the inline-field components at a larger size), a preview toggle, and comment title/width/height fields for comment nodes.
- **Several nodes selected:** "N nodes selected" plus a Delete action.
- **Nothing selected:** graph settings (master lighting; schema version shown read-only).
- **Sync:** values stay in sync with the canvas fields through the store. Edits are one undo step per commit.

- [ ] **Step 1: Failing e2e:**
  - `inspector shows selected node and edits its value` (value visible on the node too).
  - `graph settings switch lighting to unlit`.
  - `comment size editable from inspector`.
  - `inspector is reachable by keyboard and returns focus to canvas with Escape`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Better Design review plus keyboard audit, and fix findings. Screenshot `.context/phase-2/inspector.png`.
- [ ] **Step 6:** Commit `feat(editor): add inspector for nodes and graph settings`.

---

### Task 11: Editor: per-node previews

**Files:** create `features/node-previews/{preview-engine.ts,preview-engine.test.ts,preview-scheduler.ts,node-preview.tsx,use-node-preview.ts}`; modify `node-view.tsx`.

**Interfaces (Produces):**

```ts
interface PreviewEngine {
  register(ref: PortRef, canvas: HTMLCanvasElement): () => void   // unregister
  setVisible(nodeId: NodeId, visible: boolean): void
  update(graph: Graph): void        // marks dirty by upstream topology/values; value-only → applyInputValue/applyPropertyValue on affected preview materials
  dispose(): void
}
function createPreviewEngine(options: { size: number /* 96 */; fps: number /* 20 */; budgetPerFrame: number /* 4 */; createRenderer(): Promise<RendererResult> }): PreviewEngine
```

Behavior:
- **Renderer:**
  - One offscreen renderer, the same `createRenderer` as the Main Preview, on its own hidden canvas.
  - Each registered output gets a `createPreviewMaterial` on a full-screen quad.
  - Render, then `drawImage` into the node's 2D canvas. If that is unreliable on the WebGPU backend, use `readRenderTargetPixelsAsync`; the implementer decides with a test and records why.
- **Dirty tracking:**
  - A topology change rebuilds only the materials whose upstream set changed.
  - A value change applies uniforms with no rebuild.
  - Time-dependent previews re-render at ≤ `fps` and only when visible (IntersectionObserver on the node canvas).
  - At most `budgetPerFrame` renders per animation frame, round-robin.
- **Preview mode:** auto picks a sphere (3D) when the upstream subgraph uses Normal, Position, View Direction, Fresnel or Normal From Height, else a quad (2D); a per-node override (auto/2D/3D) lives in the Inspector and in the universal param `previewMode` (Task 1). Previews are drawn as circles like Unity (round mask) for 3D, squares for 2D.
- **UI:** previews show below the node body as a 96px square (Master has none). The toggle comes from the Inspector, plus an icon button in the node header with `aria-pressed`. Errors show a hatched "No preview" state.

- [ ] **Step 1: Failing tests:**
  - Unit with a fake renderer:
    - `value change applies to preview uniforms without rebuild`;
    - `unrelated topology change does not rebuild a node's preview`;
    - `budget caps renders per frame`;
    - `invisible animated previews do not render` (Review Focus 5).
  - e2e:
    - `color node preview shows its color` (sample pixels of the node canvas);
    - `time node preview animates while visible`;
    - `toggle hides preview`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Better Design review. Screenshot `.context/phase-2/node-previews.png`.
- [ ] **Step 6:** Commit `feat(editor): render live per-node previews with a shared renderer`.

---

### Task 12: Editor: code panel

**Files:** create `features/code-panel/{code-panel.tsx,code-panel-container.tsx,use-generated-code.ts}`. Add the `sugar-high` dependency.

Behavior:
- **Live:** the bottom drawer shows `generateModule(graph, registry).code`, debounced 150 ms.
- **Display:** a `pre` with line numbers, highlighted by sugar-high with colors mapped to joyco tokens (keep the AA contrast).
- **Actions:** "Copy" button (Clipboard API; announces "Copied"). Errors list the nodes that failed. A "Download .tsl.js" button is a phase-3 stub and is NOT added now.
- **Keyboard:** the drawer opens with `C`. The code region is focusable (`tabindex=0`, `role="region"`, `aria-label="Generated TSL"`).

- [ ] **Step 1: Failing e2e:**
  - `code panel shows generated module and updates on connect`.
  - `copy puts the module on the clipboard`.
  - `generated code imports only used symbols` (text assertion).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Better Design review. Screenshot `.context/phase-2/code-panel.png`.
- [ ] **Step 6:** Commit `feat(editor): add live TSL code panel`.

---

### Task 13: Examples (lettra pond, simple water), phase-2 e2e and docs

**Files:**
- Create: `apps/editor/src/examples/{lettra-pond.graph.json,simple-water.graph.json,index.ts}`, `e2e/phase-2-golden-path.spec.ts`, `e2e/lettra-pond.spec.ts`.
- Modify: `README.md` (catalog, panels, shortcuts), the codegen parity test (adds the pond).

The **lettra pond** graph, built with nudo nodes and NOT copied code, follows the structure of `joyco-studio/lettra-landing/src/lib/scenes/models/water.ts` (clone it to /tmp to read it):
- pond-space UV;
- two scrolling noise reads, giving a refraction offset;
- Voronoi F1 rosettes with Voronoi bumps on the rim;
- lace from the Voronoi edge (f2 − f1) instead of their blurred-mip crease;
- three rotated Voronoi stamp reads thresholded with AA Step and summed;
- a sun band from Exp of a Gaussian across a light direction;
- tones picked by Select on light thresholds between Blackboard color properties (shade/mid/sun per tone);
- the lace layered over the body with Lerp;
- Screen UV vignette darkening;
- unlit master.

Expose the palette, light angle/strength and wave speed as Blackboard properties. The example must render without node errors and look like the reference. Compare visually with a screenshot of the lettra site if reachable, and note any differences in the report.

`examples/index.ts` exports `{ id, title, graph }[]`. Phase 5 builds the full gallery UI. For now, add a header dropdown "Examples" listing both items. It must be keyboard operable. Picking one replaces the graph as a single undo step, after a confirm dialog when the current graph has more than the master.

- [ ] **Step 1: Failing e2e:**
  - `lettra pond example loads, has no node errors, renders a non-uniform image` (pixel variance in the preview above a threshold), `and scrubbing a palette property triggers no compile` (Review Focus 5).
  - `phase-1 v1 autosave opens migrated` (Review Focus 1, seeded with the phase-1 water JSON as schemaVersion 1).
  - Phase-2 golden path: create a property, sample a texture, use Voronoi, Split and Select, switch to unlit, check the code panel and the node previews, reload, all intact.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Build the example graphs, using a small script with core ops like the phase-1 water snippet. Commit the JSON, the examples menu and the README update.
- [ ] **Step 4:** Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. Expected: all green.
- [ ] **Step 5:** Screenshot `.context/phase-2/lettra-pond.png`.
- [ ] **Step 6:** Commit `feat(editor): add lettra pond and water examples with phase-2 e2e`.
