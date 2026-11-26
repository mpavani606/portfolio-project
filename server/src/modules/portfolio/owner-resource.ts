import type { RequestHandler, Router } from "express";
import type { HydratedDocument, Model, FilterQuery } from "mongoose";
import type { ZodType } from "zod";
import type { ResourceListQuery } from "../../../../shared/portfolio.js";
import { resourceIdParamsSchema, resourceListQuerySchema, publishStateInputSchema } from "../../../../shared/portfolio.js";
import { getValidated, validate } from "../../middleware/validate.js";
import type { TenantPortfolioRecord } from "../../models/portfolio.js";
import { tenantScoped } from "../../utils/tenant-scoped.js";
import { ApiError } from "../../utils/api-error.js";
import { getTenantId } from "../../utils/request-context.js";
import { ok } from "../../utils/response.js";

export interface OwnerResourceOptions<
  T extends TenantPortfolioRecord,
  CreateInput,
  UpdateInput,
> {
  path: string;
  model: Model<T>;
  createSchema: ZodType<CreateInput>;
  updateSchema: ZodType<UpdateInput>;
  toCreate(input: CreateInput): Omit<Partial<T>, "tenantId">;
  toUpdate(input: UpdateInput): Partial<Omit<T, "tenantId">>;
  serialize(document: HydratedDocument<T>): unknown;
  searchFields: string[];
  sortFields: Record<string, string>;
  statusField?: string;
  statusValues?: string[];
  uniqueField?: string;
  defaultSort?: Record<string, 1 | -1>;
  beforeCreate?(tenantId: import("mongoose").Types.ObjectId, input: CreateInput): Promise<void>;
  beforeUpdate?(
    tenantId: import("mongoose").Types.ObjectId,
    input: UpdateInput,
    id: string,
  ): Promise<void>;
  beforeDelete?(tenantId: import("mongoose").Types.ObjectId, id: string): Promise<void>;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

function duplicateAsConflict(field: string): never {
  throw new ApiError(409, "CONFLICT", "A resource with that unique value already exists", {
    [field]: ["This value is already in use"],
  });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFilter<T extends TenantPortfolioRecord>(
  query: ResourceListQuery,
  options: OwnerResourceOptions<T, unknown, unknown>,
): FilterQuery<T> {
  const filter: FilterQuery<T> = {};
  if (query.q) {
    const expression = new RegExp(escapeRegex(query.q), "i");
    Object.assign(filter, {
      $or: options.searchFields.map((field) => ({ [field]: expression })),
    });
  }
  if (query.status) {
    if (!options.statusField || !options.statusValues?.includes(query.status)) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid status filter", {
        status: [`Allowed values: ${(options.statusValues ?? []).join(", ")}`],
      });
    }
    Object.assign(filter, { [options.statusField]: query.status });
  }
  return filter;
}

function getSort<T extends TenantPortfolioRecord>(
  query: ResourceListQuery,
  options: OwnerResourceOptions<T, unknown, unknown>,
): Record<string, 1 | -1> {
  if (!query.sort) {
    return options.defaultSort ?? { createdAt: -1 };
  }
  const descending = query.sort.startsWith("-");
  const requested = descending ? query.sort.slice(1) : query.sort;
  const field = options.sortFields[requested];
  if (!field) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid sort field", {
      sort: [`Allowed values: ${Object.keys(options.sortFields).join(", ")}`],
    });
  }
  return { [field]: descending ? -1 : 1, _id: 1 };
}

export function registerOwnerResource<
  T extends TenantPortfolioRecord,
  CreateInput,
  UpdateInput,
>(router: Router, options: OwnerResourceOptions<T, CreateInput, UpdateInput>): void {
  const scoped = tenantScoped(options.model);

  router.get(
    options.path,
    validate(resourceListQuerySchema, "query"),
    (async (request, response) => {
      const tenantId = getTenantId(request);
      const query = getValidated<ResourceListQuery>(response, "query");
      const filter = buildFilter(query, options);
      const [documents, total] = await Promise.all([
        scoped
          .find(tenantId, filter)
          .sort(getSort(query, options))
          .skip((query.page - 1) * query.limit)
          .limit(query.limit)
          .exec(),
        scoped.countDocuments(tenantId, filter),
      ]);
      ok(response, documents.map(options.serialize), {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      });
    }) as RequestHandler,
  );

  router.post(
    options.path,
    validate(options.createSchema),
    (async (request, response) => {
      const tenantId = getTenantId(request);
      const input = getValidated<CreateInput>(response, "body");
      await options.beforeCreate?.(tenantId, input);
      try {
        const document = await scoped.create(tenantId, options.toCreate(input));
        response.status(201);
        ok(response, options.serialize(document));
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          duplicateAsConflict(options.uniqueField ?? "resource");
        }
        throw error;
      }
    }) as RequestHandler,
  );

  router.get(
    `${options.path}/:id`,
    validate(resourceIdParamsSchema, "params"),
    async (request, response) => {
      const tenantId = getTenantId(request);
      const { id } = getValidated<{ id: string }>(response, "params");
      const document = await scoped.findById(tenantId, id);
      if (!document) {
        throw new ApiError(404, "NOT_FOUND", "Resource not found");
      }
      ok(response, options.serialize(document));
    },
  );

  router.patch(
    `${options.path}/:id/publish`,
    validate(resourceIdParamsSchema, "params"),
    validate(publishStateInputSchema),
    async (request, response) => {
      const tenantId = getTenantId(request);
      const { id } = getValidated<{ id: string }>(response, "params");
      const { publishState } = getValidated<{ publishState: "draft" | "published" }>(response, "body");
      const updated = await options.model.updateOne(
        { _id: id, tenantId },
        { $set: { publishState } },
      );
      if (updated.matchedCount === 0) {
        throw new ApiError(404, "NOT_FOUND", "Resource not found");
      }
      const document = await scoped.findById(tenantId, id);
      if (!document) {
        throw new ApiError(404, "NOT_FOUND", "Resource not found");
      }
      ok(response, options.serialize(document));
    },
  );

  router.patch(
    `${options.path}/:id`,
    validate(resourceIdParamsSchema, "params"),
    validate(options.updateSchema),
    (async (request, response) => {
      const tenantId = getTenantId(request);
      const { id } = getValidated<{ id: string }>(response, "params");
      const input = getValidated<UpdateInput>(response, "body");
      await options.beforeUpdate?.(tenantId, input, id);
      let updated;
      try {
        updated = await scoped.updateById(tenantId, id, options.toUpdate(input));
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          duplicateAsConflict(options.uniqueField ?? "resource");
        }
        throw error;
      }
      if (updated.matchedCount === 0) {
        throw new ApiError(404, "NOT_FOUND", "Resource not found");
      }
      const document = await scoped.findById(tenantId, id);
      if (!document) {
        throw new ApiError(404, "NOT_FOUND", "Resource not found");
      }
      ok(response, options.serialize(document));
    }) as RequestHandler,
  );

  router.delete(
    `${options.path}/:id`,
    validate(resourceIdParamsSchema, "params"),
    async (request, response) => {
      const tenantId = getTenantId(request);
      const { id } = getValidated<{ id: string }>(response, "params");
      await options.beforeDelete?.(tenantId, id);
      const deleted = await scoped.deleteById(tenantId, id);
      if (deleted.deletedCount === 0) {
        throw new ApiError(404, "NOT_FOUND", "Resource not found");
      }
      ok(response, { deleted: true });
    },
  );
}
