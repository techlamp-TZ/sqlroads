// Parses one 30-day-course exercise file (the standard layout described in
// "00 Start Here/06 - How an exercise file works"): header, context line, numbered
// sections 0-10, and the -- >>> EXAMPLE / SOLUTION / CLEANUP code blocks.

const BANNER = /\/\* -{20,}\r?\n\s+(\d+b?)\. ([^\n]+?)\s*\r?\n\s+-{20,} \*\/\r?\n/g;

/** Text of all /* ... *\/ comment blocks in a chunk, dedented (the course indents by 3 spaces). */
function commentText(chunk) {
  const parts = [];
  for (const m of chunk.matchAll(/\/\*([\s\S]*?)\*\//g)) {
    if (/^\s*=+/.test(m[1]) || /SOLUTION BELOW/.test(m[1])) continue;
    parts.push(dedent(m[1]));
  }
  return parts.join("\n\n").trim();
}

function dedent(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(Number.isFinite(indent) ? indent : 0)).join("\n");
}

/** Code between "-- >>> NAME" and "-- <<< END OF NAME", with the leading "-- " removed. */
function codeBlock(chunk, name) {
  const m = new RegExp(`-- >>> ${name}\\r?\\n([\\s\\S]*?)-- <<< END OF ${name}`).exec(chunk);
  if (!m) return "";
  return m[1]
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => (l.startsWith("-- ") ? l.slice(3) : l.replace(/^--$/, "")))
    .join("\n")
    .trim();
}

function parseExercise(text) {
  const t = text.replace(/\r\n/g, "\n");
  const header = (/^\/\* =+\n([\s\S]*?)=+ \*\//.exec(t) || [])[1] || "";
  const idLine = /^\s+(D\d+-[CP]\d+)\s+(.+)$/m.exec(header);
  const meta = /Day (\d+)\s+\|\s+Level: ([^|\n]+?)\s+\|\s+About (\d+) minutes/.exec(header);
  const kindLine = ((/This exercise \.+ ([^\n]+(?:\n {18}[^\n]+)*)/.exec(header) || [])[1] || "").replace(/\s+/g, " ");
  const mode = /only READS/i.test(kindLine)
    ? "read"
    : /CHANGES data/i.test(kindLine)
    ? "change"
    : /FAILS ON PURPOSE/i.test(kindLine)
    ? "fail"
    : /python/i.test(kindLine)
    ? "python"
    : "other";
  const context = (/^(USE \w+;|SET search_path TO [\w, ]+;)/m.exec(t) || [])[1] || "";

  const sections = {};
  const marks = [...t.matchAll(BANNER)];
  marks.forEach((m, i) => {
    const start = m.index + m[0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index : t.length;
    sections[m[1]] = { title: m[2], body: t.slice(start, end) };
  });
  const sec = (n) => (sections[n] ? sections[n].body : "");

  const s5 = sec("5");
  const [questionPart, answerPart = ""] = s5.split(/-- YOUR ANSWER[^\n]*\n/);
  const starter = answerPart.trim();

  const hintsText = commentText(sec("6"));
  const hints = [1, 2, 3].map((n) => {
    const m = new RegExp(`Hint ${n}:\\s*([\\s\\S]*?)(?=\\n\\s*Hint ${n + 1}:|$)`).exec(hintsText);
    return m ? dedent(" ".repeat(9) + m[1]).trim() : "";
  });

  const expected = commentText(sec("9"));
  const errMatch = /FAILS ON PURPOSE with (?:MySQL|PostgreSQL) error ([0-9A-Z]+)/.exec(expected);
  const ordered = /order matters/i.test(expected) ? 1 : /order does not matter/i.test(expected) ? 0 : null;

  return {
    code: idLine ? idLine[1] : null,
    title: idLine ? idLine[2].trim() : null,
    day: meta ? Number(meta[1]) : null,
    level: meta ? meta[2] : null,
    minutes: meta ? Number(meta[3]) : null,
    mode,
    modeNote: kindLine,
    context,
    setupSql: sections["0"] ? codeBlock(sec("0"), "SETUP") || sec("0").replace(/\/\*[\s\S]*?\*\//g, "").trim() : "",
    objective: commentText(sec("1")),
    idea: commentText(sec("2")),
    tablesText: commentText(sec("3")),
    exampleIntro: commentText((/^([\s\S]*?)-- >>> EXAMPLE/.exec(sec("4")) || [])[1] || ""),
    exampleSql: codeBlock(sec("4"), "EXAMPLE"),
    exampleOutput: commentText((/-- <<< END OF EXAMPLE([\s\S]*)$/.exec(sec("4")) || [])[1] || ""),
    question: commentText(questionPart),
    starter,
    hints,
    solutionSql: codeBlock(sec("7"), "SOLUTION"),
    why: commentText(sec("8")),
    expectedText: expected,
    expectedError: errMatch ? errMatch[1] : null,
    ordered,
    cleanupSql: codeBlock(sec("9b"), "CLEANUP"),
    afterText: commentText(sec("10")),
    standard: !!(sections["5"] && sections["7"] && sections["9"] && /-- >>> SOLUTION/.test(t)),
  };
}

module.exports = { parseExercise };
