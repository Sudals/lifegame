import type { ReactNode } from 'react';

export function StatBar({ label, value, max = 100, tone, hint }: { label: string; value: number; max?: number; tone: string; hint?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="stat" title={hint}>
      <span className="stat-label">{label}</span>
      <span className="bar">
        <span className="bar-fill" style={{ width: `${pct}%`, background: tone }} />
      </span>
      <span className="stat-value">{Math.round(value)}</span>
    </div>
  );
}

export function Stars({ n, max = 5 }: { n: number; max?: number }) {
  return (
    <span className="stars" aria-label={`${n}/${max}`}>
      {'★'.repeat(n)}
      <span className="dim">{'★'.repeat(Math.max(0, max - n))}</span>
    </span>
  );
}

export function Panel({ title, children, className = '', right }: { title?: string; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <header className="panel-head">
          <h2>{title}</h2>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Progress({ value, tone = 'var(--accent)' }: { value: number; tone?: string }) {
  return (
    <span className="bar small">
      <span className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: tone }} />
    </span>
  );
}

export const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;
