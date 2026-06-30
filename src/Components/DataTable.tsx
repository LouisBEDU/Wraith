import { useState, type MouseEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../lib/toast";
import ContextMenu, { type ContextMenuItem } from "./ContextMenu";
import { ChevronDownIcon, CopyIcon } from "./icons";

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right";
};

export type DataTableGroup<T> = {
  id: string;
  title: ReactNode;
  actions?: ReactNode;
  rows: T[];
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty: ReactNode;
  minWidth?: string;
  loading?: boolean;
  rowActions?: (row: T) => ContextMenuItem[];
  groups?: DataTableGroup<T>[];
};

const SKELETON_ROWS = 5;

type MenuState = { x: number; y: number; items: ContextMenuItem[] };

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  minWidth = "min-w-0",
  loading = false,
  rowActions,
  groups,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const toast = useToast();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("contextMenu.copied"));
    } catch {
      toast.error(t("contextMenu.copyFailed"));
    }
  }

  function handleRowContextMenu(e: MouseEvent<HTMLTableRowElement>, row: T) {
    e.preventDefault();
    const cellText = (e.target as HTMLElement).closest("td")?.innerText.trim() ?? "";
    const rowText = Array.from(e.currentTarget.querySelectorAll("td"))
      .map((td) => (td as HTMLElement).innerText.trim())
      .filter(Boolean)
      .join("\t");

    const items: ContextMenuItem[] = [];
    if (cellText) {
      items.push({
        id: "copy-cell",
        label: t("contextMenu.copyCell"),
        icon: <CopyIcon className="h-4 w-4" />,
        onSelect: () => copy(cellText),
      });
    }
    if (rowText) {
      items.push({
        id: "copy-row",
        label: t("contextMenu.copyRow"),
        icon: <CopyIcon className="h-4 w-4" />,
        onSelect: () => copy(rowText),
      });
    }

    const actions = rowActions?.(row) ?? [];
    if (items.length > 0 && actions.length > 0) items.push({ type: "separator" });
    items.push(...actions);

    if (items.length > 0) setMenu({ x: e.clientX, y: e.clientY, items });
  }
  // Aucune donnée et pas de chargement en cours → vrai état vide.
  if (rows.length === 0 && !loading) {
    return (
      <div className="card shrink-0 flex flex-col items-center justify-center gap-3 py-16 text-center text-anthracite-400">
        {empty}
      </div>
    );
  }

  const showSkeleton = rows.length === 0 && loading;
  const grouped = !showSkeleton && groups !== undefined && groups.length > 0;

  function toggleGroup(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const renderRow = (row: T) => (
    <tr
      key={rowKey(row)}
      className="hover:bg-paper-dim transition-colors"
      onContextMenu={(e) => handleRowContextMenu(e, row)}
    >
      {columns.map((col) => (
        <td
          key={col.id}
          className={`px-5 py-3 ${col.align === "right" ? "text-right" : ""} ${
            col.className ?? ""
          }`}
        >
          {col.cell(row)}
        </td>
      ))}
    </tr>
  );

  const renderCollapsibleRow = (row: T, open: boolean) => (
    <tr
      key={rowKey(row)}
      className="hover:bg-paper-dim transition-colors"
      onContextMenu={(e) => handleRowContextMenu(e, row)}
    >
      {columns.map((col) => (
        <td
          key={col.id}
          className={`p-0 ${open ? "border-b border-anthracite-100" : ""} ${col.className ?? ""}`}
        >
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-out"
            style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
          >
            <div className="min-h-0 overflow-hidden">
              <div className={`px-5 py-3 ${col.align === "right" ? "text-right" : ""}`}>
                {col.cell(row)}
              </div>
            </div>
          </div>
        </td>
      ))}
    </tr>
  );

  return (
    <div className="card shrink-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className={`w-full ${minWidth} text-sm`}>
          <thead>
            <tr className="bg-anthracite-50 text-left text-xs uppercase tracking-wide text-anthracite-500">
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={`px-5 py-3 font-medium ${col.align === "right" ? "text-right" : ""} ${
                    col.className ?? ""
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={grouped ? "" : "divide-y divide-anthracite-100"}>
            {showSkeleton
              ? Array.from({ length: SKELETON_ROWS }).map((_, rowIndex) => (
                  <tr key={`skeleton-${rowIndex}`}>
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={`px-5 py-3 ${col.className ?? ""}`}
                      >
                        <div
                          className={`h-4 animate-pulse rounded bg-anthracite-100 ${
                            col.align === "right" ? "ml-auto w-8" : "w-2/3"
                          }`}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : grouped
                ? groups!.map((group) => {
                    const open = !collapsed.has(group.id);
                    return [
                      <tr
                        key={`group-${group.id}`}
                        className="border-t border-anthracite-100 bg-anthracite-50/70"
                      >
                        <td colSpan={columns.length} className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="icon-btn shrink-0"
                              aria-expanded={open}
                              onClick={() => toggleGroup(group.id)}
                            >
                              <ChevronDownIcon
                                className={`h-4 w-4 transition-transform duration-200 ${
                                  open ? "" : "-rotate-90"
                                }`}
                              />
                            </button>
                            <button
                              type="button"
                              className="min-w-0 flex-1 text-left"
                              onClick={() => toggleGroup(group.id)}
                            >
                              {group.title}
                            </button>
                            {group.actions && (
                              <div className="flex shrink-0 items-center gap-1">
                                {group.actions}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>,
                      ...group.rows.map((row) => renderCollapsibleRow(row, open)),
                    ];
                  })
                : rows.map((row) => renderRow(row))}
          </tbody>
        </table>
      </div>
      {menu && (
        <ContextMenu
          items={menu.items}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
