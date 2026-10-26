# nudo-tsl

Open-source node-based editor for [three.js shading language (TSL)](https://threejs.org/docs/#manual/en/introduction/Node-Material) shaders.

## Workspace layout

| Path               | Purpose                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `packages/core`    | Pure graph model and operations. No framework or three.js dependencies. |
| `packages/nodes`   | Node definitions. Depends only on `@nudo-tsl/core`.                     |
| `packages/runtime` | Graph to TSL compilation. Depends on `core`, `nodes` and `three`.       |
| `apps/editor`      | The Vite-based visual editor.                                           |

## Getting started

Requires Node 22+ and pnpm 11.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

## Conventions

- TypeScript strict mode, no `any`, no unsafe type assertions.
- Conventional Commits, enforced by commitlint through a Husky `commit-msg` hook.
- Package dependency boundaries are enforced by ESLint (`no-restricted-imports`).

## License

[MIT](./LICENSE)
