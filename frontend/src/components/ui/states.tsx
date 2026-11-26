import { useId, type ReactNode } from "react";
import { Button } from "./button";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const titleId = useId();
  return (
    <section className="ui-state" aria-labelledby={titleId}>
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description: string;
  onRetry: () => void;
}) {
  return (
    <section className="ui-state" role="alert">
      <h2>{title}</h2>
      <p>{description}</p>
      <Button variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </section>
  );
}
