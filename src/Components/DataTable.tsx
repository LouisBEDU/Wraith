import type { ReactNode } from "react";

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
};

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  minWidth = "min-w-0",
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="card shrink-0 flex flex-col items-center justify-center gap-3 py-16 text-center text-anthracite-400">
        {empty}
      </div>
    );
  }

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
            {rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-paper-dim transition-colors">
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
    </div>
  );
}
