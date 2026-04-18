import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer,
]);

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'kpi' | 'table';

export interface SeriesConfig {
  column: string;
  label: string;
}

export interface ChartConfig {
  sourceId: string;
  sql: string;
  chartType: ChartType;
  xAxis: string;
  series: SeriesConfig[];
  title: string;
}

interface DataSource {
  id: string;
  name: string;
  type: string;
}

type Row = Record<string, unknown>;

interface ChartBuilderProps {
  initial?: Partial<ChartConfig>;
  onSave: (config: ChartConfig) => void;
  onCancel: () => void;
}

// ─── ECharts preview ─────────────────────────────────────────────────────────

function EChartsPreview({
  data,
  config,
}: {
  data: Row[];
  config: Omit<ChartConfig, 'sourceId' | 'sql'>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    chartRef.current = echarts.init(containerRef.current);
    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || data.length === 0 || !config.xAxis || config.series.length === 0) return;

    const xValues = data.map((r) => String(r[config.xAxis] ?? ''));
    const option: EChartsOption = buildOption(config.chartType, xValues, data, config);
    chart.setOption(option, { notMerge: true });
  }, [data, config]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: 300, background: '#fafafa', borderRadius: 4 }}
    />
  );
}

function buildOption(
  type: ChartType,
  xValues: string[],
  data: Row[],
  config: Omit<ChartConfig, 'sourceId' | 'sql'>,
): EChartsOption {
  if (type === 'pie') {
    const col = config.series[0]?.column ?? '';
    return {
      title: config.title ? { text: config.title, left: 'center' } : undefined,
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          data: data.map((r) => ({ name: String(r[config.xAxis] ?? ''), value: Number(r[col] ?? 0) })),
        },
      ],
    };
  }

  const isArea = type === 'area';
  const eType = isArea ? 'line' : type === 'bar' || type === 'line' ? type : 'bar';

  return {
    title: config.title ? { text: config.title } : undefined,
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    xAxis: { type: 'category', data: xValues },
    yAxis: { type: 'value' },
    series: config.series.map((s) => ({
      name: s.label,
      type: eType as 'bar' | 'line',
      areaStyle: isArea ? {} : undefined,
      data: data.map((r) => Number(r[s.column] ?? 0)),
    })),
  };
}

// ─── KPI preview (table / kpi types) ─────────────────────────────────────────

function KpiPreview({ data, config }: { data: Row[]; config: Partial<ChartConfig> }) {
  const col = config.series?.[0]?.column ?? '';
  const value = data[0]?.[col];
  const prev = data[1]?.[col];
  const trend = value !== undefined && prev !== undefined ? Number(value) - Number(prev) : undefined;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 160,
        background: '#fafafa',
        borderRadius: 4,
        gap: 8,
      }}
    >
      <div style={{ fontSize: 13, color: '#888' }}>{config.title || col}</div>
      <div style={{ fontSize: 36, fontWeight: 700, color: '#1a1a1a' }}>{String(value ?? '—')}</div>
      {trend !== undefined && (
        <div style={{ fontSize: 13, color: trend >= 0 ? '#16a34a' : '#dc2626' }}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(2)}
        </div>
      )}
    </div>
  );
}

function TablePreview({ data }: { data: Row[] }) {
  if (data.length === 0) return <div style={{ color: '#888', fontSize: 12 }}>No data</div>;
  const cols = Object.keys(data[0]);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th
                key={c}
                style={{ borderBottom: '1px solid #ddd', padding: '4px 8px', textAlign: 'left', color: '#555' }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 8).map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
              {cols.map((c) => (
                <td key={c} style={{ padding: '3px 8px', borderBottom: '1px solid #f0f0f0' }}>
                  {String(row[c] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 8 && <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>+{data.length - 8} more rows</div>}
    </div>
  );
}

// ─── ChartBuilder ─────────────────────────────────────────────────────────────

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'bar', label: 'Bar' },
  { value: 'line', label: 'Line' },
  { value: 'pie', label: 'Pie' },
  { value: 'area', label: 'Area' },
  { value: 'kpi', label: 'KPI Card' },
  { value: 'table', label: 'Data Table' },
];

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#555',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 4,
  padding: '6px 8px',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
};

