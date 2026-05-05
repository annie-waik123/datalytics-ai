'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { HiCheckCircle, HiExclamationCircle, HiInformationCircle, HiXCircle } from 'react-icons/hi'

const TONE_MAP = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-50',
  error: 'border-rose-500/30 bg-rose-500/10 text-rose-50',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-50',
  info: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-50',
}

const ICON_MAP = {
  success: <HiCheckCircle className="h-5 w-5 text-emerald-400" />,
  error: <HiXCircle className="h-5 w-5 text-rose-400" />,
  warning: <HiExclamationCircle className="h-5 w-5 text-amber-400" />,
  info: <HiInformationCircle className="h-5 w-5 text-cyan-400" />,
}

export default function Toast({ items = [] }) {
  return (
    <div className="pointer-events-none fixed right-6 top-6 z-[100] flex w-full max-w-sm flex-col gap-3">
      <AnimatePresence>
        {items.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            className={`pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-medium shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl ${TONE_MAP[item.tone] || TONE_MAP.info}`}
          >
            <div className="flex-shrink-0">
              {ICON_MAP[item.tone] || ICON_MAP.info}
            </div>
            <div className="flex-1 leading-tight">
              {item.message}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
