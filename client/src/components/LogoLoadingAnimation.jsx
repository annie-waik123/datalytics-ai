'use client'

import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

export default function LogoLoadingAnimation() {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#05070d] relative overflow-hidden">
      {/* Dynamic Background Glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="h-96 w-96 rounded-full bg-[#ff6a00] blur-[120px]" 
        />
      </div>

      <div 
        className="relative z-10 flex h-[250px] items-end justify-center pb-8" 
        style={{ perspective: '1000px' }}
      >
        <motion.div 
          className="relative flex items-end justify-center gap-3.5"
          animate={{ rotateY: [-8, 8, -8], rotateX: [5, 15, 5] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Floor Shadow */}
          <div 
            className="absolute -bottom-4 left-1/2 w-48 -translate-x-1/2 h-8 rounded-[100%] bg-black/80 blur-xl" 
            style={{ transform: 'translateZ(-15px) rotateX(70deg)' }} 
          />

          {/* Bar 1 */}
          <motion.div
            animate={{ y: [0, -30, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0 }}
            className="relative w-[36px] h-[90px] rounded-[20px] bg-gradient-to-t from-[#cc2900] via-[#ff4d2e] to-[#ff7b00]"
            style={{
              boxShadow: 'inset -4px -4px 10px rgba(0,0,0,0.6), inset 4px 4px 10px rgba(255,255,255,0.4), 0 15px 30px rgba(255,77,46,0.6)',
              transformStyle: 'preserve-3d',
              transform: 'translateZ(15px)'
            }}
          >
            <div className="absolute top-[3px] left-[3px] right-[3px] h-8 rounded-[16px] bg-gradient-to-b from-white/60 to-transparent" />
            <div className="absolute top-[3px] right-[3px] w-2 h-full rounded-r-[16px] bg-gradient-to-l from-white/20 to-transparent" />
          </motion.div>

          {/* Bar 2 */}
          <motion.div
            animate={{ y: [0, -30, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
            className="relative w-[36px] h-[145px] rounded-[20px] bg-gradient-to-t from-[#cc2900] via-[#ff6a00] to-[#ff9500]"
            style={{
              boxShadow: 'inset -4px -4px 10px rgba(0,0,0,0.6), inset 4px 4px 10px rgba(255,255,255,0.4), 0 15px 30px rgba(255,106,0,0.6)',
              transformStyle: 'preserve-3d',
              transform: 'translateZ(30px)'
            }}
          >
            <div className="absolute top-[3px] left-[3px] right-[3px] h-8 rounded-[16px] bg-gradient-to-b from-white/60 to-transparent" />
            <div className="absolute top-[3px] right-[3px] w-2 h-full rounded-r-[16px] bg-gradient-to-l from-white/20 to-transparent" />
          </motion.div>

          {/* Bar 3 */}
          <motion.div
            animate={{ y: [0, -30, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
            className="relative w-[36px] h-[110px] rounded-[20px] bg-gradient-to-t from-[#cc2900] via-[#ff4d2e] to-[#ff7b00]"
            style={{
              boxShadow: 'inset -4px -4px 10px rgba(0,0,0,0.6), inset 4px 4px 10px rgba(255,255,255,0.4), 0 15px 30px rgba(255,77,46,0.6)',
              transformStyle: 'preserve-3d',
              transform: 'translateZ(15px)'
            }}
          >
            <div className="absolute top-[3px] left-[3px] right-[3px] h-8 rounded-[16px] bg-gradient-to-b from-white/60 to-transparent" />
            <div className="absolute top-[3px] right-[3px] w-2 h-full rounded-r-[16px] bg-gradient-to-l from-white/20 to-transparent" />
          </motion.div>
        </motion.div>
      </div>

      <div className="relative z-10 mt-10 flex flex-col items-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-[13px] font-bold tracking-[0.4em] text-[#ff6a00] uppercase opacity-90 drop-shadow-[0_0_10px_rgba(255,106,0,0.6)]"
        >
          Analyzing Pipeline
        </motion.p>
        <motion.div 
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="mt-4 flex gap-2"
        >
          <div className="h-2 w-2 rounded-full bg-[#ff4d2e] shadow-[0_0_10px_rgba(255,77,46,0.8)]" />
          <div className="h-2 w-2 rounded-full bg-[#ff6a00] shadow-[0_0_10px_rgba(255,106,0,0.8)]" />
          <div className="h-2 w-2 rounded-full bg-[#ff4d2e] shadow-[0_0_10px_rgba(255,77,46,0.8)]" />
        </motion.div>
      </div>
    </div>
  )
}
