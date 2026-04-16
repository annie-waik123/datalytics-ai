import React, { useState, useEffect } from 'react'
import cx from 'classnames'

export default function MockRazorpayModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  amount, 
  planName, 
  userEmail,
  orderId
}) {
  const [step, setStep] = useState('payment_methods') // 'payment_methods' | 'card_form' | 'processing' | 'success'
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [cardDetails, setCardDetails] = useState({
    cardNumber: '',
    expiry: '',
    cvv: '',
    name: ''
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!isOpen) {
      setStep('payment_methods')
      setSelectedMethod(null)
      setCardDetails({ cardNumber: '', expiry: '', cvv: '', name: '' })
      setErrors({})
    }
  }, [isOpen])

  if (!isOpen) return null

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    const matches = v.match(/\d{4,16}/g)
    const match = (matches && matches[0]) || ''
    const parts = []
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4))
    }
    if (parts.length) {
      return parts.join(' ')
    } else {
      return v
    }
  }

  const formatExpiry = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4)
    }
    return v
  }

  const handleCardNumberChange = (e) => {
    const formatted = formatCardNumber(e.target.value)
    if (formatted.replace(/\s/g, '').length <= 16) {
      setCardDetails(prev => ({ ...prev, cardNumber: formatted }))
    }
  }

  const handleExpiryChange = (e) => {
    const formatted = formatExpiry(e.target.value)
    if (formatted.replace(/\//g, '').length <= 4) {
      setCardDetails(prev => ({ ...prev, expiry: formatted }))
    }
  }

  const handleCvvChange = (e) => {
    const v = e.target.value.replace(/[^0-9]/gi, '')
    if (v.length <= 3) {
      setCardDetails(prev => ({ ...prev, cvv: v }))
    }
  }

  const validateCard = () => {
    const newErrors = {}
    const cardNum = cardDetails.cardNumber.replace(/\s/g, '')
    
    if (cardNum.length !== 16) {
      newErrors.cardNumber = 'Enter valid 16-digit card number'
    }
    if (cardDetails.expiry.length !== 5) {
      newErrors.expiry = 'Enter valid MM/YY'
    }
    if (cardDetails.cvv.length !== 3) {
      newErrors.cvv = 'Enter valid 3-digit CVV'
    }
    if (cardDetails.name.trim().length < 3) {
      newErrors.name = 'Enter cardholder name'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handlePay = () => {
    if (!validateCard()) return
    
    setStep('processing')
    
    // Simulate processing - NO OTP, direct success after 2 seconds
    setTimeout(() => {
      setStep('success')
      // Success delay then callback
      setTimeout(() => {
        onSuccess({
          razorpay_order_id: orderId,
          razorpay_payment_id: 'pay_card_' + Math.random().toString(36).substring(7),
          razorpay_signature: 'sig_card_' + Math.random().toString(36).substring(7)
        })
      }, 1500)
    }, 2000)
  }

  const handleSelectMethod = (method) => {
    setSelectedMethod(method)
    if (method === 'card') {
      setStep('card_form')
    } else {
      // For UPI, still use the card form for simplicity (or can direct process)
      setStep('card_form')
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-[440px] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col min-h-[500px]">
        
        {/* Header */}
        <div className="bg-[#1b2132] px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500 flex items-center justify-center text-white font-black text-xl italic shadow-lg shadow-cyan-500/20">
              D
            </div>
            <div>
              <h3 className="text-white font-bold text-lg leading-tight">Datalytics</h3>
              <p className="text-slate-400 text-[11px] font-medium tracking-wide uppercase">{planName} Plan</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Amount Banner */}
        <div className="bg-[#f8f9fc] border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Amount to Pay</p>
            <p className="text-slate-900 text-2xl font-black">₹{amount / 100}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-[10px] font-medium">Order ID</p>
            <p className="text-slate-600 text-[11px] font-mono">{orderId.slice(-8).toUpperCase()}</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white relative">
          
          {step === 'payment_methods' && (
            <div className="p-6 space-y-4 animate-in slide-in-from-bottom-4 duration-500">
              <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-2">Select Payment Method</p>
              
              <button 
                onClick={() => handleSelectMethod('card')}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-cyan-400 hover:bg-cyan-50/30 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 group-hover:scale-110 transition">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                  </div>
                  <div className="text-left">
                    <p className="text-slate-800 font-bold text-sm">Credit / Debit Card</p>
                    <p className="text-slate-400 text-xs">Visa, MasterCard, RuPay</p>
                  </div>
                </div>
                <div className="text-slate-300 group-hover:text-cyan-500 transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </div>
              </button>

              <button 
                onClick={() => handleSelectMethod('upi')}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-cyan-400 hover:bg-cyan-50/30 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div className="text-left">
                    <p className="text-slate-800 font-bold text-sm">UPI</p>
                    <p className="text-slate-400 text-xs">Google Pay, PhonePe, Paytm</p>
                  </div>
                </div>
                <div className="text-slate-300 group-hover:text-cyan-500 transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </div>
              </button>

              <div className="pt-6 border-t border-slate-100">
                <p className="text-[10px] text-center text-slate-400 font-medium">By paying, you agree to our Terms of Service</p>
              </div>
            </div>
          )}

          {step === 'card_form' && (
            <div className="p-6 space-y-4 animate-in slide-in-from-right-4 duration-300">
              {/* Back button */}
              <button 
                onClick={() => setStep('payment_methods')}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mb-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              <p className="text-slate-800 font-bold text-sm mb-4">Enter Card Details</p>
              
              {/* Card Number */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Card Number</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="1234 5678 9012 3456"
                    value={cardDetails.cardNumber}
                    onChange={handleCardNumberChange}
                    className={cx(
                      'w-full p-3 rounded-xl border text-sm font-mono tracking-wider transition-all',
                      errors.cardNumber 
                        ? 'border-rose-400 bg-rose-50' 
                        : 'border-slate-200 hover:border-cyan-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20'
                    )}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                    <div className="w-8 h-5 bg-slate-200 rounded flex items-center justify-center text-[8px] font-bold text-slate-500">VISA</div>
                    <div className="w-8 h-5 bg-slate-200 rounded flex items-center justify-center text-[8px] font-bold text-slate-500">MC</div>
                  </div>
                </div>
                {errors.cardNumber && <p className="text-[10px] text-rose-500">{errors.cardNumber}</p>}
              </div>

              {/* Card Holder Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cardholder Name</label>
                <input
                  type="text"
                  placeholder="NAME ON CARD"
                  value={cardDetails.name}
                  onChange={(e) => setCardDetails(prev => ({ ...prev, name: e.target.value.toUpperCase() }))}
                  className={cx(
                    'w-full p-3 rounded-xl border text-sm font-medium tracking-wide transition-all uppercase',
                    errors.name 
                      ? 'border-rose-400 bg-rose-50' 
                      : 'border-slate-200 hover:border-cyan-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20'
                  )}
                />
                {errors.name && <p className="text-[10px] text-rose-500">{errors.name}</p>}
              </div>

              {/* Expiry and CVV */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Expiry (MM/YY)</label>
                  <input
                    type="text"
                    placeholder="MM/YY"
                    value={cardDetails.expiry}
                    onChange={handleExpiryChange}
                    className={cx(
                      'w-full p-3 rounded-xl border text-sm font-mono tracking-wider transition-all',
                      errors.expiry 
                        ? 'border-rose-400 bg-rose-50' 
                        : 'border-slate-200 hover:border-cyan-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20'
                    )}
                  />
                  {errors.expiry && <p className="text-[10px] text-rose-500">{errors.expiry}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">CVV</label>
                  <input
                    type="password"
                    placeholder="123"
                    value={cardDetails.cvv}
                    onChange={handleCvvChange}
                    maxLength={3}
                    className={cx(
                      'w-full p-3 rounded-xl border text-sm font-mono tracking-wider transition-all',
                      errors.cvv 
                        ? 'border-rose-400 bg-rose-50' 
                        : 'border-slate-200 hover:border-cyan-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20'
                    )}
                  />
                  {errors.cvv && <p className="text-[10px] text-rose-500">{errors.cvv}</p>}
                </div>
              </div>

              {/* No OTP Badge */}
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[11px] font-semibold text-emerald-700">No OTP Required - Direct Payment</span>
              </div>

              {/* Pay Button */}
              <button
                onClick={handlePay}
                className="w-full mt-4 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/30 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                Pay ₹{amount / 100}
              </button>

              <p className="text-[10px] text-center text-slate-400">
                Your card details are securely encrypted
              </p>
            </div>
          )}

          {step === 'processing' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-white z-10 animate-in fade-in duration-300">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-cyan-500 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <h4 className="mt-8 text-lg font-bold text-slate-800">Processing Payment</h4>
              <p className="mt-2 text-sm text-slate-500 text-center">Verifying card details...</p>
              
              <div className="mt-8 flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
                <svg className="w-4 h-4 text-emerald-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-[11px] font-semibold text-emerald-700">OTP Bypassed - Instant Processing</span>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-white z-20 animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 scale-animation">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="mt-8 text-xl font-black text-slate-900">Payment Successful!</h4>
              <p className="mt-2 text-sm text-slate-500 text-center">₹{amount / 100} paid successfully. Crediting {planName} diamonds...</p>
              
              <div className="mt-10 flex flex-col items-center gap-1">
                <div className="flex h-1.5 w-40 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 animate-progress"></div>
                </div>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-3">Finalizing</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#f8f9fc] border-t border-slate-100 px-6 py-4 flex items-center justify-center gap-2">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Secured by</span>
          <div className="flex items-center gap-1 grayscale opacity-50">
            <span className="text-slate-800 font-black italic text-xs">RAZORPAY</span>
            <div className="w-3 h-3 bg-blue-600 rounded-sm"></div>
          </div>
        </div>

      </div>

      <style jsx>{`
        .scale-animation {
          animation: scale-up 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes scale-up {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-progress {
          width: 0%;
          animation: progress 2s linear forwards;
        }
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  )
}
