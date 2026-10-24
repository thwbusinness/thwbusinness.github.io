"use strict";
const { Pool } = require("pg");
const cfg = require("./config");

const pool = new Pool({
  connectionString: cfg.datenbank,
  max: 10,
  idleTimeoutMillis: 30000,
  ssl: /sslmode=require/.test(cfg.datenbank) ? { rejectUnauthorized: false } : false,
});

pool.on("error", (e) => console.error("Datenbankfehler im Pool:", e.message));

/* Alle Abfragen laufen über diese eine Stelle – und ausschließlich
   mit Platzhaltern, nie mit zusammengebautem SQL. */
async function q(text, params) {
  const res = await pool.query(text, params);
  return res.rows;
}
async function eine(text, params) {
  const rows = await q(text, params);
  return rows[0] || null;
}

module.exports = { pool, q, eine };
