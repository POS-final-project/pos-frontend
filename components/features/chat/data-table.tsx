interface DataTableProps {
  columns: string[];
  rows: (string | number | null)[][];
}

export function DataTable({ columns, rows }: DataTableProps) {
  if (!columns?.length || !rows?.length) return null;

  return (
    <div
      style={{
        overflowX: "auto",
        marginTop: 12,
        borderRadius: 8,
        border: "1px solid oklch(0.905 0.007 80)",
        background: "#ffffff",
      }}
    >
      <table style={{ fontSize: 12, width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                style={{
                  padding: "7px 12px",
                  textAlign: "left",
                  fontWeight: 600,
                  fontSize: 10.5,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "oklch(0.52 0.012 260)",
                  background: "oklch(0.97 0.004 80)",
                  borderBottom: "1px solid oklch(0.905 0.007 80)",
                  whiteSpace: "nowrap",
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{
                background: i % 2 === 0 ? "#ffffff" : "oklch(0.99 0.002 80)",
              }}
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    padding: "6px 12px",
                    color: "oklch(0.20 0.02 260)",
                    borderBottom:
                      i < rows.length - 1
                        ? "1px solid oklch(0.94 0.004 80)"
                        : "none",
                    whiteSpace: "nowrap",
                    fontSize: 12.5,
                  }}
                >
                  {cell ?? "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p
        style={{
          fontSize: 10.5,
          color: "oklch(0.65 0.008 260)",
          padding: "5px 12px",
          margin: 0,
          borderTop:
            rows.length > 0 ? "1px solid oklch(0.94 0.004 80)" : "none",
        }}
      >
        {rows.length} baris
      </p>
    </div>
  );
}
