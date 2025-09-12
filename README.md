# Express LMS API – Migration from MySQL to PostgreSQL (Step-by-Step)

This document explains, from scratch, how we migrated the backend from MySQL (mysql2) to PostgreSQL (pg), the exact edits made, and why each change was necessary. Follow it to reproduce or learn the reasoning.

## Overview

- Original stack: Express + mysql2 with `db.execute("... ? ...", params)` in routes.
- New stack: Express + pg (node-postgres) with a compatibility wrapper that keeps the old `db.execute(...)` API working.
- Additional fixes: environment variables loading order, JWT secret issue, Books routes adjusted to use Postgres-specific SQL and the `pg` client correctly.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ running locally or remotely

## 1) Install dependencies

Already present in `package.json`:

```json
{
  "dependencies": {
    "pg": "^8.16.3",
    "mysql2": "^3.14.1"
  }
}
```

Note: We kept `mysql2` for now to avoid breaking any tooling. You can remove it later if not used anywhere.

Install:

```bash
npm install
```

## 2) Environment variables

Create a `.env` file at the project root (same folder as `index.js`):

```env
PORT=3000
DB_HOST=localhost
DB_USER=your_user
DB_PASS=your_pass
DB_NAME=your_db
DB_PORT=5432
JWT_SECRET=your-very-strong-random-secret
```

Why: The API signs JWT tokens with `process.env.JWT_SECRET`. If it’s missing, login fails with: "secretOrPrivateKey must have a value".

## 3) Database connection: MySQL → Postgres with compatibility wrapper

File: `db/connection.js`

- Replaced mysql2 pool with `pg.Pool`.
- Added a small wrapper to mimic mysql2’s `execute(sql, params)` and `?` placeholders.
- Removed the self-invoking connection test that exited the process.

Key ideas:

```js
const { Pool } = require("pg");
const pool = new Pool({ host, user, password, database, port });

// Convert "?" placeholders to "$1, $2, ..." for Postgres
function convertQuestionMarksToDollars(sql, values) {
  let index = 0;
  const text = sql.replace(/\?/g, () => `$${++index}`);
  return { text, values };
}

// mysql2-like execute
async function execute(sql, params = []) {
  const { text, values } = convertQuestionMarksToDollars(sql, params);
  const result = await pool.query(text, values);
  const command = (result.command || "").toUpperCase();

  if (command === "SELECT" || Array.isArray(result.rows)) {
    return [result.rows, undefined]; // [rows, fields]
  }

  return [{ affectedRows: result.rowCount ?? 0, insertId: null }];
}

module.exports = { pool, execute };
```

Why: Routes written for mysql2 expect `db.execute` and `?` placeholders. Postgres uses `$1..$n`. This wrapper avoids mass refactors.

## 4) Ensure envs load before anything else

File: `index.js`

- Move `dotenv.config()` to the very top (before other imports).
- Add a startup warning if `JWT_SECRET` is missing.

```js
const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./docs/swagger");

if (!process.env.JWT_SECRET) {
  console.warn("Warning: JWT_SECRET is not set. Login will fail.");
}
```

Why: Some modules read env vars at import time. Loading `.env` too late leads to missing variables (e.g., JWT secret).

## 5) Books routes: switch to `pg` and Postgres syntax

File: `routes/books.js`

- Import `{ pool }` from the connection module.
- Replace `db.query(...)` with `pool.query(...)`.
- Use Postgres parameter placeholders `$1, $2, ...`.
- Use `ILIKE` for case-insensitive search in Postgres.

Examples:

```js
const { pool } = require("../db/connection");

// Count
const totalResult = await pool.query("SELECT COUNT(*) AS total FROM books");

// Pagination query with params
const result = await pool.query(
  `SELECT b.id, b.title, b.description, b.quantity,
          a.full_name AS author_name,
          c.name AS category,
          b.created_by
     FROM books b
     LEFT JOIN authors a ON b.author_id = a.id
     LEFT JOIN categories c ON b.category_id = c.id
     ORDER BY b.id
     LIMIT $1 OFFSET $2`,
  [limit, offset]
);

// Search with ILIKE
const found = await pool.query(
  `SELECT id, title, quantity
     FROM books
    WHERE quantity > 0 AND title ILIKE $1
    LIMIT 10`,
  [`%${query}%`]
);
```

Why: The Books module previously mixed mysql2-style code and a direct `db.query` call that didn’t exist in our export. Postgres requires `$1` params and `ILIKE` for case-insensitive match.

## 6) Other routes: continue working via the wrapper

Files like `routes/students.js`, `routes/borrows.js`, `routes/categories.js`, `routes/auth.js`, `routes/dashboard.js` use `db.execute(...)` with `?` placeholders. These work as-is because of the wrapper in `db/connection.js`.

Notes:

- `SELECT COUNT(*) AS total` returns strings in Postgres. We `parseInt` when needed.
- For mutations, the wrapper returns an object like `{ affectedRows: result.rowCount }` so checks like `if (result.affectedRows === 0)` continue to work.

## 7) Running the server

PowerShell (Windows):

```powershell
npm run dev
```

Avoid piping (like `| cat`) or `&&` chaining in PowerShell; it can spam long error messages.

Once running, Swagger UI is at:

```
http://localhost:3000/api-docs
```

## 8) Common pitfalls and fixes

- Login fails with 500 "secretOrPrivateKey must have a value" → set `JWT_SECRET` in `.env`, restart server.
- Swagger shows old errors after a fix → hard-refresh the page (Ctrl+F5) to avoid cached scripts.
- Books endpoints 500 → ensure you’re on the updated `routes/books.js` that uses `{ pool }` and `$1` placeholders.

## 9) Optional cleanups / next steps

- Remove `mysql2` once you’re confident no code depends on it.
- Add a health endpoint:

```js
// index.js
app.get("/healthz", (req, res) => res.json({ status: "ok" }));
```

- Add `/api/version` endpoint or include commit hash in responses for debugging.
- Add migrations (e.g., with `node-pg-migrate` or `knex`) and schema docs.

## 10) Quick checklist of changes we made

- Rewrote `db/connection.js` for Postgres with a mysql2-compatible `execute(...)` wrapper.
- Removed self-exiting DB connection test.
- Moved `dotenv.config()` to the top of `index.js` and added a `JWT_SECRET` warning.
- Fixed all Book routes to use Postgres and `pool.query(...)` with proper params and `ILIKE`.
- Verified other routes continue to work via the wrapper.

You can now build further features on PostgreSQL while keeping existing route code mostly unchanged. Enjoy!
