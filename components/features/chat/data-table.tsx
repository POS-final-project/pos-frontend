interface DataTableProps {
  columns: string[];
  rows: (string | number | null)[][];
}

export function DataTable({ columns, rows }: DataTableProps) {
  if (!columns?.length || !rows?.length) return null;

  return (
    <div className="overflow-x-auto mt-2 rounded border border-slate-200">
      <table className="text-xs w-full border-collapse">
        <thead>
          <tr className="bg-slate-50">
            {columns.map((col) => (
              <th
                key={col}
                className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="border-b border-slate-100 px-3 py-2 text-slate-700 whitespace-nowrap"
                >
                  {cell ?? "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-slate-400 px-3 py-1.5">
        {rows.length} baris
      </p>
    </div>
  );
}
