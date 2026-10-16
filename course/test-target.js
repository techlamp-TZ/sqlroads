// Test databases for the course self-test. The real course databases (MySQL practice / manual / sqlbolt,
// PostgreSQL sql_course) are never touched by it: every name is mapped to a separate test database.
const REAL = { mysql: ["practice", "manual", "sqlbolt"], postgres: ["sql_course"] };
const TEST = {
  mysql: { practice: "sqldrills_test_practice", manual: "sqldrills_test_manual", sqlbolt: "sqldrills_test_sqlbolt" },
  postgres: "sqldrills_test_course",
};
let active = null;
/** Switch this process to the test databases. Refuses a mapping that would point at a real course database. */
function useTestDatabases(target = TEST) {
  const names = Object.values(target.mysql).concat(target.postgres).map((n) => String(n).toLowerCase());
  const real = names.filter((n) => REAL.mysql.includes(n) || REAL.postgres.includes(n) || ["sql_exercises", "mysql", "sys", "information_schema", "performance_schema", "postgres"].includes(n) || /^ex\d\d_/.test(n));
  if (real.length) throw new Error("Refusing to run: the test target points at a real database (" + real.join(", ") + "). The self-test only runs on separate test databases.");
  if (names.some((n) => !/^sqldrills_test_\w+$/.test(n))) throw new Error("Refusing to run: test databases must be named sqldrills_test_*.");
  active = target;
  return active;
}
const isTest = () => !!active;
/** MySQL SQL with the course database names replaced by the test ones (only in test mode). */
function mapMysql(sql) {
  if (!active) return sql;
  const names = active.mysql;
  return String(sql)
    .replace(/(\b(?:USE|DATABASE|SCHEMA)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?`?)(practice|manual|sqlbolt)\b/gi, (m, pre, n) => pre + names[n.toLowerCase()])
    .replace(/(\btable_schema\s*=\s*')(practice|manual|sqlbolt)(')/gi, (m, a, n, c) => a + names[n.toLowerCase()] + c)
    .replace(/`(practice|manual|sqlbolt)`\./gi, (m, n) => "`" + names[n.toLowerCase()] + "`.")
    .replace(/\b(practice|manual|sqlbolt)\.(?=`?[A-Za-z_])/gi, (m, n) => names[n.toLowerCase()] + ".");
}
const pgDatabase = (real) => (active && real === "sql_course" ? active.postgres : real);
module.exports = { useTestDatabases, isTest, mapMysql, pgDatabase, REAL, TEST };
