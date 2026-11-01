const RECENT_ACTIVITY = [
  { repo: "payments-api", action: "Production release approved", time: "2m ago" },
  { repo: "auth-service", action: "Tests passed (142/142)", time: "8m ago" },
  { repo: "frontend", action: "Release lane healthy", time: "15m ago" },
  { repo: "worker", action: "Lint + security check", time: "23m ago" },
];

export function ActivityStrip() {
  return (
    <section
      className="relative overflow-hidden border-t border-border bg-soft px-[clamp(2rem,7vw,8rem)] py-[clamp(3rem,5vw,5rem)]"
      data-activity-strip="true"
      aria-label="Recent activity"
    >
      <div
        className="pointer-events-none absolute right-0 top-0 h-full w-2/5 bg-[radial-gradient(ellipse_at_right,rgba(0,208,132,0.04)_0%,transparent_70%)]"
        aria-hidden="true"
      />

      <div className="relative flex items-center gap-[0.6rem] mb-4">
        <p className="m-0 inline-flex items-center gap-[0.3rem] font-mono text-[0.72rem] tracking-[0.06em] text-muted-text">
          <span className="text-brand" aria-hidden="true">
            ./
          </span>
          activity/recent.log
        </p>
        <span
          className="inline-block size-1.5 flex-shrink-0 rounded-full bg-success [animation:flowPulse_1.5s_ease-in-out_infinite]"
          aria-hidden="true"
        />
        <span className="font-mono text-[0.68rem] text-muted-text">live</span>
      </div>

      <div className="relative grid gap-1.5">
        {RECENT_ACTIVITY.map((item) => (
          <div
            key={item.repo}
            className="flex items-center gap-[0.8rem] rounded-lg border border-border bg-surface px-[0.9rem] py-[0.65rem] transition-colors duration-150 hover:border-border-brand"
            data-activity-item="true"
          >
            <span
              className="size-[7px] flex-shrink-0 rounded-full bg-success shadow-[0_0_6px_rgba(0,208,132,0.5)]"
              aria-hidden="true"
            />
            <span className="min-w-[110px] font-mono text-[0.78rem] font-semibold text-foreground">
              {item.repo}
            </span>
            <span className="flex-1 text-[0.8rem] text-secondary-text">{item.action}</span>
            <span className="flex-shrink-0 font-mono text-[0.7rem] text-muted-text">{item.time}</span>
          </div>
        ))}
      </div>
    </section>
  );
}


