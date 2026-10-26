# nudo-tsl Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working node-based TSL shader editor: monorepo + `core` (graph, types, validation, inference, compiler, serialization, clipboard fragments) + 10 nodes and the Master Stack + `runtime` live backend + a keyboard-operable editor with canvas, add-node menu, Main Preview, undo/redo, copy/paste and autosave.

**Architecture:** Pure `core` owns the graph model and a compiler generic over an expression type `E`. Nodes declare one `build<E>` against `TslFacade<E>`; `runtime` supplies the live facade over `three/tsl` and builds a `MeshStandardNodeMaterial`. The editor stores the core `Graph` in Zustand (zundo for history) and derives the React Flow view from it.

**Tech Stack:** pnpm 11 workspaces, Turborepo 2, TypeScript ~6.0.3, Vite 8, React 19.3, @xyflow/react 12, Zustand 5 + zundo 2, three 0.186.1 (`three/webgpu`, `three/tsl`), @react-three/fiber 9 + drei 10, Tailwind v4 + shadcn (`radix-nova`, registry `@joyco`), cmdk, nanoid 6, Vitest 5, Playwright 1.64, ESLint 10 + typescript-eslint, Prettier, Husky, Commitlint.

**Spec:** `docs/superpowers/specs/2026-10-26-nudo-tsl-design.md`

## Global Constraints

- TypeScript strict everywhere: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. No `any`; use `unknown` + guards. No unsafe `as` casts (only `as const`).
- `typescript` pinned `~6.0.3`, because typescript-eslint requires `<6.1.0`.
- `three` and `@types/three` are pinned exactly: `0.186.1` / `0.186.0`.
- File and directory names are kebab-case. All code, identifiers and comments are in English.
- Package scope is `@nudo-tsl/*`, and every `package.json` has `"private": true`.
- Packages export TS source (`"exports": { ".": "./src/index.ts" }`), with no build step.
- Dependency boundaries are enforced by ESLint `no-restricted-imports`:
  - `core` imports nothing internal and nothing from react, react-dom, three or `@xyflow/*`.
  - `nodes` imports only `@nudo-tsl/core`.
  - `runtime` imports only `core`, `nodes` and `three`.
- Graph operations are pure, return `Result<T, E>` and never throw.
- Master node id is the literal `'master'`, type `'master/stack'`, and it can't be removed.
- Unconnected input values become `uniform()` live. A value change must never trigger recompilation; only a `topologyKey` change does, debounced 150 ms.
- Ports show their type as color **and** text (`1`, `2`, `3`, `4`, `T`).
- Port colors:

| Type | Color |
|---|---|
| float | `oklch(0.78 0.12 200)` |
| vec2 | `oklch(0.75 0.17 150)` |
| vec3 | `oklch(0.82 0.16 80)` |
| vec4 | `oklch(0.72 0.2 330)` |
| texture | `oklch(0.7 0.19 35)` |

- The primary blue `oklch(0.452 0.313214 264.052)` is used only for primary action, selection and focus.
- Design tokens are copied verbatim from `https://raw.githubusercontent.com/joyco-studio/gltf/main/app/globals.css`:
  - `--radius: 0`.
  - Fonts: Public Sans (`@fontsource-variable/public-sans`) and Roboto Mono (`@fontsource-variable/roboto-mono`).
  - Dark theme by default.
- Every UI task follows Better Design:
  - `get-ui-principle` before styling, `get-ux-principle` before behavior.
  - After building: `get-review-rules`, `check-comprehension`, `inspect-spacing`. Fix every critical and serious finding.
  - Use the `keyboard-accessibility` skill.
- Escape closes every overlay and returns focus to the opener. `tabindex` is only `0` or `-1`. Never use `outline: none` without the ring.
- Commits use Conventional Commits and **never** contain a `Co-Authored-By` line.
- localStorage keys: `nudo-tsl:autosave`, `nudo-tsl:autosave:corrupt`, `nudo-tsl:theme`.

## Review Focus

1. **Corrupt or foreign autosave** in localStorage (bad JSON, unknown node type, future `schemaVersion`). The editor must open with a fresh graph, keep the raw text under `nudo-tsl:autosave:corrupt` and show a dismissible notice. Never a white screen. Test in Task 11.
2. **Pasting arbitrary clipboard text** (prose, JSON that is not a fragment, a fragment with unknown node types). The paste is a no-op with a notice, and the graph and history stay untouched. Tests in Task 7 (core) and Task 14 (e2e).
3. **Disconnecting the edge that drove a generic type.** For example, vec3 → Add, then disconnect: Add's ports fall back to the type of their inline defaults, the inline field shows the right arity and the preview recompiles without error. Tests in Tasks 4 and 6.
4. **Invalid number entry** in inline fields (empty, `abc`, `1e999`, `-`). The value is never stored as NaN or Infinity; on blur or Enter the field reverts to the last valid value. Test in Task 12.
5. **No WebGPU and no WebGL2.** The preview panel shows a plain message, while canvas, editing, undo and autosave keep working. Test in Task 15.

---

## File Structure

```
package.json  pnpm-workspace.yaml  turbo.json  tsconfig.base.json
eslint.config.js  prettier.config.js  commitlint.config.js  .husky/commit-msg
.github/workflows/ci.yml  vercel.json
packages/core/src/
  index.ts
  types/{result,ids,data-type,port-value,graph,node-definition,tsl-facade}.ts
  values/{port-value-factories,convert-value}.ts
  registry/{define-node,node-registry}.ts
  types-system/{conversion,widest-type}.ts
  type-inference/resolve-port-types.ts
  validation/{would-create-cycle,check-connection}.ts
  graph/{create-graph,add-node,remove-nodes,move-nodes,set-input-value,connect,disconnect}.ts
  compiler/{compile,compile-backend}.ts
  topology/topology-key.ts
  serialization/{schema-version,parse-graph,migrate,serialize-graph}.ts
  fragment/{extract-fragment,paste-fragment,parse-fragment}.ts
  (tests: colocated *.test.ts)
packages/nodes/src/
  index.ts  create-default-registry.ts
  master/master-stack.ts
  input/{float-node,color-node,time-node,uv-node,normal-node}.ts
  math/{add-node,multiply-node,sin-node}.ts
  interpolation/lerp-node.ts
  effects/fresnel-node.ts
  testing/recording-facade.ts
packages/runtime/src/
  index.ts  live-facade.ts  live-backend.ts  create-material.ts  apply-input-value.ts
apps/editor/
  index.html  vite.config.ts  playwright.config.ts  components.json
  src/main.tsx
  src/app/{app.tsx,app-shell.tsx,theme-provider.tsx,globals.css}
  src/shared/ui/*                 # shadcn + cluster
  src/shared/theme/port-colors.ts
  src/store/{editor-store.ts,graph-slice.ts,ui-slice.ts,compile-slice.ts,autosave.ts,registry.ts}
  src/features/canvas/{graph-canvas.tsx,graph-canvas-container.tsx,to-flow.ts,node-view.tsx,port-handle.tsx,typed-edge.tsx,inline-field.tsx,parse-number-input.ts,keyboard-connect-list.tsx}
  src/features/add-node-menu/{add-node-menu.tsx,search-nodes.ts}
  src/features/shortcuts/{use-global-shortcuts.ts,shortcuts-dialog.tsx,clipboard.ts}
  src/features/main-preview/{main-preview.tsx,preview-mesh.tsx,compile-scheduler.ts,create-renderer.ts}
  e2e/*.spec.ts
```

