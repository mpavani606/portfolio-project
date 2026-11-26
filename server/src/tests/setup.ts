import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.NODE_ENV = "test";
process.env.PORT = "3000";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/qm-portfolio-test";
process.env.CLIENT_ORIGIN = "http://localhost:5173";
process.env.SESSION_SECRET = "test-session-secret-with-more-than-32-characters";
process.env.ASSET_STORAGE_PROVIDER = "local";
process.env.UPLOAD_DIR = join(tmpdir(), `qm-portfolio-test-uploads-${process.pid}`);
