import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  stale?: boolean;
  className?: string;
  children: ReactNode;
}

export default function Card({ title, subtitle, right, stale, className = '', children }: Props) {
  return (
    <section className={`card ${stale ? 'stale' : ''} ${className}`}>
      <div className="card-head">
        <div>
          <h2 className="card-title">{title}</h2>
          {subtitle && <div className="card-sub">{subtitle}</div>}
        </div>
        <div className="right">
          {stale && <span className="pill warn"><span className="dot" />STALE</span>}
          {right}
        </div>
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}
