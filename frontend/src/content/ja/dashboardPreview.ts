export const dashboardPreviewCopy = {
  eyebrow: 'デモ用プレビュー',
  title: 'ダッシュボード',
  subtitle: '仮データ表示（GAS 非接続）',

  sections: {
    followUp: {
      title: 'フォローアップ',
      overdue: '期限超過',
      today: '本日対応',
      upcoming: '今後7日以内',
      urgentBadge: (n: number) => `${n}件`,
      daysAgo: (n: number) => `${n}日前`,
      daysLater: (n: number) => `${n}日後`,
      todayLabel: '本日',
      assignee: '担当',
    },

    goals: {
      title: '目標達成率',
      monthly: '月次',
      weekly: '週次',
      revenue: '売上',
      dealCount: '件数',
      closeRate: '受注率',
      actual: '実績',
      target: '目標',
      rate: (n: number) => `${n.toFixed(1)}%`,
      unit: {
        yen: '円',
        count: '件',
        rate: '%',
      },
    },

    leadKpi: {
      title: 'リード KPI',
      totalLeads: 'リード数',
      converted: '成約数',
      excluded: '除外数',
      conversionRate: '転換率',
      prevChange: '前期比',
      periodLabel: '今月',
    },

    salesKpi: {
      title: '売上・受注',
      confirmedRevenue: '確定売上',
      orderCount: '注文件数',
      forecastRevenue: '着地予測',
      openDealCount: '予測内案件数',
      revenuePrevChange: '売上前期比',
      orderCountPrevChange: '件数前期比',
    },

    chart: {
      title: '売上推移（直近6か月）',
      confirmed: '確定売上',
      forecast: '着地予想',
      unit: (v: number): string => {
        if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}億`;
        if (v >= 10_000)      return `${(v / 10_000).toFixed(0)}万`;
        return v.toLocaleString('ja-JP');
      },
    },

    funnel: {
      title: 'ファネル',
      monthElapsed: (pct: number) => `月経過 ${pct}%`,
      leads: 'リード数',
      conversion: '転換率',
      activeDeal: 'アクティブ案件',
      closed: '成約',
      actual: '実績',
      target: '目標',
      count: '件',
      amount: '金額',
      coverage: 'カバレッジ',
      won: '成約',
      lost: '失注',
    },

    aiRecommendations: {
      title: 'AI推薦 — 優先見込み客',
      updatedAtLabel: '',
      scoreLabel: 'スコア',
      stageLabel: 'ステージ',
      assigneeLabel: '担当',
    },

    weeklyAdvisor: {
      title: '週次アドバイザー',
      categoryLabel: {
        action: 'アクション',
        alert: '警告',
        insight: 'インサイト',
      } as Record<string, string>,
    },
  },

  changeLabel: (pct: number): string =>
    pct >= 0 ? `▲${pct.toFixed(1)}%` : `▼${Math.abs(pct).toFixed(1)}%`,
  yenFormat: (v: number): string => `¥${v.toLocaleString('ja-JP')}`,
  rateFormat: (v: number): string => `${v.toFixed(1)}%`,
  countFormat: (v: number): string => `${v.toLocaleString('ja-JP')}件`,

  /** Month suffix used in chart X-axis labels (e.g. "3" + monthSuffix) */
  monthSuffix: '月',

  /** Fake customer / assignee names used only in previewAdapter (no real data) */
  fakeCustomers: [
    'Pacific Card Traders LLC',
    'Northwind Hobby Distribution Ltd',
    'Aurora Collectibles GmbH',
    'Silverline Trading Pty Ltd',
    'Meridian Imports S.A.',
    'Coastline Games & More LLC',
    'Redwood Specialty Goods Ltd',
    'Glacier Wholesale GmbH',
    'Ironwood Distributors Pty Ltd',
    'Crestview Commerce S.A.',
  ] as readonly string[],
  fakeAssignees: ['山田', '鈴木', '佐藤', '高橋', '伊藤'] as readonly string[],

  /** Fake AI recommendation data — previewAdapter only */
  fakeAiRecommendations: {
    updatedAt: '2026年8月26日 更新',
    reasons: ['過去購買×商談活発', '問い合わせ急増', 'メール開封率高', '長期放置リード', '同業他社比較中'] as readonly string[],
    stages:  ['商談中', '初回接触', 'ナーチャリング', '放置リード', '提案済み'] as readonly string[],
  },

  /** Fake weekly advisor data — previewAdapter only */
  fakeWeeklyAdvisor: {
    weekLabel: '8月25日週',
    cards: [
      {
        title: '今週の最優先アクション',
        body: '商談中リードが12件滞留しています。うち3件は2週間以上進展がなく、クロージング活動を推奨します。',
        category: 'action' as const,
      },
      {
        title: '転換率の警告',
        body: '今月の転換率 12.9% は目標 15.0% を下回っています。リードの質評価基準を見直してください。',
        category: 'alert' as const,
      },
      {
        title: '売上トレンド',
        body: '直近3か月の売上は月平均 +7.2% で推移しています。このペースを維持すると月次目標達成率 95% が見込まれます。',
        category: 'insight' as const,
      },
    ] as readonly { title: string; body: string; category: 'action' | 'alert' | 'insight' }[],
  },
} as const;
