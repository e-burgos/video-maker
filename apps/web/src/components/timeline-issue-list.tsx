import { issueSeverity } from '../api/timeline-edit/issue-severity';
import type { TimelineIssueSeverity } from '../api/timeline-edit/issue-severity';
import type { TimelineEditIssue } from '../api/timeline-edit/timeline-edit-state';

export type TimelineIssueListProps = {
  issues: readonly TimelineEditIssue[];
};

const SEVERITY_STYLES: Record<TimelineIssueSeverity, string> = {
  'save-blocking': 'border-rose-500/40 bg-rose-500/10 text-rose-100',
  'render-blocking': 'border-amber-500/40 bg-amber-500/10 text-amber-100',
};

export function TimelineIssueList({ issues }: TimelineIssueListProps) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-2">
      {issues.map((issue, index) => {
        const severity = issueSeverity(issue.code);

        return (
          <li
            key={`${issue.code}-${issue.path}-${index}`}
            role="status"
            data-severity={severity}
            className={`rounded-lg border p-3 ${SEVERITY_STYLES[severity]}`}
          >
            <p className="font-mono text-sm font-semibold">{issue.code}</p>
            <p className="mt-1 font-mono text-xs opacity-80">{issue.path}</p>
            <p className="mt-1 text-sm">{issue.message}</p>
          </li>
        );
      })}
    </ul>
  );
}