---

### Task 1: Monorepo scaffold and tooling

**Files:**
- Delete: `src/`, `public/`, `next.config.ts`, `eslint.config.mjs`, `tsconfig.json`, `AGENTS.md`. These belong to the Next scaffold; `AGENTS.md` is regenerated by `next dev` and no longer applies.
- Rewrite: `package.json`, `pnpm-workspace.yaml`, `README.md`.
- Create: `turbo.json`, `tsconfig.base.json`, `eslint.config.js`, `prettier.config.js`, `commitlint.config.js`, `.husky/commit-msg`, `.github/workflows/ci.yml`, `LICENSE` (MIT, "Alejo Pequeño"), `packages/core/{package.json,tsconfig.json,vitest.config.ts,src/index.ts,src/index.test.ts}`.

**Interfaces:**
- Produces:
  - Root scripts `lint`, `typecheck`, `test`, `build`, `e2e`, all via `turbo run`.
  - Workspace globs `apps/*` and `packages/*`.
  - `tsconfig.base.json`, which every package extends.

- [ ] **Step 1:** Remove the Next files and write the workspace config. Keep `packageManager: pnpm@11.0.3` and `engines.node >=22`. Keep `allowBuilds` in `pnpm-workspace.yaml` (add `esbuild: true`).
- [ ] **Step 2:** Write `tsconfig.base.json`:
  - `target ES2022`, `module ESNext`, `moduleResolution Bundler`.
  - `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`, `isolatedModules`, `skipLibCheck`, `noEmit`.
- [ ] **Step 3:** Write `eslint.config.js`:
  - typescript-eslint `strictTypeChecked`, plus `@typescript-eslint/no-explicit-any: error` and `consistent-type-assertions` with `assertionStyle: 'never'`. Allow `as const` via the rule option.
  - The boundary rules from Global Constraints, one override per package directory.
  - Add Prettier, Husky (`commit-msg` → `commitlint --edit`) and `@commitlint/config-conventional`.
- [ ] **Step 4:** Create `packages/core` with the placeholder `export const CORE_VERSION = '0.0.0'` and a test asserting it is a string. Its `package.json` scripts are `typecheck: tsc -p .`, `test: vitest run` and `lint: eslint .`.
- [ ] **Step 5:** Write the CI workflow:
  - Trigger on push and PR.
  - pnpm/action-setup, Node 22.
  - `pnpm install --frozen-lockfile`, then `pnpm lint typecheck test build`.
  - The e2e job is added in Task 10.
- [ ] **Step 6:** Run `pnpm install && pnpm lint && pnpm typecheck && pnpm test`. Expected: all pass, 1 test.
- [ ] **Step 7:** Verify the commit hook rejects a bad message. Run `echo "bad message" | pnpm commitlint`; expected: non-zero exit.
- [ ] **Step 8:** Commit `chore: set up pnpm + turborepo monorepo with strict tooling`.

---

### Task 2: Core types, value factories and value conversion

**Files:**
- Create: `packages/core/src/types/{result,ids,data-type,port-value,graph,node-definition,tsl-facade}.ts`, `src/values/{port-value-factories,convert-value}.ts`, `src/types-system/{conversion,widest-type}.ts`.
- Test: `src/values/convert-value.test.ts`, `src/types-system/conversion.test.ts`, `src/types-system/widest-type.test.ts`.

**Interfaces:**
- Produces (exported from `@nudo-tsl/core`):

```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
const ok: <T>(value: T) => Result<T, never>;
const err: <E>(error: E) => Result<never, E>;

type NodeId, EdgeId (branded string), NodeTypeId = string;
const asNodeId: (raw: string) => NodeId;  // the only brand constructors
const asEdgeId: (raw: string) => EdgeId;
const MASTER_NODE_ID: NodeId;             // 'master'

DATA_TYPES, DataType, VectorType, PortTypeSpec, PortValue   // exactly as in spec §4.2
interface XY { readonly x: number; readonly y: number }
PortRef, GraphNode, GraphEdge, Graph                       // spec §4.2; ParamValue = string | number | boolean
type BlackboardProperty = never;  // phase 2 placeholder; Graph.properties is always []

type NodeCategory = 'input' | 'math' | 'interpolation' | 'vector' | 'effects' | 'texture' | 'utility' | 'master';
type InputWidget = 'number' | 'color';
interface InputDefinition<I extends string> {
  readonly id: I; readonly label: string; readonly type: PortTypeSpec;
  readonly default: PortValue; readonly widget?: InputWidget; readonly optional?: boolean;
}
interface OutputDefinition<O extends string> { readonly id: O; readonly label: string; readonly type: PortTypeSpec }
NodeDefinition<I, O>, BuildContext<E, I>                     // spec §4.2
type AnyNodeDefinition = NodeDefinition<string, string>;

type BuiltinName = 'time' | 'uv' | 'normalWorld' | 'normalView' | 'positionLocal' | 'positionWorld' | 'positionViewDirection';
type Swizzle = 'x' | 'xy' | 'xyz';
interface TslFacade<E> {
  add(a: E, b: E): E; mul(a: E, b: E): E; sin(a: E): E; pow(a: E, b: E): E;
  oneMinus(a: E): E; clamp(x: E, low: E, high: E): E; dot(a: E, b: E): E; mix(a: E, b: E, t: E): E;
  builtin(name: BuiltinName): E;
  construct(type: VectorType, parts: readonly (E | number)[]): E;
  swizzle(value: E, components: Swizzle): E;
}

// values
const float: (v: number) => PortValue;  vec2/vec3/vec4: (...components) => PortValue;
const splat: (type: VectorType, v: number) => PortValue;     // vec4(0) in spec examples = splat('vec4', 0)
const concrete: (type: DataType) => PortTypeSpec;
const generic: (group: string, allowed?: readonly VectorType[]) => PortTypeSpec;  // default all 4 vector types
const convertValue: (value: PortValue, to: VectorType) => PortValue;

// type system
type Conversion = { readonly kind: 'splat' | 'truncate' | 'pad'; readonly from: VectorType; readonly to: VectorType };
type ConversionCheck = { ok: true; conversion: Conversion | null } | { ok: false };
const getConversion: (from: DataType, to: DataType) => ConversionCheck;
const widestType: (types: readonly VectorType[]) => VectorType | null;
const componentCount: (type: VectorType) => 1 | 2 | 3 | 4;
```

