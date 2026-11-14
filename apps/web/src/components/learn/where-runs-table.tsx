import type { HowItWorksContent } from '../../content/learn/learn-content';

export type WhereRunsTableProps = {
  headers: HowItWorksContent['whereHeaders'];
  rows: HowItWorksContent['whereRows'];
};

const CELL_CLASS = 'px-3 py-2 align-top text-sm';

export function WhereRunsTable({ headers, rows }: WhereRunsTableProps) {
  return (
    <div className="glass overflow-x-auto rounded-[20px] p-2">
      <table data-testid="learn-where-table" className="w-full min-w-[34rem] border-collapse text-left">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} className={`${CELL_CLASS} font-data text-[10px] uppercase tracking-[0.12em] text-[var(--cl-ink-3)]`}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.stage} className="border-t border-[var(--tucu-glass-sub-line)]">
              <th scope="row" className={`${CELL_CLASS} font-semibold text-[var(--cl-ink)]`}>
                {row.stage}
              </th>
              <td className={`${CELL_CLASS} text-[var(--cl-ink-2)]`}>{row.where}</td>
              <td className={`${CELL_CLASS} text-[var(--cl-ink-2)]`}>{row.with}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
