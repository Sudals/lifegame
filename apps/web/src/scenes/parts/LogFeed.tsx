import type { LogEntry } from '@grad-sim/engine';

export function LogFeed({ log, limit = 30 }: { log: LogEntry[]; limit?: number }) {
  const items = log.slice(-limit).reverse();
  return (
    <ul className="log">
      {items.map((e, i) => (
        <li key={`${e.week}-${log.length - i}`} className={e.tone ?? ''}>
          <span className="log-week">W{e.week + 1}</span> {e.text}
        </li>
      ))}
    </ul>
  );
}
