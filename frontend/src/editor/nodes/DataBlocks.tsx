import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DecoratorNode, type LexicalNode, type NodeKey, type SerializedLexicalNode } from 'lexical';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
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
import type { ChartConfig, ChartType, SeriesConfig } from '../../features/data-viz/ChartBuilder';

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

// ─── Shared types ─────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

interface QueryResult {
  data: Row[];
}

async function fetchQueryData(sourceId: string, sql: string): Promise<Row[]> {
  const res = await fetch('/api/v1/data-queries/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceId, query: { sql }, cacheTtl: 60 }),
  });
  if (!res.ok) throw new Error(`Query failed: ${res.status}`);
  const result = (await res.json()) as QueryResult;
  return result.data;
}

// ─── Shared selection overlay ─────────────────────────────────────────────────

function useBlockSelection(nodeKey: NodeKey) {
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const [editor] = useLexicalComposerContext();
  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      clearSelection();
      setSelected(true);
    },
    [clearSelection, setSelected],
  );
  return { isSelected, editor, onClick };
}

const blockWrapperStyle = (selected: boolean): React.CSSProperties => ({
  position: 'relative',
  border: selected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
  borderRadius: 8,
  overflow: 'hidden',
  cursor: 'pointer',
  background: '#fff',
  userSelect: 'none',
});

// ─── ECharts inline renderer ──────────────────────────────────────────────────

function buildEOption(type: ChartType, data: Row[], xAxis: string, series: SeriesConfig[], title: string): EChartsOption {
  const xValues = data.map((r) => String(r[xAxis] ?? ''));

  if (type === 'pie') {
    const col = series[0]?.column ?? '';
    return {
      title: title ? { text: title, left: 'center', textStyle: { fontSize: 13 } } : undefined,
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: '65%',
          data: data.map((r) => ({ name: String(r[xAxis] ?? ''), value: Number(r[col] ?? 0) })),
        },
      ],
    };
  }

  const isArea = type === 'area';
  const eType: 'bar' | 'line' = isArea || type === 'line' ? 'line' : 'bar';

  return {
    title: title ? { text: title, textStyle: { fontSize: 13 } } : undefined,
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    grid: { left: 40, right: 20, top: title ? 36 : 16, bottom: 32 },
    xAxis: { type: 'category', data: xValues, axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 11 } },
    series: series.map((s) => ({
      name: s.label || s.column,
      type: eType,
      areaStyle: isArea ? { opacity: 0.2 } : undefined,
      data: data.map((r) => Number(r[s.column] ?? 0)),
    })),
  };
}

// ─── ChartBlockNode ───────────────────────────────────────────────────────────

export interface SerializedChartBlockNode extends SerializedLexicalNode {
  config: ChartConfig;
}

function ChartBlockComponent({ nodeKey, config }: { nodeKey: NodeKey; config: ChartConfig }) {
  const { isSelected, onClick } = useBlockSelection(nodeKey);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [data, setData] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchQueryData(config.sourceId, config.sql)
      .then((rows) => { if (!cancelled) { setData(rows); setError(''); } })
      .catch((err: unknown) => { if (!cancelled) setError(String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [config.sourceId, config.sql]);

  useEffect(() => {
    if (!containerRef.current) return;
    chartRef.current = echarts.init(containerRef.current);
    return () => { chartRef.current?.dispose(); chartRef.current = null; };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || data.length === 0) return;
    chart.setOption(buildEOption(config.chartType, data, config.xAxis, config.series, config.title), { notMerge: true });
  }, [data, config]);

  return (
    <div style={blockWrapperStyle(isSelected)} onClick={onClick}>
      {config.title && (
        <div style={{ padding: '8px 12px 0', fontSize: 13, fontWeight: 600, color: '#374151' }}>
          {config.title}
        </div>
      )}
      {loading && (
        <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 12 }}>
          Loading…
        </div>
      )}
      {error && (
        <div style={{ padding: 12, fontSize: 12, color: '#dc2626' }}>{error}</div>
      )}
      {!loading && !error && (
        <div ref={containerRef} style={{ width: '100%', height: 260 }} />
      )}
    </div>
  );
}

export class ChartBlockNode extends DecoratorNode<React.JSX.Element> {
  __config: ChartConfig;

  static getType(): string {
    return 'chart-block';
  }

