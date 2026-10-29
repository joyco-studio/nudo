# nudo-tsl Catalog Phase, Batch 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first batch of the catalog phase:
- a real-renderer compile check;
- seven new nodes: Color Ramp, Blend, Voronoi 3D, Triplanar, Main Light, Posterize and Modulo;
- upgrades to Voronoi (cell outputs, distance metric) and Noise (FBM octaves);
- a Physical lighting mode on the Master.

**Architecture:**
- Nodes stay facade-only (`build<E>` on `TslFacade<E>`), so preview and export keep parity by construction.
- The facade grows only where an operation cannot be composed from existing methods: Voronoi distance metric and cell, cell noise, Main Light, and the `normalLocal` builtin.
- Color Ramp stops are ordinary inputs (uniforms), plus a hidden `count` param edited by a dedicated widget.
- Physical adds slots and four feature switches to the Master. `masterMaterialAssignments` decides what each lighting mode assigns.

**Tech Stack:** unchanged. TypeScript strict, three `0.186.1` (`three/webgpu`, `three/tsl`), React 19 + Vite, Zustand, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-28-nudo-tsl-node-catalog-design.md` (§3 "Tanda 1", §4.1–§4.5, §5, §6). The main spec `2026-10-26-nudo-tsl-design.md` still binds.

## Global Constraints

Everything in the phase-1 and phase-2 plans' Global Constraints still applies:
- strict TS, no `any`, no `as` beyond the existing sanctioned sites;
- kebab-case files and package boundaries;
- Conventional Commits **without** `Co-Authored-By` lines;
- the Better Design steps for UI;
- keyboard-only operation.

Additions from the spec:

- **No schema change:** `CURRENT_SCHEMA_VERSION` stays `2`. Every addition is additive, because a missing value means the default. If a task seems to need a migration, stop and ask.
- **Old graphs must look the same:**
  - Every existing `.graph.json` example and the codegen snapshots in `packages/codegen/src/__snapshots__` must stay byte-identical.
  - A Voronoi or Noise node saved before this batch must compile to the same expression as today.
- **Uniform edits must not recompile:** dragging a Color Ramp stop, or any Physical value, only writes a uniform. Changing `count`, `interpolation`, `octaves` or a `use*` switch may recompile.
- **Node quality bar:** every node and port has a description, and every node with a generic port has a one-line `formula` of at most 28 characters. Every node has a `NODES_ES` entry covering all ports, params and options (`i18n.test.ts`, `node-explanations.test.ts`).
- **Facade additions** go to the interface (core), `live-facade.ts`, `code-facade.ts`, `recording-facade.ts`, `FACADE_OPERATIONS` (`live-facade.test.ts`), and `TSL_IMPORT_NAMES` for every new `three/tsl` name printed.
- **New helper functions** touch the runtime file, the `HelperName` union, `TSL_HELPERS`, `HELPER_ORDER`, `RUNTIME_SOURCES` in `parity.test.ts`, and `HELPER_INTERNAL_NAMES` when needed.
- **Registration:** batch-1 nodes go in a new array `PHASE_3_CATALOG_C` in `packages/nodes/src/create-default-registry.ts`, pinned by `packages/nodes/src/catalog-c.test.ts`. Upgraded nodes stay in their current array.
- **UI copy:** EN and ES for every string. Code and identifiers stay in English.

## Review Focus

1. **Two Color Ramp stops at the same position:**
   - Expected: the ramp jumps cleanly, with no NaN and no black pixels.
   - Pinned in Task 8 by asserting that the span divides by `max(p_i − p_{i−1}, 0.00001)`.
2. **A saved Voronoi or Noise from before this batch, reopened:**
   - Expected: it compiles to exactly today's expression.
   - Pinned in Tasks 4 and 5 by recording-facade tests on nodes with no new params or inputs stored. The Pond `.graph.json` and the codegen snapshots stay unchanged.
3. **Switching the Master from Physical back to Standard with physical inputs wired:**
   - Expected: the wires stay, nothing errors, and the physical slots are not assigned.
   - Pinned in Task 10 by an assignments test.
4. **Lowering the Color Ramp count while removed stops are wired:**
   - Expected: those wires go away in the same undo step, and one undo brings both back.
   - Pinned in Task 9 by an operations test and an e2e undo step.
5. **A graph with Main Light whose Blackboard has a property named `lights`:**
   - Expected: the export still runs, with no duplicate identifier.
   - Pinned in Task 7 by a codegen test.

---

### Task 1: Real-renderer compile check

**Files:**
- Create: `apps/editor/e2e/compile-check.spec.ts`
- Create: `apps/editor/e2e/support/catalog-document.ts`
- Modify: `packages/runtime/src/create-material.test.ts:685-720` (`new catalog nodes`)

**Interfaces:**
- Produces:
  - `catalogDocument(lighting: string): string`, a schema-2 autosave document of `createCatalogGraph(createDefaultRegistry())` (from `packages/codegen/src/fixtures/catalog-graph.ts`) with the master `lighting` param set. Serialize it with `serializeGraph`.
  - The spec reads the lighting options from the master definition, so Task 10's `physical` is covered without edits.

- [ ] **Step 1: Write the e2e spec**

`compile-check.spec.ts` has three tests:
- `every example compiles in a real renderer`: for each example title in the templates browser, open it with `pickExampleByKeyboard`, wait for `settledCompileCount`, and expect the Main preview region to contain neither the `preview.rejected` text ("did not compile") nor `preview.compileFailed`.
- `the catalog graph compiles under every lighting mode`: for each `lighting` option of `master/stack`, seed `catalogDocument(option)` with the autosave key, reload, wait for the compile, and make the same assertion.
- `a known-bad graph is caught` (negative control): seed Normal From Height wired into both `master.position` and `master.baseColor`, then expect the rejection notice to be visible and to contain `dFdx`.

- [ ] **Step 2: Run it**

Run: `pnpm --filter @nudo-tsl/editor exec playwright test e2e/compile-check.spec.ts`
Expected: the first two tests PASS. The negative control PASSES (the check sees the failure). If the control does not see `dFdx` under SwiftShader, assert only that the notice is visible.

- [ ] **Step 3: Make `new catalog nodes` iterate the registry**

Replace the hand-written `it.each` list with every registered type except `master/stack`, `utility/comment` and `utility/reroute`. Wire each node's first vector output into `baseColor` (Main Light and Triplanar have no special case: their inputs fall back to builtins), and expect `createMaterial(...).errors` to equal `[]`.

- [ ] **Step 4: Run it**

Run: `pnpm --filter @nudo-tsl/runtime exec vitest run src/create-material.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "test(editor): compile every example and the catalog graph in a real renderer"`

---

### Task 2: Posterize and Modulo, and the catalog C array

**Files:**
- Create: `packages/nodes/src/math/posterize-node.ts`, `packages/nodes/src/math/modulo-node.ts`, `packages/nodes/src/catalog-c.test.ts`
- Modify: `packages/nodes/src/create-default-registry.ts`, `packages/nodes/src/index.ts`, `apps/editor/src/i18n/nodes.es.ts`

**Interfaces:**
- Produces:
  - `export const PHASE_3_CATALOG_C: readonly AnyNodeDefinition[]`, registered after `PHASE_2_CATALOG_B`.
  - `posterizeNode` and `moduloNode`.
  - `catalog-c.test.ts` with `CATALOG_C_TYPES` (exact order) and its `buildWith` helper. Later tasks append to both.

- [ ] **Step 1: Write the failing tests** in `catalog-c.test.ts`

```ts
const CATALOG_C_TYPES = ['math/posterize', 'math/modulo']

