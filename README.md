# nudo-tsl

A node-based shader editor for [three.js shading language (TSL)](https://threejs.org/docs/pages/TSL.html). Wire nodes together, see the material update live on a mesh, and drive everything from the keyboard.

The graph is the source of truth: the editor compiles it to a node material (lit or unlit) and renders it in a live preview (WebGPU, with a WebGL2 fallback). Your work autosaves to the browser.

**Status: phase 2.** Editing, live compilation, per-node previews, Blackboard properties, textures and the examples work today. Export to `.tsl.js` files and graph import come in phase 3. The design lives in [`docs/superpowers/specs/2026-10-26-nudo-tsl-design.md`](./docs/superpowers/specs/2026-10-26-nudo-tsl-design.md).

## Quick start

Requires Node 22+ and pnpm 11.

```bash
pnpm install
pnpm dev
```

Then open http://localhost:5173. Press `Space` on the canvas to add a node, `Tab` to a port and `Enter` to connect it, and `?` to see every shortcut. To start from a finished graph, open **Templates** in the header.

## Examples

The header's **Templates** button (or **Browse templates** in the `Ctrl/⌘` `K` palette) opens a side panel over the canvas that lists the examples and renders the selected one live, on its own mesh, before you load anything. Arrow keys or typing a title move through the list, and the preview follows. **Open template** (or `Enter`) puts it in place of your graph as one undo step, and asks first when your graph has nodes or properties. Each example is a versioned `.graph.json` in `apps/editor/src/examples`, built from a spec in `examples/build` with the core graph operations and laid out like **Tidy up**. After changing a spec, run `pnpm --filter @nudo-tsl/editor exec vitest run src/examples --update` to write the files again. A template can ship its own images: list them in the spec's `textures` (from `examples/build/bundled-textures.ts`, files in `examples/textures`) and name one in a texture slot or property with `templateTexture(PAPER_GRAIN)`. They are fetched only when the template is previewed or opened; opening stores them like uploads, deduplicated by content hash, in the same undo step. The illustration templates follow sketches from [spite/sketch](https://github.com/spite/sketch) (MIT), rebuilt from nodes; like Lava flow they draw every pattern, paper included, with nodes and ship no images. Brush toon ships images: a brush-stroke texture and a stroke mask, painted by the seeded script `examples/build/textures/paint-strokes.ts` (run it with `node` to write them again).

| Example        | What it shows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| God rays       | After [Cyanilux](https://www.cyanilux.com/tutorials/god-rays-shader-breakdown/): a stretched plane, animated noise stripes, soft edge/camera/depth fades, and stationary Voronoi dust with a fixed pixel diameter that fades in and out. Transparent, two-sided, unlit. Hand-placed; no automatic billboarding or shadow-map masking.                                                                                                                                                                                                                                                                          |
| Torn wallpaper | **Wallpaper image** and **Inner wall image** supply the surface detail (botanical print and concrete by default). **Tear shape · SDF image** defines the opening from its red channel: white inside, black outside, 0.5 at the boundary. `tearRegion` places and scales the mask (XY center / ZW full image size); `tearAmount` scales it from closed to open. Wall-anchored noise adds irregular edges and backing; set **Edge roughness** to 0 for the exact texture outline. `curlWidth` controls backing width and `curlHeight` controls lift and contact shadows. Opaque, unlit, no overhanging geometry. |
| Pond           | Illustrated water seen from above: Voronoi rosettes and lace, rotated Voronoi stamps, a sun band, a toned palette, refraction and a vignette. Unlit.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Poster         | Four-ink screen-print shading after spite's "post-hope": one light value cut into flat inks with Select, a striped band, noise-wobbled stencil edges and a fresnel outline. Unlit.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Lava flow      | An original cooling lava field: drifting, domain-warped Voronoi basalt plates over molten seams whose travelling heat drives Blackbody HDR emission, with a rough oxidized crust, a satin melt (Specular Intensity turned down), sunken seams, and crust relief and round embers anti-aliased with Derivatives. Physical.                                                                                                                                                                                                                                                                                      |
| Lines          | After spite's "Lines I": parallel ink lines in view space whose thickness follows the Main Light, over paper made of noise. Unlit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Scribble       | After spite's "Scribble I": strokes bent by fractal noise so they wobble like handwriting, each with its own pen pressure from the Random node. Unlit.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Pencil         | After the drawing pencil of Profesora Ya: graphite hatching and, in the shadows, cross-hatching from the Main Light, masked by a paper tooth of Random cells at two sizes, so strokes break into grain and crossing strokes fill more of it. A fresnel contour. Unlit.                                                                                                                                                                                                                                                                                                                                         |
| Pen            | After the pen of Profesora Ya's drawing pencil: Pencil's hatching and cross-hatching from the Main Light as ballpoint lines, unbroken, narrowed and paled where a Perlin ink flow runs dry, specked by a paper tooth of Random cells, and darker where they cross. A fresnel contour. Unlit.                                                                                                                                                                                                                                                                                                                   |
| Patch          | After spite's "Patch I": Voronoi patches, each filled with short strokes at an angle the Random node draws from its center. Unlit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Brush toon     | After a Blender toon material: the light through a five-color Color Ramp, Voronoi facets that tilt the normal, a bundled brush-stroke texture that shifts and paints over the palette, and brushed-off edges a stroke mask cuts with Alpha Clip. Unlit.                                                                                                                                                                                                                                                                                                                                                        |
| Painterly      | Eleven spheres rebuilt from a Blender painterly shader set (Midnight glaze, Pastel planet, Bubblegum, Frost speckle, Banded giant, Dusk glaze, Charcoal chrome, Pewter haze, Rose moon, Ink swirl, Night leaf): Noise Color bends the normal, a Minkowski Voronoi snaps it into brush facets and a Color Ramp cuts the light into flat paint bands. Unlit.                                                                                                                                                                                                                                                     |

Torn wallpaper separates its shape sources into **01 · TEXTURE SDF** (connected by default), **02 · ELLIPSE SDF**, and **03 · ROUNDED BOX SDF**. To switch, connect the chosen group’s final **Combine → Vec3** to **Split → In** in **04 · CONNECT ONE SHAPE HERE**. This replaces one wire, carrying distance and both distance limits together; the other two sources remain unplugged. All three share **00 · Shared placement**. The analytic shapes do not depend on the texture threshold/range. **Box corner radius** controls the rounded box, from 0 (square corners) to 0.5 (half the smaller side). The ellipse uses a near-edge distance approximation.

The Torn wallpaper mask accepts a **single-channel SDF**, not an RGB MSDF. **SDF boundary** defaults to `0.5`; **SDF range** is the full black-to-white distance span in texture UV units (`pxrange / image width` for square maps). The bundled 512² mask uses a 256-pixel range, so the value is `0.5`. Distance scales with the smaller placement axis; non-uniform stretching approximates the distance. Distortion, backing width and shadows are limited to the encoded distance span; narrow-range SDFs produce thinner edge effects. Keep the shape inside the image bounds with an exterior border. The graph clamps sampling and bounds the field so the mask does not tile. Binary black/white images define an outline, but use an SDF for gradual peel and shadow distances. The graph recovers stored image values after the editor’s sRGB decode, preserving the 0.5 contour ([color-space guidance](https://hub.joyco.studio/logs/10-color-spaces-srgb-linear)).

Regenerate the starter mask from its SVG with [msdfgen](https://hub.joyco.studio/toolbox/msdfgen):

```sh
msdfgen sdf -svg apps/editor/src/examples/textures/sources/tear-shape.svg -o apps/editor/src/examples/textures/tear-shape-sdf.png -dimensions 512 512 -pxrange 256 -scale 1 -translate 0 0
```

## Panels

| Panel      | Key | What it holds                                                                                                     |
| ---------- | --- | ----------------------------------------------------------------------------------------------------------------- |
| Properties | `B` | The Blackboard: named values (float, vectors, colors, textures) shared across the graph and exported as uniforms. |
| Inspector  | `I` | The selected node's description, params, values and preview toggle; with nothing selected, the graph settings.    |
| Preview    | `P` | The material on a mesh (sphere, cube, plane, torus, knot, Suzanne or your GLB), docked, split or full.            |
| Code       | `C` | The TSL the graph generates.                                                                                      |

## Edit with an agent

An AI agent such as Claude Code can edit the graph in your open nudo tab while you watch. It talks to nudo over MCP: it reads the graph, lists node types, adds and wires nodes, sets values, checks the generated code and looks at the preview. Its cursor moves on the canvas, every node it creates says "by" and its name, and the activity panel shows each step with **Stop** and **Undo all** (one step back to the graph before the task). Replacing the graph or opening a template asks you first.

**Connect.** Click **Connect an agent** in the header and paste the command it shows into a terminal:

```bash
claude mcp add --transport http nudo https://<your-worker>/mcp --header "Authorization: Bearer <key>"
```

Then ask Claude Code for a shader. The agent always edits the tab you used last; other tabs say so.

**Keep the key secret.** Anyone with it can edit the graph in your open tab. The key is kept in your browser, and the Worker finds your tab by its hash. If it leaks, click **Generate new key** in the same dialog: the old key stops working, and you add the server again with the new command.

**Self-host the Worker.** The agent server lives in `apps/mcp`, a Cloudflare Worker with one Durable Object per key. To run your own:

```bash
pnpm --filter @nudo-tsl/mcp exec wrangler login
pnpm --filter @nudo-tsl/mcp run deploy
```

- Set `ALLOWED_ORIGINS` (in `apps/mcp/wrangler.jsonc` or as a Worker variable) to a comma-separated list of the origins that serve the editor, such as `https://nudo.example.com,http://localhost:5173`. The bridge refuses any other origin.
- Build the editor with `VITE_NUDO_MCP_URL` set to the Worker URL, such as `https://nudo-mcp.<account>.workers.dev`. Without it the connect dialog says agent connections are not set up.

For local work, run `VITE_NUDO_MCP_URL=http://localhost:8787 pnpm dev`: it starts the editor and the Worker (`wrangler dev` on http://localhost:8787) together.

## Node catalog

| Category      | Nodes                                                                                                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input         | UV, Screen UV, Position, Normal, View Direction, Camera Position, Time, Float, Vector 2/3/4, Color, Blackboard properties                                                                                                                                           |
| Math          | Add, Subtract, Multiply, Divide, Power, Exponential, Sine, Cosine, Absolute, Fract, Floor, Min, Max, Clamp, One Minus, Remap, Distance, Random (hash), Arctangent 2, Derivatives (DDX, DDY, Fwidth; fragment only)                                                  |
| Interpolation | Lerp, Step, Smoothstep, AA Step                                                                                                                                                                                                                                     |
| Logic         | Select                                                                                                                                                                                                                                                              |
| Vector        | Split, Combine, Dot Product, Length, Normalize, Rotate 2D, Mapping, Reflect, Refract                                                                                                                                                                                |
| Effects       | Noise (simplex, Perlin, Perlin 2D), Voronoi (Euclidean, Manhattan, Chebyshev, Minkowski), Checkerboard, Gradient, Fresnel. Noise and 2D Voronoi can **Tile**: they repeat seamlessly every **Period**, so a pattern read in UV meets itself across a mesh's UV seam |
| Texture       | Sample Texture 2D (images live in the browser's IndexedDB)                                                                                                                                                                                                          |
| Color         | Color Space, Blend, Color Ramp, Bright/Contrast, Blackbody (kelvin to glow color), Tone Map (three.js's ACES Filmic, AgX, Neutral, Reinhard, Cineon or Linear, for unlit materials)                                                                                 |
| Normal, scene | Normal From Height, Depth Fade, Scene Color                                                                                                                                                                                                                         |
| Utility       | Comment, Reroute                                                                                                                                                                                                                                                    |
| Output        | Master Stack: standard, physical or unlit; Ambient Occlusion and Specular Intensity (physical) apply once connected                                                                                                                                                 |

## Scripts

| Command          | What it does                               |
| ---------------- | ------------------------------------------ |
| `pnpm dev`       | Starts the editor with hot reload.         |
| `pnpm build`     | Builds the editor into `apps/editor/dist`. |
| `pnpm lint`      | Runs ESLint, including package boundaries. |
| `pnpm typecheck` | Type-checks every package (strict mode).   |
| `pnpm test`      | Runs the unit tests (Vitest).              |
| `pnpm e2e`       | Runs the browser tests (Playwright).       |

The first `pnpm e2e` run needs the browser: `pnpm --filter @nudo-tsl/editor exec playwright install chromium`.

`pnpm e2e` starts the editor on port 5173 and the agent Worker on port 8787, and reuses a server already running there. The agent specs need an editor built with `VITE_NUDO_MCP_URL`, so when your own `pnpm dev` is up (editor on 5173, Worker on 8787), run them on ports of their own: `E2E_PORT=5190 E2E_MCP_PORT=8790 pnpm e2e`.

## Packages

| Path                      | Purpose                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`           | Pure graph model: validation, type inference, compiler, serialization and fragments. No React or three.js.                  |
| `packages/nodes`          | The master stack and the built-in nodes. Depends only on `@nudo-tsl/core`.                                                  |
| `packages/runtime`        | The live TSL backend that turns a compiled graph into a `MeshStandardNodeMaterial`. Depends on `core`, `nodes` and `three`. |
| `packages/codegen`        | Prints a graph as a readable TSL module. Depends only on `core` and `nodes`.                                                |
| `packages/agent-protocol` | The agent tool catalog and the messages between the MCP Worker and the editor tab.                                          |
| `apps/editor`             | The Vite and React editor: canvas, panels, node previews, examples, shortcuts and main preview.                             |
| `apps/mcp`                | The Cloudflare Worker that serves MCP to agents and relays their tool calls to the open editor tab.                         |

## Keyboard shortcuts

`Ctrl/⌘` means Ctrl on Windows and Linux, and Command on macOS. Press `?` in the editor for the same list, or `Ctrl/⌘` `K` to search every action and node. Panel keys work while the canvas, a node or a panel header has focus.

| Where      | Shortcut                           | Action                                               |
| ---------- | ---------------------------------- | ---------------------------------------------------- |
| Anywhere   | `Ctrl/⌘` `Z`                       | Undo                                                 |
| Anywhere   | `Ctrl/⌘` `Shift` `Z` or `Ctrl` `Y` | Redo                                                 |
| Anywhere   | `Ctrl/⌘` `C`                       | Copy selected nodes                                  |
| Anywhere   | `Ctrl/⌘` `V`                       | Paste nodes                                          |
| Anywhere   | `Ctrl/⌘` `A`                       | Select all nodes                                     |
| Anywhere   | `F`                                | Fit all nodes in view                                |
| Anywhere   | `Shift` `T`                        | Tidy up the graph                                    |
| Anywhere   | `Ctrl/⌘` `Alt` `N`                 | Start a new graph                                    |
| Anywhere   | `Ctrl/⌘` `K`                       | Open the command palette                             |
| Anywhere   | `?`                                | Show keyboard shortcuts                              |
| Anywhere   | `Alt` `T`                          | Move focus to the notifications                      |
| Panels     | `B`                                | Show or hide the Properties panel                    |
| Panels     | `I`                                | Show or hide the Inspector                           |
| Panels     | `P`                                | Show or hide the Preview                             |
| Panels     | `C`                                | Show or hide the Code panel                          |
| Panels     | `Shift` `P`                        | Next preview layout: docked, split, full             |
| Preview    | `Esc`                              | Leave the full preview                               |
| Preview    | `Arrow keys`                       | Move the split handle 5%                             |
| Preview    | `Home` or `End`                    | Smallest or largest canvas in split                  |
| Notices    | `Tab` or `Shift` `Tab`             | Move between the notification and its button         |
| Notices    | `Esc`                              | Close the notifications and return                   |
| Canvas     | `Space`                            | Add a node                                           |
| Canvas     | `Arrow keys`                       | Pan the view 40 px                                   |
| Canvas     | `Shift` `Arrow keys`               | Pan the view 160 px                                  |
| Canvas     | `Delete`                           | Delete the selected nodes and connections            |
| Canvas     | `Shift` `F10` or `Menu`            | Open the canvas menu                                 |
| Node       | `Arrow keys`                       | Move the node 10 px                                  |
| Node       | `Shift` `Arrow keys`               | Move the node 50 px                                  |
| Node       | `Delete` or `Backspace`            | Delete the node                                      |
| Node       | `Enter`                            | Edit its first field                                 |
| Node       | `Esc`                              | Leave a field and return to the node                 |
| Node       | `Tab` or `Shift` `Tab`             | Next or previous port and field                      |
| Node       | `Shift` `F10` or `Menu`            | Open its menu: copy, duplicate, preview mode, delete |
| Comment    | `Enter`                            | Write in its note                                    |
| Comment    | `Tab`                              | Edit its title                                       |
| Comment    | `Alt` `Arrow keys`                 | Resize the frame 20 px                               |
| Port       | `Enter`                            | Connect to another port                              |
| Port       | `Delete`                           | Remove its connections                               |
| Connection | `Delete`                           | Delete the connection                                |
| Connection | `Shift` `F10` or `Menu`            | Open its menu: insert a reroute, delete              |

## Contributing

Commits follow [Conventional Commits](https://www.conventionalcommits.org/), enforced by commitlint through a Husky hook. TypeScript runs in strict mode with no `any` and no unsafe assertions, and files use kebab-case names. Before opening a pull request, run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.

## License

[MIT](./LICENSE)
