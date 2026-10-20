// How to use + Docs content, shared by the learner app (window.Help), the admin (window.Help) and the tests (require).
// Every number in a guide is a {{token}} filled from GET /api/help/numbers: nothing is typed in here. A section's
// screenshot ("shot") is taken from the real app by tools/help-screenshots.cjs into public/help/.
// Rule (HANDOFF.md): any feature change must update this file (and re-take the screenshots it names).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Help = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var LEARNER = [
    { id: "stages", title: "The five stages", shot: "concept.jpg", alt: "A concept page with its stage tabs",
      text: "The course has {{concepts}} concepts in {{levels}} levels. Each concept page walks through five stages, plus an optional Study tab:\n- **Memorize**: flashcards ({{flashcards}} in all).\n- **Understand**: the concept card and predict-the-output items ({{predicts}} in all): read a query and its input rows, pick the real result.\n- **Practise**: a set of {{set_size}} exercises from easy to hard, with one Hard.\n- **Reflect**: one sentence in your own words, saved in My notes.\n- **Transfer**: the concept on a new dataset, as a business question. It unlocks when the practise set is done.\nOpen a concept from **Levels**, or follow **Learn** to go through them in order." },
    { id: "study-learn", title: "Study and Learn", shot: "learn.jpg", alt: "The Learn page: a concept's lesson, example and quick check",
      text: "**Study** is a short lesson per concept ({{lessons}} lessons): what it is, when to use it, an example with its real result, and one thing to watch out for.\n**Learn** (in the menu) goes through all {{concepts}} concepts in course order, one step each: the lesson, its example to edit and run, then a quick check of up to two questions.\n- Each step screen keeps the example's **database schema** beside the editor (its tables first) and a guidance column: the learning goal, your progress through the three steps, the key points and a tip.\n- Run shows the real result with row numbers, or the error; **Copy** copies the query and **Back to the example** resets it.\n- **Continue** takes you back to the screen you last opened.\n- **Jump to a concept** opens any of them.\n- **Done** marks the lesson as read; it doesn't change mastery.\n- A wrong quick-check answer comes back in **Review mistakes**." },
    { id: "today", title: "The Today plan", shot: "home.jpg", alt: "Home: the Today plan",
      text: "Home shows **Today**: the next steps for your current level (new flashcards, the next concept to understand, a reflection, the practise set) and one **Challenge**.\nThe daily goal is {{daily_goal}} activities. You can change it with the arrow on the Daily Goal card. Exercises, flashcards, predictions and reflections all count; the optional cards and the Challenge don't." },
    { id: "flash-library", title: "The flashcard library", shot: "flashcard-library.jpg", alt: "The flashcard library: filters, search and cards",
      text: "**Flashcards** in the menu opens the **library**: every published flashcard ({{flashcards}} in all), a page at a time.\n- Filter by **card type** (keyword, fill in the blank, clause order, spot the error) and by **level**, or **search** the words on the cards.\n- **Sort** in course order or newest first, and choose how many cards a page shows.\n- **Open a card** (click it, or Tab to it and press Enter) to study it: the session starts with that card, then the concept's due and new cards. Picking a concept starts that concept's session.\n- **Today** on Home links straight to the cards that are due." },
    { id: "repetition", title: "Spaced repetition", shot: "flashcards.jpg", alt: "A flashcard session",
      text: "- **Flashcards** come back after {{intervals}} days. A wrong answer brings a card back tomorrow.\n- **Mistakes in exercises** (and exercises solved with a hint) come back in **Review mistakes** after {{review_days}} days. A clean solve at the last review takes one off the list; quick-check mistakes from Learn work the same way.\n- The **Flashcards** page shows only cards that are due. When nothing is due, it offers new cards from your next concept." },
    { id: "mastery", title: "Mastery and level complete", shot: "levels.jpg", alt: "The level path",
      text: "A concept outside Level {{levels}} is **mastered** when:\n- every flashcard is at the {{gap}}-day gap or more;\n- {{predicts_needed}} predict-the-output items are right;\n- the practise set is solved;\n- a reflection is written;\n- a transfer task is passed.\nA stage with nothing approved yet isn't required. In Level {{levels}} a concept needs a reflection and {{project_tasks}} project tasks. Mastery is kept once earned.\nA **level is complete** at {{mastery_pct}}% of its concepts mastered, or with every exercise done and the level quiz passed ({{quiz_pct}}% or more).\nLevel locks are off by default; switched on in Settings, a level opens once {{unlock_pct}}% of the previous one is done." },
    { id: "cards", title: "Optional cards", shot: "cards.jpg", alt: "An optional practice card",
      text: "Under **More practice** on a concept's Understand tab there are {{cards}} optional cards of {{card_types}} kinds: join mappers, comparing two queries, picking the rows a query returns, an execution timeline, a query plan, and more. Each is checked against the real result.\nThey don't count for mastery or the daily goal, and have their own schedule. Say how sure you are ({{confidence}}): an unsure right answer comes back sooner." },
    { id: "challenge", title: "The Challenge", shot: "challenge.jpg", alt: "The Challenge",
      text: "Today's **Challenge** is one question: an item that is due for review, or one from your weakest concept in the level. Answer it and say how sure you are; it is scheduled for the right day." },
    { id: "reflect-notes", title: "Reflect and My notes", shot: "notes.jpg", alt: "My notes",
      text: "After you solve or miss an exercise, a short **Reflect** box asks for one sentence; every concept page has one too. Notes are saved in **My notes**, where you can search them.\nAfter a failed check, a **Mistake reflection** card compares your result with the answer (missing or extra rows, wrong columns, order) and asks what went wrong. It is saved as a misconception note." },
    { id: "schema", title: "The schema panel", shot: "schema.jpg", alt: "An exercise with the schema panel",
      text: "The **schema panel** lists a dataset's tables, their columns and keys, and a few rows of each, so you never guess a name. It is on every exercise, next to every lesson example (Study, Learn, Docs), under flashcards with SQL and with Challenge questions. The tables the SQL uses come first and open. An example that creates its own tables has none: they are in its script." },
    { id: "playground", title: "The Playground (SQL Explorer)", shot: "sqlpad.jpg", alt: "SQL Explorer, the Playground",
      text: "**SQL Explorer** at {{sqlpad_url}} is the free playground, started with the app. Pick a course database on the left (its tables and columns are listed), write any query and run it with Ctrl+Enter, then see the result as a table or a chart.\nIts connections to the course MySQL and PostgreSQL databases are read-only, so nothing you run there changes them." },
    { id: "docs", title: "Docs", shot: "docs.jpg", alt: "The Docs page",
      text: "**Docs** is the SQL reference:\n- every concept's lesson, A-Z and searchable, with an example you can edit and run;\n- one cheat sheet per level;\n- a MySQL vs PostgreSQL vs SQLite table of differences." },
    { id: "keyboard", title: "Keyboard use",
      text: "Everything works from the keyboard; a ring shows where you are while you use it.\n- The first **Tab** reaches **Skip to content**, which jumps past the menu to the page.\n- **Ctrl+K** (or **/**) puts you in the search: the arrow keys move through the results, **Enter** opens one, **Escape** closes the list.\n- In an exercise: **Ctrl+Enter** runs your query, **Ctrl+Shift+Enter** submits it, **Ctrl+I** asks for a hint, **Alt+←** and **Alt+→** open the previous and next exercise.\n- Flashcards: **Space** shows the answer, **Y** and **N** grade it, **Enter** checks a typed answer, **Backspace** takes back the last clause.\n- On a concept page the arrow keys, **Home** and **End** move between the stage tabs.\n- On a phone, the menu button opens the menu and **Escape** closes it." },
  ];
  var ADMIN = [
    { id: "generate", title: "Generate", shot: "admin-generate.jpg", alt: "Admin: Generate",
      text: "**Generate** makes drafts with AI: SQL drills, multiple choice, **Learning stages** (flashcards, predict items, practise and transfer exercises for a level) and **From images** (screenshots of a task or a table). Each run shows a cost estimate first.\n{{generator}} writes, {{reviewer}} reviews, and real SQL runs check every draft. Nothing goes live until it is approved in the review queue." },
    { id: "create", title: "Create (by hand)", shot: "admin-create.jpg", alt: "Admin: Create",
      text: "**Create** makes any item by hand: an exercise (with accepted answers, hints and whether order matters), an MCQ ({{mcq_options}} options, why each wrong one is wrong), a predict item, a lesson, any flashcard or card type. You can also build a new dataset from pasted rows, CSV or a script.\nEvery item runs the same checks as generated ones and shows each failure; a learner preview shows it as learners will. **Publish now** or **Save as draft**. Items are marked Mine, logged in History with Undo, and can be edited later. **Bulk import** takes CSV or JSON for exercises and MCQs, with a pass / fail summary first." },
    { id: "review", title: "The review queue", shot: "admin-review.jpg", alt: "Admin: Review queue",
      text: "The **review queue** holds what waits for a decision ({{queue}} now): drafts, reference answers to check, tags, stage items.\n- A draft whose checks raised a **warning** is approved on its own card; **bulk Approve** skips it.\n- **Needs manual check** means the AI providers couldn't settle it (or the tie-breaker was unavailable): read it and decide.\n- Every decision is in **History**, with **Undo** (one change, or a whole bulk run)." },
    { id: "fill-gaps", title: "Fill gaps", shot: "admin-fillgaps.jpg", alt: "Admin: Learning stages generation",
      text: "A concept is covered with {{target_flash}} flashcards, {{target_predict}} predict items, {{target_practise}} practise and {{target_transfer}} transfer exercises (Level {{levels}} has no flashcards or practise; a few concepts have exceptions). **Fill gaps** (Generate → Learning stages) makes drafts only where a concept is below that, with a cost estimate first. Live coverage is {{coverage_pct}}%." },
    { id: "concepts", title: "Concepts and coverage", shot: "admin-concepts.jpg", alt: "Admin: Concepts",
      text: "**Concepts** lists the {{concepts}} concepts per level with what is live and what is still a draft per stage, the gaps, and the exceptions. Edit a concept's name, summary or keywords, or re-tag its exercises." },
    { id: "health", title: "Library health", shot: "admin-health.jpg", alt: "Admin: Library health",
      text: "**Library health** checks the whole library for near-duplicate pairs, solutions that fail to run, titles with leftover source text, missing one-line summaries and broken cross-links, and lists the open issues ({{health_open}} now) with a decision for each." },
    { id: "backups", title: "Backups", shot: "admin-backups.jpg", alt: "Admin: Backups",
      text: "**Backups** keeps zip copies of the database, uploaded images and datasets made from images ({{backups}} so far; the last on {{last_backup}}). Restore needs you to type RESTORE and makes a backup of the current state first. The .env file with keys is never in a backup." },
    { id: "settings", title: "AI & settings", shot: "admin-settings.jpg", alt: "Admin: AI & settings",
      text: "**AI & settings** shows which AI providers are ready, the order hints try them in, and the system status (MySQL, PostgreSQL, the datasets). Keys live only in sql-drills-server/.env." },
    { id: "models", title: "Model roles", shot: "", alt: "",
      text: "- Generator: {{generator}}.\n- Reviewer: {{reviewer}}.\n- Tie-breaker: {{tiebreaker}}.\nOne provider generates, a different one reviews (never the generator reviewing itself), and real SQL decides. Learner hints use {{hint_model}}." },
    { id: "spend", title: "The AI spend log", shot: "admin-overview.jpg", alt: "Admin: Overview with the AI spend",
      text: "Every AI call is logged with its provider, model, tokens and cost. The Overview's AI generation card shows the total ({{spend_total}} over {{spend_calls}} calls since the log began) and the cost per model." },
    { id: "keyboard", title: "Keyboard use",
      text: "The admin works from the keyboard too:\n- The first **Tab** reaches **Skip to content**; **Ctrl+K** puts you in the search (the arrow keys move through the results, **Enter** opens one, **Escape** closes the list).\n- In the **review queue**: **J** and **K** go to the next and previous item, **S** skips; on a reference answer the number keys tick A, B or C, **Shift+A** uses all of them, **Enter** saves and **U** leaves it unchecked; on a draft **Y** approves and **R** rejects.\n- Dialogs (confirmations, the editor, imports) take the focus, close with **Escape** and give the focus back." },
  ];
  // MySQL 8 · PostgreSQL · SQLite (the engines the course uses): the differences learners meet most
  var DIFFS = [
    ["Join two strings", "CONCAT(a, b)", "a || b (or CONCAT)", "a || b"],
    ["First N rows", "LIMIT n OFFSET m", "LIMIT n OFFSET m, or FETCH FIRST n ROWS ONLY", "LIMIT n OFFSET m"],
    ["Auto-numbered key", "INT AUTO_INCREMENT PRIMARY KEY", "GENERATED ALWAYS AS IDENTITY (or SERIAL)", "INTEGER PRIMARY KEY"],
    ["True / false", "BOOLEAN is TINYINT(1): 1 and 0", "real BOOLEAN: true and false", "no type: 1 and 0"],
    ["Current date and time", "NOW(), CURDATE()", "NOW(), CURRENT_DATE", "datetime('now'), date('now')"],
    ["Days between two dates", "DATEDIFF(d2, d1)", "d2 - d1 (dates)", "julianday(d2) - julianday(d1)"],
    ["Insert or update", "INSERT … ON DUPLICATE KEY UPDATE", "INSERT … ON CONFLICT (key) DO UPDATE", "INSERT … ON CONFLICT (key) DO UPDATE"],
    ["FULL OUTER JOIN", "not supported: LEFT JOIN UNION RIGHT JOIN", "supported", "supported (3.39 and later)"],
    ["INTERSECT / EXCEPT", "8.0.31 and later", "supported", "supported"],
    ["Text match ignoring case", "LIKE ignores case (default collation)", "LIKE is case-sensitive; ILIKE ignores case", "LIKE ignores case for A-Z"],
    ["Quoting a name", "`backticks`", "\"double quotes\"", "\"double quotes\" (backticks too)"],
    ["5 / 2 with whole numbers", "2.5000", "2 (whole-number division)", "2 (whole-number division)"],
    ["Column types", "strict: a value must fit the type", "strict", "flexible: any value in any column"],
    ["Join a group's values", "GROUP_CONCAT(x SEPARATOR ', ')", "STRING_AGG(x, ', ')", "group_concat(x, ', ')"],
    ["NULL fallback", "IFNULL(x, y), COALESCE", "COALESCE(x, y)", "IFNULL(x, y), COALESCE"],
    ["Rows back from a change", "no RETURNING", "INSERT/UPDATE/DELETE … RETURNING", "RETURNING (3.35 and later)"],
    ["Stored procedures", "CREATE PROCEDURE, CALL", "CREATE PROCEDURE / FUNCTION", "none"],
    ["Window functions, WITH RECURSIVE", "8.0 and later", "supported", "supported (3.25 and later)"],
  ];
  // the "?" link: which section each page opens (learner routes, admin routes)
  var ROUTE_HELP = {
    learner: { home: "today", learn: "study-learn", concept: "stages", flashcards: "flash-library", review: "repetition", notes: "reflect-notes", challenge: "challenge", docs: "docs", levels: "mastery", level: "mastery", drill: "schema", progress: "mastery", help: "stages" },
    admin: { overview: "spend", generate: "generate", create: "create", review: "review", concepts: "concepts", health: "health", backups: "backups", settings: "settings", library: "review", mcqs: "create", help: "generate" },
  };
  var TOKEN = /\{\{(\w+)\}\}/g;
  function tokens() { var out = {}; LEARNER.concat(ADMIN).forEach(function (s) { (s.text.match(TOKEN) || []).forEach(function (t) { out[t.slice(2, -2)] = 1; }); }); return Object.keys(out); }
  var escH = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  /** A section's text as HTML: {{numbers}} from the API, **bold**, `code`, lines starting "- " as a list. */
  function textHtml(text, nums) {
    var filled = String(text).replace(TOKEN, function (_, k) { var v = nums && nums[k]; return v == null || v === "" ? "—" : typeof v === "number" ? v.toLocaleString("en-US") : String(v); });
    var html = "", list = false;
    filled.split("\n").forEach(function (line) {
      var inline = escH(line.replace(/^- /, "")).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
      if (/^- /.test(line)) { if (!list) { html += "<ul>"; list = true; } html += "<li>" + inline + "</li>"; }
      else { if (list) { html += "</ul>"; list = false; } if (line.trim()) html += "<p>" + inline + "</p>"; }
    });
    return html + (list ? "</ul>" : "");
  }
  return { LEARNER: LEARNER, ADMIN: ADMIN, DIFFS: DIFFS, ROUTE_HELP: ROUTE_HELP, tokens: tokens, textHtml: textHtml };
});
