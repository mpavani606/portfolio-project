import { lazy } from "react";
import type { RouteObject } from "react-router-dom";
import { AuthLayout, DashboardLayout, PublicLayout } from "./layouts";
import { RouterErrorPage } from "./router-error-page";

const HomePage = lazy(() =>
  import("./pages").then((module) => ({ default: module.HomePage })),
);
const NotFoundPage = lazy(() =>
  import("./pages").then((module) => ({ default: module.NotFoundPage })),
);
const StatusPage = lazy(() =>
  import("./pages").then((module) => ({ default: module.StatusPage })),
);

const publicChildren = [
  { index: true, Component: HomePage },
  ...(import.meta.env.DEV ? [{ path: "status", Component: StatusPage }] : []),
  { path: "*", Component: NotFoundPage },
];

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    Component: PublicLayout,
    errorElement: <RouterErrorPage />,
    children: publicChildren,
  },
  {
    path: "/auth/*",
    Component: AuthLayout,
    errorElement: <RouterErrorPage />,
    children: [{ path: "*", Component: NotFoundPage }],
  },
  {
    path: "/dashboard/*",
    Component: DashboardLayout,
    errorElement: <RouterErrorPage />,
    children: [{ path: "*", Component: NotFoundPage }],
  },
];