  static clone(node: ChartBlockNode): ChartBlockNode {
    return new ChartBlockNode(node.__config, node.__key);
  }

  static importJSON(serialized: SerializedChartBlockNode): ChartBlockNode {
    return new ChartBlockNode(serialized.config);
  }

  constructor(config: ChartConfig, key?: NodeKey) {
    super(key);
    this.__config = config;
  }

  exportJSON(): SerializedChartBlockNode {
    return { ...super.exportJSON(), type: 'chart-block', config: this.__config };
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.style.display = 'contents';
    return div;
  }

  updateDOM(): false {
    return false;
  }

  isIsolated(): boolean {
    return true;
  }

  decorate(): React.JSX.Element {
    return <ChartBlockComponent nodeKey={this.__key} config={this.__config} />;
  }
}

export function $createChartBlockNode(config: ChartConfig): ChartBlockNode {
  return new ChartBlockNode(config);
}

export function $isChartBlockNode(node: LexicalNode | null | undefined): node is ChartBlockNode {
  return node instanceof ChartBlockNode;
}

// ─── KpiCardBlockNode ─────────────────────────────────────────────────────────

export interface KpiConfig {
  sourceId: string;
  sql: string;
  valueColumn: string;
  label: string;
  showTrend: boolean;
}

export interface SerializedKpiCardBlockNode extends SerializedLexicalNode {
  config: KpiConfig;
}

