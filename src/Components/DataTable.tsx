import { useState, type MouseEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../lib/toast";
import ContextMenu, { type ContextMenuItem } from "./ContextMenu";
import { CopyIcon } from "./icons";

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right";
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty: ReactNode;
  minWidth?: string;
  /** Affiche un squelette de chargement tant qu'aucune donnée n'est encore disponible. */
  loading?: boolean;
  /** Actions métier proposées dans le menu contextuel (clic droit) d'une ligne. */
  rowActions?: (row: T) => ContextMenuItem[];
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
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const toast = useToast();
  const [menu, setMenu] = useState<MenuState | null>(null);

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

  // Premier chargement (pas encore de données en cache) → squelette.
  const showSkeleton = rows.length === 0 && loading;

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
          <tbody className="divide-y divide-anthracite-100">
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
              : rows.map((row) => (
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
                ))}
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