- [ ] **Step 1: Write failing tests**

```ts
test('getConversion splats float into vectors', () => {
  expect(getConversion('float', 'vec3')).toEqual({ ok: true, conversion: { kind: 'splat', from: 'float', to: 'vec3' } });
});
test('getConversion truncates and pads', () => {
  expect(getConversion('vec4', 'vec2')).toMatchObject({ ok: true, conversion: { kind: 'truncate' } });
  expect(getConversion('vec2', 'vec4')).toMatchObject({ ok: true, conversion: { kind: 'pad' } });
});
test('vecN to float truncates to x', () => {
  expect(getConversion('vec3', 'float')).toMatchObject({ ok: true, conversion: { kind: 'truncate' } });
});
test('same type needs no conversion', () => { expect(getConversion('vec3', 'vec3')).toEqual({ ok: true, conversion: null }); });
test('texture only connects to texture', () => {
  expect(getConversion('texture', 'vec3')).toEqual({ ok: false });
  expect(getConversion('float', 'texture')).toEqual({ ok: false });
  expect(getConversion('texture', 'texture')).toEqual({ ok: true, conversion: null });
});
test('widestType', () => {
  expect(widestType(['float', 'vec3', 'vec2'])).toBe('vec3');
  expect(widestType([])).toBeNull();
});
test('convertValue pads with 0 and w with 1', () => {
  expect(convertValue(vec2(1, 2), 'vec4')).toEqual(vec4(1, 2, 0, 1));
  expect(convertValue(float(3), 'vec3')).toEqual(vec3(3, 3, 3));
  expect(convertValue(vec3(1, 2, 3), 'float')).toEqual(float(1));
});
```

- [ ] **Step 2:** Run `pnpm --filter @nudo-tsl/core test`. Expected: FAIL (modules missing).
- [ ] **Step 3:** Implement all files from the Interfaces block and re-export from `src/index.ts`. Remove the `CORE_VERSION` placeholder.

  Splat padding rule: the splat for float → vec4 is `(v, v, v, v)`. Pad (vecN → vecM, N ≥ 2) fills with `0`, except `w`, which becomes `1`.
- [ ] **Step 4:** Run the tests and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(core): add data types, port values and conversion rules`.

---

### Task 3: Node definitions and registry

**Files:**
- Create: `packages/core/src/registry/{define-node,node-registry}.ts`.
- Test: `src/registry/node-registry.test.ts`.

**Interfaces:**
- Consumes: Task 2 types.
- Produces:

```ts
function defineNode<const I extends string, const O extends string>(definition: NodeDefinition<I, O>): NodeDefinition<I, O>;
interface NodeRegistry {
  register(definition: AnyNodeDefinition): Result<void, { code: 'duplicate-type'; type: NodeTypeId }>;
  get(type: NodeTypeId): AnyNodeDefinition | undefined;
  list(): readonly AnyNodeDefinition[];   // insertion order
}
function createNodeRegistry(): NodeRegistry;
```

- [ ] **Step 1: Failing tests:**
  - `register then get returns the definition`.
  - `register rejects duplicate type with code duplicate-type`.
  - `list preserves insertion order`.
  - A type-level test (`expectTypeOf`): with `defineNode`, `build` receives `inputs.a` and rejects `inputs.zzz`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement with a `Map`.
- [ ] **Step 4:** Run. Expected: PASS, typecheck clean.
- [ ] **Step 5:** Commit `feat(core): add node registry and defineNode`.

---

### Task 4: Type inference for generic ports

**Files:**
- Create: `packages/core/src/type-inference/resolve-port-types.ts`, `src/graph/topological-order.ts`.
- Test: `src/type-inference/resolve-port-types.test.ts`.

**Interfaces:**
- Consumes: `Graph`, `NodeRegistry`, `widestType`.
- Produces:

```ts
type PortKey = `${string}:${string}`;                   // `${nodeId}:${portId}`
const portKey: (ref: PortRef) => PortKey;
interface ResolvedTypes {
  readonly inputs: ReadonlyMap<PortKey, DataType>;
  readonly outputs: ReadonlyMap<PortKey, DataType>;
}
function topologicalOrder(graph: Graph): readonly NodeId[];   // sources first; assumes acyclic
function resolvePortTypes(graph: Graph, registry: NodeRegistry): ResolvedTypes;
```

Algorithm: walk nodes in topological order. Concrete ports take their declared type. For each generic group, the type is the `widestType` of the source output types of the group's connected inputs. If none are connected, it is the `widestType` of the types of the group's inline values (`node.inputValues[id] ?? def.default`). Generic outputs take their group's type. Nodes whose definition is missing are skipped.

- [ ] **Step 1: Failing tests.** Test registry with fixtures: `float-source` (out concrete float), `vec3-source` (out concrete vec3) and the generic `add`.
  - `unconnected generic resolves from inline defaults` → add.out is `float`.
  - `connected vec3 widens the whole group` → add.a, add.b and add.out are all `vec3`.
  - `mixed float and vec3 sources widen to vec3`.
  - `chained generics propagate` (vec3 → add1 → add2): add2.out is `vec3`.
  - `disconnecting reverts to default type` (Review Focus 3): build the graph with the edge, remove it, re-resolve, add.out is `float`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. `topologicalOrder` uses Kahn's algorithm with a stable tie-break by node id.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(core): resolve generic port types`.

---

### Task 5: Connection validation and graph operations

**Files:**
- Create: `packages/core/src/validation/{would-create-cycle,check-connection}.ts`, `src/graph/{create-graph,add-node,remove-nodes,move-nodes,set-input-value,connect,disconnect}.ts`.
- Test: `src/validation/check-connection.test.ts`, `src/graph/graph-operations.test.ts`.

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces:

