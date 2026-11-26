import {
  cloneElement,
  forwardRef,
  isValidElement,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from "react";

export const Input = forwardRef<
  HTMLInputElement,
  ComponentPropsWithoutRef<"input">
>(function Input({ className = "", ...props }, ref) {
  return (
    <input
      ref={ref}
      className={["ui-input", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  ComponentPropsWithoutRef<"textarea">
>(function Textarea({ className = "", ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={["ui-textarea", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  ComponentPropsWithoutRef<"select">
>(function Select({ className = "", ...props }, ref) {
  return (
    <select
      ref={ref}
      className={["ui-select", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
});

export function Checkbox({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"input">) {
  return <input type="checkbox" className={className} {...props} />;
}

export interface SwitchProps extends Omit<
  ComponentPropsWithoutRef<"input">,
  "type"
> {
  label?: ReactNode;
}

export function Switch({ label, className = "", ...props }: SwitchProps) {
  return (
    <label className={["ui-switch", className].filter(Boolean).join(" ")}>
      <input type="checkbox" role="switch" {...props} />
      <span className="ui-switch-track" aria-hidden="true" />
      {label !== undefined && <span>{label}</span>}
    </label>
  );
}

export interface FormFieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}

interface DescribedControlProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: FormFieldProps) {
  const hintId = hint ? id + "-hint" : undefined;
  const errorId = error ? id + "-error" : undefined;
  const child = children;
  let control = child;
  if (isValidElement<DescribedControlProps>(child)) {
    const existing = child.props["aria-describedby"];
    const describedBy =
      [existing, hintId, errorId].filter(Boolean).join(" ") || undefined;
    control = cloneElement(child as ReactElement<DescribedControlProps>, {
      id,
      "aria-describedby": describedBy,
      "aria-invalid": error ? true : child.props["aria-invalid"],
    });
  }
  return (
    <div className="ui-field">
      <label className="ui-field-label" htmlFor={id}>
        {label}
      </label>
      {control}
      {hint && (
        <div className="ui-hint" id={hintId}>
          {hint}
        </div>
      )}
      {error && (
        <div className="ui-error-text" id={errorId} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
