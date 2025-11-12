import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import logger from "./logs/logger.service";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT ?? 3030);

async function startServer() {
  try {
    app.get("/", (_, res) => {
      res.status(200).json({ message: "API is running..." });
    });

    // test route
    app.use("/api/auth", (req, res) => {
      res.json({ message: "Auth route is working!" });
    });

    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    logger.error(`❌ Server failed to start: ${err}`);
    process.exit(1);
  }
}

startServer();
