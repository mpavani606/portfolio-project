import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { useApiForm } from "./use-api-form";

function FormHarness() {
  const form = useForm<{ email: string }>();
  const { applyApiError } = useApiForm(form);
  return (
    <form onSubmit={form.handleSubmit(() => undefined)}>
      <label htmlFor="email">Email</label>
      <input id="email" {...form.register("email")} />
      {form.formState.errors.email && (
        <p role="alert">{form.formState.errors.email.message}</p>
      )}
      <button
        type="button"
        onClick={() =>
          applyApiError(
            new ApiError("Request invalid", {
              code: "VALIDATION_ERROR",
              status: 400,
              fields: { email: ["Email is already in use"] },
            }),
          )
        }
      >
        Apply server error
      </button>
    </form>
  );
}

describe("useApiForm", () => {
  it("maps API field errors onto form fields", async () => {
    const user = userEvent.setup();
    render(<FormHarness />);
    await user.click(
      screen.getByRole("button", { name: "Apply server error" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Email is already in use",
    );
  });
});
