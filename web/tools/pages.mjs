// The main pages of both apps for the Chrome checks (axe-pages.mjs, check-pages.mjs), with real ids from the server
// they run against. Every route of both apps appears at least once.
export async function mainPages(BASE) {
  const get = async (u) => (await fetch(BASE + u)).json();
  const lib = await get("/api/library"), items = lib.items || lib, mcqs = await get("/api/mcqs");
  const pick = (f) => (items.find(f) || {}).id;
  const mcq = mcqs.find((m) => m.status !== "hidden") || mcqs[0];
  return [
    "/#/home", "/#/levels", "/#/level/1", "/#/level/14?section=capstone", "/#/drills", "/#/drill/" + pick((d) => d.engine !== "server" && d.check === "solution"),
    "/#/drill/" + pick((d) => d.check === "self"), "/#/drill/" + pick((d) => d.engine === "server"), "/#/mcqs", "/#/mcq/" + (mcq.id || mcq.key), "/#/quiz/mixed", "/#/recent",
    "/#/interview", "/#/bookmarks", "/#/review", "/#/progress", "/#/concept/choosing-columns", "/#/concept/choosing-columns?tab=understand", "/#/learn",
    "/#/learn/choosing-columns?s=2", "/#/learn/choosing-columns?s=3", "/#/docs", "/#/docs?t=sheets&l=2", "/#/help", "/#/flashcards", "/#/flashcards?concept=choosing-columns",
    "/#/notes", "/#/licenses", "/#/challenge?level=1", "/#/guide", "/#/guide/commands", "/#/preview",
    "/admin#/overview", "/admin#/generate", "/admin#/generate?kind=stage&level=1", "/admin#/generate?kind=images", "/admin#/create", "/admin#/create?tab=import", "/admin#/review",
    "/admin#/review?view=history", "/admin#/library", "/admin#/item/" + pick((d) => d.check === "solution"), "/admin#/concepts", "/admin#/mcqs", "/admin#/drills", "/admin#/recent",
    "/admin#/health", "/admin#/health?check=near_dups", "/admin#/learners", "/admin#/backups", "/admin#/settings", "/admin#/help",
  ];
}
