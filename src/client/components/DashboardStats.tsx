import type { Dashboard } from '../api/types';

type Props = { dashboard?: Dashboard };

export function DashboardStats({ dashboard }: Props) {
  const tiles: [string, number | undefined][] = [
    ['TOTAL', dashboard?.total],
    ['OPEN', dashboard?.open],
    ['IN PROGRESS', dashboard?.inProgress],
    ['RESOLVED', dashboard?.resolved],
    ['CLOSED', dashboard?.closed],
    ['BREACHED', dashboard?.breached],
  ];
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map(([label, value]) => (
        <div key={label} className="rounded border border-stone-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-bold tracking-[0.14em] text-stone-400">{label}</span>
          <b className="block pt-1 text-2xl">{value ?? '—'}</b>
        </div>
      ))}
    </section>
  );
}
