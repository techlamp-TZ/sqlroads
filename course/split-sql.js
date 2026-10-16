// Copy of sqlpad-master/sqlpad-master/server/lib/split-sql.js (CommonJS). Keep the two in sync.
/**
 * Splits a SQL script into statements for MySQL, PostgreSQL, SQLite and similar engines.
 *
 * Replaces sql-limiter's getStatements(), which mis-splits common course SQL:
 * "BEGIN; CREATE ..." transactions, PostgreSQL $$ function bodies, "DROP PROCEDURE ...;"
 * followed by "CREATE PROCEDURE ... BEGIN ... END", and CASE ... END expressions.
 *
 * Rules: split on ";" outside quotes, comments and $tag$ bodies. Block keywords
 * (BEGIN, IF, CASE, LOOP, WHILE, REPEAT ... END) only nest inside CREATE PROCEDURE /
 * FUNCTION / TRIGGER / EVENT statements; elsewhere "BEGIN;" or "CASE ... END" are just words.
 * Returned statements have no trailing ";"; statements that are only comments are dropped.
 */

const ROUTINE_START =
  /^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*CREATE\s+(?:OR\s+REPLACE\s+)?(?:DEFINER\s*=\s*\S+\s+)?(?:AGGREGATE\s+)?(?:PROCEDURE|FUNCTION|TRIGGER|EVENT)\b/i;
const OPENERS = new Set(['BEGIN', 'CASE', 'IF', 'LOOP', 'WHILE', 'REPEAT']);
const CLOSER_SUFFIX = new Set(['IF', 'CASE', 'LOOP', 'WHILE', 'REPEAT']);
const isWordChar = (c) => /[A-Za-z0-9_$]/.test(c || '');

function onlyComments(s) {
  return !s.replace(/--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\//g, '').trim();
}

function nextWord(text, from) {
  const m = /^\s*([A-Za-z_]+|\(|;)/.exec(text.slice(from, from + 64));
  return m ? m[1].toUpperCase() : '';
}

/** Next few words/brackets after `from`, upper-cased: e.g. ["NOT", "EXISTS", "("]. */
function nextWords(text, from, count) {
  const out = [];
  const re = /\s*([A-Za-z_]+|\(|;)/y;
  re.lastIndex = from;
  for (let k = 0; k < count; k++) {
    const m = re.exec(text);
    if (!m) break;
    out.push(m[1].toUpperCase());
  }
  return out;
}

/**
 * DDL's "IF [NOT] EXISTS name" is not a block. Control flow's "IF EXISTS (SELECT ...) THEN",
 * "IF NOT EXISTS (...)", "IF NOT (a <=> b) THEN" are, so they must open one.
 */
function isDdlIfExists(text, from) {
  const [w1, w2, w3] = nextWords(text, from, 3);
  if (w1 === 'EXISTS') return w2 !== '(';
  if (w1 === 'NOT' && w2 === 'EXISTS') return w3 !== '(';
  return false;
}

function splitSql(text) {
  const statements = [];
  const n = text.length;
  let start = 0;
  let depth = 0;
  let routine = ROUTINE_START.test(text.slice(0, 600));

  const push = (end) => {
    const s = text.slice(start, end);
    if (!onlyComments(s)) statements.push(s.trim());
  };

  let i = 0;
  while (i < n) {
    const c = text[i];
    const c2 = text[i + 1];

    if (c === '-' && c2 === '-') {
      const nl = text.indexOf('\n', i);
      i = nl < 0 ? n : nl + 1;
      continue;
    }
    if (c === '/' && c2 === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? n : end + 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < n) {
        if (text[j] === '\\' && c !== '`') {
          j += 2;
          continue;
        }
        if (text[j] === c) {
          if (text[j + 1] === c) {
            j += 2; // doubled quote inside the literal
            continue;
          }
          break;
        }
        j++;
      }
      i = j + 1;
      continue;
    }
    if (c === '$' && !isWordChar(text[i - 1])) {
      const tag = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(text.slice(i, i + 64));
      if (tag) {
        const end = text.indexOf(tag[0], i + tag[0].length);
        i = end < 0 ? n : end + tag[0].length;
        continue;
      }
    }
    if (c === ';' && depth === 0) {
      push(i);
      start = i + 1;
      routine = ROUTINE_START.test(text.slice(start, start + 600));
      i++;
      continue;
    }
    if (routine && /[A-Za-z_]/.test(c) && !isWordChar(text[i - 1])) {
      let j = i;
      while (j < n && isWordChar(text[j])) j++;
      const word = text.slice(i, j).toUpperCase();
      if (word === 'END') {
        depth = Math.max(0, depth - 1);
        const after = nextWord(text, j);
        if (CLOSER_SUFFIX.has(after)) {
          j = text.toUpperCase().indexOf(after, j) + after.length; // "END IF", "END LOOP", ...
        }
      } else if (OPENERS.has(word)) {
        const after = nextWord(text, j);
        const isFunctionCall = after === '(' && (word === 'IF' || word === 'REPEAT');
        const isIfExists = word === 'IF' && isDdlIfExists(text, j);
        const isTransaction = word === 'BEGIN' && (after === ';' || after === 'WORK' || after === 'TRANSACTION');
        if (!isFunctionCall && !isIfExists && !isTransaction) depth++;
      }
      i = j;
      continue;
    }
    i++;
  }
  push(n);
  return statements;
}

module.exports = { splitSql };