```ts
type ConnectionRejection = 'type-mismatch' | 'cycle' | 'same-node' | 'unknown-port';
type ConnectionCheck = { ok: true; conversion: Conversion | null } | { ok: false; reason: ConnectionRejection };
function wouldCreateCycle(graph: Graph, from: PortRef, to: PortRef): boolean;
function checkConnection(graph: Graph, registry: NodeRegistry, from: PortRef, to: PortRef): ConnectionCheck;

type GraphError =
  | { code: 'unknown-node-type'; type: NodeTypeId }
  | { code: 'node-not-found'; nodeId: NodeId }
  | { code: 'cannot-remove-master' }
  | { code: 'duplicate-id'; id: string }
  | { code: 'invalid-connection'; reason: ConnectionRejection }
  | { code: 'unknown-port'; ref: PortRef };

function createGraph(): Graph;   // contains only the master node at { x: 600, y: 0 }
function addNode(graph: Graph, registry: NodeRegistry, input: { id: NodeId; type: NodeTypeId; position: XY }): Result<Graph, GraphError>;
function removeNodes(graph: Graph, ids: readonly NodeId[]): Result<Graph, GraphError>;  // also removes touching edges
function moveNodes(graph: Graph, positions: Readonly<Partial<Record<NodeId, XY>>>): Graph;
function setInputValue(graph: Graph, ref: PortRef, value: PortValue): Result<Graph, GraphError>;
function connect(graph: Graph, registry: NodeRegistry, input: { id: EdgeId; from: PortRef; to: PortRef }): Result<Graph, GraphError>;
function disconnect(graph: Graph, edgeIds: readonly EdgeId[]): Graph;
```

Rules:
- `checkConnection`:
  - `from` must be an output and `to` an input of their definitions; otherwise `unknown-port`.
  - A generic input accepts any type in its `allowed` list, and its conversion is computed at compile time, so `conversion: null`.
  - A concrete input uses `getConversion(resolvedSourceType, targetType)`.
- `connect` replaces any existing edge whose `to` matches.
- `createGraph` must not need a registry. The master node literal is `{ id: 'master', type: 'master/stack', position: { x: 600, y: 0 }, inputValues: {}, params: {} }`.

- [ ] **Step 1: Failing tests** (fixture registry plus a fixture `master/stack` with a vec3 input `baseColor`):
  - `rejects connecting a node to itself` → `same-node`.
  - `rejects a cycle a→b→a` → `cycle`.
  - `rejects texture into vec3` → `type-mismatch`.
  - `float into concrete vec3 input reports splat conversion`.
  - `rejects output-to-output` → `unknown-port`.
  - `connect replaces existing edge on the same input` → one edge remains, with the new id.
  - `removeNodes rejects master` → `cannot-remove-master`, and the graph is unchanged.
  - `removeNodes deletes touching edges`.
  - `addNode rejects unknown type` and `duplicate id`.
  - `operations never mutate input graph` (`Object.freeze` the input deeply, then run every op).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. `wouldCreateCycle` is a DFS forward from `to.nodeId` looking for `from.nodeId`; `from.nodeId === to.nodeId` counts as a cycle only after the `same-node` check.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(core): add connection validation and pure graph operations`.

---

### Task 6: Compiler and topology key

**Files:**
- Create: `packages/core/src/compiler/{compile-backend,compile}.ts`, `src/topology/topology-key.ts`.
- Test: `src/compiler/compile.test.ts`, `src/topology/topology-key.test.ts`.

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces:

```ts
type MasterSlot = 'position' | 'baseColor' | 'emission' | 'metalness' | 'roughness' | 'normal' | 'opacity';
const MASTER_SLOTS: readonly MasterSlot[];
interface CompileBackend<E> {
  readonly tsl: TslFacade<E>;
  inputValue(ref: PortRef, value: PortValue, widget: InputWidget | undefined): E;
}
type CompileTarget = { kind: 'master' } | { kind: 'port'; ref: PortRef };
interface CompileError { readonly nodeId: NodeId; readonly code: 'missing-definition' | 'unresolved-type' | 'build-failed'; readonly message: string }
type CompileOutput<E> = { kind: 'master'; slots: Partial<Record<MasterSlot, E>> } | { kind: 'port'; expression: E };
type CompileResult<E> = { ok: true; output: CompileOutput<E> } | { ok: false; errors: readonly CompileError[] };
function compile<E>(graph: Graph, registry: NodeRegistry, backend: CompileBackend<E>, target: CompileTarget): CompileResult<E>;
function topologyKey(graph: Graph): string;
```

Rules:
- Evaluation is memoized per node id.
- An input expression is resolved like this:
  - If connected, take the source output expression and apply the conversion from the source's resolved type to the input's resolved type:
    - splat: `tsl.construct(to, [x])`.
    - truncate to float: `tsl.swizzle(x, 'x')`.
    - truncate to vecN: swizzle `'xy'` / `'xyz'`.
    - pad: `tsl.construct(to, [x, 0..., 1 for w])`.
  - If unconnected, call `backend.inputValue(ref, convertValue(stored ?? default, resolvedType), widget)`.
- Master target:
  - A connected slot → expression.
  - An unconnected slot with `optional: true` (position, normal) → omitted.
  - Otherwise → inline value.
- A `build` that throws is caught and recorded as a `build-failed` `CompileError` with the error message. Errors from all reachable nodes are collected; if any exist, `ok: false`.
- Only nodes reachable from the target are evaluated.
- `topologyKey` covers sorted node ids with type and params, plus sorted edges `from→to`. It excludes positions and inputValues.

- [ ] **Step 1: Failing tests** use a string backend: a `TslFacade<string>` that prints calls, e.g. `add(a,b)`, and `inputValue` → `u(nodeId:portId)`.
  - `compiles master baseColor from lerp of two colors`: assert the exact string `mix(u(c1:color),u(c2:color),u(l:t))`.
  - `shared node is evaluated once` (spy the build count).
  - `float into vec3 slot is splatted`: `construct(vec3,[...])`.
  - `vec4 into vec3 is swizzled xyz`.
  - `optional unconnected slots are omitted`: `'position' in slots === false`.
  - `throwing build yields build-failed with nodeId`.
  - `unreachable broken node does not fail compile`.
  - `port target compiles a single expression`.
  - `after disconnecting vec3 source, add inline values compile as float` (Review Focus 3).
  - `topologyKey ignores positions and values, changes on edge add`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(core): add backend-agnostic compiler and topology key`.

---

### Task 7: Serialization, migrations and clipboard fragments

**Files:**
- Create: `packages/core/src/serialization/{schema-version,migrate,parse-graph,serialize-graph}.ts`, `src/fragment/{extract-fragment,paste-fragment,parse-fragment}.ts`.
- Test: `src/serialization/serialization.test.ts`, `src/fragment/fragment.test.ts`.

**Interfaces:**
- Produces:

