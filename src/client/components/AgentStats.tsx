import type { AgentStat } from '../api/types';

type Props = { stats?: AgentStat[] };

export function AgentStats({ stats }: Props) {
  if (!stats?.length) return null;
  return (
    <section className="mt-5 overflow-x-auto rounded border border-stone-200 bg-white shadow-sm">
      <h2 className="border-b border-stone-100 p-4 font-bold">Team performance</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] tracking-wider text-stone-400">
            <th className="px-4 py-2">AGENT</th>
            <th className="px-4 py-2">ASSIGNED</th>
            <th className="px-4 py-2">OPEN</th>
            <th className="px-4 py-2">RESOLVED</th>
            <th className="px-4 py-2">AVG FIRST RESPONSE (BUSINESS MIN)</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((stat) => (
            <tr key={stat.agent.id} className="border-t border-stone-100">
              <td className="px-4 py-2 font-semibold">{stat.agent.name}</td>
              <td className="px-4 py-2">{stat.assignedTickets}</td>
              <td className="px-4 py-2">{stat.openAssigned}</td>
              <td className="px-4 py-2">{stat.resolvedTickets}</td>
              <td className="px-4 py-2">{stat.avgFirstResponseBusinessMinutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