it('catalog-c types registered', () => {
  expect(PHASE_3_CATALOG_C.map((d) => d.type)).toEqual(CATALOG_C_TYPES)
})

it('posterize floors In × Steps back to steps', () => {
  expect(buildWith(posterizeNode, { in: 'x', steps: 's' }).out).toBe('div(floor(mul(x,s)),s)')
})

it('modulo is floored, the same on WebGPU and WebGL', () => {
  // WGSL % truncates and GLSL mod floors: A − B × floor(A / B) agrees on both.
  expect(buildWith(moduloNode, { a: 'a', b: 'b' }).out).toBe('sub(a,mul(b,floor(div(a,b))))')
})
```

- [ ] **Step 2: Run them**

Run: `pnpm --filter @nudo-tsl/nodes exec vitest run src/catalog-c.test.ts`
Expected: FAIL (`PHASE_3_CATALOG_C` is not exported).

- [ ] **Step 3: Implement both nodes**
- **`math/posterize`:**
  - Inputs: `in` (generic T, default `float(0)`) and `steps` (float, default `4`).
  - Output: `out` (T).
  - Formula: `floor(In × Steps) / Steps`.
- **`math/modulo`:**
  - Inputs: `a` (T) and `b` (T, default `float(1)`).
  - Output: `out`.
  - Formula: `A mod B`.
  - It does **not** use three's `mod`, which prints WGSL `%`.
- Add both to `PHASE_3_CATALOG_C`, export them from `index.ts`, and add their `NODES_ES` entries ("Posterizar", "Módulo").

- [ ] **Step 4: Run them**

Run: `pnpm --filter @nudo-tsl/nodes test && pnpm --filter @nudo-tsl/editor exec vitest run src/i18n && pnpm --filter @nudo-tsl/codegen test`
Expected: PASS. The catalog fixture picks the nodes up and parity holds.

- [ ] **Step 5: Commit**

`git commit -m "feat(nodes): add posterize and floored modulo nodes"`

---

### Task 3: Blend

**Files:**
- Create: `packages/nodes/src/color/blend-node.ts`
- Modify: `create-default-registry.ts`, `index.ts`, `catalog-c.test.ts`, `nodes.es.ts`

**Interfaces:**
- Produces: `blendNode`, type `color/blend`, category `color`.
  - Inputs: `base` (T, default `vec3(0.5,0.5,0.5)`, widget color), `blend` (T, default `vec3(1,1,1)`, widget color) and `opacity` (float, default `1`).
  - Output: `out` (T).
  - Param `mode` (enum, default `multiply`): `multiply`, `screen`, `overlay`, `soft-light`, `linear-light`, `color-burn`, `color-dodge`, `darken`, `lighten`, `difference`, `add` and `subtract`.
  - Formula: `mix(Base, mode, Opacity)`.

- [ ] **Step 1: Write the failing tests**

One `it.each` over all modes, each asserting the recorded `out`. With `a` = base and `b` = blend, the mode expressions are:

| mode | expression before the opacity mix |
|---|---|
| multiply | `a·b` |
| screen | `1 − (1−a)(1−b)` |
| overlay | `mix(2ab, 1 − 2(1−a)(1−b), step(0.5, a))` |
| soft-light | `(1 − 2b)·a² + 2ab` (Pegtop) |
| linear-light | `a + 2b − 1` |
| color-burn | `max(1 − (1−a) / max(b, 0.00001), 0)` |
| color-dodge | `min(a / max(1−b, 0.00001), 1)` |
| darken / lighten | `min(a,b)` / `max(a,b)` |
| difference | `abs(a − b)` |
| add / subtract | `a + b` / `a − b` |

Every mode's `out` is `mix(base, <mode>, opacity)`. Constants are built with `tsl.construct('float', [n])`. An unknown mode falls back to multiply.

- [ ] **Step 2: Run them**

Run: `pnpm --filter @nudo-tsl/nodes exec vitest run src/catalog-c.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** `blend-node.ts` from the table. Compose everything from existing facade methods: overlay uses `step`, so it works component by component on vec3 with no per-channel select. Add the `NODES_ES` entry ("Mezcla", with Spanish mode names: Multiplicar, Trama, Superponer, Luz suave, Luz lineal, Subexponer color, Sobreexponer color, Oscurecer, Aclarar, Diferencia, Sumar, Restar).

