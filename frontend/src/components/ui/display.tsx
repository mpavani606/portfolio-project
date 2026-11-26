import type { HTMLAttributes, ReactNode } from "react";
import { Button } from "./button";

export function Badge({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={["ui-badge", className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </span>
  );
}

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  children: ReactNode;
}

export function Card({ title, children, className = "", ...props }: CardProps) {
  return (
    <section
      className={["ui-card", className].filter(Boolean).join(" ")}
      {...props}
    >
      {title !== undefined && <h2 className="ui-card-heading">{title}</h2>}
      <div className="ui-card-body">{children}</div>
    </section>
  );
}

export function Table({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="ui-table-wrap">
      <table
        className={["ui-table", className].filter(Boolean).join(" ")}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export interface PaginationProps {
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
  label?: string;
}

export function Pagination({
  page,
  pages,
  onPageChange,
  label = "Pagination",
}: PaginationProps) {
  const safePages = Math.max(1, pages);
  return (
    <nav className="ui-pagination" aria-label={label}>
      <span aria-live="polite">
        Page {Math.min(page, safePages)} of {safePages}
      </span>
      <div>
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>{" "}
        <Button
          variant="secondary"
          disabled={page >= safePages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}

export function Skeleton({
  label = "Loading",
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { label?: string }) {
  return (
    <div
      className={["ui-skeleton", className].filter(Boolean).join(" ")}
      role="status"
      aria-label={label}
      {...props}
    />
  );
}