export default function ChartBuilder({ initial, onSave, onCancel }: ChartBuilderProps) {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [sourceId, setSourceId] = useState(initial?.sourceId ?? '');
  const [sql, setSql] = useState(initial?.sql ?? '');
  const [chartType, setChartType] = useState<ChartType>(initial?.chartType ?? 'bar');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [xAxis, setXAxis] = useState(initial?.xAxis ?? '');
  const [series, setSeries] = useState<SeriesConfig[]>(initial?.series ?? [{ column: '', label: '' }]);
  const [previewData, setPreviewData] = useState<Row[]>([]);
  const [previewError, setPreviewError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/v1/data-sources')
      .then((r) => r.json() as Promise<DataSource[]>)
      .then(setSources)
      .catch(() => {});
  }, []);

  const runPreview = useCallback(async () => {
    if (!sourceId || !sql) return;
    setLoading(true);
    setPreviewError('');
    try {
      const res = await fetch('/api/v1/data-queries/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, query: { sql }, cacheTtl: 30 }),
      });
      if (!res.ok) throw new Error(await res.text());
      const result = (await res.json()) as { data: Row[] };
      setPreviewData(result.data);
    } catch (err) {
      setPreviewError(String(err));
      setPreviewData([]);
    } finally {
      setLoading(false);
    }
  }, [sourceId, sql]);

  const columns = previewData.length > 0 ? Object.keys(previewData[0]) : [];

  const updateSeries = (i: number, field: keyof SeriesConfig, value: string) => {
    setSeries((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
  };

  const addSeries = () => setSeries((prev) => [...prev, { column: '', label: '' }]);
  const removeSeries = (i: number) => setSeries((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = () => {
    if (!sourceId || !sql || !xAxis || series.every((s) => !s.column)) return;
    onSave({ sourceId, sql, chartType, title, xAxis, series: series.filter((s) => s.column) });
  };

  const previewConfig = { chartType, title, xAxis, series };
  const showEChart = previewData.length > 0 && ['bar', 'line', 'pie', 'area'].includes(chartType);
  const showKpi = previewData.length > 0 && chartType === 'kpi';
  const showTable = previewData.length > 0 && chartType === 'table';

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: 8,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        maxWidth: 760,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, color: '#222' }}>Chart Builder</div>

      {/* Source */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Data Source</label>
        {sources.length > 0 ? (
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} style={inputStyle}>
            <option value="">— select —</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.type})
              </option>
            ))}
          </select>
        ) : (
          <input
            style={inputStyle}
            placeholder="Source ID"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
          />
        )}
      </div>

      {/* SQL */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Query (SQL)</label>
        <textarea
          style={{ ...inputStyle, height: 72, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
          placeholder="SELECT category, SUM(views) AS views FROM content_stats GROUP BY category"
          value={sql}
          onChange={(e) => setSql(e.target.value)}
        />
        <button
          onClick={() => void runPreview()}
          disabled={!sourceId || !sql || loading}
          style={{
            alignSelf: 'flex-start',
            padding: '5px 14px',
            fontSize: 12,
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          {loading ? 'Running…' : 'Run Preview'}
        </button>
        {previewError && <div style={{ fontSize: 12, color: '#dc2626' }}>{previewError}</div>}
      </div>

      {/* Chart type */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Chart Type</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CHART_TYPES.map((ct) => (
            <button
              key={ct.value}
              onClick={() => setChartType(ct.value)}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                border: '1px solid',
                borderColor: chartType === ct.value ? '#3b82f6' : '#ddd',
                background: chartType === ct.value ? '#eff6ff' : '#fff',
                color: chartType === ct.value ? '#2563eb' : '#555',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Title (optional)</label>
        <input
          style={inputStyle}
          placeholder="My chart"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* Axis config — not needed for table/kpi-only scenarios */}
      {chartType !== 'table' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>X-Axis / Category column</label>
            {columns.length > 0 ? (
              <select value={xAxis} onChange={(e) => setXAxis(e.target.value)} style={inputStyle}>
                <option value="">— select column —</option>
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <input
                style={inputStyle}
                placeholder="column name"
                value={xAxis}
                onChange={(e) => setXAxis(e.target.value)}
              />
            )}
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Series / Value columns</label>
            {series.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                {columns.length > 0 ? (
                  <select
                    value={s.column}
                    onChange={(e) => updateSeries(i, 'column', e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  >
                    <option value="">— column —</option>
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="column"
                    value={s.column}
                    onChange={(e) => updateSeries(i, 'column', e.target.value)}
                  />
                )}
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="label"
                  value={s.label}
                  onChange={(e) => updateSeries(i, 'label', e.target.value)}
                />
                {series.length > 1 && (
                  <button
                    onClick={() => removeSeries(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addSeries}
              style={{ fontSize: 11, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}
            >
              + Add series
            </button>
          </div>
        </div>
      )}

      {/* Live preview */}
      {previewData.length > 0 && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Preview</label>
          {showEChart && <EChartsPreview data={previewData} config={previewConfig} />}
          {showKpi && <KpiPreview data={previewData} config={{ ...previewConfig, series }} />}
          {showTable && <TablePreview data={previewData} />}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{ padding: '7px 18px', fontSize: 13, border: '1px solid #ddd', background: '#fff', borderRadius: 4, cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!sourceId || !sql}
          style={{ padding: '7px 18px', fontSize: 13, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          Insert Chart
        </button>
      </div>
    </div>
  );
}
