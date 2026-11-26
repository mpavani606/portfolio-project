import type { FilterQuery, Model, Types } from "mongoose";

export interface TenantOwned {
  tenantId: Types.ObjectId;
}

export function tenantScoped<T extends TenantOwned>(model: Model<T>) {
  return {
    create(tenantId: Types.ObjectId, document: Omit<Partial<T>, "tenantId">) {
      return model.create({ ...document, tenantId });
    },
    find(tenantId: Types.ObjectId, filter: FilterQuery<T> = {}) {
      return model.find({ ...filter, tenantId });
    },
    findById(tenantId: Types.ObjectId, id: Types.ObjectId | string) {
      return model.findOne({ _id: id, tenantId });
    },
    countDocuments(tenantId: Types.ObjectId, filter: FilterQuery<T> = {}) {
      return model.countDocuments({ ...filter, tenantId });
    },
    updateById(
      tenantId: Types.ObjectId,
      id: Types.ObjectId | string,
      update: Partial<Omit<T, "tenantId">>,
    ) {
      return model.updateOne({ _id: id, tenantId }, { $set: { ...update, tenantId } });
    },
    deleteById(tenantId: Types.ObjectId, id: Types.ObjectId | string) {
      return model.deleteOne({ _id: id, tenantId });
    },
  };
}
