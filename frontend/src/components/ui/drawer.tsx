import type { ReactNode } from "react";
import { Modal } from "./modal";

export function Drawer(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Modal
      {...props}
      overlayClassName="ui-drawer-overlay"
      className="ui-drawer"
    />
  );
}
