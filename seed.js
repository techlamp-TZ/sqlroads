// Walks the SQL PRACS tutorial-site folders on disk and loads them into data.sqlite.
// Mirrors the folder walk in sql-practice-app/build_data.py so the two stay equivalent;
// re-run any time after editing quiz.txt/.sql files to refresh the database from disk.
const fs = require("node:fs");
const path = require("node:path");
const db = require("./db.js");

const ROOT = path.join(__dirname, "..");

const SITE_META = {
  "SQL ZOO": { id: "sqlzoo", name: "SQL Zoo" },
  "SQLTUTORIAL.ORG": { id: "sqltutorialorg", name: "SQLTutorial.org" },
  "TPOINT TECH": { id: "tpointtech", name: "Tpoint Tech" },
  "W3SCHOOLS": { id: "w3schools", name: "W3Schools" },
  "GEEKSFORGEEKS": { id: "geeksforgeeks", name: "GeeksforGeeks" },
  "TUTORIALSPOINT": { id: "tutorialspoint", name: "TutorialsPoint" },
  "SQLCOURSE": { id: "sqlcourse", name: "SQLCourse" },
  "TUTORIALREPUBLIC": { id: "tutorialrepublic", name: "TutorialRepublic" },
};

function naturalKey(s) {
  const m = /^(\d+)\s+(.*)$/.exec(s);
  if (m) return [0, parseInt(m[1], 10), m[2]];
  return [1, 0, s];
}
function naturalSort(a, b) {
  const ka = naturalKey(a), kb = naturalKey(b);
  for (let i = 0; i < 3; i++) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
  }
  return 0;
}

function run() {
  db.exec("DELETE FROM files; DELETE FROM folders; DELETE FROM sites;");
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('folders','files');");

  const insertSite = db.prepare("INSERT INTO sites (id, name, order_index) VALUES (?, ?, ?)");
  const insertFolder = db.prepare("INSERT INTO folders (site_id, name, order_index) VALUES (?, ?, ?)");
  const insertFile = db.prepare("INSERT INTO files (folder_id, name, type, content, order_index) VALUES (?, ?, ?, ?, ?)");

  const siteDirs = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && SITE_META[d.name])
    .map((d) => d.name)
    .sort();

  let totalFolders = 0, totalFiles = 0;
  siteDirs.forEach((siteDir, siteIdx) => {
    const meta = SITE_META[siteDir];
    const siteFull = path.join(ROOT, siteDir);
    insertSite.run(meta.id, meta.name, siteIdx);

    const folderNames = fs.readdirSync(siteFull, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort(naturalSort);

    folderNames.forEach((folderName, folderIdx) => {
      const folderFull = path.join(siteFull, folderName);
      const folderId = Number(insertFolder.run(meta.id, folderName, folderIdx).lastInsertRowid);
      totalFolders++;

      const fileNames = fs.readdirSync(folderFull, { withFileTypes: true })
        .filter((d) => d.isFile())
        .map((d) => d.name)
        .sort();

      fileNames.forEach((fname, fileIdx) => {
        const content = fs.readFileSync(path.join(folderFull, fname), "utf-8");
        const ftype = fname.toLowerCase().endsWith(".sql") ? "sql" : "quiz";
        insertFile.run(folderId, fname, ftype, content, fileIdx);
        totalFiles++;
      });
    });
  });

  console.log(`Seeded ${siteDirs.length} sites, ${totalFolders} folders, ${totalFiles} files into data.sqlite`);
}

run();
