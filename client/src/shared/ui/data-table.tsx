import { type ReactNode } from "react";
import { cn } from "cn";

export type DataTableColumn<TRecord> = {
  readonly key: string;
  readonly header: ReactNode;
  readonly className?: string;
  readonly render: (record: TRecord) => ReactNode;
};

export type DataTableProps<TRecord> = {
  readonly columns: ReadonlyArray<DataTableColumn<TRecord>>;
  readonly records: ReadonlyArray<TRecord>;
  readonly getRowKey: (record: TRecord) => string | number;
  readonly empty?: ReactNode;
  readonly className?: string;
};

export function DataTable<TRecord>({
  columns,
  records,
  getRowKey,
  empty,
  className,
}: DataTableProps<TRecord>): ReactNode {
  if (records.length === 0) {
    return <>{empty}</>;
  }

  return (
    <div
      className={cn(
        "border-border bg-card overflow-x-auto rounded-xl border shadow-sm",
        className,
      )}
    >
      <table className="divide-border min-w-full divide-y text-left text-sm">
        <thead className="bg-secondary/50 text-muted-foreground text-xs tracking-wide uppercase">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="px-4 py-3 font-medium"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {records.map((record) => (
            <tr key={getRowKey(record)} className="align-top">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn("px-4 py-3", column.className)}
                >
                  {column.render(record)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
