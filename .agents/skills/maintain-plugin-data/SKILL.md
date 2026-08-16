---
name: maintain-plugin-data
description: Maintain and extend the plugin-data repository's vanilla JavaScript frontend built with Vite and managed by Bun. Use for UI changes, WordPress.org Plugin API integration, data calculations and rendering, CSS work, dependency changes, development commands, builds, debugging, or repository-specific implementation guidance in this project.
---

# Maintain Plugin Data

Work within the existing lightweight Bun + Vite architecture. Preserve vanilla HTML, CSS, and JavaScript unless the user explicitly requests a framework or other architectural change.

## Inspect the project

1. Check for `.codegraph/`. When it exists, use `codegraph explore` before text search or reading source files to locate or understand code.
2. Inspect `package.json`, `index.html`, and the relevant files under `src/` before editing.
3. Preserve unrelated user changes. This directory may not be a Git repository, so do not assume Git history or status is available.

## Follow stack conventions

- Use Bun as the only package manager. Run `bun install`, `bun add`, and `bun remove`; never generate `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`.
- Keep `packageManager` in `package.json` and commit `bun.lock` when dependencies change.
- Use the scripts already defined in `package.json`: `bun run dev`, `bun run build`, and `bun run preview`.
- Treat `index.html` as the Vite HTML entry point and `/src/main.js` as the browser module entry point.
- Import global styles from `src/style.css` through `src/main.js`.
- Prefer browser APIs and small focused modules over new dependencies. Add a dependency only when it materially simplifies the requested feature.
- Keep generated `dist/` and installed `node_modules/` out of source control.

## Work with plugin data

- Query the WordPress.org Plugin Information API at `https://api.wordpress.org/plugins/info/1.2/`.
- Build query strings with `URL` and `URLSearchParams`; encode dynamic values rather than interpolating raw input.
- Preserve the current default plugin tag, `form-builder`, unless the request changes it.
- Treat remote fields as untrusted or absent. Check response status, validate expected collections, handle request failures visibly, and avoid inserting untrusted strings with `innerHTML` when adding or revising rendering code.
- Keep displayed calculations explicit. The current installs-per-day value is an estimate based on active installs divided by days since the plugin was added; do not describe it as actual daily download history.
- Account for zero, missing, malformed, and capped WordPress.org values when changing calculations.

## Implement changes

1. Make the smallest coherent change that satisfies the request.
2. Keep data fetching, normalization, calculation, and DOM rendering separable when the feature grows beyond a single simple flow.
3. Preserve accessible table semantics. Add labels, status messaging, keyboard behavior, and responsive styles when introducing controls or interaction.
4. Match existing formatting unless a formatter or linter is added deliberately.

## Verify

Run `bun run build` after every implementation change. Also exercise the relevant behavior in the dev server when runtime fetching, DOM interaction, or responsive layout changes. Report any verification that could not be performed, especially network-dependent WordPress API checks.