- [ ] **Step 4: Run** the nodes, i18n and codegen suites (same command as Task 2). Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(nodes): add a blend node with twelve blend modes"`

---

### Task 4: Voronoi cell outputs, distance metric and Voronoi 3D

**Files:**
- Create:
  - `packages/runtime/src/voronoi-cell.ts`: the TSL `Fn` helpers `voronoiCell2` and `voronoiCell3`.
  - `packages/nodes/src/effects/voronoi-3d-node.ts`.
- Modify:
  - Core: `packages/core/src/types/tsl-facade.ts`.
  - Runtime: `live-facade.ts` and `live-facade.test.ts`.
  - Codegen: `code-facade.ts`, `code-expression.ts` (`HelperName`), `tsl-helpers.ts`, `reserved-names.ts` and `parity.test.ts` (`RUNTIME_SOURCES`).
  - Nodes: `recording-facade.ts`, `packages/nodes/src/effects/voronoi-node.ts`, `catalog-b.test.ts`, `catalog-c.test.ts` and the registry.
  - Editor: `nodes.es.ts` and `apps/editor/src/features/node-previews/preview-graph.ts`.

**Interfaces:**
- Produces, in core:
  - `export type VoronoiMetric = 'euclidean' | 'manhattan' | 'chebyshev'`
  - Changed signature: `voronoi(p: E, jitter: E, metric: VoronoiMetric): E`, a vec2 holding F1 and F2.
    - `euclidean` must print exactly `mx_worley_noise_vec2(p, jitter)`, as today.
    - The other metrics print `mx_worley_noise_vec3(p, jitter, <int>).xy`. Take the MaterialX metric ints from `mx_worley_distance` in `three/src/nodes/materialx/lib/mx_noise.js` (or `MaterialXNoise.js`).
  - `voronoiCell(dimensions: 2 | 3, p: E, jitter: E, metric: VoronoiMetric): E`: the nearest feature point, a vec2 or vec3.
  - `cellNoise(p: E): E`: a float from 0 to 1, printed as `mx_cell_noise_float`.
