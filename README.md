# Three.js 3D Template

This is a **web game template for AI-assisted development**.

It ships as a single browser game, while using a small workspace layout to keep a few reusable concerns decoupled:

- `game/core/` for shared gameplay state and rules
- `game/client/` for Three.js rendering and input
- `packages/i18n` for translation runtime and build-time helpers
- `packages/platform` for desktop/mobile input abstraction

The point of the structure is not to produce multiple independent applications. The point is to make one game template easier to evolve, reuse, and extend.

## Features

- **Three.js** for 3D rendering
- **TypeScript** with path aliases
- **Vite** for local development and build
- **i18n** via `@minigame/i18n`
- **Desktop/mobile input** via `@minigame/platform`
- **Template-oriented workspace layout** for shared internal packages

## Quick Start

```bash
pnpm install
pnpm dev
pnpm build
```

Dev server default: `http://localhost:15173`

## Project Structure

```text
threejs-3d/
├── index.html
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── vite.config.ts
├── i18n/
├── game/
│   ├── core/
│   │   └── source/
│   └── client/
│       ├── main.ts
│       └── source/
│           ├── index.ts
│           └── session/
└── packages/
    ├── i18n/
    ├── platform/
    └── render-adapter/
```

## Where To Work

Most feature work belongs in:

- `game/core/source/GameInstance.ts`
- `game/core/source/config.ts`
- `game/core/source/types.ts`
- `game/client/source/index.ts`
- `i18n/en.json`
- `i18n/zh.json`

You usually do **not** need to touch `packages/` unless you are intentionally extending shared infrastructure.

## Runtime Responsibilities

- `game/core/source/GameInstance.ts` runs the gameplay loop and state updates.
- `game/client/source/index.ts` handles Three.js scene setup, input, camera, and HUD.
- `game/client/main.ts` bootstraps i18n and game start.
- `packages/i18n/` provides translation runtime and Vite integration.
- `packages/platform/` provides unified desktop/mobile input helpers.
- `packages/render-adapter/` provides shared display-scaling helpers for Three.js.

## i18n

All player-facing text should use `@minigame/i18n`.

```ts
import { t } from '@minigame/i18n'

t('hud.goal', { score: String(score) })
```

When adding a new key, update both locale files:

- `i18n/en.json`
- `i18n/zh.json`

## Input

Use `PlatformInput` as the default integration point for controls.

```ts
const platformInput = new PlatformInput({
  mode: 'joystick',
  canvas: this.renderer.domElement,
})
```

The template already demonstrates the intended pattern:

- mobile uses virtual controls from `@minigame/platform`
- desktop merges keyboard input in the game loop

## Three.js Runtime Rule

Use Three.js objects for rendering, and keep gameplay flow in `GameInstance.ts` plus the scene logic in `game/client/source/index.ts`.

## Intended Use

This template is meant to be:

- easy for AI to read
- fast to modify
- simple to extend into a concrete game prototype

It is not a full framework and it does not try to pre-package every production pattern.

## License

MIT
