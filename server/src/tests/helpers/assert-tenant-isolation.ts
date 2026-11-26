import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { TenantModel } from "../../models/tenant.js";
import { UserModel } from "../../models/user.js";
import type { Types } from "mongoose";

export interface TenantIsolationResource {
  create(tenantId: Types.ObjectId, value: string): Promise<{ id: string }>;
  findById(tenantId: Types.ObjectId, id: string): Promise<{ id: string; value: string } | null>;
  updateById(tenantId: Types.ObjectId, id: string, value: string): Promise<number>;
  deleteById(tenantId: Types.ObjectId, id: string): Promise<number>;
  list(tenantId: Types.ObjectId): Promise<Array<{ id: string }>>;
}

export async function assertTenantIsolation(resource: TenantIsolationResource): Promise<void> {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  const userA = await UserModel.create({
    email: `tenant-a-${suffix}@example.test`,
    passwordHash: "fixture-only",
    isVerified: true,
  });
  const userB = await UserModel.create({
    email: `tenant-b-${suffix}@example.test`,
    passwordHash: "fixture-only",
    isVerified: true,
  });
  const tenantA = await TenantModel.create({
    ownerId: userA._id,
    slug: `tenant-a-${suffix}`,
    displayName: "Tenant A",
  });
  const tenantB = await TenantModel.create({
    ownerId: userB._id,
    slug: `tenant-b-${suffix}`,
    displayName: "Tenant B",
  });
  const recordA = await resource.create(tenantA._id, "A's private record");
  const recordB = await resource.create(tenantB._id, "B's private record");

  assert.equal(await resource.findById(tenantB._id, recordA.id), null);
  assert.equal(await resource.updateById(tenantB._id, recordA.id, "tampered"), 0);
  assert.equal(await resource.deleteById(tenantB._id, recordA.id), 0);
  assert.deepEqual(await resource.list(tenantB._id), [{ id: recordB.id }]);
  assert.equal((await resource.findById(tenantA._id, recordA.id))?.value, "A's private record");
}
