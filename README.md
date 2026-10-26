# nudo-tsl

A node-based shader editor for [three.js shading language (TSL)](https://threejs.org/docs/pages/TSL.html). Wire nodes together, see the material update live on a mesh, and drive everything from the keyboard.

The graph is the source of truth: the editor compiles it to a `MeshStandardNodeMaterial` and renders it in a live preview (WebGPU, with a WebGL2 fallback). Your work autosaves to the browser.

**Status: phase 1.** Editing, live compilation and the main preview work today. Export to TSL code and graph import come in phase 3. The design lives in [`docs/superpowers/specs/2026-10-26-nudo-tsl-design.md`](./docs/superpowers/specs/2026-10-26-nudo-tsl-design.md).

## Quick start

Requires Node 22+ and pnpm 11.

```bash
pnpm install
pnpm dev
```

Then open http://localhost:5173. Press `Space` on the canvas to add a node, `Tab` to a port and `Enter` to connect it, and `?` to see every shortcut.

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
| `apps/editor`      | The Vite and React editor: canvas, add-node menu, shortcuts and main preview.                                               |

## Keyboard shortcuts

`Ctrl/⌘` means Ctrl on Windows and Linux, and Command on macOS. Press `?` in the editor for the same list.

| Where    | Shortcut                           | Action                                    |
| -------- | ---------------------------------- | ----------------------------------------- |
| Anywhere | `Ctrl/⌘` `Z`                       | Undo                                      |
| Anywhere | `Ctrl/⌘` `Shift` `Z` or `Ctrl` `Y` | Redo                                      |
| Anywhere | `Ctrl/⌘` `C`                       | Copy selected nodes                       |
| Anywhere | `Ctrl/⌘` `V`                       | Paste nodes                               |
| Anywhere | `Ctrl/⌘` `A`                       | Select all nodes                          |
| Anywhere | `F`                                | Fit all nodes in view                     |
| Anywhere | `?`                                | Show the shortcuts                        |
| Canvas   | `Space`                            | Add a node                                |
| Canvas   | `Arrow keys`                       | Pan the view 40 px                        |
| Canvas   | `Shift` `Arrow keys`               | Pan the view 160 px                       |
| Canvas   | `Delete`                           | Delete the selected nodes and connections |
| Node     | `Arrow keys`                       | Move the node 10 px                       |
| Node     | `Shift` `Arrow keys`               | Move the node 50 px                       |
| Node     | `Delete` or `Backspace`            | Delete the node                           |
| Node     | `Enter`                            | Edit its first field                      |
| Node     | `Esc`                              | Leave a field and return to the node      |
| Node     | `Tab` or `Shift` `Tab`             | Next or previous port and field           |
| Port     | `Enter`                            | Connect to another port                   |
| Port     | `Delete`                           | Remove its connections                    |

## Contributing

Commits follow [Conventional Commits](https://www.conventionalcommits.org/), enforced by commitlint through a Husky hook. TypeScript runs in strict mode with no `any` and no unsafe assertions, and files use kebab-case names. Before opening a pull request, run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.

## License

[MIT](./LICENSE)
