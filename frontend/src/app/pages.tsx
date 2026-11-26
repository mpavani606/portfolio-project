import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, ErrorState, Skeleton } from "../components/ui";
import { apiRequest, ApiError } from "../lib/api";

export function HomePage() {
  return (
    <section className="foundation-hero">
      <p className="ui-badge">Portfolio platform</p>
      <h1>A clear home for your work.</h1>
      <p>
        Build a thoughtful portfolio that brings your projects, skills, and
        career story together.
      </p>
      {import.meta.env.DEV && (
        <div className="foundation-actions">
          <Link className="ui-button" to="/status">
            Check service status
          </Link>
        </div>
      )}
    </section>
  );
}

export function NotFoundPage() {
  return (
    <section className="status-panel">
      <p className="ui-badge">404</p>
      <h1>Page not found</h1>
      <p>The address may be incorrect, or the page may have moved.</p>
      <Link className="ui-button" to="/">
        Return home
      </Link>
    </section>
  );
}

export function StatusPage() {
  const query = useQuery({
    queryKey: ["system", "ready"],
    queryFn: () => apiRequest<{ status: string }>("/api/ready"),
    retry: false,
  });
  return (
    <section className="status-panel" aria-labelledby="status-title">
      <p className="ui-badge">Development diagnostics</p>
      <h1 id="status-title">Service status</h1>
      <p>
        Readiness is checked directly against the backend readiness endpoint.
      </p>
      {query.isPending && <Skeleton label="Checking service readiness" />}
      {query.isError && (
        <ErrorState
          title="Service not ready"
          description={
            query.error instanceof ApiError && query.error.status === 0
              ? "The backend could not be reached. Start the server and try again."
              : "The backend is not ready. Check that its database connection is available."
          }
          onRetry={() => void query.refetch()}
        />
      )}
      {query.isSuccess && (
        <Card title="Backend">
          <p className="status-indicator">
            <span
              className="status-dot"
              data-ready={query.data.status === "ready"}
              aria-hidden="true"
            />
            {query.data.status === "ready" ? "Ready" : "Not ready"}
          </p>
        </Card>
      )}
    </section>
  );
}
