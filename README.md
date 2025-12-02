# Infinite Edit

![Infinite Edit Banner](assets/banner.png)

**Infinite Edit** turns your VS Code workspace into an infinite, spatial canvas. Break free from tabs and organize your code the way you think.

## Features

### 🌌 Infinite Canvas
Navigate your codebase on a 2D infinite plane. Pan and zoom freely to organize your thoughts and files spatially.

### 📄 Spatial Editing
Open files directly onto the canvas. Each file becomes a node that you can drag, arrange, and group logically.

### ✏️ Seamless Integration
-   **Open Files**: Use the command `Infinite Edit: Open File` to open your current active editor onto the canvas.
-   **Full Editing**: Edit code with full syntax highlighting (powered by CodeMirror) directly on the canvas.
-   **Save**: Press `Ctrl+S` (or `Cmd+S`) within a node to save changes back to your disk instantly.

## Getting Started

1.  Install the extension.
2.  Run the command `Infinite Edit: Open Canvas` to launch the infinite workspace.
3.  Open any file in VS Code, then run `Infinite Edit: Open File` to add it to the canvas.
4.  Drag nodes by their title bar to arrange them.
5.  Scroll to zoom, drag the background to pan.

## Requirements

-   VS Code 1.90.0 or higher.

## Known Issues

-   Currently supports single-file nodes.
-   Resizing nodes is coming soon.

## Codebase Structure

The project is organized into a clear separation of concerns between the Backend (Extension Host) and Frontend (Webview).

```
src/
├── backend/                  # Extension Host (Node.js)
│   ├── commands/             # VS Code Command Handlers
│   ├── panels/               # Webview Panel Management
│   ├── providers/            # Data Providers (FileSystem, LSP, Config)
│   └── services/             # Backend Services (MessageBus)
├── shared/                   # Shared Types & Models
│   └── types/                # Message Protocols and Data Interfaces
├── webview/                  # Frontend (Browser/PixiJS)
│   ├── canvas/               # PixiJS Canvas & Grid Logic
│   ├── core/                 # App Controller & Messaging Client
│   ├── features/             # Feature Logic (Selection, Connections, Input)
│   ├── nodes/                # Node Implementations (Editor, Note, Media)
│   └── ui/                   # HTML/CSS Overlays (Toolbar, Minimap)
└── extension.ts              # Main Entry Point
```

### `src/backend/` (Extension Host)
Code running in the Node.js extension host environment.
-   **`extension.ts`**: The main entry point. Activates the extension and registers components.
-   **`commands/`**:
    -   `OpenCanvasCommand.ts`: Handles the command to launch the infinite canvas.
-   **`panels/`**:
    -   `InfiniteEditPanel.ts`: Manages the Webview lifecycle, HTML content generation, and message passing.
-   **`providers/`**:
    -   `FileSystemProvider.ts`: Handles file I/O operations (read/write) via VS Code APIs.
    -   `LSPProvider.ts`: Interfaces with language servers for features like Go to Definition.
    -   `ConfigProvider.ts`: Manages extension settings and persists canvas state.
-   **`services/`**:
    -   `MessageBus.ts`: Central hub for routing messages between the Webview and Backend Providers.

### `src/shared/`
Shared code between the Extension Host and Webview.
-   **`types/`**:
    -   `messages.ts`: Defines the protocol for communication (e.g., `OpenCanvas`, `SaveFile`).
    -   `models.ts`: Shared data models (e.g., `NodeData`, `CanvasConfig`).

### `src/webview/` (Frontend)
Code running in the Webview (Browser environment).
-   **`core/`**:
    -   `App.ts`: The main application controller that initializes the canvas and managers.
    -   `MessageClient.ts`: Handles sending and receiving messages to/from the backend.
-   **`canvas/`**:
    -   `CanvasManager.ts`: Manages the PixiJS application, scene graph, and main render loop.
    -   `Viewport.ts`: Handles panning, zooming, and coordinate system transformations.
    -   `Grid.ts`: Renders the infinite background grid.
-   **`nodes/`**:
    -   `BaseNode.ts`: Abstract base class for all canvas nodes.
    -   `EditorNode.ts`: A node containing a Monaco Editor instance for code editing.
    -   `NoteNode.ts`: A node for rich text or markdown notes.
    -   `MediaNode.ts`: A node for displaying images or videos.
-   **`features/`**:
    -   `SelectionManager.ts`: Handles clicking, dragging, and group selection of nodes.
    -   `ConnectionManager.ts`: Manages drawing lines and arrows between nodes.
    -   `InputManager.ts`: Centralized input handling for keyboard and mouse events.
-   **`ui/`**:
    -   `Toolbar.ts`: Manages the floating HTML toolbar for tools and settings.
    -   `Minimap.ts`: Renders a small map of the entire canvas for navigation.

---

**Enjoy coding in infinite space!**
