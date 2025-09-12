const express = require("express");
const router = express.Router();
const db = require("../db/connection");
const auth = require("../middleware/auth");

/**
 * @swagger
 * tags:
 *   name: Borrows
 *   description: Borrow and return books
 */

/**
 * @swagger
 * /api/borrows:
 *   post:
 *     summary: Borrow a book
 *     tags: [Borrows]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               student_id:
 *                 type: integer
 *               book_id:
 *                 type: integer
 *               borrow_date:
 *                 type: string
 *                 format: date
 *                 example: "2025-09-12"
 *     responses:
 *       200:
 *         description: Borrow record created
 */
router.post("/", auth(["liberian"]), async (req, res) => {
  const { student_id, book_id, borrow_date } = req.body;
  const created_by = req.user.id;
  const currentDate = borrow_date || new Date().toISOString().slice(0, 10); // Fallback to current date

  try {
    // 1. Check if the book exists and has quantity > 0
    const [[book]] = await db.execute(
      "SELECT quantity FROM books WHERE id = ?",
      [book_id]
    );

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    if (book.quantity <= 0) {
      return res.status(400).json({ message: "Book is out of stock" });
    }

    // 2. Insert borrow record with borrow_date
    await db.execute(
      "INSERT INTO borrows (student_id, book_id, borrow_date, status, created_by) VALUES (?, ?, ?, ?, ?)",
      [student_id, book_id, currentDate, "borrowed", created_by]
    );

    // 3. Decrease book quantity by 1
    await db.execute("UPDATE books SET quantity = quantity - 1 WHERE id = ?", [
      book_id,
    ]);

    res.status(200).json({ message: "Book borrowed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/borrows/{id}/return:
 *   put:
 *     summary: Return a book
 *     tags: [Borrows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Borrow record ID
 *     responses:
 *       200:
 *         description: Book returned
 */
router.put("/:id/return", auth(["liberian"]), async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.execute(
      "SELECT * FROM borrows WHERE id = ? AND return_date IS NULL",
      [id]
    );
    if (rows.length === 0)
      return res
        .status(400)
        .json({ message: "Borrow record not found or already returned" });

    await db.execute("UPDATE borrows SET return_date = NOW() WHERE id = ?", [
      id,
    ]);
    const book_id = rows[0].book_id;

    // Increment the book quantity
    await db.execute("UPDATE books SET quantity = quantity + 1 WHERE id = ?", [
      book_id,
    ]);
    res.json({ message: "Book returned successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/borrows/{id}:
 *   delete:
 *     summary: Delete a returned borrow record
 *     tags: [Borrows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Borrow record ID
 *     responses:
 *       200:
 *         description: Borrow record deleted
 *       400:
 *         description: Borrow record not found or not returned
 *       500:
 *         description: Server error
 */
router.delete("/:id", auth(["liberian"]), async (req, res) => {
  const { id } = req.params;

  try {
    // Check if the borrow record exists and has been returned
    const [rows] = await db.execute(
      "SELECT * FROM borrows WHERE id = ? AND return_date IS NOT NULL",
      [id]
    );

    if (rows.length === 0) {
      return res
        .status(400)
        .json({ message: "Borrow record not found or not yet returned" });
    }

    // Delete the borrow record
    await db.execute("DELETE FROM borrows WHERE id = ?", [id]);

    res.json({ message: "Borrow record deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/borrows:
 *   get:
 *     summary: Get all borrow records
 *     tags: [Borrows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         required: false
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         required: false
 *         description: Limit per page
 *     responses:
 *       200:
 *         description: List of borrow records
 */
router.get("/", auth(["liberian"]), async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const totalBorrowsQuery = "SELECT COUNT(*) AS total FROM borrows";
  const [totalBorrowsResult] = await db.execute(totalBorrowsQuery);
  const totalBorrows = totalBorrowsResult[0].total;
  const totalPages = Math.ceil(totalBorrows / limit);

  try {
    const [borrows] = await db.execute(
      `SELECT b.id, s.id_card, s.full_name, bk.title, b.borrow_date, b.return_date
       FROM borrows b
       JOIN students s ON b.student_id = s.id
       JOIN books bk ON b.book_id = bk.id
       ORDER BY b.borrow_date DESC
       LIMIT ${limit} OFFSET ${offset}`
    );

    res.json({
      currentPage: page,
      limit: limit,
      totalPages: totalPages,
      totalBorrows: totalBorrows,
      borrows: borrows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch borrows" });
  }
});

module.exports = router;
