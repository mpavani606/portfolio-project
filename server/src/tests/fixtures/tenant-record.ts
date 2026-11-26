import { model, Schema, Types } from "mongoose";
import { tenantScoped } from "../../utils/tenant-scoped.js";

interface TenantRecord {
  tenantId: Types.ObjectId;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

const tenantRecordSchema = new Schema<TenantRecord>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    value: { type: String, required: true },
  },
  { timestamps: true },
);

export const TenantRecordModel = model<TenantRecord>("TenantIsolationFixture", tenantRecordSchema);
const scopedRecords = tenantScoped(TenantRecordModel);

export const tenantRecordResource = {
  async create(tenantId: Types.ObjectId, value: string): Promise<{ id: string }> {
    const record = await scopedRecords.create(tenantId, { value });
    return { id: record._id.toString() };
  },
  async findById(
    tenantId: Types.ObjectId,
    id: string,
  ): Promise<{ id: string; value: string } | null> {
    const record = await scopedRecords.findById(tenantId, id);
    return record ? { id: record._id.toString(), value: record.value } : null;
  },
  async updateById(tenantId: Types.ObjectId, id: string, value: string): Promise<number> {
    const result = await scopedRecords.updateById(tenantId, id, { value });
    return result.matchedCount;
  },
  async deleteById(tenantId: Types.ObjectId, id: string): Promise<number> {
    const result = await scopedRecords.deleteById(tenantId, id);
    return result.deletedCount;
  },
  async list(tenantId: Types.ObjectId): Promise<Array<{ id: string }>> {
    const records = await scopedRecords.find(tenantId);
    return records.map((record) => ({ id: record._id.toString() }));
  },
};
