'use client'

import { useState } from 'react'
import GlassModal from '../ui/GlassModal.jsx'

const PIPELINE_STEPS = [
  { id: 'upload', label: 'Data Upload' },
  { id: 'eda', label: 'Exploration (EDA)' },
  { id: 'preprocess', label: 'Preprocessing' },
  { id: 'visualization', label: 'Visualization' },
  { id: 'training', label: 'ML Training' },
  { id: 'prediction', label: 'Prediction' },
  { id: 'insights', label: 'AI Insights' },
]

export default function FeedbackModal({ open, onClose, userProfile }) {
  const [formData, setFormData] = useState({
    name: userProfile?.fullName || '',
    email: userProfile?.email || '',
    ratings: PIPELINE_STEPS.reduce((acc, step) => ({ ...acc, [step.id]: 5 }), {}),
    feedback: '',
    improvements: '',
  })
  const [hoveredRatings, setHoveredRatings] = useState({})

  const handleRatingChange = (stepId, rating) => {
    setFormData((prev) => ({
      ...prev,
      ratings: { ...prev.ratings, [stepId]: rating },
    }))
  }

  const handleMouseEnter = (stepId, rating) => {
    setHoveredRatings((prev) => ({ ...prev, [stepId]: rating }))
  }

  const handleMouseLeave = (stepId) => {
    setHoveredRatings((prev) => {
      const next = { ...prev }
      delete next[stepId]
      return next
    })
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    // Construct WhatsApp message
    let message = `*New Feedback Received*\n\n`
    message += `*Name:* ${formData.name}\n`
    message += `*Email:* ${formData.email}\n\n`
    
    message += `*Pipeline Ratings:*\n`
    PIPELINE_STEPS.forEach((step) => {
      const rating = formData.ratings[step.id]
      message += `- ${step.label}: ${'⭐'.repeat(rating)}\n`
    })

    message += `\n*Feedback:*\n${formData.feedback}\n`
    message += `\n*Improvements:*\n${formData.improvements}\n`

    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/8707080065?text=${encodedMessage}`
    
    window.open(whatsappUrl, '_blank')
    onClose()
  }

  return (
    <GlassModal 
      open={open} 
      onClose={onClose} 
      title="Rate Your Experience"
      panelClass="!max-w-xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col items-center space-y-8 w-full py-4">
        {/* User Info - Centered */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 px-2">
          <div className="space-y-2 flex flex-col items-center md:items-start">
            <label className="text-sm font-medium text-slate-300">Name</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full text-center md:text-left rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50 transition"
              placeholder="Your Name"
            />
          </div>
          <div className="space-y-2 flex flex-col items-center md:items-start">
            <label className="text-sm font-medium text-slate-300">Email</label>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full text-center md:text-left rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50 transition"
              placeholder="your@email.com"
            />
          </div>
        </div>

        {/* Pipeline Ratings - Centered & Large Stars */}
        <div className="w-full space-y-5 px-4">
          <label className="text-sm font-bold text-cyan-400 uppercase tracking-widest block text-center">Pipeline Ratings</label>
          <div className="grid grid-cols-1 gap-4">
            {PIPELINE_STEPS.map((step) => {
              const rating = formData.ratings[step.id]
              const hoveredRating = hoveredRatings[step.id]
              const displayRating = hoveredRating !== undefined ? hoveredRating : rating

              return (
                <div key={step.id} className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all group">
                  <span className="text-sm font-medium text-slate-200 group-hover:text-cyan-300 transition-colors">{step.label}</span>
                  <div className="flex gap-2" onMouseLeave={() => handleMouseLeave(step.id)}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => handleMouseEnter(step.id, star)}
                        onClick={() => handleRatingChange(step.id, star)}
                        className={`text-4xl transition-all duration-200 hover:scale-125 ${
                          displayRating >= star ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]' : 'text-slate-700'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Feedback Textareas - Centered */}
        <div className="w-full space-y-6 px-4">
          <div className="space-y-2 flex flex-col items-center">
            <label className="text-sm font-medium text-slate-300">Feedback</label>
            <textarea
              name="feedback"
              required
              value={formData.feedback}
              onChange={handleChange}
              rows={3}
              className="w-full text-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50 resize-none transition"
              placeholder="Tell us about your overall experience..."
            />
          </div>

          <div className="space-y-2 flex flex-col items-center">
            <label className="text-sm font-medium text-slate-300">Improvement Suggestions</label>
            <textarea
              name="improvements"
              value={formData.improvements}
              onChange={handleChange}
              rows={2}
              className="w-full text-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50 resize-none transition"
              placeholder="What can we do better?"
            />
          </div>
        </div>

        {/* Submit Button - Centered */}
        <div className="w-full flex flex-col items-center gap-4 pt-4 px-4">
          <button
            type="submit"
            className="w-full md:w-auto min-w-[300px] rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-700 px-8 py-4 text-base font-bold text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:scale-[1.03] transition-all active:scale-[0.98]"
          >
            Send Feedback via WhatsApp
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-slate-500 hover:text-white transition"
          >
            Go Back
          </button>
        </div>
      </form>
    </GlassModal>
  )
}