- Nodes:
  - `effects/voronoi` keeps input `uv` as a concrete vec2 and its outputs `f1`, `f2` and `edge`. It adds the outputs `cell` (vec2) and `random` (float) and the param `distance` (enum: euclidean, manhattan, chebyshev; default euclidean).
  - `voronoi3dNode` (`effects/voronoi-3d`) has the inputs `position` (vec3, `fallback: 'positionLocal'`), `scale` (float, default 5) and `jitter` (float, default 1). Its outputs are `f1`, `f2`, `edge`, `cell` (vec3) and `random`, with the same `distance` param.

- [ ] **Step 1: Write the failing tests**
- `catalog-b.test.ts`: a Voronoi with no `distance` param stored records `f1` as `swizzle(voronoi(mul(uv,scale),jitter,euclidean),x)`. This is today's expression plus the metric argument.
- `catalog-b.test.ts`: `random` is `cellNoise(floor(voronoiCell(2,mul(uv,scale),jitter,euclidean)))`.
- `catalog-c.test.ts`: `effects/voronoi-3d` records `voronoiCell(3,…)`, and its `cell` output type is vec3.
- `codegen.test.ts`: a euclidean Voronoi prints `mx_worley_noise_vec2(`, and a manhattan one prints `mx_worley_noise_vec3(`.
- `live-facade.test.ts`: `FACADE_OPERATIONS` gains `voronoiCell` (2 and 3) and `cellNoise`, and each returns a `Node`.

- [ ] **Step 2: Run them**

Run: `pnpm -r test`
Expected: FAIL on the new cases only.

- [ ] **Step 3: Implement**
- `voronoiCell2` and `voronoiCell3` port MaterialX's worley cell search (the same hash and jitter as `mx_worley_noise_*`). The point they return is the one F1 measures, so `cell` and `random` agree with the pattern. Each takes `(p, jitter, metricInt)`.
- Keep the codegen helper sources token-identical to the runtime file.
- Reserve the helpers' internal names.
- Add `effects/voronoi-3d` to `SURFACE_NODE_TYPES`.
- Add the `NODES_ES` entries for the new outputs, the `distance` param and Voronoi 3D.

- [ ] **Step 4: Verify that nothing old moved**

Run: `pnpm -r test && git diff --stat -- apps/editor/src/examples packages/codegen/src/__snapshots__`
Expected: PASS, and no diff in example graphs or snapshots.

- [ ] **Step 5: Commit**

`git commit -m "feat(nodes): voronoi cell and random outputs, distance metrics and a 3D voronoi"`

---

### Task 5: Number param field and Noise octaves

**Files:**
- Modify:
  - Core: `packages/core/src/types/param-definition.ts` (number param gains `readonly step?: number`) and `packages/core/src/validation/param-validation.ts` (a number param must lie within `min`/`max`).
  - Editor: `apps/editor/src/features/canvas/param-field.tsx` and `apps/editor/src/features/canvas/param-kinds.ts`.
  - Nodes: `packages/nodes/src/effects/noise-node.ts` and `catalog-b.test.ts`.
  - i18n: `nodes.es.ts`.
- Test: `apps/editor/src/features/canvas/param-field.test.tsx` (create).

**Interfaces:**
- Produces:
  - `BodyParam = EnumParam | BooleanParam | NumberParam`. A non-hidden, non-universal number param renders as a numeric field (mono font, `min`/`max`/`step` from the definition) that commits on Enter or blur through `setParam`. ArrowUp and ArrowDown step by `step`.
  - Noise gains the param `octaves` (number, `min` 1, `max` 8, `step` 1, default 1) and the inputs `roughness` (float 0.5) and `lacunarity` (float 2).

