function Metric({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="label">{label}</span>
      <span className="font-mono text-[15px] font-medium leading-none text-white/90">{value}</span>
    </div>
  );
}

export default function TopBar({ network }) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-4 sm:p-5">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl glass px-3.5 py-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10">
          <svg viewBox="0 0 32 32" className="h-5 w-5">
            <path d="M16 6 L16 26 M9 12 L9 26 M23 9 L23 26" stroke="#36e2c4" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="16" cy="6" r="2.1" fill="#5cf0d6" />
          </svg>
        </div>
        <div className="pr-1">
          <h1 className="text-[15px] font-semibold leading-tight tracking-tight text-white">Aether Health</h1>
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Hong Kong Fleet</p>
        </div>
      </div>

      {network && (
        <div className="pointer-events-auto flex items-center gap-4 rounded-2xl glass px-4 py-2.5 sm:gap-5 sm:px-5">
          <Metric label="Buildings" value={network.totalBuildings} />
          <span className="h-7 w-px hairline" />
          <Metric label="Robots" value={network.activeRobots} />
          <span className="h-7 w-px hairline" />
          <Metric label="Residents" value={network.totalResidents} />
          <span className="hidden h-7 w-px hairline sm:block" />
          <div className="hidden flex-col gap-0.5 sm:flex">
            <span className="label">Checks</span>
            <span className="font-mono text-[15px] font-medium leading-none text-white/90">
              {network.totalChecks.toLocaleString()}
            </span>
          </div>
          <span className="h-7 w-px hairline" />
          <div className="flex flex-col gap-0.5">
            <span className="label">Alerts</span>
            <span className="flex items-center gap-1.5 font-mono text-[15px] font-medium leading-none text-signal-alert">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-signal-alert" />
              {network.alerts}
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
