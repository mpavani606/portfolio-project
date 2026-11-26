import { Router } from "express";
import sharp from "sharp";
import type { OutputInfo } from "sharp";
import { imageFileMetadataSchema } from "../../../shared/portfolio.js";
import { acceptImageUpload } from "../middleware/image-upload.js";
import { AssetModel } from "../models/portfolio.js";
import { assetStorage } from "../modules/assets/storage.js";
import { assetDto } from "../modules/portfolio/serializers.js";
import { ApiError } from "../utils/api-error.js";
import { getTenantId } from "../utils/request-context.js";
import { ok } from "../utils/response.js";

const router = Router();
const maxImageBytes = 5 * 1024 * 1024;
const mimeByExtension: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function hasExpectedMagicBytes(mimeType: string, buffer: Buffer): boolean {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  return (
    mimeType === "image/webp" &&
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  );
}

function invalidImage(message: string): ApiError {
  return new ApiError(400, "VALIDATION_ERROR", message, { image: [message] });
}

router.post("/image", acceptImageUpload, async (request, response) => {
  const file = request.file;
  if (!file) {
    throw invalidImage("An image file is required");
  }
  const metadata = imageFileMetadataSchema.safeParse({
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
  });
  if (!metadata.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of metadata.error.issues) {
      const field = issue.path.join(".") || "image";
      fields[field] = [...(fields[field] ?? []), issue.message];
    }
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid image metadata", fields);
  }

  const extension = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
  if (
    mimeByExtension[extension] !== metadata.data.mimetype ||
    !hasExpectedMagicBytes(metadata.data.mimetype, file.buffer)
  ) {
    throw invalidImage("Image extension, MIME type, and file signature must match");
  }

  let processed: { data: Buffer; info: OutputInfo };
  try {
    processed = await sharp(file.buffer, { limitInputPixels: 25_000_000, failOn: "error" })
      .rotate()
      .webp({ quality: 85, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw invalidImage("Image file is corrupt or unsupported");
  }
  if (
    processed.info.width < 1 ||
    processed.info.height < 1 ||
    processed.data.length > maxImageBytes
  ) {
    throw invalidImage("Processed image exceeds the allowed size or dimensions");
  }

  const tenantId = getTenantId(request);
  const stored = await assetStorage.put(tenantId.toString(), processed.data);
  try {
    const asset = await AssetModel.create({
      tenantId,
      key: stored.key,
      url: stored.url,
      mimeType: "image/webp",
      width: processed.info.width,
      height: processed.info.height,
      sizeBytes: processed.data.length,
      storageProvider: assetStorage.provider,
    });
    response.status(201);
    ok(response, assetDto(asset));
  } catch (error) {
    await assetStorage.remove(stored.key);
    throw error;
  }
});

export default router;
