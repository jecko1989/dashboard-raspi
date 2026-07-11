import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import type { Metric } from '../types';

// Grafico a linea per una singola metrica nel tempo.
interface MetricChartProps {
  title: string;
  metrics: Metric[];
  dataKey: keyof Metric;
  color: string;
  unit?: string;
}

export function MetricChart({ title, metrics, dataKey, color, unit }: MetricChartProps) {
  const data = metrics
    .filter((m) => m[dataKey] != null)
    .map((m) => ({
      time: new Date(m.collected_at).toLocaleTimeString(),
      value: m[dataKey] as number,
    }));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
        {title}
      </h4>
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">Nessun dato</p>
      ) : (
        <div className="h-44 w-full sm:h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#88888822" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={24} />
              <YAxis tick={{ fontSize: 10 }} width={40} unit={unit} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(v: number) => [`${v}${unit ?? ''}`, title]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
