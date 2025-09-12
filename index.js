const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./docs/swagger");

if (!process.env.JWT_SECRET) {
  console.warn("Warning: JWT_SECRET is not set. Login will fail.");
}

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/auth"));
app.use("/api/students", require("./routes/students"));
app.use("/api/books", require("./routes/books"));
app.use("/api/borrows", require("./routes/borrows"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/authors", require("./routes/authors"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
