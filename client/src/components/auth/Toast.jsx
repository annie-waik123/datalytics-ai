'use client'

import { AnimatePresence, motion } from 'framer-motion'

const TONE_MAP = {
  success: 'border-emerald-400/25 bg-emerald-500/12 text-emerald-100',
  error: 'border-rose-400/30 bg-rose-500/12 text-rose-100',
  warning: 'border-amber-400/30 bg-amber-500/12 text-amber-100',
  info: 'border-cyan-400/30 bg-cyan-400/12 text-cyan-50',
}

export default function Toast({ items = [] }) {
  return (
    <div className="pointer-events-none absolute right-4 top-4 z-30 flex w-full max-w-sm flex-col gap-3">
      <AnimatePresence>
        {items.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            className={`pointer-events-auto rounded-2xl border px-4 py-3 text-sm shadow-[0_18px_42px_rgba(2,6,23,0.45)] backdrop-blur-xl ${TONE_MAP[item.tone] || TONE_MAP.info}`}
          >
            {item.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
