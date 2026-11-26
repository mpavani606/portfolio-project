import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../components/ui/button";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV)
      console.error("Uncaught UI error", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="error-boundary" role="alert">
          <h1>The page could not be displayed</h1>
          <p>
            Try reloading the page. If the problem continues, return to the home
            page.
          </p>
          <Button onClick={() => window.location.reload()}>Reload page</Button>
        </main>
      );
    }
    return this.props.children;
  }
}
