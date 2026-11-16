# Rentry Builder

A visual, drag-and-drop builder for [rentry.co](https://rentry.co) profile pages. Arrange blocks (profile card, interests, links, socials, columns, …) on a Figma-style canvas, style the page with every rentry metadata option, and copy out the **METADATA** and **markdown** ready to paste into rentry.

- Visual rich-text editing (bold, colors, underline styles, spoilers, links, inline emoji/flag images) that compiles to rentry markdown
- Live preview that mirrors rentry's rendering, light/dark
- Full metadata editor with rentry's validation rules
- Templates, theme presets and saved color swatches
- Autosaves locally; export/import `.rentrybuilder.json` project files

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test
npm run build
```

Built with React, TypeScript, Vite, Zustand, TipTap and markdown-it.
