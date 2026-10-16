// One-sentence summaries (at most ~110 characters, never cut off with "…") for the exercise
// lists. Built from the first instruction sentence of the prompt, shortened by dropping
// asides (parentheses, "using …" tails) and the "Write a query that …" lead-in. Prompts that
// can't be shortened that way get a hand-written summary in text-fixes.js.
const MAX = 110;
const ABBR = /\b(i\.e|e\.g|etc|vs|approx|incl|cf|no|min|max|avg|approx|resp)\.$/i;
const VERB = { shows: "show", lists: "list", returns: "return", finds: "find", counts: "count", selects: "select", displays: "display", gives: "give", calculates: "calculate", computes: "compute", groups: "group", adds: "add", removes: "remove", deletes: "delete", updates: "update", inserts: "insert", creates: "create", joins: "join", ranks: "rank", compares: "compare", uses: "use", gets: "get", retrieves: "retrieve", produces: "produce", reports: "report", copies: "copy", changes: "change", sets: "set", fetches: "fetch", outputs: "output", prints: "print", builds: "build" };

/** The prompt's prose: code lines and links removed, one line. */
function prose(body) {
  return String(body || "").replace(/\[\[ref:[^|]+\|([^\]]+)\]\]/g, "“$1”").split("\n")
    .filter((l) => l.trim() && !/^\s{3,}\S/.test(l) && !/^\s*(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|ORDER BY|GROUP BY|JOIN|LIMIT|VALUES)\b/.test(l))
    .join(" ").replace(/\s+/g, " ").trim();
}

