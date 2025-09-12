const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
});

function convertQuestionMarksToDollars(sql, values) {
  if (!values || values.length === 0) return { text: sql, values: [] };
  let index = 0;
  const text = sql.replace(/\?/g, () => `$${++index}`);
  return { text, values };
}

async function execute(sql, params = []) {
  const { text, values } = convertQuestionMarksToDollars(sql, params);
  const result = await pool.query(text, values);
  const command = (result.command || "").toUpperCase();

  if (command === "SELECT" || Array.isArray(result.rows)) {
    // Return [rows, fields] to mimic mysql2 structure
    return [result.rows, undefined];
  }

  // For INSERT/UPDATE/DELETE mimic mysql2 OkPacket in first tuple position
  return [{ affectedRows: result.rowCount ?? 0, insertId: null }];
}

module.exports = { pool, execute };