```ts
const CURRENT_SCHEMA_VERSION = 1;
interface Migration { readonly from: number; migrate(input: Readonly<Record<string, unknown>>): Record<string, unknown> }
type ParseError =
  | { code: 'invalid-json' }
  | { code: 'invalid-shape'; path: string }
  | { code: 'unsupported-version'; version: number }
  | { code: 'unknown-node-type'; type: string };
function migrate(input: unknown, migrations: readonly Migration[]): Result<Record<string, unknown>, ParseError>;
function parseGraph(input: unknown, registry: NodeRegistry, migrations?: readonly Migration[]): Result<Graph, ParseError>;
function serializeGraph(graph: Graph): string;   // stable: nodes/edges sorted by id, 2-space JSON

interface GraphFragment { readonly kind: 'nudo-tsl/fragment'; readonly schemaVersion: 1; readonly nodes: readonly GraphNode[]; readonly edges: readonly GraphEdge[] }
function extractFragment(graph: Graph, nodeIds: readonly NodeId[]): GraphFragment | null;  // excludes master and edges leaving the set
function serializeFragment(fragment: GraphFragment): string;
function parseFragment(text: string, registry: NodeRegistry): Result<GraphFragment, ParseError>;
function pasteFragment(graph: Graph, fragment: GraphFragment, options: { offset: XY; createNodeId: () => NodeId; createEdgeId: () => EdgeId }): { graph: Graph; pastedNodeIds: readonly NodeId[] };
```

Notes:
- `parseGraph` validates every field with hand-written guards (no dependencies): the number tuple lengths must match the `PortValue.type`, and finite numbers only.
- The graph must contain a `master` node of type `master/stack`.
- A version greater than current → `unsupported-version`.

- [ ] **Step 1: Failing tests:**
  - `round-trips createGraph through serialize/parse`.
  - `serialize is stable regardless of insertion order`.
  - `rejects bad JSON shape with path` (e.g. `nodes.x.position.x` is a string).
  - `rejects NaN/Infinity in values`.
  - `rejects future schemaVersion`.
  - `rejects unknown node type`.
  - `rejects graph without master`.
  - `applies chained migrations v0→v1` (inject a fake `{from: 0}` migration and a v0 input lacking `properties`).
  - `extractFragment drops master and external edges`.
  - `pasteFragment remaps ids and offsets positions`.
  - `parseFragment rejects prose, plain graph JSON and unknown types` (Review Focus 2).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(core): add graph serialization, migrations and clipboard fragments`.

---

### Task 8: Built-in nodes package

**Files:**
- Create: `packages/nodes/{package.json,tsconfig.json,vitest.config.ts}`, all `src/` files listed in File Structure.
- Test: `src/nodes.test.ts`.

**Interfaces:**
- Consumes: `defineNode`, `generic`, `concrete`, the value factories, `TslFacade`, `createNodeRegistry`, `compile`.
- Produces:
  - `createDefaultRegistry(): NodeRegistry` (all 11 definitions).
  - `createRecordingFacade(): TslFacade<string>` (also used by runtime tests).
  - Each definition exported by name, e.g. `masterStackNode`, `floatNode`, ….

Definitions (type id → ports):

| Type id | Inputs | Outputs / build |
|---|---|---|
| `master/stack` | position vec3 optional; baseColor vec3 `(0.8,0.8,0.8)` color; emission vec3 `(0,0,0)` color; metalness float `0`; roughness float `0.5`; normal vec3 optional; opacity float `1` | build returns `{}` |
| `input/float` | x float `0` | out float = x |
| `input/color` | color vec3 `(1,1,1)` widget color | out vec3 = color |
| `input/time` | — | out float = `builtin('time')` |
| `input/uv` | — | out vec2 = `builtin('uv')` |
| `input/normal` | — | out vec3 = `builtin('normalWorld')` |
| `math/add` | a generic T default `float(0)`; b generic T default `float(0)` | out T = add |
| `math/multiply` | a T `float(1)`; b T `float(1)` | out T = mul |
| `math/sin` | in T `float(0)` | out T = sin |
| `interpolation/lerp` | a T `float(0)`; b T `float(1)`; t float `0.5` | out T = mix |
| `effects/fresnel` | power float `5` | out float = `pow(oneMinus(clamp(dot(builtin('normalView'), builtin('positionViewDirection')), 0, 1)), power)` |

Every definition needs a non-empty `description` (tooltip copy, one sentence) and `keywords`.

Lerp defaults: use `float(0)` / `float(1)` so an unconnected Lerp resolves to float. This overrides the spec example's `vec4` defaults; note it in the commit body.

- [ ] **Step 1: Failing tests:**
  - `default registry contains exactly the 11 phase-1 types`.
  - `every definition has description and keywords`.
  - `fresnel builds the expected expression` (recording facade string).
  - `compiling a Time→Sin→Lerp→baseColor graph succeeds` (via `compile` with the recording facade).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS, and lint passes the boundary rule (`nodes` imports only core).
- [ ] **Step 5:** Commit `feat(nodes): add master stack and phase-1 node catalog`.

---

### Task 9: Runtime live backend

**Files:**
- Create: `packages/runtime/{package.json,tsconfig.json,vitest.config.ts}`, `src/{index,live-facade,live-backend,create-material,apply-input-value}.ts`.
- Test: `src/create-material.test.ts` (Vitest node environment; `three/tsl` imports cleanly in Node, verified with r186).

**Interfaces:**
- Consumes: `compile`, `CompileBackend`, `MASTER_SLOTS`, `portKey`, `createDefaultRegistry`.
- Produces:

```ts
type LiveNode = Node;  // from 'three/webgpu'
type LiveUniform = UniformNode<unknown>; // implementer picks the precise @types/three uniform type; no `any`
function createLiveFacade(): TslFacade<LiveNode>;
interface LiveBackend extends CompileBackend<LiveNode> { readonly uniforms: ReadonlyMap<PortKey, LiveUniform> }
function createLiveBackend(): LiveBackend;
interface MaterialBuild {
  readonly material: MeshStandardNodeMaterial | null;   // null when compile failed
  readonly uniforms: ReadonlyMap<PortKey, LiveUniform>;
  readonly errors: readonly CompileError[];
}
function createMaterial(graph: Graph, registry: NodeRegistry): MaterialBuild;
function applyInputValue(uniforms: ReadonlyMap<PortKey, LiveUniform>, ref: PortRef, value: PortValue): boolean; // false = no uniform or type mismatch → caller recompiles
```

Mapping:

| Slot | Material property |
|---|---|
| position | `positionNode` |
| baseColor | `colorNode` |
| emission | `emissiveNode` |
| metalness | `metalnessNode` |
| roughness | `roughnessNode` |
| normal | `normalNode` |
| opacity | `opacityNode` |

When the opacity slot is connected, set `transparent = true`.

Uniform values are `number`, `Vector2`, `Vector3` or `Vector4`. `applyInputValue` mutates them in place.

- [ ] **Step 1: Failing tests:**
  - `default graph builds a material with colorNode set and no positionNode`.
  - `uniform map has an entry per inline input reached`.
  - `applyInputValue updates value without rebuilding` (same material instance, uniform `.value` equals the new Vector3 components).
  - `applyInputValue returns false for unknown key`.
  - `throwing node returns material null and errors` (registry plus a fixture node whose build throws).
  - `connected opacity sets transparent`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. The facade maps one-to-one to `three/tsl`. `construct` dispatches to `float/vec2/vec3/vec4`; `swizzle` reads the property (`.x`, `.xy`, `.xyz`) through a typed helper.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(runtime): add live TSL backend and material builder`.

