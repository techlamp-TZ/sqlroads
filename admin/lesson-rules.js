// Lessons (the Study step), rules that need no database: no source names, and no run of 10 words copied from
// the reference notes.
const SOURCE_NAME = /curious|shemmee|sql[\s-]*101|telegram|instagram|github|youtube|w3schools|tutorialspoint|geeksforgeeks|https?:\/\/|www\.|(?<![\w.])@[a-z_.]{3,}/i; // a handle, not the @ inside an e-mail address in sample data
const words = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9_*()=<>']+/g, " ").trim().split(/\s+/).filter(Boolean);
/** The first run of `n` words the text shares with the notes, or null. */
function copiedRun(text, notes, n = 10) {
  const nw = words(notes); if (nw.length < n) return null;
  const grams = new Set(); for (let i = 0; i + n <= nw.length; i++) grams.add(nw.slice(i, i + n).join(" "));
  const tw = words(text); for (let i = 0; i + n <= tw.length; i++) { const g = tw.slice(i, i + n).join(" "); if (grams.has(g)) return g; }
  return null;
}

module.exports = { SOURCE_NAME, copiedRun };
