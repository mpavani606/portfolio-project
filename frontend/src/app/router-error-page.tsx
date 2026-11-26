import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { ErrorState } from "../components/ui";

export function RouterErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? "The requested page could not be loaded."
    : "An unexpected error occurred.";
  return (
    <ErrorState
      title="Page unavailable"
      description={message}
      onRetry={() => window.location.reload()}
    />
  );
}
