import { useCallback } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { ApiError } from "./api";

export function useApiForm<TValues extends FieldValues>(
  form: UseFormReturn<TValues>,
) {
  const applyApiError = useCallback(
    (error: unknown): boolean => {
      if (!(error instanceof ApiError)) return false;
      if (error.fields) {
        for (const [name, messages] of Object.entries(error.fields)) {
          form.setError(name as Path<TValues>, {
            type: "server",
            message: messages[0] ?? error.message,
          });
        }
      }
      form.setError("root.server" as Path<TValues>, {
        type: "server",
        message: error.fields
          ? "Please correct the highlighted fields."
          : error.message,
      });
      return true;
    },
    [form],
  );

  return { applyApiError };
}
