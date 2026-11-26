import type { HydratedDocument, Model, Types } from "mongoose";
import type { TenantPortfolioRecord } from "../../models/portfolio.js";
import { tenantScoped } from "../../utils/tenant-scoped.js";
import type { TenantIsolationResource } from "./assert-tenant-isolation.js";

export interface TenantModelIsolationFixture<T extends TenantPortfolioRecord> {
  model: Model<T>;
  build(value: string): Omit<Partial<T>, "tenantId">;
  getValue(document: HydratedDocument<T>): string;
  update(value: string): Partial<Omit<T, "tenantId">>;
}

function documentId<T extends TenantPortfolioRecord>(document: HydratedDocument<T>): string {
  if (!document._id) {
    throw new Error("Persisted tenant resource has no identifier");
  }
  return document._id.toString();
}

export function tenantModelIsolationResource<T extends TenantPortfolioRecord>(
  fixture: TenantModelIsolationFixture<T>,
): TenantIsolationResource {
  const scoped = tenantScoped(fixture.model);
  return {
    async create(tenantId: Types.ObjectId, value: string): Promise<{ id: string }> {
      const document = await scoped.create(tenantId, fixture.build(value));
      return { id: documentId(document) };
    },
    async findById(
      tenantId: Types.ObjectId,
      id: string,
    ): Promise<{ id: string; value: string } | null> {
      const document = await scoped.findById(tenantId, id);
      return document
        ? { id: documentId(document), value: fixture.getValue(document) }
        : null;
    },
    async updateById(tenantId: Types.ObjectId, id: string, value: string): Promise<number> {
      const result = await scoped.updateById(tenantId, id, fixture.update(value));
      return result.matchedCount;
    },
    async deleteById(tenantId: Types.ObjectId, id: string): Promise<number> {
      const result = await scoped.deleteById(tenantId, id);
      return result.deletedCount;
    },
    async list(tenantId: Types.ObjectId): Promise<Array<{ id: string }>> {
      const documents = await scoped.find(tenantId);
      return documents.map((document) => ({ id: documentId(document) }));
    },
  };
}
