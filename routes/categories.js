const express = require("express");
const router = express.Router();
const db = require("../db/connection");
const auth = require("../middleware/auth");

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Manage book categories
 */

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all categories for selection
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 */
router.get("/", auth(["liberian"]), async (req, res) => {
  try {
    const [categories] = await db.execute("SELECT id, name FROM categories");
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