function KpiCardComponent({ nodeKey, config }: { nodeKey: NodeKey; config: KpiConfig }) {
  const { isSelected, onClick } = useBlockSelection(nodeKey);
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchQueryData(config.sourceId, config.sql)
      .then((rows) => { if (!cancelled) { setData(rows); setError(''); } })
      .catch((err: unknown) => { if (!cancelled) setError(String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [config.sourceId, config.sql]);

  const value = data[0]?.[config.valueColumn];
  const prev = data[1]?.[config.valueColumn];
  const trend =
    config.showTrend && value !== undefined && prev !== undefined
      ? Number(value) - Number(prev)
      : undefined;

  return (
    <div
      style={{ ...blockWrapperStyle(isSelected), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 120, padding: '20px 24px', gap: 6 }}
      onClick={onClick}
    >
      <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {config.label || config.valueColumn}
      </div>
      {loading && <div style={{ fontSize: 12, color: '#9ca3af' }}>Loading…</div>}
      {error && <div style={{ fontSize: 12, color: '#dc2626' }}>{error}</div>}
      {!loading && !error && (
        <>
          <div style={{ fontSize: 40, fontWeight: 700, color: '#111827', lineHeight: 1 }}>
            {value !== undefined ? String(value) : '—'}
          </div>
          {trend !== undefined && (
            <div style={{ fontSize: 13, fontWeight: 500, color: trend >= 0 ? '#16a34a' : '#dc2626' }}>
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toLocaleString()}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export class KpiCardBlockNode extends DecoratorNode<React.JSX.Element> {
  __config: KpiConfig;

  static getType(): string {
    return 'kpi-card-block';
  }

  static clone(node: KpiCardBlockNode): KpiCardBlockNode {
    return new KpiCardBlockNode(node.__config, node.__key);
  }

  static importJSON(serialized: SerializedKpiCardBlockNode): KpiCardBlockNode {
    return new KpiCardBlockNode(serialized.config);
  }

  constructor(config: KpiConfig, key?: NodeKey) {
    super(key);
    this.__config = config;
  }

  exportJSON(): SerializedKpiCardBlockNode {
    return { ...super.exportJSON(), type: 'kpi-card-block', config: this.__config };
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.style.display = 'contents';
    return div;
  }

  updateDOM(): false {
    return false;
  }

  isIsolated(): boolean {
    return true;
  }

  decorate(): React.JSX.Element {
    return <KpiCardComponent nodeKey={this.__key} config={this.__config} />;
  }
}

export function $createKpiCardBlockNode(config: KpiConfig): KpiCardBlockNode {
  return new KpiCardBlockNode(config);
}

export function $isKpiCardBlockNode(node: LexicalNode | null | undefined): node is KpiCardBlockNode {
  return node instanceof KpiCardBlockNode;
}

// ─── DataTableBlockNode ───────────────────────────────────────────────────────

export interface DataTableConfig {
  sourceId: string;
  sql: string;
  columns: Array<{ key: string; label: string; width?: number }>;
  pageSize: number;
}

export interface SerializedDataTableBlockNode extends SerializedLexicalNode {
  config: DataTableConfig;
}

function DataTableComponent({ nodeKey, config }: { nodeKey: NodeKey; config: DataTableConfig }) {
  const { isSelected, onClick } = useBlockSelection(nodeKey);
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchQueryData(config.sourceId, config.sql)
      .then((rows) => { if (!cancelled) { setData(rows); setError(''); } })
      .catch((err: unknown) => { if (!cancelled) setError(String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [config.sourceId, config.sql]);

  type ColDef = { key: string; label: string; width?: number };
  const cols: ColDef[] = config.columns.length > 0
    ? config.columns
    : data.length > 0
      ? Object.keys(data[0]).map((k) => ({ key: k, label: k }))
      : [];

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        const cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : data;

  const totalPages = Math.max(1, Math.ceil(sorted.length / config.pageSize));
  const pageData = sorted.slice(page * config.pageSize, (page + 1) * config.pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  return (
    <div style={{ ...blockWrapperStyle(isSelected), padding: 0 }} onClick={onClick}>
      {loading && (
        <div style={{ padding: 16, fontSize: 12, color: '#9ca3af' }}>Loading…</div>
      )}
      {error && (
        <div style={{ padding: 12, fontSize: 12, color: '#dc2626' }}>{error}</div>
      )}
      {!loading && !error && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {cols.map((col) => (
                    <th
                      key={col.key}
                      onClick={(e) => { e.stopPropagation(); handleSort(col.key); }}
                      style={{
                        padding: '8px 12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        fontSize: 12,
                        color: '#374151',
                        borderBottom: '1px solid #e5e7eb',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        width: col.width ?? undefined,
                      }}
                    >
                      {col.label}
                      {sortKey === col.key && (
                        <span style={{ marginLeft: 4, opacity: 0.6 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageData.map((row, i) => (
                  <tr
                    key={i}
                    style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}
                  >
                    {cols.map((col) => (
                      <td
                        key={col.key}
                        style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6', color: '#1f2937' }}
                      >
                        {String(row[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
                {pageData.length === 0 && (
                  <tr>
                    <td
                      colSpan={cols.length}
                      style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}
                    >
                      No data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '6px 12px', borderTop: '1px solid #f3f4f6', fontSize: 12, color: '#6b7280' }}
            >
              <button
                disabled={page === 0}
                onClick={(e) => { e.stopPropagation(); setPage((p) => p - 1); }}
                style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 3, padding: '2px 8px', cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}
              >
                ‹
              </button>
              <span>{page + 1} / {totalPages}</span>
              <button
                disabled={page >= totalPages - 1}
                onClick={(e) => { e.stopPropagation(); setPage((p) => p + 1); }}
                style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 3, padding: '2px 8px', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1 }}
              >
                ›
              </button>
              <span style={{ color: '#9ca3af' }}>{data.length} rows</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export class DataTableBlockNode extends DecoratorNode<React.JSX.Element> {
  __config: DataTableConfig;

  static getType(): string {
    return 'data-table-block';
  }

  static clone(node: DataTableBlockNode): DataTableBlockNode {
    return new DataTableBlockNode(node.__config, node.__key);
  }

  static importJSON(serialized: SerializedDataTableBlockNode): DataTableBlockNode {
    return new DataTableBlockNode(serialized.config);
  }

  constructor(config: DataTableConfig, key?: NodeKey) {
    super(key);
    this.__config = config;
  }

  exportJSON(): SerializedDataTableBlockNode {
    return { ...super.exportJSON(), type: 'data-table-block', config: this.__config };
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.style.display = 'contents';
    return div;
  }

  updateDOM(): false {
    return false;
  }

  isIsolated(): boolean {
    return true;
  }

  decorate(): React.JSX.Element {
    return <DataTableComponent nodeKey={this.__key} config={this.__config} />;
  }
}

export function $createDataTableBlockNode(config: DataTableConfig): DataTableBlockNode {
  return new DataTableBlockNode(config);
}

export function $isDataTableBlockNode(
  node: LexicalNode | null | undefined,
): node is DataTableBlockNode {
  return node instanceof DataTableBlockNode;
}
