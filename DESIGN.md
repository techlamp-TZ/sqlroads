# SQL Drills front end: design and build

Both apps (the learner app, `public/index.html`, and the admin, `public/admin.html`) run on one front end in
`web/`: React 19, Sass, and a copy of the Waffles design system (MIT; see `LICENSE-waffles.txt`) updated to current
React. The build output is committed in `public/app/`, so the server only serves static files: no build tool is
needed to run the app.

## How a page is drawn

- **Shell and router.** Each app keeps its shell (sidebar, top bar, search, settings) and its hash router from the
  original front end. That code now lives in `web/src/legacy/app.js` and `web/src/legacy/admin.js` and is part of
  the bundle; nothing of it is left in `public/`.
- **React owns every route.** `web/src/bridge.jsx` lists the pages per app (`PAGES.learner`, `PAGES.admin`). On
  every route change the router calls `SQLDrillsReact.unmount()` and then `mount(name, #view, { app, route, icon })`.
  A page renders synchronously (`flushSync`) into a `.wf-root` box inside `#view`.
- **Rebuilt pages** (React and Waffles components, styles on the tokens). Learner: Home with the Today plan, Learn
  (path and the three-column workspace), the concept page, the exercise page, Flashcards (library and session),
  My notes, Challenge, Docs, How to use, Licenses. Admin: Overview, Create, Concepts, Library health, AI & settings,
  Backups, How to use. Each was checked against the old page in Chrome: same text, same API calls and request
  bodies, same keys, focus and stored keys (scripts in the Phase 4 reports).
- **Hosted pages** (not rebuilt yet). The old view draws the page into a box React gives it (`hostView` in each app;
  `web/src/pages/hosted/hosted.jsx`). The box is a `.wf-host`, not a `.wf-root`, so the page looks and works exactly
  as before. Learner: levels, a level, all exercises, MCQs, an MCQ, quiz, recently added, interview, bookmarks,
  review mistakes, progress, SQL guide, preview. Admin: review queue, generate (all three kinds), library, an item,
  MCQ bank, drills, recently added, learners. These are the next to rebuild, one page at a time.
- **Shared pieces.** The old app's building blocks stay one copy each and are used by React pages through
  `window.SQLDrillsShared` (learner) and `window.SQLDrillsAdmin` (admin): the lesson card, the SQL workspace and its
  runner, the schema and tables panels, result tables and the result diff (`.rdiff`), predict / MCQ / interaction
  cards (with the `markStarted` refresh guard), spot-the-error, the exercise engine (`drillEditorHtml`,
  `drillWire`), the stage panels, `askConfirm` / `confirmClick` on `<dialog id="confirmDlg">` (OK is
  `[data-confirm=ok]`), the stale-page guard (409 and the "New version" banner), toasts, nav badges. React renders
  them through `LegacyHtml` (`web/src/shared/shared.jsx`), so their delegated handlers keep working. Page-level
  controls in React use their own attributes, never the `data-*` names the old page handlers listen for.
  `public/cards.js`, `public/compare.js` and `public/help.js` stay classic scripts: the server and the tests use
  them too.
- **Events from the old code to React pages:** `sqldrills:booted`, `sqldrills:react-ready`, `sqldrills:learn-changed`
  (a Learn step or quick-check answer), `sqldrills:challenge-done`, `sqldrills:concept-render` (a background refresh
  of the concept page).

## Tokens

- One source: `web/tokens/waffles/` (the Waffles token files, unchanged; no font) and `web/tokens/sqldrills.json`
  (IBM Plex Sans / Mono, the light and dark theme roles: bg, surface, surface-raised, border, border-strong, text,
  text-muted, accent, accent-text, on-accent, ok / bad / warn and their text colours, focus, code-bg, and a text
  variant per colour family).
- `npm run tokens` (also part of `npm run build`) writes `web/src/tokens/`: `tokens.css` (custom properties
  `--wf-*` on `:root` and `:root[data-theme="dark"]`), `_tokens.scss` (`$wf-*`, plus `wf-up` / `wf-below`
  breakpoint mixins), `tokens.js`, `tokens.json`; and the Waffles token modules in `web/src/waffles/tokens/`
  (every colour is a `var(--wf-w-*)`, so Waffles components follow the theme).
- Spacing 2–128, radii 4 and 8, four navy-tinted shadows, type scale on a 16 px base, breakpoints 480, 768, 992,
  1200, 1366, 1680. Every text colour reaches 4.5:1 in both themes.
