import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "../../config/env.js";

export interface StoredAsset {
  key: string;
  url: string;
}

export interface AssetStorage {
  readonly provider: "local" | "s3";
  put(tenantId: string, body: Buffer): Promise<StoredAsset>;
  remove(key: string): Promise<void>;
  read(key: string): Promise<Buffer | null>;
}

const safeKeyPattern = /^[a-f\d]{24}-[a-f\d-]{36}\.webp$/i;
const publicApiOrigin = env.PUBLIC_API_ORIGIN ?? `http://localhost:${env.PORT}`;

function assertSafeKey(key: string): void {
  if (!safeKeyPattern.test(key)) {
    throw new Error("Invalid generated asset key");
  }
}

class LocalAssetStorage implements AssetStorage {
  readonly provider = "local" as const;
  private readonly root = resolve(env.UPLOAD_DIR);

  async put(tenantId: string, body: Buffer): Promise<StoredAsset> {
    const key = `${tenantId}-${randomUUID()}.webp`;
    assertSafeKey(key);
    await mkdir(this.root, { recursive: true });
    await writeFile(this.pathFor(key), body, { flag: "wx" });
    return {
      key,
      url: `${publicApiOrigin}/api/public/assets/${encodeURIComponent(key)}`,
    };
  }

  async remove(key: string): Promise<void> {
    assertSafeKey(key);
    try {
      await unlink(this.pathFor(key));
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
        return;
      }
      throw error;
    }
  }

  async read(key: string): Promise<Buffer | null> {
    assertSafeKey(key);
    try {
      return await readFile(this.pathFor(key));
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  private pathFor(key: string): string {
    const path = resolve(this.root, key);
    if (!path.startsWith(`${this.root}${sep}`)) {
      throw new Error("Asset path escaped the upload directory");
    }
    return path;
  }
}

class S3AssetStorage implements AssetStorage {
  readonly provider = "s3" as const;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(region: string, bucket: string) {
    this.client = new S3Client({ region });
    this.bucket = bucket;
  }

  async put(tenantId: string, body: Buffer): Promise<StoredAsset> {
    const key = `${tenantId}-${randomUUID()}.webp`;
    assertSafeKey(key);
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
      ServerSideEncryption: "AES256",
    }));
    return {
      key,
      url: `${publicApiOrigin}/api/public/assets/${encodeURIComponent(key)}`,
    };
  }

  async remove(key: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async read(key: string): Promise<Buffer | null> {
    assertSafeKey(key);
    const object = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
    return object.Body ? Buffer.from(await object.Body.transformToByteArray()) : null;
  }
}

function requiredS3Setting(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required for S3 asset storage`);
  }
  return value;
}

export const assetStorage: AssetStorage =
  env.ASSET_STORAGE_PROVIDER === "s3"
    ? new S3AssetStorage(
        requiredS3Setting(env.AWS_REGION, "AWS_REGION"),
        requiredS3Setting(env.S3_BUCKET, "S3_BUCKET"),
      )
    : new LocalAssetStorage();