---

### Task 10: Editor app shell with the joyco design system

**Files:**
- Create: `apps/editor/{package.json,index.html,vite.config.ts,tsconfig.json,components.json,playwright.config.ts}`, `src/main.tsx`, `src/app/{app.tsx,app-shell.tsx,theme-provider.tsx,globals.css}`, `src/shared/ui/*`, `src/shared/theme/port-colors.ts`, `e2e/app-shell.spec.ts`.
- Modify: `.github/workflows/ci.yml` (add an e2e job: `pnpm exec playwright install --with-deps chromium && pnpm e2e`).

**Interfaces:**
- Produces:
  - `AppShell` props `{ canvas: ReactNode; previewPanel: ReactNode; headerActions: ReactNode }`.
  - `PORT_COLORS: Record<DataType, string>` and `PORT_LABELS: Record<DataType, '1'|'2'|'3'|'4'|'T'>`.
  - `useTheme(): { theme: 'dark' | 'light'; toggleTheme(): void }`.

Contents:
- **Vite:** `@vitejs/plugin-react`, `@tailwindcss/vite`, alias `@/` → `src/`.
- **globals.css:** the joyco file verbatim, with `--font-sans: 'Public Sans Variable'` and `--font-mono: 'Roboto Mono Variable'`.
- **shadcn:** `components.json` like joyco's (`style: radix-nova`, `baseColor: neutral`, `iconLibrary: lucide`, registry `@joyco`), with aliases `ui → @/shared/ui` and `utils → @/shared/lib/utils`. Add: button, kbd, tooltip, command, dialog, popover, separator, badge, context-menu, toggle-group, plus `cluster` from `@joyco` (fallback: copy `components/ui/cluster.tsx` from the joyco repo).
- **Theme:** class on `<html>`, default `dark`, persisted at `nudo-tsl:theme`.
- **Shell:**
  - Full-viewport canvas slot.
  - Floating header `Cluster bg="accent"` at `inset-x-4 top-4`:
    - Wordmark "NUDO" in a `bg-primary` block (mono, uppercase, tracking).
    - Filler.
    - `headerActions`.
    - Theme toggle (icon button with `aria-label`).
  - Collapsible right preview panel (`<section aria-label="Main preview">`) with a toggle button that has `aria-expanded`.

- [ ] **Step 1:** Run `get-ui-principle` and `get-ux-principle` (Better Design) for an app shell / tool UI. Note any rule that changes the shell.
- [ ] **Step 2: Failing e2e** `e2e/app-shell.spec.ts`:
  - `shell renders header and preview landmark`: `getByRole('banner')` and `getByRole('region', { name: 'Main preview' })` are visible.
  - `theme toggle works by keyboard`: Tab to the toggle, press Enter, `html` loses the `dark` class, and after a reload it persists.
  - `preview panel collapses with keyboard`: `aria-expanded` flips.
- [ ] **Step 3:** Run `pnpm --filter editor e2e`. Expected: FAIL.
- [ ] **Step 4:** Implement.
- [ ] **Step 5:** Run e2e, typecheck and lint. Expected: PASS.
- [ ] **Step 6:** Review: `get-review-rules`, `check-comprehension`, `inspect-spacing` on the rendered page, plus the `keyboard-accessibility` audit. Fix critical/serious findings and save a screenshot to `.context/phase-1/app-shell.png`.
- [ ] **Step 7:** Commit `feat(editor): add Vite app shell with joyco design system`.

---

### Task 11: Editor store, history and autosave

**Files:**
- Create: `apps/editor/src/store/{registry,editor-store,graph-slice,ui-slice,compile-slice,autosave}.ts`, `src/store/editor-store.test.ts`, `src/store/autosave.test.ts`. Vitest in the editor package uses `environment: 'jsdom'`.

**Interfaces:**
- Consumes: core ops, `createDefaultRegistry`, `parseGraph`, `serializeGraph`, fragment functions.
- Produces:

```ts
const registry: NodeRegistry;      // singleton from createDefaultRegistry()
interface GraphSlice {
  graph: Graph;
  addNode(type: NodeTypeId, position: XY): NodeId | null;
  removeNodes(ids: readonly NodeId[]): void;
  commitMove(positions: Readonly<Partial<Record<NodeId, XY>>>): void;
  setInputValue(ref: PortRef, value: PortValue): void;
  connect(from: PortRef, to: PortRef): ConnectionCheck;
  disconnect(edgeIds: readonly EdgeId[]): void;
  pasteFragment(fragment: GraphFragment, offset: XY): readonly NodeId[];
}
interface UiSlice {
  selectedNodeIds: readonly NodeId[];
  draftPositions: Readonly<Partial<Record<NodeId, XY>>>;  // live drag positions, not in history
  notice: { kind: 'info' | 'error'; message: string } | null;
  setSelection(ids: readonly NodeId[]): void; setDraftPositions(p: UiSlice['draftPositions']): void;
  showNotice(n: NonNullable<UiSlice['notice']>): void; dismissNotice(): void;
}
interface CompileSlice { errorsByNode: Readonly<Partial<Record<NodeId, string>>>; setCompileErrors(errors: readonly CompileError[]): void }
const useEditorStore: UseBoundStore<…>;   // zustand + temporal(zundo) with partialize → { graph }
function undo(): void; function redo(): void;
function loadAutosave(storage: Storage): { graph: Graph; notice: UiSlice['notice'] };
function startAutosave(storage: Storage, delayMs?: number /* 500 */): () => void;  // returns unsubscribe
```

Notes:
- Failed core operations leave the state untouched and do not create a history entry. Configure zundo's `equality` with reference equality on `graph`.
- `commitMove` writes positions to the graph and clears `draftPositions`, which produces a single history entry.

