import { useCallback, useEffect, useState } from 'react';
import { getDashboardKpis, type DashboardKpis } from './gas/client';

type LoadState = 'loading' | 'ready' | 'error';

const metrics = (kpis: DashboardKpis) => [
  { label: '総リード数', value: kpis.totalLeads.toLocaleString('ja-JP'), help: `インバウンド ${kpis.leadsIn.toLocaleString('ja-JP')} / アウトバウンド ${kpis.leadsOut.toLocaleString('ja-JP')}` },
  { label: '進行中の商談', value: kpis.activeDeals.toLocaleString('ja-JP'), help: '現在アクティブな商談' },
  { label: '成約数', value: kpis.wonDeals.toLocaleString('ja-JP'), help: `失注 ${kpis.lostDeals.toLocaleString('ja-JP')}` },
  { label: '成約率', value: `${kpis.conversionRate.toLocaleString('ja-JP')}%`, help: '成約 / 成約＋失注' }
];

export default function App() {
  const [state, setState] = useState<LoadState>('loading');
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      setKpis(await getDashboardKpis());
      setState('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'データを読み込めませんでした。');
      setState('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <div className="eyebrow">Frontend foundation</div>
          <h1>ダッシュボード</h1>
          <p className="subtitle">React + Vite のDEV限定技術実証</p>
        </div>
        <button className="refresh" type="button" onClick={() => void load()} disabled={state === 'loading'}>
          {state === 'loading' ? '読み込み中…' : '更新'}
        </button>
      </header>

      {state === 'error' && <section className="status error" role="alert">読み込みに失敗しました: {error}</section>}
      {state === 'loading' && <section className="status" aria-live="polite">KPIを読み込んでいます…</section>}
      {state === 'ready' && kpis && (
        <section className="metric-grid" aria-label="主要指標">
          {metrics(kpis).map((metric) => (
            <article className="card" key={metric.label}>
              <div className="metric-label">{metric.label}</div>
              <div className="metric-value">{metric.value}</div>
              <div className="metric-help">{metric.help}</div>
            </article>
          ))}
        </section>
      )}

      <p className="note">この画面は既存の読み取り専用KPI関数のみを利用します。シート設定・環境分岐・書込み処理は追加しません。</p>
    </main>
  );
}
