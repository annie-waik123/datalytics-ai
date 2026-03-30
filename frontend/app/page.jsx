"use client";

import { useEffect, useRef, useState } from "react";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --red: #ff4d2e;
    --orange: #ff6a00;
    --cyan: #ff9d00;
    --blue: #ff4d2e;
    --navy: #0a0e1a;
    --navy2: #0d1225;
    --glass: rgba(255,255,255,0.04);
    --glass-border: rgba(255,255,255,0.08);
  }

  html { scroll-behavior: smooth; }

  body {
    font-family: 'Poppins', sans-serif;
    background: var(--navy);
    color: #fff;
    overflow-x: hidden;
    min-height: 100vh;
  }

  .mm-wrap { font-family: 'Poppins', sans-serif; background: var(--navy); color: #fff; overflow-x: hidden; min-height: 100vh; }

  /* BG */
  .bg-wrap { position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background: radial-gradient(ellipse 80% 60% at 10% 50%, rgba(255,106,0,0.13) 0%, transparent 60%),
                radial-gradient(ellipse 70% 50% at 90% 50%, rgba(255,77,46,0.10) 0%, transparent 60%),
                linear-gradient(135deg, #0a0e1a 0%, #0d1225 50%, #0a0e1a 100%); }
  .blob { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.55; }
  .blob1 { width: 520px; height: 520px; background: radial-gradient(circle, #ff6a0055 0%, transparent 70%); top: -100px; left: -120px; animation: blobFloat 8s ease-in-out infinite; }
  .blob2 { width: 420px; height: 420px; background: radial-gradient(circle, #ff4d2e44 0%, transparent 70%); bottom: 10%; right: -80px; animation: blobFloat 10s ease-in-out infinite reverse; }
  .blob3 { width: 260px; height: 260px; background: radial-gradient(circle, #ff9d0022 0%, transparent 70%); top: 40%; right: 25%; animation: blobFloat 7s ease-in-out infinite 2s; }
  .blob4 { width: 380px; height: 380px; background: radial-gradient(circle, #ff4d2e33 0%, transparent 70%); top: 60%; left: 10%; animation: blobFloat 9s ease-in-out infinite 3s; }
  .blob5 { width: 300px; height: 300px; background: radial-gradient(circle, #ff6a0022 0%, transparent 70%); top: 80%; right: 20%; animation: blobFloat 11s ease-in-out infinite 1s; }
  @keyframes blobFloat { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-30px) scale(1.05); } }

  .grid-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: 0.04;
    background-image: linear-gradient(rgba(255,106,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,106,0,1) 1px, transparent 1px);
    background-size: 60px 60px; }

  /* NAVBAR */
  nav.mm-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 5%; height: 70px;
    background: rgba(6,10,24,0.8); backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    transition: background 0.3s, box-shadow 0.3s;
    animation: fadeDown 0.8s ease both; }
  @keyframes fadeDown { from { opacity:0; transform:translateY(-20px); } to { opacity:1; transform:translateY(0); } }

  .logo { display: flex; align-items: center; gap: 8px; font-size: 1.35rem; font-weight: 700; letter-spacing: -0.3px; text-decoration: none; color: #fff; }
  .logo-icon { display: flex; gap: 2px; align-items: flex-end; }
  .logo-icon span { display: block; width: 4px; border-radius: 2px; background: linear-gradient(180deg, var(--orange), var(--red)); }
  .logo-icon span:nth-child(1) { height: 10px; }
  .logo-icon span:nth-child(2) { height: 16px; }
  .logo-icon span:nth-child(3) { height: 12px; }
  .logo strong { color: var(--red); }

  .nav-links { display: flex; gap: 2rem; list-style: none; }
  .nav-links a { color: rgba(255,255,255,0.72); text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: color 0.25s; position: relative; }
  .nav-links a::after { content: ''; position: absolute; bottom: -4px; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, var(--red), var(--orange)); border-radius: 2px; transform: scaleX(0); transition: transform 0.25s; }
  .nav-links a:hover { color: #fff; }
  .nav-links a:hover::after { transform: scaleX(1); }

  .nav-actions { display: flex; align-items: center; gap: 1rem; }
  .btn-login { color: rgba(255,255,255,0.78); background: none; border: none; font-family: inherit; font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: color 0.25s; }
  .btn-login:hover { color: #fff; }
  .btn-signup { background: linear-gradient(135deg, var(--red), var(--orange)); color: #fff; border: none; padding: 9px 22px; border-radius: 10px; font-family: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 0 20px rgba(255,77,46,0.4); }
  .btn-signup:hover { transform: translateY(-2px); box-shadow: 0 0 35px rgba(255,77,46,0.7); }

  /* HERO */
  .hero { position: relative; z-index: 1; min-height: 100vh; display: flex; align-items: center; padding: 90px 5% 60px; gap: 4%; }
  .hero-left { flex: 0 0 45%; animation: fadeLeft 1s ease 0.3s both; }
  @keyframes fadeLeft { from { opacity:0; transform:translateX(-40px); } to { opacity:1; transform:translateX(0); } }
  .hero-eyebrow { font-size: 0.85rem; font-weight: 500; color: rgba(255,255,255,0.5); letter-spacing: 1px; margin-bottom: 18px; }
  .hero-eyebrow span { color: var(--cyan); }
  .hero-h1 { font-size: clamp(2.4rem, 4.5vw, 3.6rem); font-weight: 800; line-height: 1.12; letter-spacing: -1px; margin-bottom: 20px; }
  .hero-h1 .accent { color: var(--red); }
  .hero-sub { font-size: 1rem; font-weight: 400; color: var(--red); opacity: 0.9; margin-bottom: 40px; }
  .hero-btns { display: flex; gap: 16px; flex-wrap: wrap; }

  .btn-primary { background: linear-gradient(135deg, var(--red), var(--orange)); color: #fff; border: none; padding: 14px 30px; border-radius: 12px; font-family: inherit; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 0 25px rgba(255,77,46,0.45); }
  .btn-primary:hover { transform: translateY(-3px); box-shadow: 0 0 45px rgba(255,77,46,0.75); }
  .btn-secondary { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.15); padding: 13px 26px; border-radius: 12px; font-family: inherit; font-size: 0.95rem; font-weight: 500; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 10px; backdrop-filter: blur(8px); }
  .btn-secondary:hover { background: rgba(255,255,255,0.1); border-color: rgba(0,212,255,0.4); box-shadow: 0 0 20px rgba(0,212,255,0.2); transform: translateY(-2px); }
  .play-icon { width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 0.7rem; }

  /* HERO RIGHT */
  .hero-right { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; min-height: 480px; animation: fadeRight 1s ease 0.5s both; perspective: 1200px; }
  @keyframes fadeRight { from { opacity:0; transform:translateX(40px); } to { opacity:1; transform:translateX(0); } }

  .stage { position: relative; width: 520px; height: 460px; transform-style: preserve-3d; transform: rotateX(18deg) rotateY(-20deg); animation: stageFloat 6s ease-in-out infinite; transition: transform 0.3s ease; }
  @keyframes stageFloat { 0%,100% { transform: rotateX(18deg) rotateY(-20deg) translateY(0); } 50% { transform: rotateX(14deg) rotateY(-16deg) translateY(-18px); } }

  .card { position: absolute; background: rgba(13,18,37,0.85); border: 1px solid rgba(255,255,255,0.09); border-radius: 20px; backdrop-filter: blur(16px); box-shadow: 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08); }

  .card-main { width: 310px; height: 210px; top: 0; left: 50%; transform: translateX(-50%); padding: 20px 22px; z-index: 3; }
  .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
  .card-title { font-size: 0.75rem; font-weight: 600; color: rgba(255,255,255,0.6); letter-spacing: 0.5px; }
  .card-badge { font-size: 0.65rem; font-weight: 700; padding: 3px 8px; border-radius: 20px; background: rgba(0,212,255,0.15); color: var(--cyan); border: 1px solid rgba(0,212,255,0.25); }
  .chart-bars { display: flex; align-items: flex-end; gap: 7px; height: 100px; padding-top: 10px; }
  .bar-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
  .bar { width: 100%; border-radius: 5px 5px 0 0; position: relative; overflow: hidden; }
  .bar::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 30%; background: rgba(255,255,255,0.2); border-radius: 5px 5px 0 0; }
  .bar-b1 { height: 55px; background: linear-gradient(180deg, #ff6a00, #ff4d2e); box-shadow: 0 0 12px rgba(255,77,46,0.5); }
  .bar-b2 { height: 80px; background: linear-gradient(180deg, #00d4ff, #0066ff); box-shadow: 0 0 12px rgba(0,212,255,0.5); }
  .bar-b3 { height: 45px; background: linear-gradient(180deg, #a855f7, #7c3aed); box-shadow: 0 0 12px rgba(168,85,247,0.5); }
  .bar-b4 { height: 95px; background: linear-gradient(180deg, #22c55e, #16a34a); box-shadow: 0 0 12px rgba(34,197,94,0.5); }
  .bar-b5 { height: 65px; background: linear-gradient(180deg, #f59e0b, #d97706); box-shadow: 0 0 12px rgba(245,158,11,0.4); }
  .bar-b6 { height: 75px; background: linear-gradient(180deg, #ff6a00, #ff4d2e); box-shadow: 0 0 12px rgba(255,77,46,0.5); }
  .bar-label { font-size: 0.55rem; color: rgba(255,255,255,0.35); font-weight: 500; }
  .chart-bottom { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
  .chart-total { font-size: 1.1rem; font-weight: 700; color: #fff; }
  .chart-change { font-size: 0.7rem; color: #22c55e; font-weight: 600; }

  .card-donut { width: 165px; height: 175px; bottom: 80px; left: 10px; padding: 18px 16px; z-index: 4; animation: floatCard1 5s ease-in-out infinite; }
  @keyframes floatCard1 { 0%,100% { transform: translateY(0) translateZ(20px); } 50% { transform: translateY(-12px) translateZ(30px); } }
  .donut-title { font-size: 0.65rem; font-weight: 600; color: rgba(255,255,255,0.5); margin-bottom: 12px; }
  .donut-wrap { display: flex; justify-content: center; align-items: center; position: relative; width: 90px; height: 90px; margin: 0 auto 10px; }
  .donut-svg { width: 90px; height: 90px; transform: rotate(-90deg); }
  .donut-bg { fill: none; stroke: rgba(255,255,255,0.07); strokeWidth: 10; }
  .donut-fill { fill: none; strokeWidth: 10; strokeLinecap: round; stroke: url(#donutGrad); strokeDasharray: 220; strokeDashoffset: 66; animation: donutAnim 2s ease 1s both; }
  @keyframes donutAnim { from { strokeDashoffset: 220; } to { strokeDashoffset: 66; } }
  .donut-label { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); font-size: 1.1rem; font-weight: 800; color: #fff; text-align: center; line-height: 1; }
  .donut-label small { display: block; font-size: 0.5rem; font-weight: 500; color: rgba(255,255,255,0.45); margin-top: 1px; }
  .donut-legend { display: flex; gap: 8px; justify-content: center; }
  .legend-dot { width: 7px; height: 7px; border-radius: 50%; margin-right: 3px; display: inline-block; }
  .legend-item { display: flex; align-items: center; font-size: 0.58rem; color: rgba(255,255,255,0.55); }

  .card-stats { width: 175px; height: 140px; bottom: 80px; right: 5px; padding: 16px 18px; z-index: 4; animation: floatCard2 6s ease-in-out infinite 1s; }
  @keyframes floatCard2 { 0%,100% { transform: translateY(0) translateZ(15px); } 50% { transform: translateY(-16px) translateZ(25px); } }
  .stats-amount { font-size: 1.3rem; font-weight: 800; background: linear-gradient(135deg, #ff6a00, #ff4d2e); WebkitBackgroundClip: text; WebkitTextFillColor: transparent; margin-bottom: 4px; }
  .stats-label { font-size: 0.65rem; color: rgba(255,255,255,0.45); margin-bottom: 14px; }
  .mini-bars { display: flex; align-items: flex-end; gap: 4px; height: 40px; }
  .mini-bar { flex: 1; border-radius: 3px 3px 0 0; transition: height 0.6s ease; }
  .stats-footer { display: flex; justify-content: space-between; margin-top: 8px; }
  .stats-foot-item { font-size: 0.62rem; color: rgba(255,255,255,0.4); }
  .stats-foot-item strong { color: #fff; display: block; font-size: 0.72rem; }

  .card-pct { width: 110px; height: 90px; bottom: 0; right: 90px; padding: 14px 16px; z-index: 5; animation: floatCard3 4.5s ease-in-out infinite 0.5s; }
  @keyframes floatCard3 { 0%,100% { transform: translateY(0) translateZ(40px); } 50% { transform: translateY(-10px) translateZ(50px); } }
  .pct-icon { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, var(--red), var(--orange)); display: flex; align-items: center; justify-content: center; font-size: 1rem; font-weight: 900; color: #fff; box-shadow: 0 0 15px rgba(255,77,46,0.5); margin-bottom: 8px; }
  .pct-label { font-size: 0.58rem; color: rgba(255,255,255,0.45); }
  .pct-value { font-size: 1rem; font-weight: 800; color: #fff; }

  .card-ticker { width: 200px; height: 70px; top: 220px; left: 50%; transform: translateX(-50%); padding: 12px 16px; z-index: 3; display: flex; align-items: center; gap: 12px; animation: floatCard4 5.5s ease-in-out infinite 1.5s; }
  @keyframes floatCard4 { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-8px); } }
  .ticker-icon { width: 38px; height: 38px; border-radius: 12px; flex-shrink: 0; background: linear-gradient(135deg, #0066ff, #00d4ff); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; box-shadow: 0 0 15px rgba(0,102,255,0.5); }
  .ticker-info { flex: 1; }
  .ticker-name { font-size: 0.72rem; font-weight: 700; color: #fff; }
  .ticker-sub { font-size: 0.6rem; color: rgba(255,255,255,0.4); }
  .ticker-val { text-align: right; }
  .ticker-price { font-size: 0.8rem; font-weight: 700; color: #fff; }
  .ticker-chg { font-size: 0.6rem; font-weight: 600; }

  .platform { position: absolute; border-radius: 20px; background: rgba(0,0,0,0.3); filter: blur(8px); }
  .plat1 { width: 300px; height: 25px; bottom: -30px; left: 50%; transform: translateX(-50%); }
  .plat2 { width: 160px; height: 18px; bottom: 50px; left: 15px; opacity: 0.6; }
  .plat3 { width: 170px; height: 18px; bottom: 50px; right: 10px; opacity: 0.6; }

  /* STATS STRIP */
  .stats-strip { position: relative; z-index: 1; display: flex; justify-content: center; gap: 3%; padding: 20px 5% 60px; }
  .stat-item { background: var(--glass); border: 1px solid var(--glass-border); border-radius: 18px; padding: 22px 30px; text-align: center; flex: 1; max-width: 200px; backdrop-filter: blur(12px); transition: transform 0.3s, box-shadow 0.3s; }
  .stat-item:hover { transform: translateY(-6px); box-shadow: 0 0 30px rgba(0,212,255,0.12); border-color: rgba(0,212,255,0.2); }
  .stat-num { font-size: 1.9rem; font-weight: 800; background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.6) 100%); WebkitBackgroundClip: text; WebkitTextFillColor: transparent; backgroundClip: text; margin-bottom: 4px; }
  .stat-desc { font-size: 0.78rem; color: rgba(255,255,255,0.4); font-weight: 500; }

  /* SECTION COMMON */
  section { position: relative; z-index: 1; }
  .section-tag { display: inline-block; font-size: 0.75rem; font-weight: 600; letter-spacing: 2px; color: var(--cyan); text-transform: uppercase; background: rgba(0,212,255,0.08); border: 1px solid rgba(0,212,255,0.2); padding: 5px 14px; border-radius: 20px; margin-bottom: 16px; }
  .section-tag.red { color: var(--red); background: rgba(255,77,46,0.08); border-color: rgba(255,77,46,0.2); }
  .section-tag.purple { color: #a855f7; background: rgba(168,85,247,0.08); border-color: rgba(168,85,247,0.2); }
  .section-tag.green { color: #22c55e; background: rgba(34,197,94,0.08); border-color: rgba(34,197,94,0.2); }
  .section-title { font-size: clamp(1.7rem, 3vw, 2.5rem); font-weight: 800; margin-bottom: 16px; }
  .section-sub { font-size: 0.95rem; color: rgba(255,255,255,0.45); max-width: 520px; line-height: 1.7; }
  .section-head { margin-bottom: 56px; }
  .section-head.center { text-align: center; }
  .section-head.center .section-sub { margin: 0 auto; }
  .section-divider { width: 80px; height: 3px; border-radius: 3px; background: linear-gradient(90deg, var(--red), var(--orange)); margin: 16px 0 0; }
  .section-divider.center { margin: 16px auto 0; }

  /* FEATURES */
  .features { padding: 60px 5% 90px; }
  .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; }
  .feat-card { background: var(--glass); border: 1px solid var(--glass-border); border-radius: 22px; padding: 28px 24px; backdrop-filter: blur(12px); transition: all 0.35s; position: relative; overflow: hidden; }
  .feat-card:hover { transform: translateY(-8px); border-color: rgba(255,255,255,0.14); box-shadow: 0 16px 40px rgba(0,0,0,0.3); }
  .feat-icon { width: 52px; height: 52px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 18px; }
  .fi-red { background: linear-gradient(135deg, rgba(255,77,46,0.25), rgba(255,106,0,0.15)); border: 1px solid rgba(255,77,46,0.3); }
  .fi-cyan { background: linear-gradient(135deg, rgba(0,212,255,0.25), rgba(0,102,255,0.15)); border: 1px solid rgba(0,212,255,0.3); }
  .fi-purple { background: linear-gradient(135deg, rgba(168,85,247,0.25), rgba(124,58,237,0.15)); border: 1px solid rgba(168,85,247,0.3); }
  .fi-green { background: linear-gradient(135deg, rgba(34,197,94,0.25), rgba(22,163,74,0.15)); border: 1px solid rgba(34,197,94,0.3); }
  .fi-yellow { background: linear-gradient(135deg, rgba(245,158,11,0.25), rgba(217,119,6,0.15)); border: 1px solid rgba(245,158,11,0.3); }
  .fi-blue { background: linear-gradient(135deg, rgba(0,102,255,0.25), rgba(0,212,255,0.15)); border: 1px solid rgba(0,102,255,0.3); }
  .feat-title { font-size: 1.05rem; font-weight: 700; margin-bottom: 10px; }
  .feat-desc { font-size: 0.82rem; color: rgba(255,255,255,0.5); line-height: 1.65; }

  /* HOW IT WORKS */
  .how { padding: 80px 5% 100px; }
  .steps { display: flex; flex-direction: column; gap: 0; position: relative; max-width: 900px; margin: 0 auto; }
  .steps::before { content: ''; position: absolute; left: 40px; top: 50px; bottom: 50px; width: 2px; background: linear-gradient(180deg, var(--red), var(--orange), var(--cyan)); border-radius: 2px; }
  .step { display: flex; gap: 30px; align-items: flex-start; padding: 30px 0; opacity: 0; transform: translateX(-30px); transition: all 0.6s ease; }
  .step.visible { opacity: 1; transform: translateX(0); }
  .step-num { width: 80px; height: 80px; flex-shrink: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; position: relative; z-index: 1; border: 2px solid rgba(255,255,255,0.1); }
  .sn1 { background: linear-gradient(135deg, rgba(255,77,46,0.2), rgba(255,106,0,0.1)); box-shadow: 0 0 25px rgba(255,77,46,0.3); border-color: rgba(255,77,46,0.3); }
  .sn2 { background: linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,102,255,0.1)); box-shadow: 0 0 25px rgba(0,212,255,0.3); border-color: rgba(0,212,255,0.3); }
  .sn3 { background: linear-gradient(135deg, rgba(168,85,247,0.2), rgba(124,58,237,0.1)); box-shadow: 0 0 25px rgba(168,85,247,0.3); border-color: rgba(168,85,247,0.3); }
  .sn4 { background: linear-gradient(135deg, rgba(34,197,94,0.2), rgba(22,163,74,0.1)); box-shadow: 0 0 25px rgba(34,197,94,0.3); border-color: rgba(34,197,94,0.3); }
  .step-body { padding-top: 14px; }
  .step-title { font-size: 1.2rem; font-weight: 700; margin-bottom: 8px; }
  .step-desc { font-size: 0.88rem; color: rgba(255,255,255,0.5); line-height: 1.7; max-width: 560px; }

  /* SERVICES */
  .services { padding: 80px 5% 100px; }
  .services-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
  .service-card { background: var(--glass); border: 1px solid var(--glass-border); border-radius: 24px; padding: 32px 28px; backdrop-filter: blur(12px); position: relative; overflow: hidden; transition: all 0.4s; cursor: pointer; }
  .service-card:hover { transform: translateY(-10px); box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
  .service-tag-badge { font-size: 0.65rem; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 20px; padding: 4px 10px; border-radius: 20px; display: inline-block; }
  .service-icon-wrap { width: 64px; height: 64px; border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; margin-bottom: 22px; }
  .service-title { font-size: 1.15rem; font-weight: 700; margin-bottom: 12px; }
  .service-desc { font-size: 0.83rem; color: rgba(255,255,255,0.45); line-height: 1.7; margin-bottom: 20px; }
  .service-link { font-size: 0.82rem; font-weight: 600; color: var(--cyan); display: flex; align-items: center; gap: 6px; cursor: pointer; }

  /* METRICS */
  .metrics { padding: 80px 5% 100px; }
  .metrics-inner { background: rgba(13,18,37,0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 28px; padding: 48px; backdrop-filter: blur(20px); display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
  .metric-list { display: flex; flex-direction: column; gap: 22px; }
  .metric-row { display: flex; flex-direction: column; gap: 8px; }
  .metric-label-row { display: flex; justify-content: space-between; align-items: center; }
  .metric-label { font-size: 0.82rem; font-weight: 600; color: rgba(255,255,255,0.7); }
  .metric-val { font-size: 0.82rem; font-weight: 700; }
  .metric-bar-bg { height: 8px; background: rgba(255,255,255,0.06); border-radius: 10px; overflow: hidden; }
  .metric-bar-fill { height: 100%; border-radius: 10px; transition: width 1.5s cubic-bezier(0.16,1,0.3,1); }
  .mf1 { background: linear-gradient(90deg, #ff4d2e, #ff6a00); box-shadow: 0 0 10px rgba(255,77,46,0.4); }
  .mf2 { background: linear-gradient(90deg, #00d4ff, #0066ff); box-shadow: 0 0 10px rgba(0,212,255,0.4); }
  .mf3 { background: linear-gradient(90deg, #a855f7, #7c3aed); box-shadow: 0 0 10px rgba(168,85,247,0.4); }
  .mf4 { background: linear-gradient(90deg, #22c55e, #16a34a); box-shadow: 0 0 10px rgba(34,197,94,0.4); }
  .metrics-right { display: flex; flex-direction: column; gap: 18px; }
  .metric-big-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; padding: 22px; display: flex; align-items: center; gap: 18px; transition: all 0.3s; }
  .metric-big-card:hover { border-color: rgba(0,212,255,0.2); box-shadow: 0 0 25px rgba(0,212,255,0.08); transform: translateX(6px); }
  .mbc-icon { width: 50px; height: 50px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0; }
  .mbc-body { flex: 1; }
  .mbc-title { font-size: 0.8rem; color: rgba(255,255,255,0.45); margin-bottom: 4px; }
  .mbc-val { font-size: 1.35rem; font-weight: 800; }
  .mbc-change { font-size: 0.75rem; font-weight: 600; }
  .up { color: #22c55e; }
  .down { color: #ef4444; }
  .neutral { color: var(--cyan); }

  /* TESTIMONIALS */
  .testimonials { padding: 80px 5% 100px; }
  .testi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .testi-card { background: var(--glass); border: 1px solid var(--glass-border); border-radius: 22px; padding: 30px 26px; backdrop-filter: blur(12px); transition: all 0.3s; position: relative; overflow: hidden; }
  .testi-card::before { content: '"'; position: absolute; top: 14px; right: 20px; font-size: 5rem; font-weight: 900; color: rgba(255,255,255,0.04); line-height: 1; }
  .testi-card:hover { transform: translateY(-6px); box-shadow: 0 20px 50px rgba(0,0,0,0.35); border-color: rgba(255,255,255,0.12); }
  .testi-stars { display: flex; gap: 3px; margin-bottom: 18px; }
  .star { color: #f59e0b; font-size: 0.9rem; }
  .testi-text { font-size: 0.88rem; color: rgba(255,255,255,0.65); line-height: 1.75; margin-bottom: 24px; font-style: italic; }
  .testi-author { display: flex; align-items: center; gap: 12px; }
  .testi-avatar { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; }
  .testi-name { font-size: 0.88rem; font-weight: 700; color: #fff; }
  .testi-role { font-size: 0.74rem; color: rgba(255,255,255,0.4); }
  .testi-featured { border-color: rgba(255,77,46,0.3); background: rgba(255,77,46,0.04); }

  /* PRICING */
  .pricing { padding: 80px 5% 100px; }
  .pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; align-items: start; }
  .price-card { background: var(--glass); border: 1px solid var(--glass-border); border-radius: 24px; padding: 36px 30px; backdrop-filter: blur(12px); transition: all 0.4s; position: relative; overflow: hidden; }
  .price-card.featured { background: linear-gradient(135deg, rgba(255,77,46,0.12), rgba(255,106,0,0.06)); border-color: rgba(255,77,46,0.35); box-shadow: 0 0 50px rgba(255,77,46,0.15); transform: scale(1.04); }
  .price-card:hover { transform: translateY(-8px); }
  .price-card.featured:hover { transform: scale(1.04) translateY(-8px); }
  .popular-badge { position: absolute; top: 20px; right: 20px; background: linear-gradient(135deg, var(--red), var(--orange)); color: #fff; font-size: 0.65rem; font-weight: 700; letter-spacing: 1px; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; box-shadow: 0 0 15px rgba(255,77,46,0.5); }
  .price-plan { font-size: 0.78rem; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: var(--cyan); margin-bottom: 14px; }
  .price-plan.red { color: var(--red); }
  .price-amount { font-size: 2.8rem; font-weight: 900; line-height: 1; margin-bottom: 4px; }
  .price-period { font-size: 0.82rem; color: rgba(255,255,255,0.4); margin-bottom: 28px; }
  .price-period small { display: block; font-size: 0.65rem; color: rgba(255,255,255,0.3); margin-top: 2px; }
  .price-divider { height: 1px; background: rgba(255,255,255,0.07); margin-bottom: 28px; }
  .price-features { display: flex; flex-direction: column; gap: 14px; margin-bottom: 32px; }
  .pf-item { display: flex; align-items: center; gap: 12px; font-size: 0.85rem; color: rgba(255,255,255,0.65); }
  .pf-check { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; flex-shrink: 0; }
  .pf-check.yes { background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
  .pf-check.no { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.1); }
  .price-btn { width: 100%; padding: 14px; border-radius: 14px; border: none; font-family: inherit; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .price-btn.outline { background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #fff; }
  .price-btn.outline:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.25); }
  .price-btn.solid { background: linear-gradient(135deg, var(--red), var(--orange)); color: #fff; box-shadow: 0 0 25px rgba(255,77,46,0.4); }
  .price-btn.solid:hover { box-shadow: 0 0 45px rgba(255,77,46,0.7); transform: translateY(-2px); }

  /* MARQUEE */
  .partners { padding: 50px 5% 80px; overflow: hidden; }
  .partners-label { text-align: center; font-size: 0.8rem; font-weight: 500; color: rgba(255,255,255,0.3); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 36px; }
  .marquee-track { display: flex; gap: 0; overflow: hidden; }
  .marquee-inner { display: flex; gap: 0; animation: marquee 30s linear infinite; }
  @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  .marquee-item { display: flex; align-items: center; gap: 10px; padding: 0 40px; font-size: 1rem; font-weight: 700; color: rgba(255,255,255,0.22); white-space: nowrap; transition: color 0.3s; }
  .marquee-item:hover { color: rgba(255,255,255,0.55); }
  .marquee-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.15); }

  /* FAQ */
  .faq { padding: 80px 5% 100px; }
  .faq-list { max-width: 780px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
  .faq-item { background: var(--glass); border: 1px solid var(--glass-border); border-radius: 18px; overflow: hidden; transition: border-color 0.3s; }
  .faq-item.open { border-color: rgba(0,212,255,0.25); }
  .faq-q { display: flex; justify-content: space-between; align-items: center; padding: 22px 26px; cursor: pointer; userSelect: none; font-size: 0.95rem; font-weight: 600; }
  .faq-icon { width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center; font-size: 1rem; transition: transform 0.3s, background 0.3s; flex-shrink: 0; }
  .faq-item.open .faq-icon { transform: rotate(45deg); background: rgba(0,212,255,0.15); }
  .faq-a { overflow: hidden; transition: max-height 0.4s ease, padding 0.3s; padding: 0 26px; max-height: 0; }
  .faq-item.open .faq-a { max-height: 200px; padding: 0 26px 22px; }
  .faq-a p { font-size: 0.86rem; color: rgba(255,255,255,0.5); line-height: 1.75; }

  /* CTA */
  .cta-section { padding: 40px 5% 100px; }
  .cta-inner { background: linear-gradient(135deg, rgba(255,77,46,0.15) 0%, rgba(255,106,0,0.08) 30%, rgba(0,100,255,0.12) 70%, rgba(0,212,255,0.08) 100%); border: 1px solid rgba(255,77,46,0.25); border-radius: 32px; padding: 70px 60px; text-align: center; position: relative; overflow: hidden; backdrop-filter: blur(20px); }
  .cta-glow { position: absolute; top: -100px; left: 50%; transform: translateX(-50%); width: 500px; height: 300px; background: radial-gradient(ellipse, rgba(255,77,46,0.2), transparent 70%); pointer-events: none; }
  .cta-tag { display: inline-block; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); padding: 6px 18px; border-radius: 20px; font-size: 0.78rem; font-weight: 600; letter-spacing: 1px; color: rgba(255,255,255,0.7); margin-bottom: 24px; }
  .cta-title { font-size: clamp(2rem, 4vw, 3rem); font-weight: 900; line-height: 1.15; margin-bottom: 18px; }
  .cta-title span { color: var(--red); }
  .cta-desc { font-size: 0.98rem; color: rgba(255,255,255,0.5); max-width: 500px; margin: 0 auto 40px; line-height: 1.7; }
  .cta-btns { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
  .cta-note { font-size: 0.78rem; color: rgba(255,255,255,0.3); margin-top: 20px; }

  /* NEWSLETTER */
  .newsletter { padding: 0 5% 90px; }
  .newsletter-inner { background: var(--glass); border: 1px solid var(--glass-border); border-radius: 24px; padding: 48px; display: flex; align-items: center; gap: 48px; backdrop-filter: blur(16px); }
  .nl-left { flex: 1; }
  .nl-title { font-size: 1.5rem; font-weight: 800; margin-bottom: 8px; }
  .nl-sub { font-size: 0.85rem; color: rgba(255,255,255,0.45); }
  .nl-form { flex: 1; display: flex; gap: 12px; }
  .nl-input { flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px 20px; color: #fff; font-family: inherit; font-size: 0.9rem; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
  .nl-input::placeholder { color: rgba(255,255,255,0.3); }
  .nl-input:focus { border-color: rgba(0,212,255,0.4); box-shadow: 0 0 15px rgba(0,212,255,0.1); }
  .nl-btn { background: linear-gradient(135deg, var(--red), var(--orange)); border: none; padding: 14px 28px; border-radius: 12px; color: #fff; font-family: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.2s; box-shadow: 0 0 20px rgba(255,77,46,0.35); }
  .nl-btn:hover { transform: translateY(-2px); box-shadow: 0 0 35px rgba(255,77,46,0.6); }

  /* FOOTER */
  footer.mm-footer { position: relative; z-index: 1; background: rgba(0,0,0,0.4); border-top: 1px solid rgba(255,255,255,0.06); }
  .footer-top { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 40px; padding: 60px 5% 50px; }
  .footer-brand .footer-logo { font-size: 1.3rem; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .footer-logo strong { color: var(--red); }
  .footer-brand p { font-size: 0.84rem; color: rgba(255,255,255,0.4); line-height: 1.7; max-width: 260px; margin-bottom: 24px; }
  .footer-social { display: flex; gap: 10px; }
  .soc-btn { width: 38px; height: 38px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; font-size: 1rem; cursor: pointer; transition: all 0.25s; }
  .soc-btn:hover { background: rgba(255,77,46,0.15); border-color: rgba(255,77,46,0.3); transform: translateY(-3px); box-shadow: 0 0 15px rgba(255,77,46,0.3); }
  .footer-col h4 { font-size: 0.85rem; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 20px; color: #fff; }
  .footer-col ul { list-style: none; display: flex; flex-direction: column; gap: 12px; }
  .footer-col ul li a { font-size: 0.82rem; color: rgba(255,255,255,0.42); text-decoration: none; transition: color 0.2s; }
  .footer-col ul li a:hover { color: var(--cyan); }
  .footer-bottom { display: flex; justify-content: space-between; align-items: center; padding: 20px 5%; border-top: 1px solid rgba(255,255,255,0.05); flex-wrap: wrap; gap: 12px; }
  .footer-copy { font-size: 0.78rem; color: rgba(255,255,255,0.3); }
  .footer-bottom-links { display: flex; gap: 1.5rem; }
  .footer-bottom-links a { font-size: 0.78rem; color: rgba(255,255,255,0.35); text-decoration: none; transition: color 0.2s; }
  .footer-bottom-links a:hover { color: var(--cyan); }
  .footer-badge { font-size: 0.75rem; color: rgba(255,255,255,0.3); display: flex; align-items: center; gap: 6px; }
  .badge-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 8px rgba(34,197,94,0.6); animation: pulseDot 2s ease-in-out infinite; }
  @keyframes pulseDot { 0%,100%{transform:scale(1);} 50%{transform:scale(1.3);} }

  /* REVEAL */
  .reveal { opacity: 0; transform: translateY(40px); transition: all 0.7s cubic-bezier(0.16,1,0.3,1); }
  .reveal.up { opacity: 1; transform: translateY(0); }
  .reveal-delay-1 { transition-delay: 0.1s; }
  .reveal-delay-2 { transition-delay: 0.2s; }
  .reveal-delay-3 { transition-delay: 0.3s; }
  .reveal-delay-4 { transition-delay: 0.4s; }
  .reveal-delay-5 { transition-delay: 0.5s; }
  .reveal-delay-6 { transition-delay: 0.6s; }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #060b18; }
  ::-webkit-scrollbar-thumb { background: linear-gradient(180deg, var(--red), var(--orange)); border-radius: 3px; }

  @media (max-width: 1100px) { .services-grid { grid-template-columns: repeat(2, 1fr); } .footer-top { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 900px) { .hero { flex-direction: column; padding: 100px 5% 40px; } .hero-left { flex: none; width: 100%; text-align: center; } .hero-btns { justify-content: center; } .hero-right { min-height: 380px; width: 100%; } .stage { transform: rotateX(12deg) rotateY(-12deg) scale(0.78); } .nav-links { display: none; } .stats-strip { flex-wrap: wrap; } .testi-grid { grid-template-columns: 1fr; } .pricing-grid { grid-template-columns: 1fr; } .price-card.featured { transform: none; } .metrics-inner { grid-template-columns: 1fr; } .newsletter-inner { flex-direction: column; } .nl-form { flex-direction: column; } }
  @media (max-width: 700px) { .services-grid { grid-template-columns: 1fr; } .footer-top { grid-template-columns: 1fr; } .cta-inner { padding: 40px 24px; } .steps::before { left: 34px; } }
  @media (max-width: 600px) { .stage { transform: rotateX(10deg) rotateY(-8deg) scale(0.6); } .hero-right { min-height: 300px; } .stat-item { padding: 16px 20px; } }
`;

// ── Sub-components ──────────────────────────────────────────

function Navbar({ scrolled }) {
  return (
    <nav className="mm-nav" style={scrolled ? { background: 'rgba(6,10,24,0.95)', boxShadow: '0 4px 30px rgba(0,0,0,0.4)' } : {}}>
      <a href="#" className="logo">
        <div className="logo-icon">
          <span /><span /><span />
        </div>
        Datalytics
      </a>
      <ul className="nav-links">
        {['Home','About Us','Services','Pricing','Contact'].map(l => (
          <li key={l}><a href="#">{l}</a></li>
        ))}
      </ul>
      <div className="nav-actions">
        <button className="btn-login">Login</button>
        <button className="btn-signup" onClick={() => window.location.href='/app'}>Launch App</button>
      </div>
    </nav>
  );
}

function HeroDashboard({ tickerPrice, tickerChg, miniBarHeights }) {
  return (
    <div className="stage" id="stage">
      {/* MAIN CHART */}
      <div className="card card-main">
        <div className="card-header">
          <span className="card-title">DATA OVERVIEW</span>
          <span className="card-badge">LIVE</span>
        </div>
        <div className="chart-bars">
          {[['bar-b1','Jan'],['bar-b2','Feb'],['bar-b3','Mar'],['bar-b4','Apr'],['bar-b5','May'],['bar-b6','Jun']].map(([cls,label]) => (
            <div className="bar-wrap" key={label}>
              <div className={`bar ${cls}`} />
              <span className="bar-label">{label}</span>
            </div>
          ))}
        </div>
        <div className="chart-bottom">
          <span className="chart-total">48,240 Rows</span>
          <span className="chart-change">▲ +12.4%</span>
        </div>
      </div>

      {/* TICKER */}
      <div className="card card-ticker">
        <div className="ticker-icon">📊</div>
        <div className="ticker-info">
          <div className="ticker-name">Data Points</div>
          <div className="ticker-sub">Real-time Stream</div>
        </div>
        <div className="ticker-val">
          <div className="ticker-price">{tickerPrice}</div>
          <div className="ticker-chg" style={{ color: tickerChg.startsWith('+') ? '#22c55e' : '#ef4444' }}>{tickerChg}</div>
        </div>
      </div>

      {/* DONUT */}
      <div className="card card-donut">
        <div className="donut-title">MODEL ACCURACY</div>
        <div className="donut-wrap">
          <svg className="donut-svg" viewBox="0 0 90 90">
            <defs>
              <linearGradient id="donutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff6a00" />
                <stop offset="100%" stopColor="#ff4d2e" />
              </linearGradient>
            </defs>
            <circle className="donut-bg" cx="45" cy="45" r="35" />
            <circle cx="45" cy="45" r="35" fill="none" strokeWidth="10" strokeLinecap="round"
              stroke="url(#donutGrad)" strokeDasharray="220" strokeDashoffset="66"
              style={{ animation: 'donutAnim 2s ease 1s both' }} />
          </svg>
          <div className="donut-label">94%<small>Accuracy</small></div>
        </div>
        <div className="donut-legend">
          <span className="legend-item"><span className="legend-dot" style={{ background: 'linear-gradient(135deg,#ff6a00,#ff4d2e)' }} />Target</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: 'rgba(255,255,255,0.15)' }} />Current</span>
        </div>
      </div>

      {/* STATS */}
      <div className="card card-stats">
        <div className="stats-amount" style={{ background: 'linear-gradient(135deg,#ff6a00,#ff4d2e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>+2,349 Nodes</div>
        <div className="stats-label">Monthly Growth</div>
        <div className="mini-bars">
          {miniBarHeights.map((h, i) => (
            <div key={i} className="mini-bar" style={{
              height: h + '%',
              background: [2,4,6].includes(i) ? 'linear-gradient(180deg,#ff6a00,#ff4d2e)' : 'rgba(255,255,255,0.15)',
              boxShadow: [2,4,6].includes(i) ? '0 0 8px rgba(255,80,40,0.5)' : 'none'
            }} />
          ))}
        </div>
        <div className="stats-footer">
          <div className="stats-foot-item"><strong>248</strong>Clusters</div>
          <div className="stats-foot-item"><strong>+18%</strong>Velocity</div>
        </div>
      </div>

      {/* PCT */}
      <div className="card card-pct">
        <div className="pct-icon">🔍</div>
        <div className="pct-label">Insight Rate</div>
        <div className="pct-value">86.4%</div>
      </div>

      <div className="platform plat1" />
      <div className="platform plat2" />
      <div className="platform plat3" />
    </div>
  );
}

function MetricBar({ label, val, color, cls, width }) {
  const ref = useRef(null);
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { setAnimated(true); obs.disconnect(); }
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div className="metric-row" ref={ref}>
      <div className="metric-label-row">
        <span className="metric-label">{label}</span>
        <span className="metric-val" style={{ color }}>{val}</span>
      </div>
      <div className="metric-bar-bg">
        <div className={`metric-bar-fill ${cls}`} style={{ width: animated ? width + '%' : '0%' }} />
      </div>
    </div>
  );
}

function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item${open ? ' open' : ''}`}>
      <div className="faq-q" onClick={() => setOpen(!open)}>
        <span>{question}</span>
        <span className="faq-icon">+</span>
      </div>
      <div className="faq-a"><p>{answer}</p></div>
    </div>
  );
}

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('up'); obs.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

function useSteps() {
  useEffect(() => {
    const steps = document.querySelectorAll('.step');
    const obs = new IntersectionObserver(entries => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('visible'), i * 150);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    steps.forEach(s => obs.observe(s));
    return () => obs.disconnect();
  }, []);
}

// ── MAIN COMPONENT ──────────────────────────────────────────
export default function Datalytics() {
  const [scrolled, setScrolled] = useState(false);
  const [tickerPrice, setTickerPrice] = useState('43,210');
  const [tickerChg, setTickerChg] = useState('+2.34%');
  const [miniBarHeights, setMiniBarHeights] = useState([30,55,70,45,80,60,90]);
  const [nlEmail, setNlEmail] = useState('');
  const [nlDone, setNlDone] = useState(false);
  const [volumeVal, setVolumeVal] = useState('1.3B');
  const tickerBase = useRef(43210);
  const volBase = useRef(1.3);

  useReveal();
  useSteps();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Ticker live update
  useEffect(() => {
    const id = setInterval(() => {
      const delta = (Math.random() - 0.48) * 120;
      tickerBase.current = Math.max(40000, tickerBase.current + delta);
      const base = tickerBase.current;
      const pct = ((base - 43210) / 43210 * 100).toFixed(2);
      setTickerPrice(Math.round(base).toLocaleString());
      setTickerChg((pct >= 0 ? '+' : '') + pct + '%');
    }, 2200);
    return () => clearInterval(id);
  }, []);

  // Mini bars animation
  useEffect(() => {
    const defaults = [30,55,70,45,80,60,90];
    const id = setInterval(() => {
      setMiniBarHeights(defaults.map(h => Math.max(15, h + (Math.random()-0.5)*20)));
    }, 1800);
    return () => clearInterval(id);
  }, []);

  // Volume live
  useEffect(() => {
    const id = setInterval(() => {
      volBase.current += (Math.random() - 0.45) * 0.02;
      volBase.current = Math.max(1.0, Math.min(2.0, volBase.current));
      setVolumeVal(volBase.current.toFixed(1) + 'B');
    }, 3000);
    return () => clearInterval(id);
  }, []);

  // Mouse parallax on stage
  useEffect(() => {
    const stage = document.getElementById('stage');
    if (!stage) return;
    const onMove = (e) => {
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx, dy = (e.clientY - cy) / cy;
      stage.style.transform = `rotateX(${18 - dy * 8}deg) rotateY(${-20 + dx * 10}deg)`;
      stage.style.animation = 'none';
    };
    const onLeave = () => { stage.style.transform = ''; stage.style.animation = ''; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseleave', onLeave); };
  }, []);

  const handleNl = () => {
    if (nlEmail.includes('@')) {
      setNlDone(true);
    }
  };

  const features = [
    { icon: '📁', cls: 'fi-red', title: 'Smart Upload', desc: 'Easily import CSV, Excel, and JSON datasets with automated schema detection and validation.' },
    { icon: '📊', cls: 'fi-cyan', title: 'Live Analytics', desc: 'Visualize your data performance with AI-powered charts, trends and predictive insights in real time.' },
    { icon: '🔐', cls: 'fi-purple', title: 'Enterprise Security', desc: 'Military-grade encryption, biometric auth and multi-factor verification keep your data safe 24/7.' },
    { icon: '🤖', cls: 'fi-green', title: 'AI Insights', desc: 'Our AI engine analyses your data patterns and delivers personalized strategic recommendations.' },
    { icon: '⚡', cls: 'fi-yellow', title: 'Instant Processing', desc: 'Parallel-powered processing in under 3 seconds, 24/7. No delays, no interruptions.' },
    { icon: '🌍', cls: 'fi-blue', title: 'Global Connectivity', desc: 'Connect to any data source directly from your unified Datalytics dashboard.' },
  ];

  const services = [
    { tag: 'Data', tagColor: 'var(--red)', tagBg: 'rgba(255,77,46,0.1)', tagBorder: 'rgba(255,77,46,0.25)', icon: '📁', iconBg: 'linear-gradient(135deg,rgba(255,77,46,0.2),rgba(255,106,0,0.1))', iconBorder: 'rgba(255,77,46,0.25)', title: 'Smart Ingestion', desc: 'Ingest data from any source. Our intelligent routing ensures the cleanest data and fastest processing times every time.', linkColor: 'var(--cyan)' },
    { tag: 'Analytics', tagColor: 'var(--cyan)', tagBg: 'rgba(0,212,255,0.1)', tagBorder: 'rgba(0,212,255,0.25)', icon: '📈', iconBg: 'linear-gradient(135deg,rgba(0,212,255,0.2),rgba(0,102,255,0.1))', iconBorder: 'rgba(0,212,255,0.25)', title: 'Deep Insights', desc: 'Explore patterns, correlations and anomalies with ease. Advanced visualization, real-time charts, and AI signals at your fingertips.', linkColor: 'var(--cyan)' },
    { tag: 'ML', tagColor: '#a855f7', tagBg: 'rgba(168,85,247,0.1)', tagBorder: 'rgba(168,85,247,0.25)', icon: '🧠', iconBg: 'linear-gradient(135deg,rgba(168,85,247,0.2),rgba(124,58,237,0.1))', iconBorder: 'rgba(168,85,247,0.25)', title: 'Auto-ML Training', desc: 'Train state-of-the-art machine learning models with just a few clicks. No complex coding required.', linkColor: '#a855f7' },
    { tag: 'Reporting', tagColor: '#22c55e', tagBg: 'rgba(34,197,94,0.1)', tagBorder: 'rgba(34,197,94,0.25)', icon: '📊', iconBg: 'linear-gradient(135deg,rgba(34,197,94,0.2),rgba(22,163,74,0.1))', iconBorder: 'rgba(34,197,94,0.25)', title: 'Advanced Reports', desc: 'Generate beautiful, interactive reports and visualizations that tell the story behind your numbers.', linkColor: '#22c55e' },
    { tag: 'Predictions', tagColor: '#f59e0b', tagBg: 'rgba(245,158,11,0.1)', tagBorder: 'rgba(245,158,11,0.25)', icon: '🚀', iconBg: 'linear-gradient(135deg,rgba(245,158,11,0.2),rgba(217,119,6,0.1))', iconBorder: 'rgba(245,158,11,0.25)', title: 'Predictive Power', desc: 'Deploy your trained models instantly to make real-time predictions and drive better decisions.', linkColor: '#f59e0b' },
    { tag: 'Preprocessing', tagColor: '#60a5fa', tagBg: 'rgba(0,102,255,0.1)', tagBorder: 'rgba(0,102,255,0.25)', icon: '🛠️', iconBg: 'linear-gradient(135deg,rgba(0,102,255,0.2),rgba(0,212,255,0.1))', iconBorder: 'rgba(0,102,255,0.25)', title: 'Data Preprocessing', desc: 'Clean, normalize, and transform your data with our intuitive automated preprocessing pipeline.', linkColor: '#60a5fa' },
  ];

  const testimonials = [
    { featured: true, avatar: '👨‍💼', avatarBg: 'linear-gradient(135deg,rgba(255,77,46,0.3),rgba(255,106,0,0.2))', avatarBorder: 'rgba(255,77,46,0.3)', text: '"Datalytics completely transformed how I manage my data insights. The AI advisor alone saved us $40K in the first quarter. Absolutely game-changing platform."', name: 'Marcus Chen', role: 'CTO, DataVault Inc.' },
    { featured: false, avatar: '👩‍💻', avatarBg: 'linear-gradient(135deg,rgba(0,212,255,0.3),rgba(0,102,255,0.2))', avatarBorder: 'rgba(0,212,255,0.3)', text: '"I\'ve tried every analytics app out there. Nothing comes close to the velocity and depth Datalytics provides. My insights are up 34% since switching. Highly recommend!"', name: 'Sarah Williams', role: 'Senior Data Scientist, Apex Capital' },
    { featured: false, avatar: '👨‍🚀', avatarBg: 'linear-gradient(135deg,rgba(168,85,247,0.3),rgba(124,58,237,0.2))', avatarBorder: 'rgba(168,85,247,0.3)', text: '"The smart ingestion feature is incredible. We process data from 47 sources and the processing speed is unmatched. Our ops team is 3x more efficient now."', name: 'Ravi Patel', role: 'COO, GlobalMesh Ltd.' },
    { featured: false, avatar: '👩‍⚕️', avatarBg: 'linear-gradient(135deg,rgba(34,197,94,0.3),rgba(22,163,74,0.2))', avatarBorder: 'rgba(34,197,94,0.3)', text: '"The security features give me total peace of mind. Biometric auth, real-time anomaly detection, instant lock — I\'ve never felt safer managing $2M+ in data assets."', name: 'Emily Rodriguez', role: 'Data Architect' },
    { featured: false, avatar: '🧑‍🎨', avatarBg: 'linear-gradient(135deg,rgba(245,158,11,0.3),rgba(217,119,6,0.2))', avatarBorder: 'rgba(245,158,11,0.3)', text: '"As a startup founder, Datalytics\' preprocessing tools are a lifesaver. Cleaning, normalizing, and tracking — all under one roof with stunning design."', name: 'Alex Thompson', role: 'Founder, NovaSpark Studio' },
    { featured: false, avatar: '👨‍🔬', avatarBg: 'linear-gradient(135deg,rgba(0,102,255,0.3),rgba(0,212,255,0.2))', avatarBorder: 'rgba(0,102,255,0.3)', text: '"The high-accuracy models at 94% are insane. I moved all my data workflows here. Customer support is also exceptional — real humans, instant responses."', name: 'James Liu', role: 'AI Research Lead' },
  ];

  const faqs = [
    { q: 'Is my data safe with Datalytics?', a: 'Absolutely. Datalytics uses 256-bit AES encryption, is SOC 2 Type II certified, and all data is backed up across multiple regions. We also employ real-time anomaly monitoring and biometric authentication to protect your account around the clock.' },
    { q: 'How fast is data processing?', a: 'Most datasets are processed within 2–8 seconds using our parallel-powered engines. Large-scale ingestion can take slightly longer, but with Datalytics\' network you get near-instant insights 24/7.' },
    { q: 'Can I cancel my subscription anytime?', a: 'Yes, completely. You can cancel your Pro or Enterprise subscription at any time from your account settings. There are no cancellation fees or lock-in periods. You\'ll retain full access until the end of your billing period.' },
    { q: 'What data sources does Datalytics support?', a: 'Datalytics supports 150+ data sources including CSV, Excel, SQL, NoSQL, and various cloud APIs. We support major data formats and can connect to almost any data stream directly from your dashboard.' },
    { q: 'How does the AI insights engine work?', a: 'Our AI engine analyzes your data history, patterns, correlations and market conditions in real time. It then generates personalized strategic recommendations, insights, and alerts — all updated continuously as your data evolves.' },
    { q: 'Is there an API available for developers?', a: 'Yes! Datalytics offers a comprehensive REST API and SDK libraries for JavaScript, Python, Go, and more. Enterprise customers get full white-label API access with dedicated sandboxes, webhooks, and SLA-backed uptime guarantees.' },
  ];

  const marqueeItems = ['📊 Snowflake','☁️ AWS','🔥 Databricks','🔍 Elastic','🧠 OpenAI','⚡ Spark','📦 MongoDB','🚀 Google Cloud','💡 Microsoft Azure'];

  return (
    <div className="mm-wrap">
      <style>{styles}</style>

      {/* BG */}
      <div className="bg-wrap">
        <div className="blob blob1"/><div className="blob blob2"/><div className="blob blob3"/>
        <div className="blob blob4"/><div className="blob blob5"/>
      </div>
      <div className="grid-bg"/>

      <Navbar scrolled={scrolled} />

      {/* HERO */}
      <section className="hero" id="hero">
        <div className="hero-left">
          <p className="hero-eyebrow">The next generation <span>analytics</span> platform</p>
          <h1 className="hero-h1">The new era of<br /><span className="accent">data</span><br />insights.</h1>
          <p className="hero-sub">Unlocking the power of AI-driven data insights.</p>
          <div className="hero-btns">
            <button className="btn-primary" onClick={() => window.location.href='/app'}>Try it free</button>
            <button className="btn-secondary">
              <span className="play-icon">▶</span>
              Show me the demo
            </button>
          </div>
        </div>
        <div className="hero-right">
          <HeroDashboard tickerPrice={tickerPrice} tickerChg={tickerChg} miniBarHeights={miniBarHeights} />
        </div>
      </section>

      {/* STATS STRIP */}
      <div className="stats-strip">
        {[['2M+','Data Assets Processed'],['4.8B','Data Points Streamed'],['99%','Processing Uptime'],['150+','Data Sources Integrated']].map(([num,desc],i) => (
          <div key={desc} className={`stat-item reveal${i > 0 ? ` reveal-delay-${i}` : ''}`}>
            <div className="stat-num">{num}</div>
            <div className="stat-desc">{desc}</div>
          </div>
        ))}
      </div>

      {/* PARTNERS MARQUEE */}
      <div className="partners">
        <p className="partners-label">Trusted by leading data-driven companies worldwide</p>
        <div className="marquee-track">
          <div className="marquee-inner">
            {[...marqueeItems,...marqueeItems].map((item,i) => (
              <div key={i} className="marquee-item">{item}<span className="marquee-dot"/></div>
            ))}
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <section className="features" id="about">
        <div className="section-head">
          <div className="section-tag reveal">Why Datalytics</div>
          <h2 className="section-title reveal reveal-delay-1">Everything you need to manage<br />your data</h2>
          <div className="section-divider reveal reveal-delay-2"/>
          <p className="section-sub reveal reveal-delay-2" style={{ marginTop: 16 }}>Powerful tools and features built for modern data science — from solo analysts to enterprise teams.</p>
        </div>
        <div className="features-grid">
          {features.map((f,i) => (
            <div key={f.title} className={`feat-card reveal reveal-delay-${i+1}`}>
              <div className={`feat-icon ${f.cls}`}>{f.icon}</div>
              <h3 className="feat-title">{f.title}</h3>
              <p className="feat-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how" id="howit">
        <div className="section-head center">
          <div className="section-tag reveal">How It Works</div>
          <h2 className="section-title reveal reveal-delay-1">Get insights in 4 simple steps</h2>
          <div className="section-divider center reveal reveal-delay-2"/>
          <p className="section-sub reveal reveal-delay-2" style={{ marginTop: 16 }}>From ingestion to your first strategic decision — it takes less than 5 minutes.</p>
        </div>
        <div className="steps">
          {[
            { num: '01', cls: 'sn1', title: 'Connect Your Sources', desc: 'Securely link any data source — SQL, NoSQL, Cloud Storage, or API. We support 150+ integrations via open data protocols.' },
            { num: '02', cls: 'sn2', title: 'Smart Preprocessing', desc: 'Our automated pipeline cleans, normalizes, and transforms your raw data into analysis-ready formats in seconds.' },
            { num: '03', cls: 'sn3', title: 'Train & Explore', desc: 'Train state-of-the-art ML models, explore correlations, and ask questions to your data using our AI-powered chatbot.' },
            { num: '04', cls: 'sn4', title: 'Ship & Decide', desc: 'Deploy models instantly, generate interactive reports, and make data-driven decisions with real-time confidence scores.' },
          ].map(s => (
            <div key={s.num} className="step">
              <div className={`step-num ${s.cls}`}>{s.num}</div>
              <div className="step-body">
                <h3 className="step-title">{s.title}</h3>
                <p className="step-desc">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section className="services" id="services">
        <div className="section-head">
          <div className="section-tag red reveal">Our Services</div>
          <h2 className="section-title reveal reveal-delay-1">Comprehensive data solutions</h2>
          <div className="section-divider reveal reveal-delay-2" style={{ background: 'linear-gradient(90deg,var(--red),var(--orange))' }}/>
          <p className="section-sub reveal reveal-delay-2" style={{ marginTop: 16 }}>A complete ecosystem of data products designed to empower individuals and businesses alike.</p>
        </div>
        <div className="services-grid">
          {services.map((s,i) => (
            <div key={s.title} className={`service-card reveal reveal-delay-${(i%3)+1}`}>
              <span className="service-tag-badge" style={{ background: s.tagBg, color: s.tagColor, border: `1px solid ${s.tagBorder}` }}>{s.tag}</span>
              <div className="service-icon-wrap" style={{ background: s.iconBg, border: `1px solid ${s.iconBorder}` }}>{s.icon}</div>
              <h3 className="service-title">{s.title}</h3>
              <p className="service-desc">{s.desc}</p>
              <div className="service-link" style={{ color: s.linkColor }}>Learn more →</div>
            </div>
          ))}
        </div>
      </section>

      {/* LIVE METRICS */}
      <section className="metrics">
        <div className="metrics-inner">
          <div className="metrics-left">
            <div className="section-tag reveal">Live Metrics</div>
            <h2 className="section-title reveal reveal-delay-1" style={{ maxWidth: 400 }}>Real-time platform performance</h2>
            <div className="section-divider reveal reveal-delay-2"/>
            <p className="section-sub reveal reveal-delay-2" style={{ marginTop: 16, marginBottom: 32 }}>Our infrastructure is built for speed, scale, and reliability — serving millions of data points every day.</p>
            <div className="metric-list reveal reveal-delay-3">
              <MetricBar label="Processing Velocity" val="97%" color="#ff6a00" cls="mf1" width={97} />
              <MetricBar label="Asset Security" val="99%" color="var(--cyan)" cls="mf2" width={99} />
              <MetricBar label="Insight Accuracy" val="94%" color="#a855f7" cls="mf3" width={94} />
              <MetricBar label="Platform Satisfaction" val="98%" color="#22c55e" cls="mf4" width={98} />
            </div>
          </div>
          <div className="metrics-right reveal reveal-delay-2">
            {[
              { icon: '🚀', bg: 'linear-gradient(135deg,rgba(255,77,46,0.2),rgba(255,106,0,0.1))', border: 'rgba(255,77,46,0.25)', title: 'Daily Insights', val: '4.2M+', change: '▲ 18.5%', changeCls: 'up' },
              { icon: '📊', bg: 'linear-gradient(135deg,rgba(0,212,255,0.2),rgba(0,102,255,0.1))', border: 'rgba(0,212,255,0.25)', title: 'Volume Today', val: volumeVal, change: '▲ 7.2%', changeCls: 'up' },
              { icon: '⏱️', bg: 'linear-gradient(135deg,rgba(168,85,247,0.2),rgba(124,58,237,0.1))', border: 'rgba(168,85,247,0.25)', title: 'Avg. Processing Time', val: '2.8s', change: '★ Best in class', changeCls: 'neutral' },
              { icon: '🌍', bg: 'linear-gradient(135deg,rgba(34,197,94,0.3),rgba(22,163,74,0.2))', border: 'rgba(34,197,94,0.3)', title: 'Active Sources', val: '157', change: '▲ +3 this month', changeCls: 'up' },
            ].map(m => (
              <div key={m.title} className="metric-big-card">
                <div className="mbc-icon" style={{ background: m.bg, border: `1px solid ${m.border}` }}>{m.icon}</div>
                <div className="mbc-body">
                  <div className="mbc-title">{m.title}</div>
                  <div className="mbc-val">{m.val}</div>
                </div>
                <div className={`mbc-change ${m.changeCls}`}>{m.change}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="testimonials">
        <div className="section-head center">
          <div className="section-tag purple reveal">Testimonials</div>
          <h2 className="section-title reveal reveal-delay-1">What our users are saying</h2>
          <div className="section-divider center reveal reveal-delay-2" style={{ background: 'linear-gradient(90deg,#a855f7,#7c3aed)' }}/>
          <p className="section-sub reveal reveal-delay-2" style={{ marginTop: 16 }}>Over 2 million people trust Datalytics with their strategic future. Here's what some of them have to say.</p>
        </div>
        <div className="testi-grid">
          {testimonials.map((t,i) => (
            <div key={t.name} className={`testi-card${t.featured ? ' testi-featured' : ''} reveal reveal-delay-${(i%3)+1}`}>
              <div className="testi-stars">{[...Array(5)].map((_,j) => <span key={j} className="star">★</span>)}</div>
              <p className="testi-text">{t.text}</p>
              <div className="testi-author">
                <div className="testi-avatar" style={{ background: t.avatarBg, border: `1px solid ${t.avatarBorder}` }}>{t.avatar}</div>
                <div>
                  <div className="testi-name">{t.name}</div>
                  <div className="testi-role">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="pricing" id="pricing">
        <div className="section-head center">
          <div className="section-tag green reveal">Pricing</div>
          <h2 className="section-title reveal reveal-delay-1">Simple, transparent pricing</h2>
          <div className="section-divider center reveal reveal-delay-2" style={{ background: 'linear-gradient(90deg,#22c55e,#16a34a)' }}/>
          <p className="section-sub reveal reveal-delay-2" style={{ marginTop: 16 }}>No hidden fees. No surprises. Cancel anytime. Start free today.</p>
        </div>
        <div className="pricing-grid">
          {/* Starter */}
          <div className="price-card reveal reveal-delay-1">
            <div className="price-plan">Starter</div>
            <div className="price-amount">$0</div>
            <div className="price-period">per month · forever free</div>
            <div className="price-divider"/>
            <div className="price-features">
              {['Up to 50 datasets/mo','Basic insights dashboard','1 data source link','Mobile & web access'].map(f => <div key={f} className="pf-item"><div className="pf-check yes">✓</div>{f}</div>)}
              {['AI advisor','Priority support','Advanced preprocessing'].map(f => <div key={f} className="pf-item"><div className="pf-check no">✗</div>{f}</div>)}
            </div>
            <button className="price-btn outline">Get started free</button>
          </div>
          {/* Pro */}
          <div className="price-card featured reveal reveal-delay-2">
            <div className="popular-badge">Most Popular</div>
            <div className="price-plan red">Pro</div>
            <div className="price-amount" style={{ background: 'linear-gradient(135deg,#ff6a00,#ff4d2e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>$29</div>
            <div className="price-period">per month · billed annually</div>
            <div className="price-divider" style={{ background: 'rgba(255,77,46,0.2)' }}/>
            <div className="price-features">
              {['Unlimited datasets','Advanced insights + charts','10 data source links','AI insights (full access)','Full preprocessing suite','Priority 24/7 support'].map(f => <div key={f} className="pf-item"><div className="pf-check yes">✓</div>{f}</div>)}
              <div className="pf-item"><div className="pf-check no">✗</div>White-label API access</div>
            </div>
            <button className="price-btn solid">Start Pro Trial</button>
          </div>
          {/* Enterprise */}
          <div className="price-card reveal reveal-delay-3">
            <div className="price-plan">Enterprise</div>
            <div className="price-amount">$99</div>
            <div className="price-period">per month · custom billing</div>
            <div className="price-divider"/>
            <div className="price-features">
              {['Everything in Pro','Unlimited team members','White-label API access','Custom integrations','Dedicated account manager','SLA 99.99% uptime','Advanced security tools'].map(f => <div key={f} className="pf-item"><div className="pf-check yes">✓</div>{f}</div>)}
            </div>
            <button className="price-btn outline">Contact sales</button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq" id="faq">
        <div className="section-head center">
          <div className="section-tag reveal">FAQ</div>
          <h2 className="section-title reveal reveal-delay-1">Frequently asked questions</h2>
          <div className="section-divider center reveal reveal-delay-2"/>
          <p className="section-sub reveal reveal-delay-2" style={{ marginTop: 16 }}>Can't find your answer? <span style={{ color: 'var(--cyan)', cursor: 'pointer' }}>Chat with our team →</span></p>
        </div>
        <div className="faq-list">
          {faqs.map((f,i) => (
            <div key={f.q} className={`reveal${i > 0 ? ` reveal-delay-${i}` : ''}`}>
              <FAQItem question={f.q} answer={f.a} />
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-inner reveal">
          <div className="cta-glow"/>
          <div className="cta-tag">🎉 Limited time — First 3 months free</div>
          <h2 className="cta-title">Ready to take control of<br />your <span>data future?</span></h2>
          <p className="cta-desc">Join over 2 million users who have already transformed the way they manage data. Get started free — no credit card required.</p>
          <div className="cta-btns">
            <button className="btn-primary" style={{ padding: '16px 40px', fontSize: '1rem' }} onClick={() => window.location.href='/app'}>🚀 Start for Free</button>
            <button className="btn-secondary" style={{ padding: '15px 32px', fontSize: '1rem' }}>Schedule a Demo</button>
          </div>
          <p className="cta-note">✓ No credit card required &nbsp;&nbsp; ✓ Setup in under 5 minutes &nbsp;&nbsp; ✓ Cancel anytime</p>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="newsletter" id="contact">
        <div className="newsletter-inner reveal">
          <div className="nl-left">
            <h3 className="nl-title">Stay ahead of the curve 📬</h3>
            <p className="nl-sub">Get weekly insights, data trends, and AI news delivered to your inbox.</p>
          </div>
          <div className="nl-form">
            <input className="nl-input" type="email" placeholder="Enter your email address"
              value={nlDone ? '✓ You\'re subscribed!' : nlEmail}
              onChange={e => setNlEmail(e.target.value)}
              disabled={nlDone}
              style={nlDone ? { color: '#22c55e', borderColor: 'rgba(34,197,94,0.4)' } : {}}
            />
            <button className="nl-btn" onClick={handleNl}>Subscribe</button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mm-footer">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="footer-logo">
              <div className="logo-icon" style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                {[10,16,12].map(h => <span key={h} style={{ display: 'block', width: 4, height: h, borderRadius: 2, background: 'linear-gradient(180deg,#ff6a00,#ff4d2e)' }} />)}
              </div>
              Datalytics
            </div>
            <p>The next-generation data platform powering strategic freedom for individuals and enterprises across 157 countries.</p>
            <div className="footer-social">
              {['𝕏','in','💬','⌨','▶'].map(s => <button key={s} className="soc-btn">{s}</button>)}
            </div>
          </div>
          {[
            { title: 'Product', links: ['Features','Pricing','Integrations','Changelog','Roadmap','API Docs'] },
            { title: 'Company', links: ['About Us','Blog','Careers','Press','Partners','Contact'] },
            { title: 'Legal', links: ['Privacy Policy','Terms of Service','Cookie Policy','Compliance','Security','GDPR'] },
          ].map(col => (
            <div key={col.title} className="footer-col">
              <h4>{col.title}</h4>
              <ul>{col.links.map(l => <li key={l}><a href="#">{l}</a></li>)}</ul>
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <div className="footer-copy">© 2026 Datalytics Inc. All rights reserved. Registered in Delaware, USA.</div>
          <div className="footer-badge"><span className="badge-dot"/>All systems operational</div>
          <div className="footer-bottom-links">
            {['Privacy','Terms','Cookies','Support'].map(l => <a key={l} href="#">{l}</a>)}
          </div>
        </div>
      </footer>
    </div>
  );
}