- [ ] **Step 1: Write the failing tests**
- `catalog-b.test.ts`:
  - With octaves 1 (or absent), `out` is exactly `noise(simplex,mul(p,scale))`.
  - With octaves 3, `out` is the amplitude-weighted sum over frequencies `scale·lacunarity^i` (with amplitudes `roughness^i`), divided by `1 + roughness + roughness²`. Assert the recorded string.
  - A non-integer stored octaves value is rounded, and one out of range is clamped to 1…8.
- `param-field.test.tsx`: the field renders for a number param, and ArrowUp moves 1 → 2 and calls `setParam` with 2.
- `param-validation`: 9 is rejected for a param with `max` 8.

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement**
- The noise build unrolls the octaves in JS. Octave `i ≥ 1` samples `p · scale · pow(lacunarity, i)` with amplitude `pow(roughness, i)`.
- Normalize by the summed amplitudes, so the range stays −1…1, as Blender does.
- With 1 octave, return today's expression unchanged.

- [ ] **Step 4: Run** `pnpm -r test` and the keyboard e2e: `pnpm --filter @nudo-tsl/editor exec playwright test e2e/node-params.spec.ts`. Expected: PASS. Then check the Pond snapshot: no diff.

- [ ] **Step 5: Commit**

`git commit -m "feat(nodes): fractal noise octaves and a number param field"`

---

### Task 6: Triplanar

**Files:**
- Create: `packages/nodes/src/texture/triplanar-node.ts`
- Modify: `tsl-facade.ts` (`BuiltinName` gains `'normalLocal'`), `live-facade.ts` (`BUILTINS.normalLocal: () => normalLocal`), the codegen builtin map, `recording-facade.ts`, the registry, `catalog-c.test.ts`, `nodes.es.ts` and `preview-graph.ts` (`SURFACE_NODE_TYPES`).

**Interfaces:**
- Produces `triplanarNode`, type `texture/triplanar`.
  - Inputs:
    - `texture` (texture, default `texture(null)`)
    - `position` (vec3, `fallback: 'positionLocal'`)
    - `normal` (vec3, `fallback: 'normalLocal'`)
    - `scale` (float, 1)
    - `sharpness` (float, 1)
  - Outputs: `rgba`, `rgb` and `a`, like Sample Texture 2D.

- [ ] **Step 1: Write the failing test**

The recorded `rgba` is the sum of three samples:
- one at `construct(vec2,[p.y,p.z])·scale` weighted by `w.x`,
- one at `zx` weighted by `w.y`,
- one at `xy` weighted by `w.z`.

Here `w = pow(abs(normal), sharpness) / dot(pow(abs(normal), sharpness), vec3(1,1,1))`. Every sample uses `textureSample(tex, uv, null)`.

- [ ] **Step 2: Run it.** Expected: FAIL.

- [ ] **Step 3: Implement** with the existing facade methods plus `builtin('normalLocal')`. Do not use three's `triplanarTexture`, because it has no sharpness and prints a different module.

- [ ] **Step 4: Run** `pnpm -r test`. Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(nodes): add a triplanar texture node"`

---

### Task 7: Main Light

**Files:**
- Create:
  - `packages/core/src/scene/main-light.ts`
  - `packages/runtime/src/main-light.ts`
  - `packages/nodes/src/input/main-light-node.ts`
- Modify:
  - Core: `tsl-facade.ts` and the core `index.ts`.
  - Runtime: `live-facade.ts` and `live-facade.test.ts`.
  - Codegen: `code-facade.ts`, `code-backend.ts`, `generate-module.ts`, `print-module.ts` and `reserved-names.ts` (`lights`).
  - Nodes: `recording-facade.ts`, the registry and `catalog-c.test.ts`.
  - Editor: `nodes.es.ts`, `preview-graph.ts` and `apps/editor/src/features/main-preview/preview-scene.tsx`.

**Interfaces:**
- **Core:**
  - `export type MainLightComponent = 'direction' | 'color'`
  - Facade: `mainLight(component: MainLightComponent): E` (vec3).
  - `export const MAIN_LIGHT_DEFAULTS: { readonly direction: readonly [number, number, number]; readonly color: readonly [number, number, number] }`, set to `direction: [0.424264, 0.565685, 0.707107]` (the preview key light `[3,4,5]` normalized) and `color: [2.5, 2.5, 2.5]` (white × `KEY_LIGHT_INTENSITY`).
