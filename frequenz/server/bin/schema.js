"use strict";
/* Legt das Schema an. Mehrfaches Ausführen schadet nicht. */
const fs = require("fs");
const path = require("path");
const { pool } = require("../lib/db");

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, "..", "schema.sql"), "utf8");
  await pool.query(sql);
  console.log("Schema angelegt oder bereits vorhanden.");
  await pool.end();
})().catch((e) => { console.error("Schema fehlgeschlagen:", e.message); process.exit(1); });