- Rule: no hard-coded colour in `web/src` (a test fails). The only exception is `web/src/legacy/`, the old styles
  and code moved as they were; moving them onto the tokens is part of rebuilding the hosted pages.

## Components

- `web/src/waffles/react/<package>/`: button, card, form-elements, markdown, modals (native `<dialog>`),
  positioner, resizable-elements, text, toast, tooltip, utils, and `icons` (generated from `web/icons/`). Import as
  `@waffles/<package>`. `web/src/waffles/stylesheets/`: the Waffles SCSS (table, tabs, progress bar, pagination,
  dropdown, flash banner, count indicator, icon, core) on `@use`.
- Our own, in `web/src/shared/`: `LinkTabs` (Waffles minimal tabs as links; the bold label width is reserved),
  `Loader` (a neutral ring; Waffles' only spinner was its logo), `OldIcon` (the app's own icon set), `ConfirmButton`,
  `WhenBooted`, the `LegacyHtml` wrappers, and `page.scss` (page frame with the rail, hero, prose, tables, chips).
  Admin pages use `web/src/admin/admin.jsx` (`useAdmin`, `AdminPage`, `Panel`, `.wf-control` fields: Waffles' form
  look for native controls Waffles has no prop for: datalist, option groups, spellcheck, file).
- Changes made to Waffles: React 19 (no `defaultProps` / `propTypes`), native `<dialog>` modals, react-toastify 11,
  react-markdown 10, colours from the tokens, keyboard-only focus rings, Button labels shown as written (no
  `capitalize`), Badge text colour per theme. `git diff 773ba43 -- web/src/waffles` shows every change.
- Never copy DataCamp or Waffles logos, the Studio Feixen font or brand imagery, and never show their names in either
  app (a test checks the built files).

## Build and run

From `sql-drills-server/` (install once: `npm install` in `web/`; those packages are dev-only):

| Command | What it does |
|---|---|
| `npm run build` | tokens → Vite → `web/tools/inject.mjs`. Two entries: `src/main.jsx` (learner) and `src/admin-main.jsx` (admin); the old stylesheets (`src/legacy/app.css`, `admin.css`) are CSS entries written into each page first, in the old order. Output in `public/app/` (hashed names), written into the pages between `<!-- waffles:start -->` and `<!-- waffles:end -->`. |
| `npm run dev` | watch build + a server on :4100; refuses unless the folder is a test copy (`.sqldrills-copy` marker) with `SQLDRILLS_DB` pointing at a database copy. |
| `npm start` | the app on :4000 and SQLPad on :3010 (unchanged). |

After a build, commit `public/app/` and the two HTML files together with the source change.

## Catalog (Storybook)

In `web/`: `npm run storybook` (dev server on :6006) or `npm run build-storybook` (into `web/storybook-static/`,
ignored by git and never copied into `public/`). Every component, variant, size and state, in light and dark; the
"Shared pieces" stories boot the real old app from `src/legacy/` with `/api` forwarded to a test copy on :4100
(`node tools/serve-catalog.mjs`, which refuses :4000). Checks on the built catalog: `node tools/axe-stories.mjs
--widths 1366,390` (axe on every story, both themes), `node tools/check-catalog.mjs` (tabs don't shift,
keyboard-only focus, `#confirmDlg`), `node tools/check-shared.mjs` (old vs new shared pieces).

## Tests

- `node --test test/*.test.js` (server, card engine, How to use, tokens and build, shared pieces): 92 tests.
- `npm run test:web` (Vitest + Testing Library + axe-core in jsdom): the components and every rebuilt page.
- `npm run audit:contrast`: every token text / background pair, both themes.
- `npm run audit:pages` (`web/tools/axe-pages.mjs`): axe in real Chrome on every page of both apps, light and dark,
  1366 and 390 px, against a server on a database copy (never :4000). Expected result: no violations.
- Browser tests write learner rows (progress, attempts, notes, flashcard grades): run them on a copy only and leave
  nothing behind.

## Accessibility rules kept in every page

Light and dark mode; 4.5:1 text contrast; keyboard access to everything with the ring on keyboard focus only;
headings in order with one h1; unique landmark names; a skip link that moves focus (the hash holds the route, so it
never changes the address); combobox semantics for both searches; dialogs that take focus, close on Escape and give
focus back; tables and code that scroll sideways can be focused; no horizontal page scroll at 390 px.