- **Runtime:** module-level shared uniforms `mainLightDirection` and `mainLightColor` (`uniform(new Vector3(...))` with the defaults). The live facade returns them.
- **Codegen:**
  - `mainLight(c)` prints `lights.mainLightDirection` or `lights.mainLightColor` and records the component.
  - `ModulePlan` gains `readonly lights: readonly MainLightComponent[]`. `printModule` emits `export const lights = { mainLightDirection: uniform(vec3(...)), mainLightColor: uniform(vec3(...)) }` with this comment: `// Main Light: keep in step with your scene's key DirectionalLight, e.g. lights.mainLightDirection.value.copy(light.position).normalize(); lights.mainLightColor.value.setFromColor(light.color).multiplyScalar(light.intensity)`.
  - `lights` becomes a reserved name.
- **Node `input/main-light`:**
  - Input: `normal` (vec3, `fallback: 'normalWorld'`, description noting world space).
  - Outputs: `direction` (vec3), `color` (vec3), `lambert` = `max(dot(normalize(n), dir), 0)` and `halfLambert` = `dot(normalize(n), dir)·0.5 + 0.5`.

- [ ] **Step 1: Write the failing tests**
- `catalog-c.test.ts` checks the recorded `lambert` and `halfLambert`.
- `codegen.test.ts`:
  - The module contains `export const lights` and `lights.mainLightDirection`.
  - A graph with a Blackboard property named `lights` plus a Main Light still generates code, imports cleanly in the parity harness and has no duplicate identifier.
- `apps/editor/src/features/main-preview/preview-scene.test.ts` (create): `KEY_LIGHT_POSITION` normalized equals `MAIN_LIGHT_DEFAULTS.direction`, and `KEY_LIGHT_INTENSITY` equals `color[0]`. Export the two constants for this.

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement**, and add `input/main-light` to `SURFACE_NODE_TYPES`.

- [ ] **Step 4: Run** `pnpm -r test`. Expected: PASS. Untouched snapshots do not change, because `lights` prints only when used.

- [ ] **Step 5: Commit**

`git commit -m "feat(nodes): main light node with shared light uniforms in preview and export"`

---

### Task 8: Color Ramp node

**Files:**
- Create: `packages/nodes/src/color/color-ramp-node.ts`
- Modify:
  - Core: `packages/core/src/types/node-definition.ts` (`InputDefinition` gains `readonly hiddenWhen?: (params: Readonly<Record<string, ParamValue>>) => boolean`).
  - Nodes: the registry, `catalog-c.test.ts`, `node-explanations.test.ts` (if it walks inputs) and `nodes.es.ts`.

**Interfaces:**
- Produces `colorRampNode`, type `color/color-ramp`.
  - Input `in` (float, 0.5).
  - Stop inputs for N = 0…7: `stop{N}Position` (float) and `stop{N}Color` (vec3, widget color).
    - Defaults: stop 0 at position 0, black; every other stop at position 1, white.
    - Each stop input with index ≥ `count` has a `hiddenWhen` returning true.
  - Params:
    - `count`: number, min 2, max 8, step 1, default 2, `hidden: true`.
    - `interpolation`: enum `linear`, `constant` or `smooth`, default linear.
  - Output: `out` (vec3).
  - Formula: `ramp(In)`.
- Export from `color-ramp-node.ts`: `COLOR_RAMP_MAX_STOPS = 8`, `colorRampStopInputIds(index: number): { position: string; color: string }` and `colorRampCount(params): number` (clamped and rounded). The editor reuses these.

- [ ] **Step 1: Write the failing tests** (recorded expressions with count 3)
- **linear:** `color = c0`. Then, for i = 1…2: `t_i = clamp(div(sub(in,p_{i−1}), max(sub(p_i,p_{i−1}), 0.00001)), 0, 1)` and `color = mix(color, c_i, t_i)`.
- **smooth:** the same `t_i`, passed through `t·t·(3 − 2t)`.
- **constant:** `color = mix(color, c_i, step(p_i, in))`.
- Stops at or above `count` never appear in the expression.
- Equal positions do not divide by zero: the `max(..., 0.00001)` is present (Review Focus 1).

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement.** Also teach the canvas row list and the inspector to skip inputs whose `hiddenWhen(node.params)` is true, in `node-port-layout.ts` `visibleInputs` and in the inspector input rows.

- [ ] **Step 4: Run** `pnpm -r test`. Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(nodes): color ramp node with up to eight connectable stops"`

---

### Task 9: Color Ramp editor widget

