import multer from "multer";
import type { RequestHandler } from "express";
import { ApiError } from "../utils/api-error.js";

const acceptedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const imageParser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!acceptedMimeTypes.has(file.mimetype)) {
      callback(new ApiError(400, "VALIDATION_ERROR", "Only JPEG, PNG, and WebP images are accepted", {
        image: ["Unsupported image MIME type"],
      }));
      return;
    }
    callback(null, true);
  },
});

export const acceptImageUpload: RequestHandler = (request, response, next) => {
  imageParser.single("image")(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const message = error.code === "LIMIT_FILE_SIZE"
        ? "Image must be 5 MB or smaller"
        : "Invalid image upload";
      next(new ApiError(400, "VALIDATION_ERROR", message, { image: [message] }));
      return;
    }
    if (error) {
      next(error);
      return;
    }
    next();
  });
};
