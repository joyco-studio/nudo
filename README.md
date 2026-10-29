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

The header's **Templates** button (or **Browse templates** in the `Ctrl/⌘` `K` palette) opens a side panel over the canvas that lists the examples and renders the selected one live, on its own mesh, before you load anything. Arrow keys or typing a title move through the list, and the preview follows. **Open template** (or `Enter`) puts it in place of your graph as one undo step, and asks first when your graph has nodes or properties. Each example is a versioned `.graph.json` in `apps/editor/src/examples`, built from a spec in `examples/build` with the core graph operations and laid out like **Tidy up**. After changing a spec, run `pnpm --filter @nudo-tsl/editor exec vitest run src/examples --update` to write the files again.

| Example         | What it shows                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pond            | Illustrated water seen from above: Voronoi rosettes and lace, rotated Voronoi stamps, a sun band, a toned palette, refraction and a vignette. Unlit.        |
| Iridescent blob | The tutorial graph: Time-driven noise breathes the surface, a mask picks colors and roughness, and a fresnel adds a rim. Each step sits in a comment frame. |

## Panels

| Panel      | Key | What it holds                                                                                                     |
| ---------- | --- | ----------------------------------------------------------------------------------------------------------------- |
| Properties | `B` | The Blackboard: named values (float, vectors, colors, textures) shared across the graph and exported as uniforms. |
| Inspector  | `I` | The selected node's description, params, values and preview toggle; with nothing selected, the graph settings.    |
| Preview    | `P` | The material on a mesh (sphere, cube, plane, torus, knot, Suzanne or your GLB), docked, split or full.            |
| Code       | `C` | The TSL the graph generates.                                                                                      |

## Node catalog

| Category      | Nodes                                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input         | UV, Screen UV, Position, Normal, View Direction, Camera Position, Time, Float, Vector 2/3/4, Color, Blackboard properties                             |
| Math          | Add, Subtract, Multiply, Divide, Power, Exponential, Sine, Cosine, Absolute, Fract, Floor, Min, Max, Clamp, One Minus, Remap, Distance, Random (hash) |
| Interpolation | Lerp, Step, Smoothstep, AA Step                                                                                                                       |
| Logic         | Select                                                                                                                                                |
| Vector        | Split, Combine, Dot Product, Length, Normalize, Rotate 2D                                                                                             |
| Effects       | Noise (simplex, Perlin), Voronoi, Checkerboard, Gradient, Fresnel                                                                                     |
| Texture       | Sample Texture 2D (images live in the browser's IndexedDB)                                                                                            |
| Color         | Color Space                                                                                                                                           |
| Normal, scene | Normal From Height, Depth Fade, Scene Color                                                                                                           |
| Utility       | Comment, Reroute                                                                                                                                      |
| Output        | Master Stack, standard (lit) or unlit                                                                                                                 |

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

## Packages

| Path               | Purpose                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`    | Pure graph model: validation, type inference, compiler, serialization and fragments. No React or three.js.                  |
| `packages/nodes`   | The master stack and the built-in nodes. Depends only on `@nudo-tsl/core`.                                                  |
| `packages/runtime` | The live TSL backend that turns a compiled graph into a `MeshStandardNodeMaterial`. Depends on `core`, `nodes` and `three`. |
| `packages/codegen` | Prints a graph as a readable TSL module. Depends only on `core` and `nodes`.                                                |
| `apps/editor`      | The Vite and React editor: canvas, panels, node previews, examples, shortcuts and main preview.                             |

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