/** Sentences, not split after "i.e." / "e.g." or inside numbers. */
function sentences(text) {
  // also after "…found with:" when the code that followed was removed ("with: Modify it …")
  const parts = text.split(/(?<=[.?!])\s+(?=[A-Z("'“`0-9])|(?<=:)\s+(?=[A-Z][a-z]+\s+[a-z])/);
  const out = [];
  for (const p of parts) {
    if (out.length && (ABBR.test(out[out.length - 1]) || unbalanced(out[out.length - 1]) || /\.\.\.$/.test(out[out.length - 1]))) out[out.length - 1] += " " + p;
    else out.push(p);
  }
  return out.map((s) => s.trim()).filter(Boolean);
}
const unbalanced = (s) => (s.match(/\(/g) || []).length > (s.match(/\)/g) || []).length;

// sentences that only introduce code or are notes, not the task
const LEAD_IN = /:\s*$|^\(?\s*(just run it|read the notes|note:|hint:|tip:)|^EXAM CONDITIONS|^Metric contract/i;

function finish(s) {
  s = s.replace(/\s+([,.;:?!])/g, "$1").replace(/[\s,;:–-]+$/, "").trim();
  if (!/[.?!]$/.test(s)) s += ".";
  // a sentence may start with a table or column name (stg_orders_raw): keep its case
  return /^[a-z]+_\w*/.test(s) ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

// a usable summary: a real sentence, not a column list, a fragment or a dangling "rule: ="
function readable(s, max = MAX) {
  if (!s || s.length > max || s.length < 12) return false;
  if (/^\(/.test(s)) return false; // an aside, not the task
  if (/^[a-z]/.test(s) && !/^[a-z]+_\w*/.test(s)) return false;
  if (/[:=(]\s*\.?$|\s=\s*\.$|,\s*\.$/.test(s)) return false;
  const words = s.replace(/[.?!]$/, "").split(/[\s,]+/).filter(Boolean);
  const ids = words.filter((w) => /^[a-z]+_[a-z0-9_]+$/i.test(w)).length;
  return words.length >= 3 && ids / words.length <= 0.5;
}
const ok = (t, max) => (readable(finish(t), max) ? finish(t) : null);

function shorten(s, max = MAX) {
  if (s.length <= max) return ok(s, max);
  // 1. asides in parentheses
  let t = s;
  // ...but not one that is the noun of the sentence ("why (pet_id, vet_id) alone")
  const FUNC = /^(why|the|a|an|of|on|in|with|from|and|or|by|to|as|is|are|be|whether|than)$/i;
  for (let k = 0; k < 3; k++) t = t.replace(/(\S+)?\s*\([^()]*\)/g, (m, w) => (w && FUNC.test(w) ? m : w || ""));
  if (finish(t).length <= max) return ok(t, max);
  // 2. "Write a query that shows …" -> "Show …"; "In your own words, explain …" -> "Explain …"
  t = t.replace(/^in your own words,?\s*/i, "")
    .replace(/^(write|create|give)\s+(a|an|one|the)\s+(single\s+)?(sql\s+)?(query|statement|select)\s+(that|which|to)\s+(would\s+)?(\w+)/i, (m, a, b, c, d, e, f, g, verb) => VERB[verb.toLowerCase()] || verb)
    .replace(/^using\s+[^,]{1,40},\s*/i, "");
  if (finish(t).length <= max) return ok(t, max);
  // 3. drop trailing clauses ("…, using X", "… - so that Y", "…; then Z") while the rest still reads as a task
  const tail = /(\s+[-–—]\s+|;\s+|,\s+(?:using|so|which|where|then|and then|but|even though|because|since|without|with|including|for example|e\.g\.|i\.e\.|ordered|sorted|rounded|showing|both|each|plus|as well as|keeping|not|if|when|labelled|named|called)\b)[^,;–—]*$/i;
  for (let k = 0; k < 4 && finish(t).length > max; k++) {
    const m = t.match(tail);
    if (!m || m.index < 30) break;
    t = t.slice(0, m.index);
  }
  return ok(t, max);
}

/** { summary, how } - how: "first" (first sentence as is), "short" (shortened), "none" (needs a hand-written one) */
const TASK_VERB = /^(Show|List|Find|Return|Write|Create|Count|Add|Make|Compute|Calculate|Rank|Use|Insert|Update|Delete|Drop|Explain|Describe|Build|Compare|Rewrite|Give|Select|Report|Load|Run|Prove|Get|Number|Classify|Put|Design|Fix|Check|Grant|Revoke|Join|Combine|Mark|Record|Set|Change|Remove|Keep|Turn|Split|Store|Name|Measure|Detect|Flag|Repair|Inject|Log|Summari[sz]e|Test|Read|Order|Sort|Filter|Pick|Choose|Decide|Answer|Try|Obtain|Display|Produce|Identify|Convert|Extract|Rename|Truncate|Alter|Index|Validate|Verify|Simulate|Generate|Replace|Restore|Backfill|Merge|Upsert|Lock|Open|Raise|Lower|Assign|Apply|Mask|Suppress|Profile|Clean|Standardi[sz]e|Parse|Format|Group|Pivot|Unpivot|Archive|Copy|Move|Track|Fill|Flatten|Expand|In one sentence)\b/;

function summarize(title, body, avoid) {
  const ss = sentences(prose(body)).filter((s) => !LEAD_IN.test(s) && !/^[\s(]*just run/i.test(s));
  if (!ss.length) return { summary: "", how: "empty" };
  // the first real sentence (headings like "Part F." or "Inactive products." are skipped)
  // ...preferring the task (an instruction or a question) over a context sentence like
  // "Stock starts at 10." that some prompts open with
  const real = ss.filter((x) => x.split(/\s+/).length >= 4).slice(0, 4);
  const task = (x) => TASK_VERB.test(x) || /\?$/.test(x);
  const candidates = real.filter(task).concat(real.filter((x) => !task(x))).slice(0, 3);
  const first = candidates[0] || ss[0];
  // a prompt that just repeats the title adds nothing
  const same = (a, b) => a.toLowerCase().replace(/[^a-z0-9]+/g, "") === b.toLowerCase().replace(/[^a-z0-9]+/g, "");
  let s = null;
  for (const x of candidates) if ((s = shorten(x)) && !(avoid && avoid.has(s))) break; else s = null;
  if (!s) return { summary: "", how: "none", first };
  if (same(s, title)) return { summary: "", how: "same" };
  return { summary: s, how: s === finish(first) ? "first" : "short" };
}

/** A short title (<= 80 characters, no full stop) from a question sentence, or null. */
function shortTitle(sentence) {
  const s = sentences(String(sentence || "").replace(/\[\[ref:[^|]+\|([^\]]+)\]\]/g, "an earlier exercise").replace(/\s+/g, " ").trim())[0] || "";
  const base = s.replace(/:\s*$/, ".");
  const t = shorten(base, 80) || shorten(base, MAX);
  return t ? t.replace(/\.$/, "") : null;
}

/**
 * Drill questions whose first line is the start of a sentence that wraps onto the next lines
 * ("N) Write a statement that returns only the department_name column\n   from the departments
 * table."). Returns { prompt, rest } with the whole first paragraph re-joined, or null when the
 * first line is a heading ("N) LEFT JOIN").
 */
function unwrap(title, body) {
  const lines = String(body || "").split("\n");
  const first = (lines[0] || "").trim();
  const wrapped = !/[.?!]$/.test(title) && /^[a-z(“"'0-9]/.test(first);
  const whole = /[.?!]$/.test(title);
  if (!wrapped && !whole) return null;
  const para = [title];
  let k = 0;
  if (wrapped) {
    while (k < lines.length && lines[k].trim() && !/^\s{3,}\S/.test(lines[k])) {
      para.push(lines[k].trim());
      k++;
      if (/[.?!:]$/.test(lines[k - 1].trim())) break;
    }
  }
  return { prompt: para.join(" ").replace(/\s+/g, " ").trim(), rest: lines.slice(k).join("\n").replace(/^\n+/, "") };
}

module.exports = { summarize, prose, sentences, shortTitle, unwrap, MAX };
