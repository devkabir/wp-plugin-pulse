# WP Plugin Pulse

**WP Plugin Pulse** is a fast, browser-based competitor intelligence and optimization platform for WordPress plugin developers, product managers, and marketers. It analyzes public [WordPress.org Plugin Directory](https://wordpress.org/plugins/) data to surface market trends, benchmark competitors head-to-head, and audit `readme.txt` files for directory best practices and discovery.

Built with pure vanilla TypeScript, modern CSS, and Vite, managed with Bun — zero heavy frontend frameworks.

---

## Key Features

### Multi-Mode Plugin Search & Discovery

- **Tag Search:** Explore plugins by tag category with quick-access preset chips (`form-builder`, `seo`, `woocommerce`, `security`, `performance`, `backup`).
- **Keyword Search:** Search plugin titles, descriptions, and metadata across the WordPress.org directory.
- **Slug Lookup:** Directly inspect any specific plugin by its WordPress.org repository slug.
- **Client-side Filtering & Multi-criteria Sorting:** Filter loaded results instantly by name, author, tag, or description. Sort by Active Installs, Lifetime Install Pace, Name, Rating Score, Support Thread Resolution, or Last Updated date.
- **Pagination Support:** Seamless pagination with page indicators and batch result controls.

### Competitive Landscape KPIs

- Real-time aggregated performance indicators for loaded query results:
  - Total combined active installs across the niche
  - Median customer rating score
  - Average support thread resolution rate
  - Lifetime install pace leader

### Head-to-Head Competitor Intelligence

- **Subject vs. Competitors:** Designate "My Plugin" (subject) and benchmark against up to 3 competitors side-by-side.
- **Metric Comparison:** Compare Active Installs, Lifetime Install Pace, Observed Snapshot Momentum, Star Ratings & Review Counts, Support Resolution Rates, WordPress Core Compatibility (`Requires at least` / `Tested up to`), Minimum PHP versions, and Update Freshness.
- **Automated Feature Matrix:** Multi-niche automated feature extraction with evidence citations pulled from tags, short descriptions, and full descriptions.
- **Tag Gap Analysis:** Identify high-performing category tags used by competitors that the subject plugin is missing.
- **Prioritized Opportunities:** Deterministic gap scoring categorizing actionable improvements into high, medium, and low impact.
- **Persistent Tray:** Selections persist locally across sessions via `localStorage`.

### Readme & Header Optimization Workspace

- **Browser-Based Parsing:** Upload or paste `readme.txt` and main plugin `.php` files (all parsing happens locally in the browser — no remote uploads).
- **Comprehensive Audit Rules:**
  - Standard WordPress.org header fields validation (`Contributors`, `Tags`, `Requires at least`, `Tested up to`, `Requires PHP`, `Stable tag`, `License`).
  - Version consistency checks between `readme.txt` and the main PHP file header.
  - Core compatibility freshness checks against current WordPress releases.
  - Section checks for Screenshots, FAQ, Installation, Changelog, and Upgrade Notices.
  - Evidence-gated competitor tag and keyword enhancement suggestions.
- **Interactive Diff Viewer & Export:** Inspect generated improvements in Unified or Side-by-Side diff views, with one-click copy and `.txt` file export.

### Performance, Resilience & Accessibility

- **Zero Frontend Framework Overhead:** Fast startup and rendering via native browser APIs and modular TypeScript.
- **Light & Dark Theme:** Built-in theme switcher with system preference detection and flash-free initial rendering.
- **Resilient Error Handling:** Classified error states (network timeouts, HTTP failures, malformed payloads) with in-place retry triggers and background refresh preservation.
- **Accessible Design:** Semantic HTML table structures, accessible keyboard navigation, high-contrast states, and ARIA live regions for screen readers.

---

## Important Data Methodology & Notes

1. **Lifetime Install Pace vs. Recent Growth:**
   - The **Lifetime Install Pace** metric is calculated as:
     $$\text{Lifetime Pace} = \frac{\text{Reported Active Installs}}{\text{Days since plugin was added to WordPress.org}}$$
   - This represents historical daily adoption since launch, **not** short-term daily download spikes or recent momentum.
   - **Observed Momentum** is tracked across local snapshots taken between visits.
2. **WordPress.org Active Install Rounding:**
   - Active install counts provided by the WordPress.org API are capped or bucketed (e.g., `100,000+`, `1,000,000+`, `5,000,000+`).
3. **Data Freshness & Development Proxy:**
   - During local development, requests to the WordPress.org API pass through a Vite dev server proxy that includes a 24-hour file-based cache to prevent rate-limiting.
4. **Privacy & Security:**
   - Uploaded plugin files and readme content are parsed completely client-side in browser memory and are never transmitted to external servers.

---

## Prerequisites

- [Bun](https://bun.sh/) 1.3 or later

---

## Getting Started

1. **Install dependencies:**

   ```bash
   bun install
   ```

2. **Start the development server:**

   ```bash
   bun run dev
   ```

   Open the printed local URL (typically `http://localhost:5173`) in your browser.

---

## Available Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the Vite development server with the WordPress.org API caching proxy. |
| `bun run typecheck` | Run the TypeScript compiler (`tsc --noEmit`) to verify type integrity. |
| `bun run test` | Run the unit test suite with Bun's built-in test runner. |
| `bun run build` | Type-check and build the optimized production bundle in `dist/`. |
| `bun run preview` | Locally preview the built production assets in `dist/`. |

---

## Project Structure

```text
├── .agents/                    # Agent skills and workflow configuration
├── index.html                  # Main application HTML entry point
├── package.json                # Project scripts and dependencies
├── tsconfig.json               # TypeScript compiler configuration
├── vite.config.js              # Vite configuration & WordPress.org API caching proxy
└── src/
    ├── main.ts                 # Application bootstrapping and event coordination
    ├── style.css               # Global responsive styles & design tokens
    ├── api/                    # WordPress.org API clients and query transformers
    │   ├── plugins.ts
    │   └── plugin-query.test.ts
    ├── components/             # DOM-based UI views and components
    │   ├── card-view.ts
    │   ├── comparison-section.ts
    │   ├── comparison-tray.ts
    │   ├── kpi-summary.ts
    │   ├── pagination-controls.ts
    │   ├── plugin-card.ts
    │   ├── plugin-compare.ts
    │   ├── plugin-row.ts
    │   ├── plugin-table.ts
    │   ├── readme-audit-results.ts
    │   ├── readme-diff.ts
    │   ├── readme-workspace.ts
    │   └── table-status-row.ts
    ├── domain/                 # Core domain logic, parsers, and calculations
    │   ├── error-classifier.ts
    │   ├── feature-dictionary.ts
    │   ├── feature-extractor.ts
    │   ├── php-header-parser.ts
    │   ├── plugin-comparison.ts
    │   ├── plugin-kpi.ts
    │   ├── plugin-metrics.ts
    │   ├── plugin-momentum.ts
    │   ├── plugin-normalizer.ts
    │   ├── plugin-selectors.ts
    │   ├── plugin-snapshots.ts
    │   ├── plugin-types.ts
    │   ├── readme-audit.ts
    │   ├── readme-parser.ts
    │   ├── readme-rules.ts
    │   ├── readme-types.ts
    │   ├── recommendations.ts
    │   ├── tag-intelligence.ts
    │   ├── text-edits.ts
    │   └── wordpress-versions.ts
    ├── state/                  # Centralized reactive application state
    │   └── app-state.ts
    └── utils/                  # Formatting, theme, storage, and text helpers
        ├── comparison-preference.ts
        ├── decode-html-entities.ts
        ├── results-meta.ts
        ├── theme.ts
        └── view-preference.ts
```

---

## Data Source & Disclaimer

All plugin metrics are sourced from the public [WordPress.org Plugin Information API](https://developer.wordpress.org/plugins/wordpress-org/plugin-developer-faq/#how-does-the-plugin-information-api-work).

*Disclaimer:* WP Plugin Pulse is an independent open-source project and is not affiliated with, authorized, or endorsed by WordPress.org, Automattic, or the WordPress Foundation.
