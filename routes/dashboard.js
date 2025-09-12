const express = require("express");
const router = express.Router();
const db = require("../db/connection");
const auth = require("../middleware/auth");

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Dashboard summary information
 */

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_books:
 *                   type: integer
 *                 total_students:
 *                   type: integer
 *                 total_borrows:
 *                   type: integer
 *                 borrowed_not_returned:
 *                   type: integer
 *                 returned:
 *                   type: integer
 */
router.get("/", auth(["liberian"]), async (req, res) => {
  try {
    const [[{ total_books }]] = await db.execute("SELECT COUNT(*) AS total_books FROM books");
    const [[{ total_students }]] = await db.execute("SELECT COUNT(*) AS total_students FROM students");
    const [[{ total_borrows }]] = await db.execute("SELECT COUNT(*) AS total_borrows FROM borrows");
    const [[{ borrowed_not_returned }]] = await db.execute("SELECT COUNT(*) AS borrowed_not_returned FROM borrows WHERE return_date IS NULL");
    const [[{ returned }]] = await db.execute("SELECT COUNT(*) AS returned FROM borrows WHERE return_date IS NOT NULL");

    res.json({
      total_books,
      total_students,
      total_borrows,
      borrowed_not_returned,
      returned
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
