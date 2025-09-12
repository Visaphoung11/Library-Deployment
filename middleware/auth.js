module.exports = (roles = []) => (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No Authorization header" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token", error: err.message });

    if (roles.length && !roles.includes(user.role)) {
      return res.status(403).json({
        message: `Access denied for role '${user.role}'`,
        required: roles
      });
    }

    req.user = user;
    next();
  });
};

const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();