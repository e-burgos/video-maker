import { issueSeverity } from '../api/timeline-edit/issue-severity';
import type { TimelineIssueSeverity } from '../api/timeline-edit/issue-severity';
import type { TimelineEditIssue } from '../api/timeline-edit/timeline-edit-state';

export type TimelineIssueListProps = {
  issues: readonly TimelineEditIssue[];
};

const SEVERITY_STYLES: Record<TimelineIssueSeverity, string> = {
  'save-blocking': 'border-[var(--tucu-state-red-line)] bg-[var(--tucu-state-red-soft)]',
  'render-blocking': 'border-[var(--tucu-state-orange-line)] bg-[var(--tucu-state-orange-soft)]',
  warning: 'border-[var(--tucu-state-teal-line)] bg-[var(--tucu-state-teal-soft)]',
};

export function TimelineIssueList({ issues }: TimelineIssueListProps) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {issues.map((issue, index) => {
        const severity = issueSeverity(issue.code);

        return (
          <li
            key={`${issue.code}-${issue.path}-${index}`}
            role="status"
            data-severity={severity}
            className={`rounded-[12px] border p-3 text-[var(--cl-ink)] ${SEVERITY_STYLES[severity]}`}
          >
            <p className="font-data m-0 text-sm font-semibold">{issue.code}</p>
            <p className="font-data m-0 mt-1 text-xs text-[var(--cl-ink-2)]">{issue.path}</p>
            <p className="m-0 mt-1 text-sm">{issue.message}</p>
          </li>
        );
      })}
    </ul>
  );
}
