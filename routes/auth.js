const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db/connection");
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin authentication
 */


/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Admin login(liberian)
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Users'
 *     responses:
 *       201:
 *         description: Login successfully
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Users:
 *       type: object
 *       required:
 *         - username
 *         - password
 *       properties:
 *         username:
 *           type: string
 *         password:
 *           type: string
 *       example:
 *         username: liberian1
 *         password: password123
 */
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.execute("SELECT * FROM users WHERE username = ?", [username]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET);
    res.json({ token, user: { id: user.id, full_name: user.full_name, username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
