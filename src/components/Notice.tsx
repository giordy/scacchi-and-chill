import {
  NoticeState,
} from '../types';

export function Notice({ notice }: { notice: NoticeState | null }) {
  if (!notice) return null;
  return (
    <div className={"notice " + notice.kind} role="status" aria-live="polite">
      {notice.text}
      {notice.items && (
        <ul>
          {notice.items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
