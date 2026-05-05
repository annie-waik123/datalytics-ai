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

function buildKpiMetrics({ kpiCounts = {}, completedSteps = {} }) {
  // Merge real-time pipeline progress with historical MongoDB counts
  const datasets   = kpiCounts.datasets   || 0
  const models     = kpiCounts.models     || 0
  const dashboards = kpiCounts.dashboards || 0
  const reports    = kpiCounts.reports    || 0
  const queries    = kpiCounts.queries    || 0
  
  // Calculate real-time pipeline completion from props
  const doneCount = Object.values(completedSteps).filter(Boolean).length
  const totalPossible = Object.keys(completedSteps).length || 10
  const realTimePipeline = Math.round((doneCount / totalPossible) * 100)
  
  const pipeline = kpiCounts.pipeline_completion || realTimePipeline

  const trend = (val, unit = '%') =>
    val > 0 ? { value: `+${val}${unit}`, direction: 'up' } : { value: '—', direction: 'neutral' }

  return [
    {
      id: 'datasets',
      label: 'Total Datasets Uploaded',
      value: compactNumber(datasets),
      trend: trend(datasets > 0 ? 100 : 0),
      sparkline: [0, 2, 1, 4, datasets || 1],
      icon: 'dataset',
    },
    {
      id: 'models',
      label: 'Models Trained',
      value: compactNumber(models),
      trend: trend(models > 0 ? 100 : 0),
      sparkline: [0, 1, 0, 3, models || 1],
      icon: 'model',
    },
    {
      id: 'dashboards',
      label: 'Dashboards Created',
      value: compactNumber(dashboards),
      trend: trend(dashboards > 0 ? 100 : 0),
      sparkline: [0, 0, 1, 2, dashboards || 1],
      icon: 'dashboard',
    },
    {
      id: 'reports',
      label: 'Reports Generated',
      value: compactNumber(reports),
      trend: trend(reports > 0 ? 100 : 0),
      sparkline: [0, 0, 0, 1, reports || 1],
      icon: 'report',
    },
    {
      id: 'queries',
      label: 'Queries Processed',
      value: compactNumber(queries),
      trend: trend(queries > 0 ? queries * 25 : 0),
      sparkline: [0, 5, 12, 8, queries || 1],
      icon: 'query',
    },
    {
      id: 'success',
      label: 'Pipeline Completion',
      value: percentage(pipeline),
      trend: trend(pipeline > 0 ? pipeline : 0),
      sparkline: [0, 20, 45, 70, pipeline || 1],
      icon: 'success',
    },
  ]
}

