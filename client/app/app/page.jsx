'use client'

import dynamic from 'next/dynamic'
import AnalyticsPipelineStepper from '../../src/components/AnalyticsPipelineStepper.jsx'
// import { useRouter } from 'next/navigation'
// import { useEffect } from 'react'
// import { useAuth } from '../../src/auth/AuthContext.jsx'

const DashboardApp = dynamic(() => import('../../src/App.jsx'), {
  ssr: false,
  loading: () => <AnalyticsPipelineStepper theme="dark" stepDuration={1050} />,
})

export default function DashboardPage() {
  // const router = useRouter()
  // const { initialized, isAuthenticated, isVerified } = useAuth()
  //
  // useEffect(() => {
  //   if (!initialized) return
  //
  //   if (!isAuthenticated) {
  //     router.replace('/?auth=login')
  //     return
  //   }
  //
  //   if (!isVerified) {
  //     router.replace('/?auth=otp')
  //   }
  // }, [initialized, isAuthenticated, isVerified, router])
  //
  // if (!initialized || !isAuthenticated || !isVerified) {
  //   return <AnalyticsPipelineStepper theme="dark" stepDuration={1050} />
  // }

  return <DashboardApp />
}
