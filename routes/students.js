const express = require("express");
const db = require("../db/connection");
const auth = require("../middleware/auth");
const router = express.Router();


/**
 * @swagger
 * /api/students:
 *   post:
 *     summary: Create a new student
 *     tags: [Students]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Student'
 *     responses:
 *       201:
 *         description: Student created successfully
 */
router.post("", auth(["liberian"]), async (req, res) => {
  const { full_name, id_card, student_class } = req.body;

  try {
    await db.execute("INSERT INTO students (full_name, id_card, class, created_by) VALUES (?, ?, ?, ?)", [
      full_name,
      id_card,
      student_class,
      req.user.id
    ]);
    res.status(201).json({ message: "Student created" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Student:
 *       type: object
 *       required:
 *         - full_name
 *         - id_card
 *         - student_class
 *       properties:
 *         id:
 *           type: integer
 *           description: Auto-generated ID
 *         full_name:
 *           type: string
 *           description: First name
 *         id_card:
 *           type: string
 *           description: Student ID card number
 *         student_class:
 *           type: string
 *           description: Class of the student
 *       example:
 *         full_name: kakada
 *         id_card: STU0001
 *         student_class: wmad
 */

/**
 * @swagger
 * /api/students:
 *   get:
 *     summary: Get all students with pagination and created_by
 *     tags: [Students]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of students per page
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all students with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 currentPage:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 10
 *                 totalPages:
 *                   type: integer
 *                   example: 5
 *                 totalBooks:
 *                   type: integer
 *                   example: 50
 *                 students:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       full_name:
 *                         type: string
 *                       id_card:
 *                         type: string
 *                       class:
 *                         type: string
 *                       created_by:
 *                         type: integer
 */
router.get("", auth(["liberian"]), async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const totalStudentsQuery = "SELECT COUNT(*) AS total FROM students";
  const [totalStudentsResult] = await db.execute(totalStudentsQuery);
  const totalStudents = totalStudentsResult[0].total;
  const totalPages = Math.ceil(totalStudents / limit);


  const query = `
      SELECT
        students.id, students.full_name, students.id_card, students.class, students.created_by
      FROM students
      LIMIT ${limit} OFFSET ${offset}
    `;

  try {
    const [students] = await db.execute(query);
    res.json({
      currentPage: page,
      limit: limit,
      totalPages: totalPages,
      totalStudents: totalStudents,
      students: students
    });

  } catch (error) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch students" });
  }
});



/**
 * @swagger
 * /api/students/search:
 *   get:
 *     summary: Search students by name or ID card
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Name or ID card to search
 *     responses:
 *       200:
 *         description: List of matching students
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   id_card:
 *                     type: string
 *                   full_name:
 *                     type: string
 */
router.get("/search", auth(["liberian"]), async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ message: "Missing query" });

  try {
    const [rows] = await db.execute(
      `SELECT id, id_card, full_name
       FROM students
       WHERE id_card LIKE ? OR full_name LIKE ?
       LIMIT 10`,
      [`%${query}%`, `%${query}%`]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/students/{id}:
 *   get:
 *     summary: Get a student by ID
 *     tags: [Students]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Student ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Student details
 */
router.get("/:id", auth(["liberian"]), async (req, res) => {
  const studentId = req.params.id;

  try {
    const query = "SELECT * FROM students WHERE id = ?";
    const [student] = await db.execute(query, [studentId]);

    if (student.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json(student[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch student" });
  }
}
);

/**
 * @swagger
 * /api/students/{id}:
 *   put:
 *     summary: Update a student by ID
 *     tags: [Students]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Student ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Student'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Student updated successfully
 */
router.put("/:id", auth(["liberian"]), async (req, res) => {
  const studentId = req.params.id;
  const { full_name, id_card, student_class } = req.body;

  try {
    const query = `UPDATE students SET full_name = '${full_name}', id_card = '${id_card}', class = '${student_class}' WHERE id = ${studentId}`;
    const [result] = await db.execute(query);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json({ message: "Student updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update student" });
  }
}
);

/**
 * @swagger
 * /api/students/{id}:
 *   delete:
 *     summary: Delete a student by ID
 *     tags: [Students]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Student ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Student deleted successfully
 */
router.delete("/:id", auth(["liberian"]), async (req, res) => {
  const studentId = req.params.id;

  try {
    const query = "DELETE FROM students WHERE id = ?";
    const [result] = await db.execute(query, [studentId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json({ message: "Student deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete student" });
  }
}
);


module.exports = router;