**Files:**
- Create:
  - `apps/editor/src/features/color-ramp/color-ramp-operations.ts`: pure graph operations.
  - `apps/editor/src/features/color-ramp/color-ramp-operations.test.ts`
  - `apps/editor/src/features/color-ramp/color-ramp-editor.tsx`
  - `apps/editor/e2e/color-ramp.spec.ts`
- Modify: `apps/editor/src/features/canvas/node-view.tsx` (render the editor in the body of `color/color-ramp`), the node inspector, the store action that commits a whole-graph change as one undo step (the one paste and example opening use), and `messages/en.ts` / `es.ts`.

**Interfaces:**
- Consumes from Task 8: `COLOR_RAMP_MAX_STOPS`, `colorRampStopInputIds` and `colorRampCount`.
- Produces pure functions, each returning `Result<Graph, string>`:
  - `addStop(graph, registry, nodeId)`: inserts a stop at the midpoint of the widest gap, with the color interpolated there. Later stops shift up one index, values and edges included.
  - `removeStop(graph, registry, nodeId, index)`: removes the stop's edges, shifts later stops down (values and edges) and lowers `count`. It refuses when `count` is 2.
  - `moveStop(graph, registry, nodeId, index, position)`: clamps the position between its neighbours.
  - `swapStops(graph, registry, nodeId, a, b)`: swaps positions and colors (values only, the edges stay).

- [ ] **Step 1: Write the failing unit tests**
- Each operation's result (counts, values and edges).
- `moveStop` past a neighbour stops at the neighbour's position.
- Removing a wired stop removes its edge (Review Focus 4).

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement the operations and the editor**
- The editor has a gradient bar preview and a list of active stops. Each row has:
  - a position field: arrows ±0.01, Shift+arrows ±0.1, clamped;
  - a color swatch button that opens the existing color picker;
  - "Move up" and "Move down" buttons;
  - a "Remove stop" button, disabled at 2.
- Below the list, an "Add stop" button, disabled at 8.
- Every control is reachable with Tab, and focus stays visible.
- Each action commits through the single-step store action, so one undo reverts it.
- Run the Better Design steps (UI and UX principles before building, then review rules, comprehension and spacing on the rendered node) and fix the critical and serious findings.

- [ ] **Step 4: Write and run `color-ramp.spec.ts`** (keyboard only)
- Add a Color Ramp from the menu and Tab to "Add stop": Enter takes the count to 3.
- Move a stop with ArrowRight: the stored position grows by 0.01.
- Remove a wired stop: the edge is gone. Undo once (`ControlOrMeta+z`): the stop and the edge are back.

Run: `pnpm --filter @nudo-tsl/editor exec playwright test e2e/color-ramp.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(editor): keyboard-operable color ramp editor"`

---

### Task 10: Master Physical (core, runtime, codegen)

**Files:**
- Modify:
  - Nodes: `packages/nodes/src/master/master-stack.ts`.
  - Core: `packages/core/src/compiler/compile-backend.ts` and `packages/core/src/master/master-settings.ts`.
  - Runtime: `packages/runtime/src/create-material.ts`.
  - Codegen: `generate-module.ts` and `print-module.ts`.
  - Tests: `nodes.test.ts`, `catalog-b.test.ts`, `parity.test.ts`, `codegen.test.ts` and `create-material.test.ts`.

**Interfaces:**
- **Master definition:**
  - Lighting options: standard, unlit and physical (label "Physical").
  - New boolean params, all default false: `useTransmission`, `useClearcoat`, `useSheen` and `useIridescence`.
  - New non-optional inputs, appended in this order:
    - `transmission` 0, `ior` 1.5, `thickness` 0
    - `clearcoat` 0, `clearcoatRoughness` 0
    - `sheen` vec3(0,0,0) with widget color, `sheenRoughness` 1
    - `iridescence` 0, `iridescenceIOR` 1.3
- **Core:**
  - `MasterLighting = 'standard' | 'unlit' | 'physical'`.
  - `MasterSettings` gains `readonly physical: { readonly transmission: boolean; readonly clearcoat: boolean; readonly sheen: boolean; readonly iridescence: boolean }`.
  - `MasterSlot` and `MASTER_SLOTS` gain the nine slots. `MasterMaterialProperty` gains `transmissionNode`, `iorNode`, `thicknessNode`, `clearcoatNode`, `clearcoatRoughnessNode`, `sheenNode`, `sheenRoughnessNode`, `iridescenceNode` and `iridescenceIORNode`.
  - `export const PHYSICAL_FEATURE_SLOTS: Readonly<Record<keyof MasterSettings['physical'], readonly MasterSlot[]>>` maps `transmission` to `['transmission','ior','thickness']`, `clearcoat` to `['clearcoat','clearcoatRoughness']`, `sheen` to `['sheen','sheenRoughness']` and `iridescence` to `['iridescence','iridescenceIOR']`.
  - `masterMaterialAssignments(tsl, slots, settings: MasterSettings)` now takes the settings instead of the lighting:
    - standard assigns the original eight slots only;
    - unlit is unchanged;
    - physical assigns the original eight plus the slots of every enabled feature.
