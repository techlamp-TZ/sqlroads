// Generate → From images, the parts that need no database (admin/image-rules.js).
const test = require("node:test");
const assert = require("node:assert");
const { DatabaseSync } = require("node:sqlite");
const R = require("../admin/image-rules.js");

test("image size is read from the PNG / JPEG header; anything else is refused", () => {
  const png = Buffer.alloc(32); png.writeUInt32BE(0x89504e47, 0); png.writeUInt32BE(1280, 16); png.writeUInt32BE(720, 20);
  assert.deepStrictEqual(R.imageInfo(png), { type: "png", w: 1280, h: 720 });
  // a JPEG: SOI, an APP0 segment, then SOF0 with height 600 and width 800
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03, 0x01, 0x22, 0x00]);
  assert.deepStrictEqual(R.imageInfo(jpg), { type: "jpeg", w: 800, h: 600 });
  assert.strictEqual(R.imageInfo(Buffer.from("GIF89a....................")), null);
});

test("vision tokens: 32 px patches times 1.62, capped at 1,536 patches", () => {
  assert.strictEqual(R.visionTokens(320, 320), Math.ceil(100 * 1.62));
  assert.ok(R.visionTokens(4000, 3000) <= Math.ceil(1536 * 1.62));
});

test("a dataset from screenshot rows: safe names, inferred types, a primary key only when it is one, and it runs", () => {
  const { sql, plan } = R.datasetSql([
    { name: "Order Items!", columns: ["id", "Product Name", "price", "sold on", "order"], rows: [[1, "Pen", "1.50", "2024-01-02", 3], [2, "Ink 'blue'", 2, "2024-01-03", null], [3, "NULL", "4.25", "2024-01-04", 1]] },
    { name: "notes", columns: ["code", "text"], rows: [["A", "x"], ["A", "y"]] },
  ]);
  assert.deepStrictEqual(plan.map((t) => [t.name, t.rows]), [["order_items", 3], ["notes", 2]]);
  assert.match(sql, /CREATE TABLE order_items \(\n  id INT PRIMARY KEY,\n  product_name VARCHAR\(\d+\),\n  price DECIMAL\(14,2\),\n  sold_on DATE,\n  order_ INT\n\)/);
  assert.match(sql, /'Ink ''blue'''/);
  assert.doesNotMatch(sql, /CREATE TABLE notes \([^)]*PRIMARY KEY/);
  const m = new DatabaseSync(":memory:");
  m.exec(sql);
  assert.deepStrictEqual({ ...m.prepare("SELECT COUNT(*) n, SUM(product_name IS NULL) nulls FROM order_items").get() }, { n: 3, nulls: 1 });
});

test("types shown in a structure-only screenshot become portable SQL types", () => {
  assert.strictEqual(R.sqlType("NUMBER"), "INT");
  assert.strictEqual(R.sqlType("VARCHAR2(17)"), "VARCHAR(17)");
  assert.strictEqual(R.sqlType("NUMBER(10,2)"), "DECIMAL(10,2)");
  assert.strictEqual(R.sqlType("date"), "DATE");
  assert.strictEqual(R.sqlType(""), null);
  const { sql } = R.datasetSql([{ name: "CITY", columns: ["ID", "NAME", "COUNTRYCODE"], types: ["NUMBER", "VARCHAR2(17)", "VARCHAR2(3)"], rows: [[1, "Kabul", "AFG"]] }]);
  assert.match(sql, /id INT PRIMARY KEY,\n  name VARCHAR\(17\),\n  countrycode VARCHAR\(3\)/);
});
