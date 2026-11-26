import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export function Tabs({
  items,
  label = "Content tabs",
}: {
  items: TabItem[];
  label?: string;
}) {
  const [selected, setSelected] = useState(
    () => items.find((item) => !item.disabled)?.id ?? "",
  );
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = items.length - 1;
    else
      nextIndex =
        (index + (event.key === "ArrowRight" ? 1 : -1) + items.length) %
        items.length;
    while (items[nextIndex]?.disabled && nextIndex !== index) {
      nextIndex =
        (nextIndex + (event.key === "ArrowRight" ? 1 : -1) + items.length) %
        items.length;
    }
    const next = items[nextIndex];
    if (next && !next.disabled) {
      setSelected(next.id);
      refs.current[nextIndex]?.focus();
    }
  }

  const active = items.find((item) => item.id === selected);
  return (
    <div>
      <div className="ui-tabs-list" role="tablist" aria-label={label}>
        {items.map((item, index) => (
          <button
            key={item.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            id={"tab-" + item.id}
            className="ui-tab"
            type="button"
            role="tab"
            aria-selected={item.id === selected}
            aria-controls={"panel-" + item.id}
            tabIndex={item.id === selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => setSelected(item.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {active && (
        <div
          id={"panel-" + active.id}
          role="tabpanel"
          aria-labelledby={"tab-" + active.id}
          tabIndex={0}
        >
          {active.content}
        </div>
      )}
    </div>
  );
}
