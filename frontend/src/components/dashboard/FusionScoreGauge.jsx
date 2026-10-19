export default function FusionScoreGauge({ score, threshold }) {
  const isDanger = score >= threshold;
  const segments = [0.25, 0.5, 0.75, 1.0];
  
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <span className="text-slate-500 text-xs font-bold uppercase tracking-wider font-display">Fusion Score Gauge</span>
        <span className={`font-mono text-2xl font-bold ${isDanger ? 'text-red-500' : 'text-blue-600'}`}>
          {score.toFixed(2)}
        </span>
      </div>
      <div className="flex gap-2 h-10">
        {segments.map((seg, i) => {
          const isActive = score >= (i * 0.25);
          const color = score >= threshold 
            ? 'bg-red-500' 
            : (score >= 0.5 ? 'bg-orange-500' : 'bg-emerald-500');
            
          return (
            <div 
              key={i} 
              className={`flex-1 rounded-lg transition-all duration-300 ${
                isActive ? color : 'bg-slate-100'
              } ${isDanger && isActive ? 'animate-pulse' : ''}`}
            />
          );
        })}
      </div>
      <div className="text-[11px] text-slate-400 font-mono flex justify-between">
        <span>0.0</span>
        <span className="text-orange-600 font-semibold">THRESHOLD: {threshold.toFixed(2)}</span>
        <span>1.0</span>
      </div>
    </div>
  );
}
