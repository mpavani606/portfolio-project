import type { Types } from "mongoose";
import type { SessionDocument } from "../models/session.js";
import type { UserDocument } from "../models/user.js";

export interface AuthContext {
  user: UserDocument;
  session: SessionDocument;
}

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
      tenantId?: Types.ObjectId;
    }
  }
}

export {};
