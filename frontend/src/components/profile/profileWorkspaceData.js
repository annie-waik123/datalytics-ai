function daysAgoLabel(daysAgo) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function compactNumber(value) {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`
  return value.toLocaleString('en-US')
}

function percentage(value) {
  return `${Number(value || 0).toFixed(1)}%`
}

function getInitials(value = '') {
  const parts = value
    .split(' ')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 2)

  if (!parts.length) return 'DL'
  return parts.map((chunk) => chunk[0]?.toUpperCase() || '').join('')
}

function buildKpiMetrics({ dataset, datasetProfile, savedCharts = [], dashboardState = {}, predictionStatus = {}, completedSteps = {} }) {
  const rowCount = datasetProfile?.totalRowCount || datasetProfile?.rowCount || 0
  const totalDatasets = dataset ? Math.max(7, Math.min(32, 1 + Math.round(rowCount / 2400))) : 6
  const modelsTrained =
    (predictionStatus?.supervised_done ? 4 : 1) +
    (predictionStatus?.unsupervised_done ? 2 : 0) +
    (predictionStatus?.best_done ? 1 : 0)
  const dashboardsCreated = Math.max(3, 1 + Number(Boolean(dashboardState?.widgets?.length)) + Math.min(savedCharts.length, 4))
  const reportsGenerated = Math.max(5, Number(Boolean(completedSteps?.reports)) + dashboardsCreated + 1)
  const queriesProcessed = Math.max(124, rowCount ? Math.round(rowCount * 1.8) : 124)
  const successRate = Math.max(
    72,
    Math.min(
      98,
      78 + (
        Number(Boolean(completedSteps?.exploration))
        + Number(Boolean(completedSteps?.visualization))
        + Number(Boolean(completedSteps?.recommendations))
        + Number(Boolean(completedSteps?.aiInsights))
      ) * 3.4
    )
  )

  return [
    {
      id: 'datasets',
      label: 'Total Datasets Uploaded',
      value: compactNumber(totalDatasets),
      trend: { value: '+12.4%', direction: 'up' },
      sparkline: [18, 22, 20, 24, 26, 29, 31],
      icon: 'dataset',
    },
    {
      id: 'models',
      label: 'Models Trained',
      value: compactNumber(modelsTrained),
      trend: { value: '+8.1%', direction: 'up' },
      sparkline: [8, 9, 10, 11, 12, 13, 15],
      icon: 'model',
    },
    {
      id: 'dashboards',
      label: 'Dashboards Created',
      value: compactNumber(dashboardsCreated),
      trend: { value: '+16.3%', direction: 'up' },
      sparkline: [6, 7, 8, 8, 9, 11, 13],
      icon: 'dashboard',
    },
    {
      id: 'reports',
      label: 'Reports Generated',
      value: compactNumber(reportsGenerated),
      trend: { value: '+5.7%', direction: 'up' },
      sparkline: [14, 16, 18, 17, 19, 20, 22],
      icon: 'report',
    },
    {
      id: 'queries',
      label: 'Queries Processed',
      value: compactNumber(queriesProcessed),
      trend: { value: '+21.9%', direction: 'up' },
      sparkline: [88, 96, 104, 117, 126, 140, 152],
      icon: 'query',
    },
    {
      id: 'success',
      label: 'Success Rate',
      value: percentage(successRate),
      trend: { value: '+2.8%', direction: 'up' },
      sparkline: [74, 76, 77, 79, 82, 84, Number(successRate.toFixed(1))],
      icon: 'success',
    },
  ]
}

function buildDatasets(dataset, datasetProfile) {
  const primaryDataset = dataset?.name || 'revenue_forecast_q2.csv'
  const primaryStatus = dataset ? 'Active' : 'Processing'

  return [
    {
      id: 'ds-primary',
      name: primaryDataset,
      createdDate: daysAgoLabel(3),
      lastModified: daysAgoLabel(0),
      status: primaryStatus,
      type: 'CSV',
    },
    {
      id: 'ds-2',
      name: 'customer_retention_segments.json',
      createdDate: daysAgoLabel(8),
      lastModified: daysAgoLabel(2),
      status: 'Active',
      type: 'API',
    },
    {
      id: 'ds-3',
      name: 'north_region_pipeline.xlsx',
      createdDate: daysAgoLabel(11),
      lastModified: daysAgoLabel(4),
      status: 'Processing',
      type: 'Excel',
    },
    {
      id: 'ds-4',
      name: 'finance_month_end_snapshot.csv',
      createdDate: daysAgoLabel(17),
      lastModified: daysAgoLabel(8),
      status: 'Failed',
      type: 'CSV',
    },
    {
      id: 'ds-5',
      name: datasetProfile?.numericColumns?.[0]
        ? `${datasetProfile.numericColumns[0].toLowerCase()}_cohort_export.csv`
        : 'experiment_cohort_export.csv',
      createdDate: daysAgoLabel(24),
      lastModified: daysAgoLabel(15),
      status: 'Active',
      type: 'CSV',
    },
  ]
}

function buildModels(predictionStatus = {}) {
  return [
    {
      id: 'mdl-1',
      name: predictionStatus?.best_model_name || 'Random Forest Revenue Predictor',
      createdDate: daysAgoLabel(2),
      lastModified: daysAgoLabel(0),
      status: predictionStatus?.best_done ? 'Active' : 'Processing',
      type: 'Supervised',
    },
    {
      id: 'mdl-2',
      name: 'Premium User Churn Classifier',
      createdDate: daysAgoLabel(7),
      lastModified: daysAgoLabel(1),
      status: predictionStatus?.supervised_done ? 'Active' : 'Processing',
      type: 'Classification',
    },
    {
      id: 'mdl-3',
      name: 'Customer Segment Clusters',
      createdDate: daysAgoLabel(12),
      lastModified: daysAgoLabel(5),
      status: predictionStatus?.unsupervised_done ? 'Active' : 'Processing',
      type: 'Clustering',
    },
    {
      id: 'mdl-4',
      name: 'Forecast Drift Watcher',
      createdDate: daysAgoLabel(20),
      lastModified: daysAgoLabel(9),
      status: 'Failed',
      type: 'Monitoring',
    },
  ]
}

function buildDashboards(dataset, dashboardState = {}, savedCharts = []) {
  const widgetCount = dashboardState?.widgets?.length || 0

  return [
    {
      id: 'db-1',
      name: 'Auto Power BI Dashboard',
      createdDate: daysAgoLabel(1),
      lastModified: daysAgoLabel(0),
      status: widgetCount ? 'Active' : 'Processing',
      type: `${Math.max(widgetCount, 4)} widgets`,
    },
    {
      id: 'db-2',
      name: 'Executive Revenue Pulse',
      createdDate: daysAgoLabel(6),
      lastModified: daysAgoLabel(1),
      status: 'Active',
      type: 'Board view',
    },
    {
      id: 'db-3',
      name: 'Retention Command Center',
      createdDate: daysAgoLabel(13),
      lastModified: daysAgoLabel(3),
      status: 'Active',
      type: 'KPI canvas',
    },
    {
      id: 'db-4',
      name: dataset?.name ? `${dataset.name.replace(/\.[^.]+$/, '')} Storyboard` : 'Ops Storyboard',
      createdDate: daysAgoLabel(19),
      lastModified: daysAgoLabel(10),
      status: savedCharts.length ? 'Active' : 'Processing',
      type: 'Slide deck',
    },
  ]
}

function buildReports(completedSteps = {}) {
  return [
    {
      id: 'rp-1',
      name: 'Board Review Packet',
      createdDate: daysAgoLabel(4),
      lastModified: daysAgoLabel(1),
      status: completedSteps?.reports ? 'Active' : 'Processing',
      type: 'PDF',
    },
    {
      id: 'rp-2',
      name: 'Daily Insight Digest',
      createdDate: daysAgoLabel(9),
      lastModified: daysAgoLabel(2),
      status: 'Active',
      type: 'Email brief',
    },
    {
      id: 'rp-3',
      name: 'AI Recommendation Snapshot',
      createdDate: daysAgoLabel(14),
      lastModified: daysAgoLabel(5),
      status: completedSteps?.recommendations ? 'Active' : 'Processing',
      type: 'JSON',
    },
    {
      id: 'rp-4',
      name: 'Weekly Forecast Commentary',
      createdDate: daysAgoLabel(21),
      lastModified: daysAgoLabel(8),
      status: 'Failed',
      type: 'Narrative',
    },
  ]
}

function buildAiFeed(dataset, datasetProfile, predictionStatus = {}) {
  const leadMetric = datasetProfile?.numericColumns?.[0] || 'revenue'
  const segmentMetric = datasetProfile?.categoricalColumns?.[0] || 'segment'

  return [
    {
      id: 'ins-1',
      title: `${leadMetric} trend accelerated this week`,
      severity: 'high',
      time: '5 min ago',
      summary: `AI detected a meaningful uplift in ${leadMetric} after the latest pipeline refresh.`,
      details: `The latest operating window shows a stronger run-rate on ${leadMetric}. Recommended next step: compare conversion and retention signals before scaling the winning workflow.`,
    },
    {
      id: 'ins-2',
      title: `${segmentMetric} performance gap widened`,
      severity: 'medium',
      time: '26 min ago',
      summary: `Top-performing ${segmentMetric} groups are now materially ahead of the trailing cohort.`,
      details: `This gap suggests your current playbook is working unevenly. Clone the strongest messaging, channel mix, or allocation logic into lagging groups for a fast experiment.`,
    },
    {
      id: 'ins-3',
      title: 'Forecast confidence improved',
      severity: predictionStatus?.best_done ? 'positive' : 'medium',
      time: '1 hr ago',
      summary: predictionStatus?.best_done
        ? 'Model selection finished successfully and forecast reliability improved.'
        : 'AI is still evaluating the strongest prediction path for this workspace.',
      details: predictionStatus?.best_done
        ? `The best model now supports more confident planning windows. Use the billing and dashboard sections to align stakeholder reporting with this forecast.`
        : 'Complete model training to turn this into a stable production insight.',
    },
  ]
}

function buildChatHistory(datasetProfile) {
  const metric = datasetProfile?.numericColumns?.[0] || 'sales'
  const segment = datasetProfile?.categoricalColumns?.[0] || 'region'

  return [
    {
      id: 'chat-1',
      title: `Show correlation between ${metric} and retention`,
      time: 'Today, 11:42 AM',
      details: 'Assistant returned a strong positive relationship and suggested monitoring both metrics together in one executive dashboard.',
    },
    {
      id: 'chat-2',
      title: `Which ${segment} cohorts are underperforming?`,
      time: 'Today, 10:18 AM',
      details: 'Assistant highlighted the weakest cohorts, recommended a targeted intervention, and prepared a downloadable recommendation summary.',
    },
    {
      id: 'chat-3',
      title: 'Generate a monthly leadership report',
      time: 'Yesterday, 6:03 PM',
      details: 'Assistant compiled the report outline, key KPIs, and report export suggestions for leadership review.',
    },
  ]
}

function buildRecentQueries(datasetProfile) {
  const dateField = Object.entries(datasetProfile?.types || {}).find(([, type]) => type === 'date')?.[0] || 'date'
  const metric = datasetProfile?.numericColumns?.[0] || 'revenue'

  return [
    {
      id: 'qry-1',
      query: `Compare ${metric} by ${dateField}`,
      time: '3 min ago',
      details: 'Expanded into time-based trend analysis with recommended dashboard views.',
    },
    {
      id: 'qry-2',
      query: 'Predict next month demand',
      time: '18 min ago',
      details: 'Prepared a forecasting workflow and suggested confidence bands for stakeholder review.',
    },
    {
      id: 'qry-3',
      query: 'Show anomaly detection summary',
      time: '42 min ago',
      details: 'Returned suspicious spikes, potential causes, and a prioritized alert list.',
    },
  ]
}

export function buildProfileWorkspaceModel(input = {}) {
  const {
    authProfile,
    dataset,
    datasetProfile,
    savedCharts = [],
    dashboardState = {},
    predictionStatus = {},
    completedSteps = {},
  } = input

  const plan = authProfile?.plan || (predictionStatus?.best_done ? 'Enterprise' : dataset ? 'Pro' : 'Free')
  const role = authProfile?.role || (predictionStatus?.best_done ? 'Admin' : dataset ? 'Analyst' : 'User')
  const fullName = authProfile?.fullName || 'Datalytics User'
  const email = authProfile?.email || 'workspace@datalytics.ai'
  const headline = authProfile?.headline || (
    dataset?.name
      ? `Leading analytics workflows around ${dataset.name}`
      : 'Driving AI-powered analytics and decision intelligence'
  )
  const initials = authProfile?.initials || getInitials(fullName)

  return {
    profile: {
      fullName,
      role,
      email,
      joinDate: 'Jan 18, 2024',
      plan,
      status: 'Active',
      initials,
      avatarUrl: authProfile?.photoURL || '',
      headline,
    },
    metrics: buildKpiMetrics({ dataset, datasetProfile, savedCharts, dashboardState, predictionStatus, completedSteps }),
    work: {
      datasets: buildDatasets(dataset, datasetProfile),
      models: buildModels(predictionStatus),
      dashboards: buildDashboards(dataset, dashboardState, savedCharts),
      reports: buildReports(completedSteps),
    },
    aiFeed: buildAiFeed(dataset, datasetProfile, predictionStatus),
    chatHistory: buildChatHistory(datasetProfile),
    recentQueries: buildRecentQueries(datasetProfile),
    billing: {
      currentPlan: plan,
      usage: [
        { label: 'Datasets', used: dataset ? 7 : 3, total: plan === 'Enterprise' ? 100 : plan === 'Pro' ? 10 : 3 },
        { label: 'Dashboards', used: Math.max(3, (dashboardState?.widgets?.length || 0) > 0 ? 4 : 2), total: plan === 'Enterprise' ? 50 : plan === 'Pro' ? 15 : 3 },
        { label: 'Model Runs', used: predictionStatus?.supervised_done ? 18 : 6, total: plan === 'Enterprise' ? 120 : plan === 'Pro' ? 30 : 5 },
      ],
      history: [
        { id: 'inv-101', date: daysAgoLabel(8), amount: '$79.00', status: 'Paid', invoice: 'INV-2408' },
        { id: 'inv-100', date: daysAgoLabel(39), amount: '$79.00', status: 'Paid', invoice: 'INV-2407' },
        { id: 'inv-099', date: daysAgoLabel(69), amount: '$49.00', status: 'Paid', invoice: 'INV-2406' },
      ],
      comparisonPlans: [
        { name: 'Free', price: '$0', description: 'Explore datasets and basic analytics', highlight: false },
        { name: 'Pro', price: '$79', description: 'Advanced dashboards, reports, and AI insights', highlight: true },
        { name: 'Enterprise', price: '$199', description: 'Security controls, SSO, governance, and scale', highlight: false },
      ],
    },
    security: {
      lastLogin: 'Today, 09:24 AM',
      location: 'Lucknow, India',
      sessions: [
        { id: 's1', device: 'Windows Laptop', browser: 'Chrome 135', location: 'Lucknow, India', active: true, lastSeen: 'Now' },
        { id: 's2', device: 'MacBook Pro', browser: 'Edge 134', location: 'Bengaluru, India', active: false, lastSeen: '2 hours ago' },
        { id: 's3', device: 'iPhone 15', browser: 'Safari', location: 'Lucknow, India', active: false, lastSeen: 'Yesterday' },
      ],
    },
  }
}
