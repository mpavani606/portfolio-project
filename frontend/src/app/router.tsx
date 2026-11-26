import { Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Skeleton } from "../components/ui";
import { appRoutes } from "./routes";

const router = createBrowserRouter(appRoutes);

export function AppRouter() {
  return (
    <Suspense
      fallback={
        <main className="page-container">
          <Skeleton label="Loading page" />
        </main>
      }
    >
      <RouterProvider router={router} />
    </Suspense>
  );
}
