'use client'

import dynamic from 'next/dynamic'

const DashboardApp = dynamic(() => import('../../src/App.jsx'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-[#070b15] text-slate-300">
      Loading dashboard...
    </div>
  ),
})

export default function DashboardPage() {
  return <DashboardApp />
}
