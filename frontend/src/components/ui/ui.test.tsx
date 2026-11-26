import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Drawer,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Modal,
  Pagination,
  Select,
  Skeleton,
  Switch,
  Table,
  Tabs,
  Textarea,
  ToastProvider,
  useToast,
} from "./index";

function ToastHarness() {
  const { showToast } = useToast();
  return (
    <Button onClick={() => showToast("Saved", "success")}>Show toast</Button>
  );
}

describe("UI kit rendering and accessibility", () => {
  it("renders labeled form controls and associates hints and errors", () => {
    render(
      <div>
        <FormField
          id="email"
          label="Email"
          hint="Used for sign in"
          error="Enter a valid email"
        >
          <Input id="wrong-email-id" type="email" />
        </FormField>
        <label>
          <Checkbox aria-label="Accept terms" />
          Accept terms
        </label>
        <Switch label="Public profile" defaultChecked />
        <FormField id="notes" label="Notes">
          <Textarea />
        </FormField>
        <FormField id="country" label="Country">
          <Select>
            <option>Canada</option>
          </Select>
        </FormField>
      </div>,
    );
    const email = screen.getByLabelText("Email");
    expect(email).toHaveAttribute("id", "email");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email.getAttribute("aria-describedby")).toContain("email-hint");
    expect(email.getAttribute("aria-describedby")).toContain("email-error");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email");
    expect(
      screen.getByRole("checkbox", { name: "Accept terms" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Public profile" }),
    ).toBeChecked();
    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
    expect(screen.getByLabelText("Country")).toBeInTheDocument();
  });

  it("renders content, empty/error states, table, pagination, badge, and skeleton", async () => {
    const onRetry = vi.fn();
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(
      <div>
        <Badge>Ready</Badge>
        <Card title="Summary">
          <p>Portfolio summary</p>
        </Card>
        <Table aria-label="Projects">
          <caption>Projects</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Example</td>
            </tr>
          </tbody>
        </Table>
        <Pagination page={1} pages={3} onPageChange={onPageChange} />
        <Skeleton label="Loading projects" />
        <EmptyState
          title="Nothing here"
          description="Add an item to get started."
        />
        <ErrorState description="Try again." onRetry={onRetry} />
      </div>,
    );
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Portfolio summary")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Projects" })).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Loading projects" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Nothing here" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("gives multiple empty states unique, correctly associated heading IDs", () => {
    render(
      <>
        <EmptyState title="First empty" description="First description" />
        <EmptyState title="Second empty" description="Second description" />
      </>,
    );
    const sections = screen.getAllByRole("region");
    const ids = sections.map((section) =>
      section.getAttribute("aria-labelledby"),
    );
    expect(new Set(ids).size).toBe(2);
    sections.forEach((section) => {
      expect(section.querySelector("h2")?.id).toBe(
        section.getAttribute("aria-labelledby"),
      );
    });
  });

  it("uses the FormField id for its label association even when the child has another id", () => {
    render(
      <FormField id="expected-control" label="Display name">
        <Input id="child-control" />
      </FormField>,
    );
    expect(screen.getByLabelText("Display name")).toHaveAttribute(
      "id",
      "expected-control",
    );
  });

  it("supports arrow-key tab selection", async () => {
    const user = userEvent.setup();
    render(
      <Tabs
        items={[
          {
            id: "overview",
            label: "Overview",
            content: <p>Overview content</p>,
          },
          { id: "details", label: "Details", content: <p>Details content</p> },
        ]}
      />,
    );
    const overview = screen.getByRole("tab", { name: "Overview" });
    overview.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Details" })).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Details content");
  });

  it("traps focus in modal and drawer and returns focus to the opener", async () => {
    const user = userEvent.setup();
    function Example() {
      const [open, setOpen] = useState(false);
      const [drawerOpen, setDrawerOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Open dialog</Button>
          <Modal open={open} onClose={() => setOpen(false)} title="Settings">
            <button type="button">First action</button>
            <button type="button">Last action</button>
          </Modal>
          <Button onClick={() => setDrawerOpen(true)}>Open drawer</Button>
          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            title="Filters"
          >
            <p>Filter options</p>
          </Drawer>
        </>
      );
    }
    render(<Example />);
    const opener = screen.getByRole("button", { name: "Open dialog" });
    await user.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    const close = within(dialog).getByRole("button", { name: "Close dialog" });
    expect(close).toHaveFocus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(
      within(dialog).getByRole("button", { name: "Last action" }),
    ).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Open drawer" }));
    expect(screen.getByRole("dialog", { name: "Filters" })).toBeInTheDocument();
    expect(
      document.querySelector(".ui-overlay.ui-drawer-overlay"),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
  });

  it("requires confirmation through an explicit dialog action", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={() => undefined}
        onConfirm={onConfirm}
        title="Delete item"
        description="This cannot be undone."
        confirmLabel="Delete"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("announces toast messages politely", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Show toast" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
  });
});
