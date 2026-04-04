# Infinite Edit — Codebase Overview

A VS Code extension that renders a 2D infinite canvas for spatial code editing.

## Architecture

Two isolated runtimes communicate over a message-passing protocol:

| Layer | Runtime | Entry Point |
|---|---|---|
| Backend | Node.js Extension Host | `src/backend/extension.ts` |
| Frontend | Browser (Webview) | `src/webview/main.ts` |
| Shared | Both | `src/shared/types/` |

## Backend (`src/backend/`)

- **`extension.ts`** — activates the extension; bootstraps `@hediet/node-reload` in development for hot reload without a full VS Code restart
- **`panels/InfiniteEditPanel.ts`** — owns the Webview lifecycle, generates the HTML shell, and bridges messages to the extension host
- **`commands/`** — VS Code command handlers (e.g. Open Canvas, Open File)
- **`providers/`** — `FileSystemProvider`, `LSPProvider`, `ConfigProvider` wrap VS Code APIs
- **`services/MessageBus.ts`** — central hub routing messages between frontend and backend providers

## Frontend (`src/webview/`)

- **`core/App.ts`** — top-level controller; initializes canvas and all managers
- **`core/MessageClient.ts`** — sends/receives typed messages to/from the backend
- **`canvas/`** — PixiJS render loop, viewport (pan/zoom), infinite grid
- **`nodes/`** — `BaseNode` + concrete types: `EditorNode` (Monaco), `NoteNode`, `MediaNode`
- **`features/`** — `SelectionManager`, `ConnectionManager`, `InputManager`
- **`ui/`** — HTML overlay widgets: `Toolbar`, `Minimap`

## Shared (`src/shared/`)

- **`types/messages.ts`** — typed message protocol shared by both runtimes
- **`types/models.ts`** — shared data models (`NodeData`, `CanvasConfig`, etc.)
- **`MonacoConfig.ts`** — Monaco worker label → worker key mapping

## Build & Dev

| Script | Purpose |
|---|---|
| `npm run dev` | Runs both watchers concurrently |
| `watch` | Rspack incremental build of the extension host |
| `serve-webview` | Rspack dev server (port 3000) with HMR |

### Hot Module Replacement

Two independent mechanisms run in parallel during development:

1. **Extension host** — `@hediet/node-reload` watches `dist/extension.js` and re-executes the module in place (no VS Code restart required)
2. **Webview** — Rspack HMR pushes patches over `ws://localhost:3000/ws`; `main.ts` registers `hmr.dispose()` to tear down the `App` instance (Pixi renderer, event listeners, etc.) before the module re-executes, preventing duplicate instances

The webview CSP in `InfiniteEditPanel.ts` explicitly whitelists the dev server origin and WebSocket for the HMR connection to work inside the VS Code webview sandbox.