function buildDatasets(dataset, datasetProfile, predictionStatus, dashboardState, savedCharts, completedSteps) {
  if (!dataset || !dataset.name) {
    try {
      const saved = localStorage.getItem('datalytics_true_history')
      return saved ? JSON.parse(saved) : []
    } catch(e) {
      return []
    }
  }
  
  const extMatch = dataset.name.match(/\.([a-z0-9]+)$/i)
  const ext = extMatch ? extMatch[1] : 'csv'
  const typeStr = ext.toUpperCase()
  const rowCount = datasetProfile?.totalRowCount || dataset?.rows?.length || 0
  const colCount = datasetProfile?.totalColumnCount || dataset?.columns?.length || 0

  let pipelineSteps = ['☁️ Dataset Uploaded']
  if (datasetProfile?.columns?.length > 0) pipelineSteps.push('🤖 AI Profiled')
  if (dashboardState?.widgets?.length > 0 || savedCharts?.length > 0) pipelineSteps.push('📊 Dashboard Built')
  if (predictionStatus?.best_done || predictionStatus?.supervised_done || predictionStatus?.unsupervised_done) pipelineSteps.push('🧠 Models Trained')
  if (completedSteps?.reports) pipelineSteps.push('📄 Reports Generated')
  
  const pipelineJourney = pipelineSteps.join(' ➔ ')

  const currentDataset = {
    id: `ds-${Date.now()}`,
    name: dataset.name,
    time: `Today at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
    userAction: pipelineJourney,
    type: `${typeStr} • ${rowCount} Rows • ${colCount} Cols`,
  }

  let history = []
  try {
    const saved = localStorage.getItem('datalytics_true_history')
    if (saved) {
      history = JSON.parse(saved)
    }
  } catch(e) {}

  // Automatically record this dataset if it isn't literally the exact same one just added
  if (history.length === 0 || history[0].name !== dataset.name) {
    history.unshift(currentDataset)
    // Keep a maximum of 20 strictly real history items
    history = history.slice(0, 20)
    try {
      localStorage.setItem('datalytics_true_history', JSON.stringify(history))
    } catch(e) {}
  } else if (history.length > 0) {
    // Just update the most recent one's time if the name is identical to keep feeling real-time
    history[0].time = currentDataset.time
    history[0].type = currentDataset.type
    history[0].userAction = currentDataset.userAction
    try {
      localStorage.setItem('datalytics_true_history', JSON.stringify(history))
    } catch(e) {}
  }

  // Ensure unique React IDs
  history = history.map((item, index) => ({ ...item, id: `ds-hist-${index}` }))

  return history
}

function buildModels(predictionStatus = {}) {
  if (!predictionStatus || !predictionStatus.best_done) return []

  return [
    {
      id: 'mdl-1',
      name: predictionStatus.best_model_name || 'Trained Predictor',
      createdDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      lastModified: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      status: 'Active',
      type: 'Machine Learning',
    }
  ]
}

function buildDashboards(dataset, dashboardState = {}, savedCharts = []) {
  const widgetCount = dashboardState?.widgets?.length || 0
  if (widgetCount === 0 && savedCharts.length === 0) return []

  return [
    {
      id: 'db-1',
      name: dataset?.name ? `${dataset.name} Dashboard` : 'My Auto Dashboard',
      createdDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      lastModified: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      status: 'Active',
      type: `${widgetCount} widgets`,
    }
  ]
}

function buildReports(completedSteps = {}) {
  if (!completedSteps?.reports) return []

  return [
    {
      id: 'rp-1',
      name: 'Auto PDF Delivery',
      createdDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      lastModified: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      status: 'Active',
      type: 'PDF',
    }
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
    currentPlanOverride,
    kpiCounts = {},
  } = input

  const plan = currentPlanOverride || authProfile?.plan || 'None'
  const role = authProfile?.role || (predictionStatus?.best_done ? 'Admin' : dataset ? 'Analyst' : 'User')
  const fullName = authProfile?.fullName || 'Datalytics User'
  const email = authProfile?.email || 'workspace@datalytics.ai'
  const headline = authProfile?.headline || (
    dataset?.name
      ? `Leading analytics workflows around ${dataset.name}`
      : 'Driving AI-powered analytics and decision intelligence'
  )
  const initials = authProfile?.initials || getInitials(fullName)

  const joinDate = authProfile?.joinedAt 
    ? new Date(authProfile.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Jan 18, 2024'

  return {
    profile: {
      fullName,
      role,
      email,
      joinDate,
      plan,
      status: 'Active',
      initials,
      avatarUrl: authProfile?.photoURL || '',
      headline,
    },
    metrics: buildKpiMetrics({ kpiCounts, completedSteps }),
    work: {
      datasets: buildDatasets(dataset, datasetProfile, predictionStatus, dashboardState, savedCharts, completedSteps),
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
        { label: 'Datasets', used: dataset ? 7 : 3, total: (plan === 'Enterprise' || plan === 'Team') ? 100 : plan === 'Pro' ? 10 : 3 },
        { label: 'Dashboards', used: Math.max(3, (dashboardState?.widgets?.length || 0) > 0 ? 4 : 2), total: (plan === 'Enterprise' || plan === 'Team') ? 50 : plan === 'Pro' ? 15 : 3 },
        { label: 'Model Runs', used: predictionStatus?.supervised_done ? 18 : 6, total: (plan === 'Enterprise' || plan === 'Team') ? 120 : plan === 'Pro' ? 30 : 5 },
      ],
      history: [
        { id: 'inv-101', date: daysAgoLabel(8), amount: '$79.00', status: 'Paid', invoice: 'INV-2408' },
        { id: 'inv-100', date: daysAgoLabel(39), amount: '$79.00', status: 'Paid', invoice: 'INV-2407' },
        { id: 'inv-099', date: daysAgoLabel(69), amount: '$49.00', status: 'Paid', invoice: 'INV-2406' },
      ],
      comparisonPlans: [
        { 
          name: 'Free', 
          tagline: 'Perfect for getting started with core analytics tools.',
          price: '₹0', 
          originalPrice: null,
          priceINR: 0,
          diamonds: 200,
          highlight: false,
          badge: 'Default',
          featuresTitle: null,
          features: [
            'Core dataset upload and analytics dashboard',
            'Basic dataset profiling and summary reports',
            'Single dashboard workspace',
            'Community AI query support',
          ],
          buttonLabel: null,
          displayCredits: '200 Credits'
        },
        { 
          name: 'Basic', 
          tagline: 'Great for focused analytics workflows and predictive reporting.',
          price: '₹200', 
          originalPrice: null,
          priceINR: 200,
          diamonds: 300,
          highlight: true,
          badge: null,
          featuresTitle: null,
          features: [
            'Expanded dataset and dashboard quotas',
            'Automated model training and forecasts',
            'Custom charts and export-ready reports',
            'Faster analytics processing',
          ],
          buttonLabel: 'Proceed to Pay',
          displayCredits: '300 Credits'
        },
        { 
          name: 'Pro', 
          tagline: 'Best value for teams building AI-driven analytics.',
          price: '₹500', 
          originalPrice: null,
          priceINR: 500,
          diamonds: 800,
          highlight: false,
          badge: 'Verified Tier',
          featuresTitle: null,
          features: [
            'Full AI workspace with advanced insights',
            'Priority model runs and forecasting',
            'Unlimited dashboards and reports',
            'Dedicated analytics support',
          ],
          buttonLabel: 'Select Plan',
          displayCredits: '800 Credits'
        },
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