- [ ] **Step 1: Failing tests:**
  - `addNode then undo restores previous graph; redo reapplies`.
  - `removeNodes of a connected node then undo restores node and edges`.
  - `drag: setDraftPositions creates no history; commitMove creates exactly one entry`.
  - `rejected connect leaves history unchanged`.
  - `removeNodes(['master']) is a no-op with notice`.
  - `loadAutosave returns fresh graph when storage empty`.
  - `loadAutosave with corrupt JSON returns fresh graph, copies raw to nudo-tsl:autosave:corrupt, and returns error notice` (Review Focus 1), plus the same for an unknown node type and a future `schemaVersion`.
  - `autosave writes serialized graph after 500ms debounce` (fake timers).
- [ ] **Step 2:** Run `pnpm --filter editor test`. Expected: FAIL.
- [ ] **Step 3:** Implement. Ids come from `nanoid` through `asNodeId` / `asEdgeId`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(editor): add zustand store with undo history and autosave`.

---

### Task 12: Canvas, node view, typed ports and inline fields

**Files:**
- Create: `apps/editor/src/features/canvas/{graph-canvas-container.tsx,graph-canvas.tsx,to-flow.ts,node-view.tsx,port-handle.tsx,typed-edge.tsx,inline-field.tsx,parse-number-input.ts}`.
- Test: `to-flow.test.ts`, `parse-number-input.test.ts`, `e2e/canvas.spec.ts`.

**Interfaces:**
- Consumes: store (Task 11), `resolvePortTypes`, `checkConnection`, `PORT_COLORS` / `PORT_LABELS`.
- Produces:

```ts
function toFlow(graph: Graph, registry: NodeRegistry, types: ResolvedTypes, draft: UiSlice['draftPositions'], errors: CompileSlice['errorsByNode'], selected: readonly NodeId[]): { nodes: FlowNode[]; edges: FlowEdge[] };
type FlowNodeData = { definition: AnyNodeDefinition; node: GraphNode; inputTypes: Record<string, DataType>; outputTypes: Record<string, DataType>; connectedInputs: ReadonlySet<string>; error: string | undefined };
function parseNumberInput(raw: string, previous: number): number;  // non-finite or empty → previous
```

Behavior:
- **Container vs view:** `graph-canvas-container` reads the store and memoizes `toFlow` with selectors; `graph-canvas` is presentational.
- **React Flow handlers:**
  - `onNodesChange` position events while dragging → `setDraftPositions`; drag stop → `commitMove`.
  - `onConnect` → `connect`.
  - `isValidConnection` → `checkConnection(...).ok`.
  - Edge removal → `disconnect`.
  - Selection → `setSelection`.
- **Node view:**
  - Header with the label (tooltip = `description`).
  - Inputs on the left, outputs on the right.
  - Each port shows a colored dot plus a mono type label.
  - Unconnected inputs render an inline field by type: number (drag to scrub plus keyboard ArrowUp/Down ±0.1, Shift ±1), vec (one number per component), color (native `<input type="color">` mapped to linear vec3).
  - Master node has no delete affordance and a "Master Stack" header with Vertex / Fragment groups.
  - An error shows a `destructive` border plus the message text inside the node.
- **Motion:** node appear and edge connect use subtle transitions (≤150 ms, opacity/transform only), disabled under `prefers-reduced-motion`.
- **Typed edge:** the stroke uses the source type color. Edges with a conversion get a small midpoint marker whose `aria-label`/title names the conversion.

- [ ] **Step 1: Failing unit tests:**
  - `toFlow applies draft positions over graph positions`.
  - `toFlow marks connected inputs and errors`.
  - `parseNumberInput` table: `''→prev`, `'abc'→prev`, `'1e999'→prev`, `'-'→prev`, `'0.25'→0.25`, `'-3'→-3` (Review Focus 4).
- [ ] **Step 2: Failing e2e** `canvas.spec.ts` (seed the graph through localStorage `nudo-tsl:autosave` with a Color node connected to baseColor):
  - `renders master stack and color node with typed ports` (text `3` next to the ports).
  - `dragging a node then undo returns it` (mouse drag, `Control+Z`).
  - `invalid number entry reverts on blur`.
- [ ] **Step 3:** Run. Expected: FAIL.
- [ ] **Step 4:** Run `get-ui-principle` for node/graph density, then implement.
- [ ] **Step 5:** Run unit + e2e. Expected: PASS.
- [ ] **Step 6:** Better Design review (`get-review-rules`, `check-comprehension`, `inspect-spacing`). Fix critical/serious findings and screenshot `.context/phase-1/canvas.png`.
- [ ] **Step 7:** Commit `feat(editor): add node canvas with typed ports, edges and inline fields`.

---

### Task 13: Add-node menu

**Files:**
- Create: `apps/editor/src/features/add-node-menu/{add-node-menu.tsx,search-nodes.ts}`.
- Test: `search-nodes.test.ts`, `e2e/add-node-menu.spec.ts`.

**Interfaces:**
- Produces:
  - `searchNodes(definitions: readonly AnyNodeDefinition[], query: string): readonly { category: NodeCategory; items: readonly AnyNodeDefinition[] }[]`. Matching is case-insensitive over label + keywords + type id. The master is excluded. Groups follow `NodeCategory` order.
  - `AddNodeMenu` props `{ open: boolean; onOpenChange(open: boolean): void; onPick(type: NodeTypeId): void }`.

Behavior:
- Opens from:
  - Space when focus is on the canvas pane or a node, but not inside a text field, button or menu.
  - Right-click on the pane, which places the node at the cursor.
  - A header button "Add node" with `Kbd` Space.
- cmdk dialog with grouped results.
- Placement: at the cursor for right-click; otherwise next to the focused node (+260 px x), else the viewport center.
- The new node receives focus.
- Escape closes the menu and returns focus to the opener.

- [ ] **Step 1: Failing tests:**
  - `searchNodes('mix')` returns Lerp under interpolation.
  - `searchNodes('')` returns all categories without master.
  - e2e `space opens menu, typing "fres" + Enter adds Fresnel and focuses it`.
  - e2e `escape closes and restores focus to the header button`.
  - e2e `right-click on pane opens menu`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Better Design review plus keyboard-accessibility audit. Fix critical/serious findings.
- [ ] **Step 6:** Commit `feat(editor): add searchable add-node menu`.

---

### Task 14: Keyboard model, keyboard connect, shortcuts and clipboard

**Files:**
- Create: `apps/editor/src/features/shortcuts/{use-global-shortcuts.ts,shortcuts-dialog.tsx,clipboard.ts}`, `src/features/canvas/keyboard-connect-list.tsx`.
- Modify: `node-view.tsx`, `port-handle.tsx`, `graph-canvas.tsx`.
- Test: `e2e/keyboard.spec.ts`.

**Interfaces:**
- Consumes: store, `extractFragment` / `serializeFragment` / `parseFragment`, `checkConnection`.
- Produces:
  - `useGlobalShortcuts(): void` (mounted once in `App`).
  - `copySelection(): Promise<void>` and `pasteFromClipboard(): Promise<void>` in `clipboard.ts`.

Behavior (spec §5):
- **Nodes:**
  - Nodes are focusable in DOM order (`tabindex=0`) with the ring.
  - Arrows move 10 px, Shift+Arrows 50 px. Each keydown burst is committed as one `commitMove` on keyup.
  - Delete/Backspace removes the node (the master shows a notice instead).
  - Enter focuses the first inline field; Escape returns to the node.
- **Ports:** ports are buttons inside the node. Enter on a port opens `KeyboardConnectList`:
  - A popover listbox with search, listing every compatible port in the graph ("NodeLabel › PortLabel · type"). Compatibility is computed with `checkConnection`.
  - Enter connects. Escape closes and returns focus to the port.
  - Delete on a connected port disconnects it.
- **Global shortcuts:**
  - Ctrl/⌘+Z undo; Ctrl/⌘+Shift+Z and Ctrl+Y redo.
  - Ctrl/⌘+C / V copy and paste.
  - Ctrl/⌘+A select all.
  - F fits the view.
  - `?` opens the shortcuts dialog (a table of every shortcut).
  - Shortcuts are ignored while focus is in a text input.
- **Paste:** a fragment is placed at a +40 px offset and the pasted nodes become selected. Invalid clipboard content shows the notice "Clipboard doesn't contain nudo-tsl nodes" and changes nothing.

- [ ] **Step 1: Failing e2e** (`context.grantPermissions(['clipboard-read','clipboard-write'])`):
  - `connect Time to Sin using only the keyboard` (Tab to the Time output port, Enter, type "sin", Enter → an edge exists).
  - `arrow keys move focused node and a single undo restores it`.
  - `delete on master shows notice and keeps it`.
  - `copy/paste duplicates selected nodes with internal edge`.
  - `pasting prose shows notice and leaves graph unchanged` (Review Focus 2).
  - `? opens shortcuts dialog; Escape closes and restores focus`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Run the `keyboard-accessibility` skill audit with Playwright on the running app. Fix every finding.
- [ ] **Step 6:** Commit `feat(editor): full keyboard operation, shortcuts and clipboard fragments`.

---

### Task 15: Main Preview with live compilation

**Files:**
- Create: `apps/editor/src/features/main-preview/{create-renderer.ts,compile-scheduler.ts,main-preview.tsx,preview-mesh.tsx}`.
- Test: `compile-scheduler.test.ts`, `e2e/preview.spec.ts`.

**Interfaces:**
- Consumes: `createMaterial`, `applyInputValue`, `topologyKey`, store.
- Produces:

```ts
interface CompileSchedulerOptions { delayMs: number /* 150 */; build(graph: Graph): MaterialBuild; onBuilt(build: MaterialBuild): void }
interface CompileScheduler { update(graph: Graph): void; dispose(): void }
function createCompileScheduler(options: CompileSchedulerOptions): CompileScheduler;
type RendererResult = { ok: true; renderer: WebGPURenderer; backend: 'webgpu' | 'webgl2' } | { ok: false; message: string };
function createRenderer(canvas: HTMLCanvasElement): Promise<RendererResult>;
```

Scheduler rules:
- Same `topologyKey` → apply the changed inputValues immediately with `applyInputValue`. If any call returns false, schedule a rebuild.
- Different key → debounce the rebuild by `delayMs`.
- `onBuilt` receives every build. The component keeps the last material whose `material !== null`, and always forwards errors to `setCompileErrors`.

Preview:
- R3F `<Canvas>` with `gl` set to the async factory around `createRenderer` (`WebGPURenderer` from `three/webgpu`; it falls back to WebGL2 by itself).
- If the renderer fails, render the text "Preview unavailable: this browser supports neither WebGPU nor WebGL2." instead of the canvas.
- Mesh picker: a `ToggleGroup` (radio semantics) with Sphere, Cube, Plane, Torus, plus a "Load GLB" file button (GLTFLoader; apply the material to every mesh; revoke the object URL).
- drei `OrbitControls` and a "Reset view" button.
- Hemisphere light plus a directional light.
- Background color input, defaulting to the `--background` token.
- A small mono badge shows the backend (`WebGPU` / `WebGL2`).

- [ ] **Step 1: Failing unit tests** (fake timers, stub `build`):
  - `value-only change applies uniforms without rebuild`.
  - `topology change rebuilds once after 150ms even with rapid updates`.
  - `failed applyInputValue triggers rebuild`.
  - `dispose cancels pending rebuild`.
- [ ] **Step 2: Failing e2e:**
  - `preview canvas renders and shows backend badge`.
  - `changing color value does not log compile` (expose `window.__nudoCompileCount` in dev only and assert it is unchanged).
  - `switching mesh by keyboard` (arrow keys in the radio group).
  - `no WebGPU/WebGL2 shows fallback message while canvas editing still works` (init script deletes `navigator.gpu` and stubs `HTMLCanvasElement.prototype.getContext` to return null for webgl2; then add a node with Space and verify it appears) — Review Focus 5.
- [ ] **Step 3:** Run. Expected: FAIL.
- [ ] **Step 4:** Implement.
- [ ] **Step 5:** Run. Expected: PASS.
- [ ] **Step 6:** Better Design review (`get-review-rules`, `check-comprehension`, `inspect-spacing`). Fix and screenshot `.context/phase-1/preview.png`.
- [ ] **Step 7:** Commit `feat(editor): add live main preview with debounced compilation`.

---

### Task 16: End-to-end flow, docs and deploy config

**Files:**
- Create: `e2e/golden-path.spec.ts`, `vercel.json` (build `pnpm --filter editor build`, output `apps/editor/dist`, SPA rewrite to `/index.html`).
- Modify: `README.md` (what it is, dev commands, package map, keyboard shortcuts table, MIT).

- [ ] **Step 1: Failing e2e** `golden path: Time → Sin → Lerp(t) between two Colors → Base Color, plus Fresnel → Emission, compiles without node errors and survives reload`. The flow uses keyboard connect, reload, and asserts the same edge count and no error borders.
- [ ] **Step 2:** Run. Expected: FAIL only if something is missing; fix the gaps it reveals.
- [ ] **Step 3:** Write the README and `vercel.json`.
- [ ] **Step 4:** Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. Expected: all green.
- [ ] **Step 5:** Commit `docs: add README, deploy config and golden-path e2e`.
