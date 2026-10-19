import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { mockEvents, mockAnalytics } from '../lib/mockData';

const data = [
  { time: '00:00', crossings: 2 }, { time: '04:00', crossings: 1 },
  { time: '08:00', crossings: 5 }, { time: '12:00', crossings: 4 },
  { time: '16:00', crossings: 8 }, { time: '20:00', crossings: 3 },
];

export default function History() {
  return (
    <div className="p-8 space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Crossings', value: mockAnalytics.totalCrossings, color: 'blue' },
          { label: 'Avg Latency', value: `${mockAnalytics.avgLatency}ms`, color: 'emerald' },
          { label: 'False Positives', value: `${mockAnalytics.falsePositiveRate * 100}%`, color: 'orange' },
          { label: 'Uptime', value: `${mockAnalytics.uptime}%`, color: 'purple' },
        ].map(stat => (
          <div key={stat.label} className={`bg-gradient-to-br from-${stat.color}-50 to-${stat.color}-100 p-6 rounded-2xl border border-${stat.color}-200 shadow-sm hover:shadow-md transition-shadow`}>
            <div className={`text-${stat.color}-600 text-xs font-bold uppercase tracking-wider`}>{stat.label}</div>
            <div className={`text-3xl font-mono font-bold text-${stat.color}-700 mt-2`}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-slate-500 text-xs font-bold uppercase mb-6">Crossing Activity (24h)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="time" stroke="#94A3B8" fontSize={10} fontFamily="IBM Plex Mono" />
              <YAxis stroke="#94A3B8" fontSize={10} fontFamily="IBM Plex Mono" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#1E293B' }}
                itemStyle={{ color: '#2563EB' }}
              />
              <Line type="stepAfter" dataKey="crossings" stroke="#2563EB" strokeWidth={3} dot={{ fill: '#2563EB', r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm font-mono">
          <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold">
            <tr>
              <th className="p-4">Timestamp</th>
              <th className="p-4">Type</th>
              <th className="p-4">Score</th>
              <th className="p-4">Latency</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mockEvents.map(event => (
              <tr key={event.id} className="text-slate-800 hover:bg-slate-50 transition-colors">
                <td className="p-4">{new Date(event.timestamp).toLocaleString()}</td>
                <td className="p-4 capitalize font-bold text-blue-600">{event.type}</td>
                <td className="p-4 font-bold">{event.fusionScore}</td>
                <td className="p-4 text-orange-600 font-bold">{event.latencyMs}ms</td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${event.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                    {event.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
