# WP Plugin Pulse

WP Plugin Pulse is a small browser-based dashboard for comparing public WordPress.org plugin metrics. It currently loads up to 100 plugins tagged `form-builder` and presents their activity in an accessible table.

## Features

- Fetches current plugin information from the WordPress.org Plugin Information API.
- Shows active installations, ratings, rating counts, and open support threads.
- Estimates average active installs per day since each plugin was added.
- Decodes HTML entities in plugin names without injecting remote HTML.
- Provides accessible loading and error states.
- Uses strict TypeScript and native browser APIs without a frontend framework.

## Important data note

The “Installs / Day” value is an estimate:

```text
active installs / days since the plugin was added
```

It is not actual daily download history. WordPress.org may round or cap active-install counts, and missing or malformed remote values can affect displayed results. All other metrics reflect the fields returned by the public API when the page loads.

## Requirements

- [Bun](https://bun.sh/) 1.3 or later

## Local development

Install dependencies and start the Vite development server:

```bash
bun install
bun run dev
```

Vite prints the local URL after startup.

## Available commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the development server. |
| `bun run typecheck` | Run the TypeScript compiler without emitting files. |
| `bun run build` | Type-check and create a production build in `dist/`. |
| `bun run preview` | Preview the production build locally. |

## Project structure

```text
index.html                  Vite HTML entry point
src/main.ts                 Data fetching and metric calculation
src/components/             DOM-based table components
src/utils/                  Data normalization utilities
src/style.css               Global styles
```

## Data source

Plugin data comes from the public [WordPress.org Plugin Information API](https://codex.wordpress.org/WordPress.org_API#Plugins). The default query uses the `form-builder` tag and is configured in `src/main.ts`.

This project is independent and is not affiliated with or endorsed by WordPress.org or the WordPress Foundation.