- **Runtime and codegen:**
  - `RuntimeMaterial` adds `MeshPhysicalNodeMaterial`.
  - `MaterialClass` adds `'MeshPhysicalNodeMaterial'`, and both pick it for physical.

- [ ] **Step 1: Write the failing tests**
- `nodes.test.ts` / `catalog-b.test.ts`: the pinned master input ids and param shapes, updated.
- `master-settings` tests:
  - Physical with every feature off assigns exactly the eight standard properties.
  - With `useTransmission` on, it adds `transmissionNode`, `iorNode` and `thicknessNode`.
  - Standard with physical inputs wired assigns none of them (Review Focus 3).
- `create-material.test.ts`: physical builds a `MeshPhysicalNodeMaterial`, and moving the transmission uniform does not rebuild it.
- `parity.test.ts`: a physical graph with all four switches on imports and exports `MeshPhysicalNodeMaterial` slots that are three `Node`s.

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement.** The `useTransmission` description warns that it renders the scene behind once more.

- [ ] **Step 4: Run** `pnpm -r test && git diff --stat -- apps/editor/src/examples packages/codegen/src/__snapshots__`. Expected: PASS, and no diff: standard and unlit graphs assign exactly what they did before.

- [ ] **Step 5: Commit**

`git commit -m "feat(core): physical lighting mode with transmission, clearcoat, sheen and iridescence"`

---

### Task 11: Master Physical in the editor

**Files:**
- Modify:
  - `apps/editor/src/features/canvas/node-port-layout.ts`
  - `apps/editor/src/features/canvas/param-field.tsx` (`bodyParams` for the master)
  - `apps/editor/src/features/inspector/graph-inspector.tsx` and `inspector-input-row.tsx`
  - `apps/editor/src/examples/build/node-geometry.ts`
  - `messages/en.ts` / `es.ts` and `nodes.es.ts` (master entry)
- Test: `node-port-layout.test.ts` (create or extend) and `apps/editor/e2e/inspector.spec.ts` (extend).

**Interfaces:**
- Consumes `PHYSICAL_FEATURE_SLOTS` from Task 10.
- Produces:
  - Master input groups become Vertex, Fragment and Physical (`node.group.physical`). The Physical group holds the nine physical inputs and is a disclosure: collapsed by default unless the lighting is physical.
  - Disabled hints:
    - `node.physicalOnly` ("Only Physical lighting uses this") on physical inputs when the lighting is not physical;
    - `node.physicalFeatureOff` ("Turn on {feature} to use this") when the input's feature switch is off.
  - The `use*` switches show only while the lighting is physical.

- [ ] **Step 1: Write the failing tests**
- `groupInputs` returns three groups for the master.
- Hints per lighting and switch state.
- `bodyParams` hides the `use*` params unless the lighting is physical.

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement**, reusing the existing disclosure pattern (see `e2e/disclosure-chevron.spec.ts`). Run the Better Design review steps on the master node in both themes.

- [ ] **Step 4: Run** `pnpm -r test` and the e2e `inspector.spec.ts` extension (keyboard only): set Lighting to Physical, Tab to "Transmission" (the switch), press Space, and expect the Transmission row to be enabled. Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(editor): physical group and feature switches on the master"`

---

### Task 12: Batch verification

- [ ] **Step 1:** Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm -r test`. Expected: all PASS. A pre-existing `format:check` warning on `keyboard-connect-list.tsx` is not this batch's to fix: note it, do not touch it.
- [ ] **Step 2:** Run `pnpm --filter @nudo-tsl/editor exec playwright test`. Expected: PASS, including `compile-check.spec.ts`, which now also covers physical and every new node.
- [ ] **Step 3:** Run `git diff main --stat -- apps/editor/src/examples packages/codegen/src/__snapshots__`. Expected: no changes.
- [ ] **Step 4:** Mark batch 1 done in the spec (§3) with a one-line note, then commit: `git commit -m "docs: mark catalog batch 1 done"`.
