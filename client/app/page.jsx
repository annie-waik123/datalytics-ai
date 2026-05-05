"use client";

import { useEffect, useRef, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { FaInstagram, FaLinkedin, FaGithub, FaGlobe } from "react-icons/fa";
import AnalyticsPipelineStepper from "../src/components/AnalyticsPipelineStepper.jsx";
import AuthSystem from "../src/auth/AuthSystem.jsx";
// import { useAuth } from "../src/auth/AuthContext.jsx";
// import AuthModal from "../src/components/auth/AuthModal.jsx";

const styles = `
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

  /* NAV HOVER DROPDOWN */
  .nav-item { position: relative; display: flex; align-items: center; height: 100%; }
  .nav-dropdown {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%) translateY(15px);
    background: rgba(10, 14, 26, 0.98);
    border: 1px solid rgba(255, 77, 46, 0.2);
    border-radius: 12px;
    padding: 16px;
    width: max-content;
    min-width: 220px;
    max-width: 300px;
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
    backdrop-filter: blur(20px);
    box-shadow: 0 15px 40px rgba(0,0,0,0.6), 0 0 20px rgba(255, 77, 46, 0.05);
    z-index: 1000;
    pointer-events: none;
    text-align: left;
  }
  .nav-item:hover .nav-dropdown {
    opacity: 1;
    visibility: visible;
    transform: translateX(-50%) translateY(0);
    pointer-events: auto;
  }
  .dropdown-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 8px; }
  .dropdown-title { font-size: 0.85rem; font-weight: 700; color: #fff; }
  .dropdown-badge { font-size: 0.65rem; background: rgba(255, 77, 46, 0.15); color: var(--red); padding: 2px 8px; border-radius: 10px; font-weight: 700; text-transform: uppercase; }
  .dropdown-desc { font-size: 0.78rem; color: rgba(255,255,255,0.5); line-height: 1.5; margin-bottom: 12px; }
  .dropdown-price-row { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 8px; margin-top: 10px; }
  .dropdown-price-label { font-size: 0.7rem; color: rgba(255,255,255,0.4); font-weight: 600; text-transform: uppercase; }
  .dropdown-price-val { font-size: 0.9rem; font-weight: 800; color: var(--red); }
  .dropdown-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
  .dropdown-list-item { font-size: 0.78rem; color: rgba(255,255,255,0.7); display: flex; align-items: center; gap: 8px; transition: color 0.2s; }
  .dropdown-list-item:hover { color: #fff; }
  .dropdown-list-item i { font-size: 0.7rem; color: var(--orange); font-style: normal; }
  .dropdown-contact-row { display: flex; align-items: center; gap: 10px; color: #fff; font-weight: 600; font-size: 0.9rem; background: rgba(255, 77, 46, 0.1); padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255, 77, 46, 0.2); }
  .dropdown-contact-icon { font-size: 1.1rem; }

  .nav-actions { display: flex; align-items: center; gap: 1rem; }
  .btn-login { color: rgba(255,255,255,0.78); background: none; border: none; font-family: inherit; font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: color 0.25s; }
  .btn-login:hover { color: #fff; }
  .btn-signup { background: linear-gradient(135deg, var(--red), var(--orange)); color: #fff; border: none; padding: 9px 22px; border-radius: 10px; font-family: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 0 20px rgba(255,77,46,0.4); }
  .btn-signup:hover { transform: translateY(-2px); box-shadow: 0 0 35px rgba(255,77,46,0.7); }

  /* HAMBURGER */
  .hamburger { display: none; flex-direction: column; gap: 5px; background: none; border: none; cursor: pointer; padding: 5px; z-index: 1001; }
  .hamburger span { display: block; width: 24px; height: 2px; background: #fff; border-radius: 2px; transition: 0.3s; }
  .hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
  .hamburger.open span:nth-child(2) { opacity: 0; }
  .hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

  /* MOBILE MENU */
  .mobile-menu { position: fixed; top: 0; right: -100%; width: 80%; height: 100vh; background: rgba(10, 14, 26, 0.98); backdrop-filter: blur(20px); z-index: 1000; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: 0.4s cubic-bezier(0.165, 0.84, 0.44, 1); border-left: 1px solid rgba(255, 77, 46, 0.2); }
  .mobile-menu.open { right: 0; }
  .mobile-nav-links { list-style: none; display: flex; flex-direction: column; gap: 2rem; align-items: center; margin-bottom: 3rem; }
  .mobile-nav-links a { color: #fff; text-decoration: none; font-size: 1.2rem; font-weight: 600; }
  .mobile-nav-actions { display: flex; flex-direction: column; gap: 1rem; width: 80%; }
  .mobile-nav-actions button { width: 100%; padding: 15px; }

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

  .btn-primary { background: linear-gradient(135deg, var(--red), var(--orange)); color: #fff; border: none; padding: 22px 50px; border-radius: 14px; font-family: inherit; font-size: 1.25rem; font-weight: 600; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 0 25px rgba(255,77,46,0.45); }
  .btn-primary:hover { transform: translateY(-3px); box-shadow: 0 0 45px rgba(255,77,46,0.75); }
  .btn-secondary { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.15); padding: 21px 46px; border-radius: 14px; font-family: inherit; font-size: 1.25rem; font-weight: 500; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 10px; backdrop-filter: blur(8px); }
  .btn-secondary:hover { background: rgba(255,255,255,0.1); border-color: rgba(0,212,255,0.4); box-shadow: 0 0 20px rgba(0,212,255,0.2); transform: translateY(-2px); }
  .play-icon { width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 0.7rem; }

  /* HERO RIGHT */
  .hero-right { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; min-height: 600px; animation: fadeRight 1s ease 0.5s both; perspective: 1500px; }
  @keyframes fadeRight { from { opacity:0; transform:translateX(40px); } to { opacity:1; transform:translateX(0); } }

  .stage { position: relative; width: 520px; height: 460px; transform-style: preserve-3d; transform: rotateX(18deg) rotateY(-20deg) scale(1.25); animation: stageFloat 6s ease-in-out infinite; transition: transform 0.3s ease; }
  @keyframes stageFloat { 0%,100% { transform: rotateX(18deg) rotateY(-20deg) scale(1.25) translateY(0); } 50% { transform: rotateX(14deg) rotateY(-16deg) scale(1.25) translateY(-22px); } }

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

  /* PIPELINE STRIP */
  .pipeline-strip { position: relative; z-index: 1; padding: 60px 5% 80px; text-align: center; }
  .pipeline-title { font-size: clamp(2rem, 4vw, 3.2rem); font-weight: 900; color: #fff; margin-bottom: 10px; line-height: 1.1; }
  .pipeline-title span { color: #22c55e; }
  .pipeline-sub { font-size: 0.9rem; color: rgba(255,255,255,0.4); margin-bottom: 52px; letter-spacing: 0.3px; }
  .pipeline-track { display: flex; align-items: center; justify-content: center; gap: 0; overflow-x: auto; padding: 10px 0 20px; scrollbar-width: none; }
  .pipeline-track::-webkit-scrollbar { display: none; }
  .pipeline-scanner { display: none; }
  @keyframes nodeIn { from { opacity:0; transform: translateX(-40px) scale(0.8); } to { opacity:1; transform: translateX(0) scale(1); } }
  @keyframes arrowIn { from { opacity:0; transform: scaleX(0); transform-origin: left; } to { opacity:1; transform: scaleX(1); } }
  @keyframes spinRound { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  @keyframes flowArrow { 0% { transform: translateX(-20px); } 100% { transform: translateX(45px); } }
  .pl-node { display: flex; flex-direction: column; align-items: center; gap: 12px; animation: nodeIn 0.5s cubic-bezier(0.16,1,0.3,1) both; }
  .pl-circle { width: 72px; height: 72px; border-radius: 50%; border: 2px solid rgba(34,197,94,0.15); background: rgba(34,197,94,0.06); display: flex; align-items: center; justify-content: center; font-size: 1.8rem; transition: all 0.3s ease; cursor: pointer; position: relative; }
  .pl-circle::after { content: ''; position: absolute; top: -3px; left: 50%; margin-left: -3px; width: 6px; height: 6px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 10px #22c55e, 0 0 20px #22c55e; animation: spinRound 3s linear infinite; transform-origin: 3px 39px; pointer-events: none; z-index: 5; }
  .pl-circle:hover { border-color: rgba(34,197,94,0.6); background: rgba(34,197,94,0.15); box-shadow: 0 0 25px rgba(34,197,94,0.4); transform: scale(1.1); }
  .pl-label { font-size: 0.72rem; color: rgba(255,255,255,0.55); font-weight: 600; text-align: center; max-width: 72px; line-height: 1.3; }
  .pl-node:first-child .pl-label { color: #4ade80; }
  .pl-arrow { display: flex; align-items: center; padding: 0 4px; margin-bottom: 28px; animation: arrowIn 0.4s cubic-bezier(0.16,1,0.3,1) both; }
  .pl-arrow-line { width: 36px; height: 2px; background: rgba(34,197,94,0.2); position: relative; overflow: hidden; }
  .pl-arrow-line::after { content: ''; position: absolute; top: 0; left: 0; width: 14px; height: 100%; background: linear-gradient(90deg, transparent, #22c55e); animation: flowArrow 1.5s linear infinite; }
  .pl-arrow-head { width: 0; height: 0; border-top: 5px solid transparent; border-bottom: 5px solid transparent; border-left: 7px solid rgba(34,197,94,0.5); }

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

  /* PRODUCT PREVIEW */
  .product-preview { padding: 60px 3% 80px; position: relative; z-index: 1; }
  .preview-browser { max-width: 1200px; margin: 0 auto; border-radius: 18px; overflow: hidden; box-shadow: 0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.07), 0 0 100px rgba(255,77,46,0.1); animation: previewFloat 6s ease-in-out infinite; }
  @keyframes previewFloat { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-10px);} }
  .preview-bar { background: #1a1d2e; padding: 14px 22px; display: flex; align-items: center; gap: 14px; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .preview-dots { display:flex; gap:7px; }
  .preview-dot { width:13px; height:13px; border-radius:50%; }
  .pd-red{background:#ff5f57;} .pd-yellow{background:#ffbd2e;} .pd-green{background:#28c840;}
  .preview-url { flex:1; background:rgba(255,255,255,0.05); border-radius:6px; padding:6px 16px; font-size:0.78rem; color:rgba(255,255,255,0.4); font-family:monospace; }
  .preview-badge { font-size:0.68rem; color:#22c55e; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.2); padding:4px 12px; border-radius:10px; font-weight:600; white-space:nowrap; }
  .preview-tabs { background:#13172a; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; gap:0; overflow-x:auto; scrollbar-width:none; }
  .preview-tabs::-webkit-scrollbar{display:none;}
  .preview-tab { background:none; border:none; border-bottom:2px solid transparent; padding:10px 20px; font-size:0.75rem; font-weight:600; color:rgba(255,255,255,0.4); cursor:pointer; white-space:nowrap; font-family:inherit; transition:all 0.2s; }
  .preview-tab:hover { color:rgba(255,255,255,0.7); background:rgba(255,255,255,0.03); }
  .preview-tab.active { color:#fff; border-bottom-color:var(--orange); background:rgba(255,106,0,0.06); }
  .preview-content { background:#0d1225; display:grid; grid-template-columns:240px 1fr; min-height:500px; }
  .preview-sidebar { background:#0a0e1a; border-right:1px solid rgba(255,255,255,0.05); padding:20px 0; }
  .ps-logo { padding:0 20px 20px; font-weight:800; font-size:1rem; color:#fff; border-bottom:1px solid rgba(255,255,255,0.05); margin-bottom:12px; }
  .ps-logo span{color:var(--red);}
  .ps-label { padding:0 20px; font-size:0.6rem; font-weight:700; letter-spacing:1.5px; color:rgba(255,255,255,0.25); text-transform:uppercase; margin-bottom:8px; margin-top:4px; }
  .ps-item { display:flex; align-items:center; justify-content:space-between; padding:10px 20px; font-size:0.78rem; color:rgba(255,255,255,0.55); cursor:default; transition:all 0.2s; }
  .ps-item.active { background:rgba(255,106,0,0.12); color:#fff; border-left:2px solid var(--orange); }
  .ps-item-left { display:flex; align-items:center; gap:10px; }
  .ps-badge { font-size:0.58rem; padding:2px 7px; border-radius:8px; font-weight:700; }
  .psb-done { background:rgba(34,197,94,0.15); color:#4ade80; }
  .psb-prog { background:rgba(255,106,0,0.15); color:#fb923c; }
  .preview-progress { padding:20px; border-top:1px solid rgba(255,255,255,0.05); margin-top:auto; }
  .pp-label { font-size:0.6rem; color:rgba(255,255,255,0.3); font-weight:600; letter-spacing:1px; text-transform:uppercase; margin-bottom:8px; }
  .pp-bar-bg { height:4px; background:rgba(255,255,255,0.06); border-radius:4px; overflow:hidden; }
  .pp-bar-fill { height:100%; width:40%; background:linear-gradient(90deg,var(--red),var(--orange)); border-radius:4px; animation:ppFill 2s ease both; }
  @keyframes ppFill { from{width:0;} to{width:40%;} }
  .pp-sub { font-size:0.62rem; color:rgba(255,255,255,0.25); margin-top:6px; }
  .preview-main { padding:28px 30px; }
  .pm-title { font-size:1.3rem; font-weight:800; color:#fff; margin-bottom:4px; }
  .pm-sub { font-size:0.78rem; color:rgba(255,255,255,0.35); margin-bottom:22px; }
  .pm-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:22px; }
  .pm-stat { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:14px 16px; }
  .pm-stat-label { font-size:0.6rem; color:rgba(255,255,255,0.35); font-weight:600; letter-spacing:1px; text-transform:uppercase; margin-bottom:6px; }
  .pm-stat-val { font-size:1.6rem; font-weight:900; color:#fff; }
  .pm-stat-val.green{color:#4ade80;} .pm-stat-val.purple{color:#c084fc;}
  .pm-table { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:12px; overflow:hidden; }
  .pm-thead { display:grid; grid-template-columns:1.5fr 1fr 0.8fr 1.2fr; padding:10px 16px; background:rgba(255,255,255,0.03); font-size:0.65rem; font-weight:700; color:rgba(255,255,255,0.35); letter-spacing:1px; text-transform:uppercase; }
  .pm-row { display:grid; grid-template-columns:1.5fr 1fr 0.8fr 1.2fr; padding:11px 16px; font-size:0.78rem; color:rgba(255,255,255,0.75); border-top:1px solid rgba(255,255,255,0.04); transition:background 0.2s; }
  .pm-row:hover { background:rgba(255,255,255,0.03); }
  .pm-type-cat{color:#60a5fa;} .pm-type-num{color:#4ade80;} .pm-type-dt{color:#f59e0b;}
  .pm-null-ok{color:#4ade80;} .pm-null-warn{color:#fb923c;}
  .pm-charts-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 10px;}
  .pm-chart-box { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; padding: 16px; height: 180px; display: flex; flex-direction: column; }
  .pm-chart-title { font-size: 0.8rem; font-weight: 600; color: rgba(255,255,255,0.7); margin-bottom: 12px; }
  .pm-chart-mock { flex: 1; display: flex; align-items: flex-end; gap: 8px; justify-content: center; position: relative; }
  .pm-chart-mock.bar-chart div { width: 30px; background: rgba(59,130,246,0.5); border-radius: 4px 4px 0 0; animation: barRise 0.8s ease backwards; }
  @keyframes barRise { from{height:0} }
  .pm-chart-mock.pie-chart { align-items: center; }
  .pie-slice { width: 100px; height: 100px; border-radius: 50%; background: conic-gradient(var(--orange) 0% 40%, #3b82f6 40% 70%, #22c55e 70% 100%); animation: spinIn 1s cubic-bezier(0.16,1,0.3,1); }
  @keyframes spinIn { from{transform:scale(0) rotate(-180deg);} to{transform:scale(1) rotate(0);} }

  /* live dot */
  .live-dot { display:inline-block; width:7px; height:7px; border-radius:50%; background:#22c55e; box-shadow:0 0 8px #22c55e; animation:pulseDot 1.5s ease-in-out infinite; margin-right:6px; }

  .old-way { padding: 80px 5% 100px; }
  .old-way-cards { display: flex; flex-direction: column; gap: 16px; position: relative; max-width: 800px; margin: 0 auto; }
  .old-card { display: flex; align-items: center; gap: 20px; padding: 24px 30px; background: rgba(255, 77, 46, 0.03); border: 1px solid rgba(255, 77, 46, 0.15); border-radius: 16px; transition: transform 0.3s ease, background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease; position: relative; overflow: hidden; cursor: none; animation: cardRise 0.6s cubic-bezier(0.16,1,0.3,1) both; }
  .old-card::before { content: ''; position: absolute; inset: -2px; border-radius: 18px; background: radial-gradient(400px circle at var(--mx,50%) var(--my,50%), rgba(255,77,46,0.5) 0%, rgba(255,77,46,0.15) 40%, transparent 60%); z-index: 0; opacity: 0; transition: opacity 0.3s ease; pointer-events: none; }
  .old-card::after { content: ''; position: absolute; inset: 2px; background: rgba(12,10,18,0.97); border-radius: 14px; z-index: 0; pointer-events: none; }
  .old-card > * { position: relative; z-index: 1; }
  .old-card:hover::before { opacity: 1; }
  .old-card:hover { transform: translateY(-3px); box-shadow: 0 0 0 1px rgba(255,77,46,0.4), 0 0 15px rgba(255,77,46,0.2), 0 15px 30px rgba(0,0,0,0.4); border-color: rgba(255,77,46,0.6); }
  .old-cursor { width: 18px; height: 18px; background: radial-gradient(circle, #ff4d2e, #cc3d25); border-radius: 50%; position: absolute; pointer-events: none; transform: translate(-50%,-50%); z-index: 10; box-shadow: 0 0 8px 3px rgba(255,77,46,1), 0 0 20px 6px rgba(255,77,46,0.7), 0 0 40px 12px rgba(255,77,46,0.3); opacity: 0; transition: opacity 0.15s ease; }
  .old-card:hover .old-cursor { opacity: 1; }
  .old-icon { font-size: 1.6rem; flex-shrink: 0; }
  .old-text { font-size: 1rem; color: rgba(255, 255, 255, 0.85); font-weight: 500; }

  /* SERVICES */
  .services { padding: 80px 5% 100px; }
  @keyframes cardRise { from { opacity: 0; transform: translateY(36px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .services-grid-10 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px; }
  .service-card-10 { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 22px 18px 20px; backdrop-filter: blur(12px); position: relative; overflow: hidden; cursor: none;
    animation: cardRise 0.6s cubic-bezier(0.16,1,0.3,1) both;
    transition: transform 0.35s ease, box-shadow 0.35s ease, border-color 0.35s ease; }
  .service-card-10::before { content: ''; position: absolute; inset: -2px; border-radius: 22px;
    background: radial-gradient(220px circle at var(--mx,50%) var(--my,50%), rgba(34,197,94,0.9) 0%, rgba(34,197,94,0.4) 35%, transparent 65%);
    z-index: 0; opacity: 0; transition: opacity 0.3s ease; pointer-events: none; }
  .service-card-10::after { content: ''; position: absolute; inset: 2px; background: rgba(8,12,22,0.97); border-radius: 18px; z-index: 0; pointer-events: none; }
  .service-card-10 > * { position: relative; z-index: 1; }
  .service-card-10:hover::before { opacity: 1; }
  .service-card-10:hover { transform: translateY(-8px);
    box-shadow: 0 0 0 1px rgba(34,197,94,0.6), 0 0 20px rgba(34,197,94,0.4), 0 0 50px rgba(34,197,94,0.2), 0 20px 50px rgba(0,0,0,0.5);
    border-color: rgba(34,197,94,0.7); }
  .sc10-cursor { width: 18px; height: 18px; background: radial-gradient(circle, #4ade80, #16a34a); border-radius: 50%; position: absolute; pointer-events: none; transform: translate(-50%,-50%); z-index: 10;
    box-shadow: 0 0 8px 3px rgba(34,197,94,1), 0 0 20px 6px rgba(34,197,94,0.7), 0 0 40px 12px rgba(34,197,94,0.3); opacity: 0;
    transition: opacity 0.15s ease; }
  .service-card-10:hover .sc10-cursor { opacity: 1; }
  .service-tag-badge { font-size: 0.58rem; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; padding: 3px 9px; border-radius: 20px; display: inline-block; }
  .service-icon-wrap { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; margin-bottom: 14px; margin-top: 10px; }
  .service-title { font-size: 0.95rem; font-weight: 700; margin-bottom: 8px; }
  .service-desc { font-size: 0.76rem; color: rgba(255,255,255,0.45); line-height: 1.65; margin: 0; }

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
  .marquee-inner { display: flex; gap: 0; animation: marquee 30s linear infinite; width: max-content; }
  @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  .marquee-item { flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding: 0 40px; font-size: 1rem; font-weight: 700; color: rgba(255,255,255,0.22); white-space: nowrap; transition: color 0.3s; }
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

    /* CONTACT FORM */
  .contact-section { padding: 0 5% 100px; }
  .contact-wrapper { 
    max-width: 1100px; 
    margin: 0 auto; 
    display: grid; 
    grid-template-columns: 1fr 1fr; 
    gap: 60px; 
    align-items: center;
    background: rgba(255,255,255,0.02); 
    border: 1px solid rgba(255,255,255,0.06); 
    border-radius: 32px; 
    padding: 60px; 
    backdrop-filter: blur(20px);
    box-shadow: 0 20px 50px rgba(0,0,0,0.3);
  }
  .contact-info-side { padding-right: 20px; }
  .contact-info-tag { display: inline-block; padding: 6px 14px; border-radius: 20px; background: rgba(34,197,94,0.15); color: #22c55e; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; }
  .contact-info-h2 { font-size: 3rem; font-weight: 900; line-height: 1.1; margin-bottom: 24px; }
  .contact-info-h2 span { background: linear-gradient(135deg, var(--red), var(--orange)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .contact-info-p { font-size: 1rem; color: rgba(255,255,255,0.5); line-height: 1.7; margin-bottom: 32px; }
  .contact-features-list { display: flex; flex-direction: column; gap: 16px; list-style: none; }
  .contact-feature-item { display: flex; align-items: center; gap: 12px; font-size: 0.9rem; color: rgba(255,255,255,0.7); }
  .contact-feature-item i { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background: rgba(34,197,94,0.2); color: #22c55e; border-radius: 50%; font-size: 0.7rem; font-style: normal; }

  .contact-card { 
    background: rgba(255,255,255,0.03); 
    border: 1px solid rgba(255,255,255,0.08); 
    border-radius: 24px; 
    padding: 40px; 
    box-shadow: 0 15px 35px rgba(0,0,0,0.2);
  }
  .contact-title { font-size: 1.8rem; font-weight: 800; margin-bottom: 24px; text-align: left; color: #22c55e; }
  .form-group { margin-bottom: 24px; display: flex; flex-direction: column; gap: 8px; }
  .form-label { font-size: 0.9rem; font-weight: 500; color: rgba(255,255,255,0.6); }
  .form-input, .form-textarea { 
    background: rgba(255,255,255,0.05); 
    border: 1px solid rgba(255,255,255,0.12); 
    border-radius: 12px; 
    padding: 14px 20px; 
    color: #fff; 
    font-family: inherit; 
    font-size: 0.95rem; 
    outline: none; 
    transition: all 0.3s;
  }
  .form-textarea { min-height: 120px; resize: vertical; }
  .form-input:focus, .form-textarea:focus { border-color: var(--red); background: rgba(255,255,255,0.08); box-shadow: 0 0 20px rgba(255,77,46,0.1); }
  .form-btn { 
    width: 100%; 
    background: linear-gradient(135deg, var(--red), var(--orange)); 
    border: none; 
    padding: 16px; 
    border-radius: 14px; 
    color: #fff; 
    font-size: 1rem; 
    font-weight: 700; 
    cursor: pointer; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    gap: 10px; 
    transition: all 0.3s; 
    box-shadow: 0 10px 25px rgba(255,77,46,0.3);
  }
  .form-btn:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(255,77,46,0.5); }
  .form-success { text-align: center; color: #22c55e; font-weight: 600; padding: 20px; border: 1px dashed #22c55e; border-radius: 12px; background: rgba(34,197,94,0.05); }

  /* FOOTER */
  footer.mm-footer { position: relative; z-index: 1; background: rgba(0,0,0,0.4); border-top: 1px solid rgba(255,255,255,0.06); }
  .footer-top { display: grid; grid-template-columns: 2.5fr 1fr 1fr 1fr; gap: 60px; padding: 80px 5% 70px; }
  .footer-brand .footer-logo { font-size: 1.8rem; font-weight: 800; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
  .footer-logo strong { color: var(--red); }
  .footer-brand p { font-size: 1rem; color: rgba(255,255,255,0.5); line-height: 1.8; max-width: 350px; margin-bottom: 32px; }
  .footer-social { display: flex; gap: 18px; margin-top: 32px; }
  .soc-btn { 
    position: relative;
    width: 52px; 
    height: 52px; 
    border-radius: 14px; 
    background: rgba(255,255,255,0.03); 
    border: 1px solid rgba(255,255,255,0.08); 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    font-size: 1.5rem; 
    cursor: pointer; 
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
    color: rgba(255,255,255,0.65);
    text-decoration: none;
    overflow: visible;
  }
  .soc-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: 0;
    border-radius: 11px;
  }
  .soc-btn svg { position: relative; z-index: 1; transition: transform 0.4s ease, color 0.3s ease; }
  .soc-btn:hover { transform: translateY(-6px); border-color: transparent; color: #fff; box-shadow: 0 10px 20px rgba(0,0,0,0.3); }
  .soc-btn:hover svg { transform: scale(1.15); }

  .soc-btn.instagram:hover::before { opacity: 1; background: radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%); }
  .soc-btn.instagram:hover { box-shadow: 0 10px 25px rgba(214, 36, 159, 0.4); }
  
  .soc-btn.linkedin:hover::before { opacity: 1; background: #0A66C2; }
  .soc-btn.linkedin:hover { box-shadow: 0 10px 25px rgba(10, 102, 194, 0.4); }
  
  .soc-btn.github:hover::before { opacity: 1; background: #24292e; }
  .soc-btn.github:hover { box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5); border-color: rgba(255,255,255,0.2); }
  
  .soc-btn.portfolio:hover::before { opacity: 1; background: linear-gradient(135deg, var(--red), var(--orange)); }
  .soc-btn.portfolio:hover { box-shadow: 0 10px 25px rgba(255, 106, 0, 0.4); }

  /* Better Tooltip */
  .soc-btn::after {
    content: attr(data-label);
    position: absolute;
    top: -40px;
    left: 50%;
    transform: translateX(-50%) translateY(10px);
    background: rgba(10, 14, 26, 0.95);
    color: #fff;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 600;
    opacity: 0;
    pointer-events: none;
    transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
    white-space: nowrap;
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 5px 15px rgba(0,0,0,0.4);
    backdrop-filter: blur(8px);
    z-index: 100;
  }
  .soc-btn:hover::after { opacity: 1; transform: translateX(-50%) translateY(0); }
  .footer-col h4 { font-size: 0.85rem; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 20px; color: #fff; }
  .footer-col ul { list-style: none; display: flex; flex-direction: column; gap: 12px; }
  .footer-col ul li a { font-size: 0.82rem; color: rgba(255,255,255,0.42); text-decoration: none; transition: color 0.2s; cursor: pointer; }
  .footer-col ul li a:hover, .footer-col ul li a.active { color: var(--cyan); }
  .footer-col ul li { position: relative; cursor: pointer; }
  .footer-link-desc {
    position: absolute;
    bottom: 100%;
    left: 0;
    background: rgba(10, 14, 26, 0.98);
    color: #fff;
    padding: 12px 16px;
    border-radius: 12px;
    font-size: 0.8rem;
    width: 240px;
    white-space: normal;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-5px);
    transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
    border: 1px solid rgba(255,255,255,0.15);
    box-shadow: 0 10px 30px rgba(0,0,0,0.6);
    pointer-events: none;
    z-index: 100;
    line-height: 1.5;
  }
  .footer-link-desc.large {
    width: 320px;
    font-size: 0.75rem;
  }
  .footer-col ul li.legal-li:hover .footer-link-desc {
    opacity: 1;
    visibility: visible;
    transform: translateY(-10px);
  }

  .footer-link-desc.active {
    opacity: 1;
    visibility: visible;
    transform: translateY(-10px);
  }

  .footer-bottom { display: flex; justify-content: space-between; align-items: center; padding: 20px 5%; border-top: 1px solid rgba(255,255,255,0.05); flex-wrap: wrap; gap: 12px; }
  .footer-copy { font-size: 0.78rem; color: rgba(255,255,255,0.3); }
  .footer-badge { font-size: 0.75rem; color: rgba(255,255,255,0.3); display: flex; align-items: center; gap: 6px; }
  .badge-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 8px rgba(34,197,94,0.6); animation: pulseDot 2s ease-in-out infinite; }
  @keyframes pulseDot { 0%,100%{transform:scale(1);} 50%{transform:scale(1.3);} }

  .zoom-typing-text {
    position: absolute;
    top: calc(100% + 16px);
    left: 65%;
    transform: translateX(-50%);
    white-space: nowrap;
    overflow: hidden;
    border-right: 2px solid orange;
    font-size: 10px;
    color: #f97316;
    font-weight: 600;
    letter-spacing: 0.2px;
    width: 330px;
    animation: typingZoom 5s steps(50, end) infinite, blinkCaret 0.75s step-end infinite;
    text-shadow: 0 0 5px rgba(249,115,22,0.4);
    pointer-events: none;
  }
  @media (max-width: 1024px) {
    .zoom-typing-text { display: none !important; }
  }
  @keyframes typingZoom {
    0%, 15% { width: 0; }
    50%, 85% { width: 330px; }
    100% { width: 0; }
  }
  @keyframes blinkCaret {
    from, to { border-color: transparent }
    50% { border-color: orange; }
  }
  /* REVEAL */
  .reveal { opacity: 0; transform: translateY(40px); transition: all 0.7s cubic-bezier(0.16,1,0.3,1); }
  .reveal.up { opacity: 1; transform: translateY(0); }
  /* product preview always visible */
  .product-preview .reveal,
  .product-preview .reveal-delay-1,
  .product-preview .reveal-delay-2 { opacity: 1 !important; transform: none !important; }
  .reveal-delay-1 { transition-delay: 0.1s; }
  .reveal-delay-2 { transition-delay: 0.2s; }
  .reveal-delay-3 { transition-delay: 0.3s; }
  .reveal-delay-4 { transition-delay: 0.4s; }
  .reveal-delay-5 { transition-delay: 0.5s; }
  .reveal-delay-6 { transition-delay: 0.6s; }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #060b18; }
  ::-webkit-scrollbar-thumb { background: linear-gradient(180deg, var(--red), var(--orange)); border-radius: 3px; }

  @media (max-width: 1400px) { .services-grid-10 { grid-template-columns: repeat(4, 1fr); } }
  @media (max-width: 1100px) { .services-grid { grid-template-columns: repeat(2, 1fr); } .services-grid-10 { grid-template-columns: repeat(3, 1fr); } .footer-top { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 900px) { 
    .hero { flex-direction: column; padding: 100px 5% 40px; text-align: center; } 
    .hero-left { flex: none; width: 100%; margin-bottom: 50px; } 
    .hero-btns { justify-content: center; } 
    .hero-right { min-height: 400px; width: 100%; display: flex; justify-content: center; } 
    .stage { transform: rotateX(12deg) rotateY(-12deg) scale(0.8) !important; animation: stageFloatMobile 6s ease-in-out infinite; } 
    @keyframes stageFloatMobile { 0%,100% { transform: rotateX(12deg) rotateY(-12deg) scale(0.8) translateY(0); } 50% { transform: rotateX(10deg) rotateY(-10deg) scale(0.8) translateY(-15px); } }
    .nav-links { display: none; } 
    .nav-actions .btn-login, .nav-actions .btn-signup { display: none; }
    .hamburger { display: flex; }
    .stats-strip { flex-wrap: wrap; } 
    .testi-grid { grid-template-columns: 1fr; } 
    .pricing-grid { grid-template-columns: 1fr; } 
    .price-card.featured { transform: none; } 
    .metrics-inner { grid-template-columns: 1fr; } 
    .contact-wrapper { grid-template-columns: 1fr; padding: 40px 30px; gap: 40px; }
    .contact-info-h2 { font-size: 2.2rem; }
    .newsletter-inner { flex-direction: column; text-align: center; padding: 30px 20px; } 
    .nl-form { flex-direction: column; width: 100%; } 
    .services-grid-10 { grid-template-columns: repeat(2, 1fr); } 
  }
  @media (max-width: 700px) { 
    .services-grid { grid-template-columns: 1fr; } 
    .services-grid-10 { grid-template-columns: 1fr; } 
    .footer-top { grid-template-columns: 1fr; } 
    .cta-inner { padding: 50px 30px; } 
    .cta-title { font-size: 2.2rem; }
    .pipeline-title { font-size: 2rem; }
  }
  @media (max-width: 600px) { 
    .stage { transform: rotateX(10deg) rotateY(-8deg) scale(0.6) !important; } 
    @keyframes stageFloatMobileSmall { 0%,100% { transform: rotateX(10deg) rotateY(-8deg) scale(0.6) translateY(0); } 50% { transform: rotateX(8deg) rotateY(-6deg) scale(0.6) translateY(-10px); } }
    .stage { animation: stageFloatMobileSmall 6s ease-in-out infinite; }
    .hero-right { min-height: 300px; } 
    .hero-h1 { font-size: 2.5rem; }
    .hero-sub { font-size: 0.9rem; }
    .btn-primary, .btn-secondary { width: 100%; justify-content: center; }
  }

  /* LANDING PAGE MOBILE RESPONSIVE HARDENING */
  @media (max-width: 900px) {
    .mm-wrap { width: 100%; overflow-x: hidden; }
    nav.mm-nav { height: 64px; padding: 0 18px; }
    .logo { font-size: 1.08rem; min-width: 0; }
    .nav-actions { gap: 0.5rem; }
    .mobile-menu {
      width: min(88vw, 360px);
      align-items: stretch;
      justify-content: flex-start;
      padding: 96px 24px 32px;
      overflow-y: auto;
    }
    .mobile-nav-links { align-items: stretch; gap: 0.65rem; margin-bottom: 1.5rem; }
    .mobile-nav-links a {
      display: block;
      width: 100%;
      padding: 14px 16px;
      border-radius: 12px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      font-size: 1rem;
      text-align: left;
    }
    .mobile-nav-actions { width: 100%; }

    .hero {
      min-height: auto;
      padding: 96px 20px 32px;
      gap: 18px;
    }
    .hero-left { margin-bottom: 14px; }
    .hero-eyebrow { font-size: 0.74rem; line-height: 1.5; margin-bottom: 14px; }
    .hero-h1 {
      font-size: clamp(2.2rem, 11vw, 3.4rem);
      line-height: 1.05;
      margin-bottom: 16px;
      letter-spacing: 0;
    }
    .hero-sub { margin-bottom: 24px; line-height: 1.55; }
    .hero-btns { width: 100%; }
    .btn-primary, .btn-secondary {
      min-height: 54px;
      width: min(100%, 360px);
      padding: 15px 20px;
      border-radius: 12px;
      font-size: 1rem;
      white-space: normal;
      line-height: 1.25;
    }
    .hero-right {
      min-height: 340px;
      overflow: hidden;
      perspective: 1000px;
      margin-top: 4px;
    }

    .pipeline-strip, .partners, .features, .product-preview, .old-way,
    .services, .metrics, .testimonials, .pricing, .faq, .cta-section,
    .contact-section {
      padding-left: 20px;
      padding-right: 20px;
    }
    .section-head { margin-bottom: 34px; text-align: center; }
    .section-head .section-sub, .section-sub { margin-left: auto; margin-right: auto; }
    .section-divider { margin-left: auto; margin-right: auto; }
    .section-title { font-size: clamp(1.85rem, 8vw, 2.55rem); line-height: 1.12; }

    .pipeline-strip { padding-top: 42px; padding-bottom: 52px; }
    .pipeline-track {
      justify-content: flex-start;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      padding: 10px 6px 22px;
      -webkit-overflow-scrolling: touch;
    }
    .pl-node { min-width: 86px; scroll-snap-align: center; }
    .pl-circle { width: 60px; height: 60px; font-size: 1.45rem; }
    .pl-circle::after { transform-origin: 3px 33px; }
    .pl-arrow-line { width: 24px; }
    .pl-label { max-width: 84px; }

    .preview-browser { border-radius: 14px; animation: none; }
    .preview-bar { padding: 12px; gap: 9px; }
    .preview-url { min-width: 0; padding: 6px 10px; font-size: 0.66rem; overflow: hidden; text-overflow: ellipsis; }
    .preview-badge { display: none; }
    .preview-content { grid-template-columns: 1fr; min-height: auto; }
    .preview-sidebar { display: none; }
    .preview-main { padding: 18px; }
    .pm-title { font-size: 1.08rem; }
    .pm-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .pm-stat { padding: 12px; }
    .pm-stat-val { font-size: 1.28rem; }
    .pm-table { overflow-x: auto; }
    .pm-thead, .pm-row { min-width: 560px; }
    .pm-charts-grid { grid-template-columns: 1fr; }

    .features-grid, .services-grid-10, .testi-grid, .pricing-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }
    .feat-card, .service-card-10, .testi-card, .price-card {
      border-radius: 16px;
      padding: 22px 18px;
    }
    .service-card-10, .old-card { cursor: default; }
    .sc10-cursor, .old-cursor { display: none; }

    .old-way { padding-top: 52px; padding-bottom: 64px; }
    .old-way .section-title { font-size: clamp(2rem, 9vw, 2.6rem) !important; }
    .old-way-cards { gap: 12px; }
    .old-card { align-items: flex-start; padding: 18px; gap: 14px; }
    .old-text { font-size: 0.9rem; line-height: 1.55; }

    .metrics-inner {
      border-radius: 20px;
      padding: 24px 18px;
      gap: 28px;
    }
    .metric-big-card {
      align-items: flex-start;
      padding: 18px;
      gap: 14px;
      flex-wrap: wrap;
    }
    .mbc-change { width: 100%; padding-left: 64px; }

    .price-card.featured, .price-card.featured:hover { transform: none; }
    .price-amount { font-size: 2.25rem; }
    .pricing [style*="height: 40px"] { height: auto !important; min-height: 0; }
    .pricing > div[style*="justify-content: center"] > div {
      width: 100%;
      justify-content: center;
      text-align: center;
      flex-wrap: wrap;
    }

    .faq-q { align-items: flex-start; gap: 14px; padding: 18px; font-size: 0.9rem; }
    .faq-a, .faq-item.open .faq-a { padding-left: 18px; padding-right: 18px; }
    .faq-item.open .faq-a { max-height: 360px; padding-bottom: 18px; }

    .cta-section { padding-top: 24px; padding-bottom: 64px; }
    .cta-inner { border-radius: 22px; padding: 44px 20px; }
    .cta-title { font-size: clamp(2rem, 9vw, 2.6rem); line-height: 1.12; }
    .cta-note { line-height: 1.7; }

    .contact-wrapper {
      border-radius: 22px;
      padding: 28px 18px;
      gap: 28px;
    }
    .contact-info-side { padding-right: 0; text-align: center; }
    .contact-info-h2 { font-size: clamp(2rem, 9vw, 2.5rem); }
    .contact-features-list { align-items: stretch; }
    .contact-feature-item { align-items: flex-start; text-align: left; }
    .contact-card { border-radius: 18px; padding: 22px 18px; }
    .contact-title { text-align: center; font-size: 1.45rem; }
    .form-input, .form-textarea { width: 100%; padding: 13px 14px; }

    .footer-top {
      grid-template-columns: 1fr;
      gap: 28px;
      padding: 54px 20px 42px;
      text-align: center;
    }
    .footer-brand p { max-width: none; margin-left: auto; margin-right: auto; }
    .footer-brand .footer-logo, .footer-social { justify-content: center; }
    .footer-col ul { align-items: center; }
    .footer-link-desc { display: none; }
    .footer-bottom { justify-content: center; text-align: center; padding: 18px 20px 24px; }
  }

  @media (max-width: 600px) {
    .blob { filter: blur(54px); opacity: 0.35; }
    nav.mm-nav { padding: 0 14px; }
    .mobile-menu { width: 100vw; border-left: 0; }
    .hero { padding: 88px 16px 24px; }
    .hero-right { min-height: 280px; }
    .stage {
      width: 420px;
      height: 360px;
      transform: rotateX(8deg) rotateY(-6deg) scale(0.55) !important;
      transform-origin: center center;
    }
    @keyframes stageFloatMobileSmall {
      0%,100% { transform: rotateX(8deg) rotateY(-6deg) scale(0.55) translateY(0); }
      50% { transform: rotateX(7deg) rotateY(-4deg) scale(0.55) translateY(-8px); }
    }
    .card-main { width: 286px; height: 198px; }
    .card-donut { left: 0; bottom: 74px; }
    .card-stats { right: 0; bottom: 74px; }
    .card-ticker { top: 205px; }

    .pipeline-strip, .partners, .features, .product-preview, .old-way,
    .services, .metrics, .testimonials, .pricing, .faq, .cta-section,
    .contact-section {
      padding-left: 16px;
      padding-right: 16px;
    }
    .features { padding-top: 44px; padding-bottom: 58px; }
    .product-preview, .services, .metrics, .testimonials, .pricing, .faq { padding-top: 52px; padding-bottom: 64px; }
    .partners { padding-top: 34px; padding-bottom: 46px; }
    .marquee-item { padding: 0 22px; font-size: 0.9rem; }
    .pm-stats { grid-template-columns: 1fr; }
    .pm-charts-grid { gap: 12px; }
    .pm-chart-box { height: 150px; }
    .metric-big-card { display: grid; grid-template-columns: 48px 1fr; }
    .mbc-change { width: auto; padding-left: 0; grid-column: 2; }
    .footer-social { gap: 12px; flex-wrap: wrap; }
    .soc-btn { width: 46px; height: 46px; }
  }

  @media (max-width: 380px) {
    .hero-h1 { font-size: 2rem; }
    .hero-right { min-height: 250px; }
    .stage { transform: rotateX(8deg) rotateY(-6deg) scale(0.49) !important; }
    .btn-primary, .btn-secondary { font-size: 0.92rem; }
    .section-title { font-size: 1.7rem; }
    .preview-main, .contact-card { padding: 16px 14px; }
  }
`;

// ── Sub-components ──────────────────────────────────────────

// ── LiveCounter: counts up to target ─────────────
function LiveCounter({ target, cls }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    setVal(0);
    let start = 0;
    const step = Math.ceil(target / 30);
    const id = setInterval(() => {
      start = Math.min(start + step, target);
      setVal(start);
      if (start >= target) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [target]);
  return <div className={`pm-stat-val${cls ? ' ' + cls : ''}`}>{val}</div>;
}

// ── ProductPreview: auto-cycling pipeline screens ──────────
const PREVIEW_SCREENS = [
  {
    id: 'upload', sidebarActive: 'Dataset Upload',
    title: 'Dataset Upload', sub: 'Drag and drop CSV, Excel, or JSON files',
    stats: [
      { label: 'Total Rows', val: 36, cls: '' }, { label: 'Columns', val: 10, cls: '' },
      { label: 'Numeric', val: 5, cls: 'green' }, { label: 'Categorical', val: 4, cls: 'purple' },
    ],
    rows: [
      { col: 'date', type: 'datetime', typeCls: 'pm-type-dt', nulls: 0, nullCls: 'pm-null-ok', sample: '2024-01-05' },
      { col: 'region', type: 'categorical', typeCls: 'pm-type-cat', nulls: 0, nullCls: 'pm-null-ok', sample: 'West, East' },
      { col: 'category', type: 'categorical', typeCls: 'pm-type-cat', nulls: 0, nullCls: 'pm-null-ok', sample: 'Furniture' },
      { col: 'sales', type: 'numeric', typeCls: 'pm-type-num', nulls: 0, nullCls: 'pm-null-ok', sample: '4200' },
      { col: 'profit', type: 'numeric', typeCls: 'pm-type-num', nulls: 0, nullCls: 'pm-null-ok', sample: '820' },
      { col: 'discount', type: 'numeric', typeCls: 'pm-type-num', nulls: 1, nullCls: 'pm-null-warn', sample: '0.05' },
      { col: 'satisfaction', type: 'numeric', typeCls: 'pm-type-num', nulls: 1, nullCls: 'pm-null-warn', sample: '4.6' },
    ],
  },
  {
    id: 'eda', sidebarActive: 'Data Exploration',
    title: 'Data Exploration', sub: 'Automated correlation & distribution analysis',
    stats: [
      { label: 'Correlations', val: 12, cls: 'green' }, { label: 'Outliers', val: 3, cls: '' },
      { label: 'Missing %', val: 2, cls: 'purple' }, { label: 'Features', val: 10, cls: '' },
    ],
    rows: [
      { col: 'sales ↔ profit', type: 'pearson r', typeCls: 'pm-type-num', nulls: 0.87, nullCls: 'pm-null-ok', sample: 'Strong +ve' },
      { col: 'discount ↔ profit', type: 'pearson r', typeCls: 'pm-type-dt', nulls: -0.65, nullCls: 'pm-null-warn', sample: 'Moderate -ve' },
      { col: 'satisfaction', type: 'skewness', typeCls: 'pm-type-cat', nulls: 0.12, nullCls: 'pm-null-ok', sample: 'Normal dist.' },
      { col: 'sales', type: 'kurtosis', typeCls: 'pm-type-num', nulls: 1.4, nullCls: 'pm-null-ok', sample: 'Light tail' },
      { col: 'region', type: 'unique vals', typeCls: 'pm-type-cat', nulls: 4, nullCls: 'pm-null-ok', sample: 'N/S/E/W' },
      { col: 'category', type: 'unique vals', typeCls: 'pm-type-cat', nulls: 6, nullCls: 'pm-null-ok', sample: '6 classes' },
    ],
  },
  {
    id: 'viz', sidebarActive: 'Visualization',
    title: 'Visualization', sub: 'Interactive charts auto-generated from your dataset',
    stats: [
      { label: 'Charts', val: 8, cls: 'green' }, { label: 'Chart Types', val: 5, cls: '' },
      { label: 'Filters', val: 3, cls: 'purple' }, { label: 'Exports', val: 4, cls: '' },
    ],
    rows: [
      { col: 'Sales by Region', type: 'bar chart', typeCls: 'pm-type-num', nulls: 'Live', nullCls: 'pm-null-ok', sample: 'West leads' },
      { col: 'Profit Trend', type: 'line chart', typeCls: 'pm-type-dt', nulls: 'Live', nullCls: 'pm-null-ok', sample: '+12% MoM' },
      { col: 'Category Split', type: 'pie chart', typeCls: 'pm-type-cat', nulls: 'Live', nullCls: 'pm-null-ok', sample: '6 segments' },
      { col: 'Sales vs Discount', type: 'scatter', typeCls: 'pm-type-num', nulls: 'Live', nullCls: 'pm-null-warn', sample: '-0.65 corr' },
      { col: 'Satisfaction Dist.', type: 'histogram', typeCls: 'pm-type-cat', nulls: 'Live', nullCls: 'pm-null-ok', sample: 'Bell curve' },
      { col: 'Heatmap', type: 'correlation', typeCls: 'pm-type-num', nulls: 'Live', nullCls: 'pm-null-ok', sample: '10×10 grid' },
    ],
  },
  {
    id: 'predict', sidebarActive: 'Prediction',
    title: 'ML Prediction', sub: 'Auto-trained regression model · Target: sales',
    stats: [
      { label: 'Accuracy', val: 94, cls: 'green' }, { label: 'R² Score', val: 91, cls: 'green' },
      { label: 'MAE', val: 38, cls: '' }, { label: 'Features', val: 8, cls: 'purple' },
    ],
    rows: [
      { col: 'Random Forest', type: 'model', typeCls: 'pm-type-num', nulls: '94%', nullCls: 'pm-null-ok', sample: 'Best fit' },
      { col: 'XGBoost', type: 'model', typeCls: 'pm-type-cat', nulls: '91%', nullCls: 'pm-null-ok', sample: 'Runner-up' },
      { col: 'Linear Regr.', type: 'model', typeCls: 'pm-type-dt', nulls: '76%', nullCls: 'pm-null-warn', sample: 'Baseline' },
      { col: 'discount', type: 'feature', typeCls: 'pm-type-num', nulls: 0.42, nullCls: 'pm-null-ok', sample: 'Top feature' },
      { col: 'region', type: 'feature', typeCls: 'pm-type-cat', nulls: 0.31, nullCls: 'pm-null-ok', sample: 'High imp.' },
      { col: 'category', type: 'feature', typeCls: 'pm-type-cat', nulls: 0.18, nullCls: 'pm-null-ok', sample: 'Mid imp.' },
    ],
  },
  {
    id: 'powerbi', sidebarActive: 'Power BI',
    title: 'Power BI Dashboard', sub: 'Drag-and-drop dashboard builder with live data refresh',
    stats: [
      { label: 'Widgets', val: 12, cls: 'green' }, { label: 'Pages', val: 3, cls: '' },
      { label: 'Filters', val: 6, cls: 'purple' }, { label: 'KPIs', val: 5, cls: 'green' },
    ],
    rows: [
      { col: 'Total Sales KPI', type: 'card widget', typeCls: 'pm-type-num', nulls: 'Live', nullCls: 'pm-null-ok', sample: '₹1.52M' },
      { col: 'Profit Margin', type: 'gauge', typeCls: 'pm-type-cat', nulls: 'Live', nullCls: 'pm-null-ok', sample: '19.5%' },
      { col: 'Sales by Month', type: 'column chart', typeCls: 'pm-type-dt', nulls: 'Live', nullCls: 'pm-null-ok', sample: 'Jan-Dec' },
      { col: 'Region Map', type: 'geo chart', typeCls: 'pm-type-num', nulls: 'Live', nullCls: 'pm-null-ok', sample: '4 regions' },
      { col: 'Drill-through', type: 'table', typeCls: 'pm-type-cat', nulls: 'Live', nullCls: 'pm-null-warn', sample: 'Row-level' },
      { col: 'Date Slicer', type: 'filter', typeCls: 'pm-type-dt', nulls: 'Live', nullCls: 'pm-null-ok', sample: 'Q1–Q4 2024' },
    ],
  },
  {
    id: 'ai', sidebarActive: 'Decision Engine',
    title: 'AI Decision Engine', sub: 'Executive-level recommendations from your data',
    stats: [
      { label: 'Insights', val: 7, cls: 'green' }, { label: 'Actions', val: 4, cls: '' },
      { label: 'Risk Flags', val: 2, cls: 'purple' }, { label: 'Conf. Score', val: 93, cls: 'green' },
    ],
    rows: [
      { col: '📈 Boost West sales', type: 'priority', typeCls: 'pm-type-num', nulls: 'High', nullCls: 'pm-null-ok', sample: '+18% uplift' },
      { col: '✂️ Cut discounts', type: 'priority', typeCls: 'pm-type-dt', nulls: 'High', nullCls: 'pm-null-ok', sample: '+12% margin' },
      { col: '🔍 Furniture dip', type: 'alert', typeCls: 'pm-type-cat', nulls: 'Med', nullCls: 'pm-null-warn', sample: 'Q3 anomaly' },
      { col: '🤖 Retrain model', type: 'action', typeCls: 'pm-type-num', nulls: 'Low', nullCls: 'pm-null-ok', sample: 'Monthly' },
      { col: '⚠️ Low satisfaction', type: 'risk', typeCls: 'pm-type-dt', nulls: 'Med', nullCls: 'pm-null-warn', sample: '3 regions' },
      { col: '📊 Q4 forecast', type: 'insight', typeCls: 'pm-type-cat', nulls: 'Low', nullCls: 'pm-null-ok', sample: '+22% YoY' },
    ],
  },
];

const SIDEBAR_ITEMS = [
  { icon: '📁', label: 'Dataset Upload',  badge: 'DONE',        cls: 'psb-done', screenId: 'upload'  },
  { icon: '🔍', label: 'Data Exploration',badge: 'DONE',        cls: 'psb-done', screenId: 'eda'     },
  { icon: '📊', label: 'Visualization',   badge: 'DONE',        cls: 'psb-done', screenId: 'viz'     },
  { icon: '🧩', label: 'Prediction',      badge: 'IN PROGRESS', cls: 'psb-prog', screenId: 'predict' },
  { icon: '⚡', label: 'Power BI',        badge: 'DONE',        cls: 'psb-done', screenId: 'powerbi' },
  { icon: '🧠', label: 'Decision Engine', badge: 'IN PROGRESS', cls: 'psb-prog', screenId: 'ai'      },
];

function ProductPreview() {
  const [screenIdx, setScreenIdx] = useState(0);
  const [fade, setFade] = useState(true);

  const switchTo = (i) => {
    setFade(false);
    setTimeout(() => { setScreenIdx(i); setFade(true); }, 300);
  };

  useEffect(() => {
    const id = setInterval(() => {
      switchTo((screenIdx + 1) % PREVIEW_SCREENS.length);
    }, 3500);
    return () => clearInterval(id);
  }, [screenIdx]);

  const screen = PREVIEW_SCREENS[screenIdx];
  const totalScreens = PREVIEW_SCREENS.length;
  const progressPct = Math.round(((screenIdx + 1) / totalScreens) * 100);

  return (
    <div className="preview-browser">
      {/* Browser chrome */}
      <div className="preview-bar">
        <div className="preview-dots">
          <div className="preview-dot pd-red"/><div className="preview-dot pd-yellow"/><div className="preview-dot pd-green"/>
        </div>
        <div className="preview-url">datalytics18.com/app · Datalytics v1.18</div>
        <div className="preview-badge"><span className="live-dot"/>End-to-end analytics pipeline</div>
      </div>

      {/* Tab bar */}
      <div className="preview-tabs">
        {PREVIEW_SCREENS.map((s, i) => (
          <button key={s.id} className={`preview-tab${i === screenIdx ? ' active' : ''}`} onClick={() => switchTo(i)}>
            {s.sidebarActive}
          </button>
        ))}
      </div>

      {/* App shell */}
      <div className="preview-content" style={{ opacity: fade ? 1 : 0, transition: 'opacity 0.3s ease' }}>
        {/* Sidebar — each item clickable */}
        <div className="preview-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="ps-logo">● Data<span>lytics</span></div>
          <div className="ps-label">Pipeline Modules</div>
          {SIDEBAR_ITEMS.map((item, i) => {
            const isActive = item.label === screen.sidebarActive;
            return (
              <div
                key={item.label}
                className={`ps-item${isActive ? ' active' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => switchTo(PREVIEW_SCREENS.findIndex(s => s.id === item.screenId))}
              >
                <div className="ps-item-left">
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                <span className={`ps-badge ${item.cls}`}>{item.badge}</span>
              </div>
            );
          })}
          <div style={{ flex: 1 }}/>
          <div className="preview-progress">
            <div className="pp-label">Workflow Progress</div>
            <div className="pp-bar-bg">
              <div className="pp-bar-fill" style={{ width: `${progressPct}%`, transition: 'width 0.6s ease' }}/>
            </div>
            <div className="pp-sub">{screenIdx + 1} of {totalScreens} modules viewed</div>
          </div>
        </div>

        {/* Main panel */}
        <div className="preview-main">
          <div className="pm-title">{screen.title}</div>
          <div className="pm-sub">{screen.sub}</div>
          <div className="pm-stats">
            {screen.stats.map(s => (
              <div key={s.label} className="pm-stat">
                <div className="pm-stat-label">{s.label}</div>
                <LiveCounter key={`${screen.id}-${s.label}`} target={s.val} cls={s.cls} />
              </div>
            ))}
          </div>
          {screen.id === 'viz' || screen.id === 'powerbi' ? (
            <div className="pm-charts-grid">
              <div className="pm-chart-box">
                <div className="pm-chart-title">Sales by Region</div>
                <div className="pm-chart-mock bar-chart">
                  <div style={{height: '40%', animationDelay: '0s'}}></div>
                  <div style={{height: '80%', background: 'var(--orange)', animationDelay: '0.1s'}}></div>
                  <div style={{height: '60%', animationDelay: '0.2s'}}></div>
                  <div style={{height: '90%', background: '#22c55e', animationDelay: '0.3s'}}></div>
                </div>
              </div>
              <div className="pm-chart-box">
                <div className="pm-chart-title">Profit Trend</div>
                <div className="pm-chart-mock line-chart">
                  <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{width: '100%', height: '100%', overflow: 'visible'}}>
                    <path d="M0,40 L20,20 L40,30 L60,10 L80,15 L100,0" fill="none" stroke="var(--cyan)" strokeWidth="3" vectorEffect="non-scaling-stroke" style={{strokeDasharray: 200, strokeDashoffset: 200, animation: 'dash 1.5s ease forwards'}} />
                  </svg>
                  <style>{`@keyframes dash { to { stroke-dashoffset: 0; } }`}</style>
                </div>
              </div>
              <div className="pm-chart-box">
                <div className="pm-chart-title">Category Split</div>
                <div className="pm-chart-mock pie-chart">
                  <div className="pie-slice"></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="pm-table">
              <div className="pm-thead">
                <span>Column</span><span>Type</span><span>Value</span><span>Sample</span>
              </div>
              {screen.rows.map((row, i) => (
                <div key={i} className="pm-row">
                  <span>{row.col}</span>
                  <span className={row.typeCls}>{row.type}</span>
                  <span className={row.nullCls}>{row.nulls}</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{row.sample}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function Navbar({ scrolled, onLaunch, onLogin }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navItems = [
    { label: 'Home', href: '#hero' },
    { 
      label: 'About Us', 
      href: '#about',
      dropdown: {
        title: 'About Datalytics',
        desc: 'The next generation analytics platform unlocking the power of AI-driven data insights.',
        badge: 'New Gen'
      }
    },
    { 
      label: 'Services', 
      href: '#services',
      dropdown: {
        title: 'Our Pipeline',
        list: ['01 · Smart Ingestion', '02 · Data Preprocessing', '03 · Deep Insights', '04 · Auto-ML Training', '05 · Predictive Power', '06 · Advanced Reports', '07 · Dashboard Builder', '08 · AI Chatbot', '09 · Decision Engine', '10 · User Profile'],
        badge: '10 Steps'
      }
    },
    { 
      label: 'Pricing', 
      href: '#pricing',
      dropdown: {
        title: 'Pricing Plans',
        desc: 'Simple, transparent pricing for teams of all sizes.',
        price: 'Starting $0/mo',
        badge: 'Best Value'
      }
    },
    { 
      label: 'Contact', 
      href: '#contact',
      dropdown: {
        title: 'Get In Touch',
        contact: '8707080065',
        badge: '24/7 Support'
      }
    }
  ];

  return (
    <nav className="mm-nav" style={scrolled ? { background: 'rgba(6,10,24,0.95)', boxShadow: '0 4px 30px rgba(0,0,0,0.4)' } : {}}>
      <a href="#" className="logo">
        <div style={{
          position: 'relative',
          width: '30px',
          height: '22px',
          perspective: '100px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: '3px',
          flexShrink: 0,
        }}>
          <div style={{
            position: 'absolute',
            bottom: '-3px', left: '50%',
            transform: 'translateX(-50%)',
            width: '28px', height: '7px',
            background: 'radial-gradient(ellipse, rgba(255,110,0,0.6) 0%, transparent 70%)',
            filter: 'blur(3px)',
            borderRadius: '50%',
            animation: 'logo3dPulse 2.5s ease-in-out infinite',
          }} />
          {[{ h: '55%' }, { h: '100%' }, { h: '72%' }].map((bar, i) => (
            <div key={i} style={{
              position: 'relative',
              width: '6px', height: bar.h,
              borderRadius: '2px',
              background: 'linear-gradient(180deg, #ffb347 0%, #ff6d00 45%, #cc2800 100%)',
              boxShadow: '0 2px 6px rgba(255,100,0,0.55), inset 0 1px 0 rgba(255,255,255,0.35)',
              transform: 'rotateX(16deg) rotateY(-5deg)',
              transformStyle: 'preserve-3d',
              animation: `logo3dBob ${1.5 + i * 0.2}s ease-in-out ${i * 0.15}s infinite`,
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 100%)', borderRadius: '2px 2px 0 0' }} />
              <div style={{ position: 'absolute', top: 0, right: 0, width: '30%', height: '100%', background: 'linear-gradient(270deg, rgba(0,0,0,0.3) 0%, transparent 100%)', borderRadius: '0 2px 2px 0' }} />
            </div>
          ))}
          <style>{`
            @keyframes logo3dBob {
              0%, 100% { transform: rotateX(16deg) rotateY(-5deg) translateY(0px); }
              50% { transform: rotateX(16deg) rotateY(-5deg) translateY(-3px); }
            }
            @keyframes logo3dPulse {
              0%, 100% { opacity: 0.5; transform: translateX(-50%) scaleX(1); }
              50% { opacity: 1; transform: translateX(-50%) scaleX(1.25); }
            }
          `}</style>
        </div>
        Datalytics
      </a>
      <ul className="nav-links">
        {navItems.map(item => (
          <li key={item.label} className="nav-item">
            <a href={item.href}>{item.label}</a>
            {item.dropdown && (
              <div className="nav-dropdown">
                <div className="dropdown-header">
                  <span className="dropdown-title">{item.dropdown.title}</span>
                  {item.dropdown.badge && <span className="dropdown-badge">{item.dropdown.badge}</span>}
                </div>
                {item.dropdown.desc && <p className="dropdown-desc">{item.dropdown.desc}</p>}
                {item.dropdown.list && (
                  <ul className="dropdown-list">
                    {item.dropdown.list.map(li => (
                      <li key={li} className="dropdown-list-item">
                        <i>→</i> {li}
                      </li>
                    ))}
                  </ul>
                )}
                {item.dropdown.price && (
                  <div className="dropdown-price-row">
                    <span className="dropdown-price-label">Starter</span>
                    <span className="dropdown-price-val">{item.dropdown.price}</span>
                  </div>
                )}
                {item.dropdown.contact && (
                  <div className="dropdown-contact-row">
                    <span className="dropdown-contact-icon">📞</span>
                    <span>{item.dropdown.contact}</span>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="nav-actions">
        <button className="btn-login" onClick={onLogin}>Login</button>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
          <button className="btn-signup" onClick={onLaunch}>Start Analyzing 🚀</button>
          <div className="zoom-typing-text">
            ⚡ For the best experience, set your browser zoom to 80%
          </div>
        </div>
        <button className={`hamburger ${mobileMenuOpen ? 'open' : ''}`} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          <span /><span /><span />
        </button>
      </div>

      <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <ul className="mobile-nav-links">
          {navItems.map(item => (
            <li key={item.label}>
              <a href={item.href} onClick={() => setMobileMenuOpen(false)}>{item.label}</a>
            </li>
          ))}
        </ul>
        <div className="mobile-nav-actions">
          <button className="btn-login" onClick={() => { onLogin(); setMobileMenuOpen(false); }}>Login</button>
          <button className="btn-signup" onClick={() => { onLaunch(); setMobileMenuOpen(false); }}>Start Analyzing 🚀</button>
        </div>
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

function FAQItem({ question, answer, isOpen, onToggle }) {
  const [displayedAnswer, setDisplayedAnswer] = useState('');

  useEffect(() => {
    if (isOpen) {
      let index = 0;
      setDisplayedAnswer('');
      const interval = setInterval(() => {
        setDisplayedAnswer(answer.slice(0, index + 1));
        index++;
        if (index > answer.length) clearInterval(interval);
      }, 40); // Slower typing speed (40ms instead of 10ms)
      return () => clearInterval(interval);
    } else {
      setDisplayedAnswer('');
    }
  }, [isOpen, answer]);

  return (
    <div className={`faq-item${isOpen ? ' open' : ''}`}>
      <div className="faq-q" onClick={onToggle}>
        <span>{question}</span>
        <span className="faq-icon">+</span>
      </div>
      <div className="faq-a">
        <p style={{ minHeight: '60px' }}>
          {displayedAnswer}
          {isOpen && displayedAnswer.length < answer.length && <span style={{ borderRight: '2px solid var(--cyan)', marginLeft: '2px' }}></span>}
        </p>
      </div>
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
  const router = useRouter();
  // const { isAuthenticated, isVerified } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [tickerPrice, setTickerPrice] = useState('43,210');
  const [tickerChg, setTickerChg] = useState('+2.34%');
  const [miniBarHeights, setMiniBarHeights] = useState([30,55,70,45,80,60,90]);
  const [activeFooterLink, setActiveFooterLink] = useState(null);
  const [contactName, setContactName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactMessage, setContactMessage] = useState('');
    const [contactDone, setContactDone] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [authView, setAuthView] = useState("signup");
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const [volumeVal, setVolumeVal] = useState('1.3B');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const tickerBase = useRef(43210);
  const volBase = useRef(1.3);

  const handleBuyPlan = async (planName, priceAmount, diamonds) => {
    if (!priceAmount || priceAmount === 0) return;
    
    let token = null;
    if (typeof window !== 'undefined') {
      token = localStorage.getItem('auth_token');
    }
    
    if (!token) {
      setIsLaunching(true);
      return;
    }
    
    try {
      setPaymentLoading(true);
      setPaymentError(null);

      if (typeof window !== 'undefined' && !window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = resolve;
          script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
          document.body.appendChild(script);
        });
      }

      const res = await fetch('/api/payment/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          plan_name: planName,
          amount: priceAmount,
          diamonds: diamonds
        })
      });
      
      let data;
      try {
        data = await res.json();
      } catch (err) {
        throw new Error('Network Error');
      }

      if (!res.ok) throw new Error(data.detail || 'Failed to create order');

      if (data.mock) {
        // Mock payment flow: skip Razorpay modal and verify mock directly
        const verifyRes = await fetch('/api/payment/verify-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            razorpay_order_id: data.order_id,
            razorpay_payment_id: "pay_mock_" + Date.now(),
            razorpay_signature: "mock_signature",
            plan_name: planName,
            diamonds: diamonds
          })
        });
        if (verifyRes.ok) {
          router.push('/app');
        } else {
          const verifyData = await verifyRes.json();
          setPaymentError(verifyData.detail || 'Mock verification failed');
        }
        return;
      }

      const options = {
        key: data.key,
        amount: data.amount,
        currency: data.currency,
        name: 'Datalytics',
        description: `Purchase ${planName}`,
        order_id: data.order_id,
        handler: async function (response) {
          try {
            const verifyRes = await fetch('/api/payment/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan_name: planName,
                diamonds: diamonds
              })
            });
            if (verifyRes.ok) {
              router.push('/app');
            } else {
              const verifyData = await verifyRes.json();
              setPaymentError(verifyData.detail || 'Payment verification failed');
            }
          } catch (err) {
            setPaymentError('Error verifying payment.');
          }
        },
        prefill: { name: 'Datalytics User', email: 'user@example.com' },
        theme: { color: '#10b981' }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        setPaymentError(response.error.description || 'Payment Failed');
      });
      rzp.open();

    } catch (err) {
      console.error(err);
      setPaymentError(err.message || 'Payment intialization failed.');
    } finally {
      setPaymentLoading(false);
    }
  };

  useReveal();
  useSteps();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLaunchApp = () => {
    let token = null;
    if (typeof window !== 'undefined') {
      token = localStorage.getItem('auth_token');
    }
    
    if (!token || token === 'undefined' || token === 'null') {
      setAuthView("login");
      setIsLaunching(true);
    } else {
      router.push('/app');
    }
  };

  const handleLoginOpen = () => {
    setAuthView("login");
    setIsLaunching(true);
  };

  useEffect(() => {
    if (!isLaunching) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isLaunching]);

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
      stage.style.transform = `rotateX(${18 - dy * 8}deg) rotateY(${-20 + dx * 10}deg) scale(1.25)`;
      stage.style.animation = 'none';
    };
    const onLeave = () => { stage.style.transform = ''; stage.style.animation = ''; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseleave', onLeave); };
  }, []);

  const handleContact = () => {
    if (!contactName.trim() || !contactEmail.includes('@')) {
      alert("Please enter a valid name and email address.");
      return;
    }
    setContactDone(true);
    // WhatsApp link format: https://wa.me/number?text=message
    const message = encodeURIComponent(`Hi, I'm ${contactName}.\nEmail: ${contactEmail}\nMessage: ${contactMessage}`);
    const waUrl = `https://wa.me/918707080065?text=${message}`;
    window.open(waUrl, '_blank');
  };

  const features = [
    { icon: '📁', cls: 'fi-red', title: 'Smart Upload', desc: 'Import CSV, Excel, and JSON instantly with automated schema detection and clean data onboarding.' },
    { icon: '📊', cls: 'fi-cyan', title: 'Live Analytics', desc: 'Monitor key metrics, trends, and performance in real time across your active datasets.' },
    { icon: '🔐', cls: 'fi-purple', title: 'Secure Workspace', desc: 'Protect every dataset with role-based access, encryption, and audit-ready workspace controls.' },
    { icon: '🤖', cls: 'fi-green', title: 'AI Insights', desc: 'AI discovers patterns, anomalies and business signals so your team can act faster and smarter.' },
    { icon: '⚡', cls: 'fi-yellow', title: 'Instant Processing', desc: 'Run analytics pipelines and feature extraction in seconds for faster decision-ready results.' },
    { icon: '🌍', cls: 'fi-blue', title: 'Global Connectivity', desc: 'Connect SQL, cloud, and API sources in one unified analytics platform without extra setup.' },
  ];

  const services = [
    { step: '01', tag: 'Upload', tagColor: 'var(--red)', tagBg: 'rgba(255,77,46,0.1)', tagBorder: 'rgba(255,77,46,0.25)', icon: '📁', iconBg: 'linear-gradient(135deg,rgba(255,77,46,0.2),rgba(255,106,0,0.1))', iconBorder: 'rgba(255,77,46,0.25)', title: 'Smart Ingestion', desc: 'Upload CSV, Excel, or JSON files. Auto-detect schema, validate data quality, and onboard datasets in seconds.' },
    { step: '02', tag: 'Preprocessing', tagColor: '#60a5fa', tagBg: 'rgba(0,102,255,0.1)', tagBorder: 'rgba(0,102,255,0.25)', icon: '🛠️', iconBg: 'linear-gradient(135deg,rgba(0,102,255,0.2),rgba(0,212,255,0.1))', iconBorder: 'rgba(0,102,255,0.25)', title: 'Data Preprocessing', desc: 'Clean, normalize, handle missing values, and transform raw data into analysis-ready formats automatically.' },
    { step: '03', tag: 'Analytics', tagColor: 'var(--cyan)', tagBg: 'rgba(0,212,255,0.1)', tagBorder: 'rgba(0,212,255,0.25)', icon: '📈', iconBg: 'linear-gradient(135deg,rgba(0,212,255,0.2),rgba(0,102,255,0.1))', iconBorder: 'rgba(0,212,255,0.25)', title: 'Deep Insights', desc: 'Explore correlations, distributions, and anomalies with interactive charts, heatmaps, and AI-powered signals.' },
    { step: '04', tag: 'ML', tagColor: '#a855f7', tagBg: 'rgba(168,85,247,0.1)', tagBorder: 'rgba(168,85,247,0.25)', icon: '🧠', iconBg: 'linear-gradient(135deg,rgba(168,85,247,0.2),rgba(124,58,237,0.1))', iconBorder: 'rgba(168,85,247,0.25)', title: 'Auto-ML Training', desc: 'Train classification, regression, or clustering models automatically. No coding needed — just pick a target column.' },
    { step: '05', tag: 'Predictions', tagColor: '#f59e0b', tagBg: 'rgba(245,158,11,0.1)', tagBorder: 'rgba(245,158,11,0.25)', icon: '🚀', iconBg: 'linear-gradient(135deg,rgba(245,158,11,0.2),rgba(217,119,6,0.1))', iconBorder: 'rgba(245,158,11,0.25)', title: 'Predictive Power', desc: 'Deploy trained models instantly to generate real-time predictions with confidence scores and accuracy metrics.' },
    { step: '06', tag: 'Reporting', tagColor: '#22c55e', tagBg: 'rgba(34,197,94,0.1)', tagBorder: 'rgba(34,197,94,0.25)', icon: '📊', iconBg: 'linear-gradient(135deg,rgba(34,197,94,0.2),rgba(22,163,74,0.1))', iconBorder: 'rgba(34,197,94,0.25)', title: 'Advanced Reports', desc: 'Generate beautiful, exportable PDF reports with visual summaries, KPIs, and shareable insight snapshots.' },
    { step: '07', tag: 'Dashboard', tagColor: '#e879f9', tagBg: 'rgba(232,121,249,0.1)', tagBorder: 'rgba(232,121,249,0.25)', icon: '🖥️', iconBg: 'linear-gradient(135deg,rgba(232,121,249,0.2),rgba(168,85,247,0.1))', iconBorder: 'rgba(232,121,249,0.25)', title: 'Dashboard Builder', desc: 'Build interactive Power BI-style dashboards with drag-and-drop charts, filters, and live data refresh.' },
    { step: '08', tag: 'AI Chat', tagColor: '#34d399', tagBg: 'rgba(52,211,153,0.1)', tagBorder: 'rgba(52,211,153,0.25)', icon: '🤖', iconBg: 'linear-gradient(135deg,rgba(52,211,153,0.2),rgba(16,185,129,0.1))', iconBorder: 'rgba(52,211,153,0.25)', title: 'AI Chatbot', desc: 'Ask questions about your data in plain English. The AI chatbot surfaces insights, queries data, and explains results instantly.' },
    { step: '09', tag: 'Decisions', tagColor: '#fb923c', tagBg: 'rgba(251,146,60,0.1)', tagBorder: 'rgba(251,146,60,0.25)', icon: '⚡', iconBg: 'linear-gradient(135deg,rgba(251,146,60,0.2),rgba(245,158,11,0.1))', iconBorder: 'rgba(251,146,60,0.25)', title: 'Decision Engine', desc: 'Get executive-level, AI-backed strategic recommendations tailored to your dataset and business context.' },
    { step: '10', tag: 'Workspace', tagColor: '#94a3b8', tagBg: 'rgba(148,163,184,0.1)', tagBorder: 'rgba(148,163,184,0.25)', icon: '👤', iconBg: 'linear-gradient(135deg,rgba(148,163,184,0.2),rgba(100,116,139,0.1))', iconBorder: 'rgba(148,163,184,0.25)', title: 'User Profile', desc: 'Track your analytics history, manage workspace settings, monitor credit usage, and export your activity data.' },
  ];

  const testimonials = [
    { featured: true, avatar: '👨‍💼', avatarBg: 'linear-gradient(135deg,rgba(255,77,46,0.3),rgba(255,106,0,0.2))', avatarBorder: 'rgba(255,77,46,0.3)', text: '"Datalytics completely removed the headache of manual data cleaning. The way it handles CSV uploads and auto-detects schemas is flawless. Truly a beginner-friendly platform!"', name: 'Amit kr. Sharma', role: 'Data Analyst' },
    { featured: false, avatar: '👨‍💻', avatarBg: 'linear-gradient(135deg,rgba(0,212,255,0.3),rgba(0,102,255,0.2))', avatarBorder: 'rgba(0,212,255,0.3)', text: '"I\'m not a coder, but I built a full interactive Power BI-style dashboard in just minutes. The no-code layout is incredibly intuitive and the live visuals are stunning."', name: 'Sachin kr. Verma', role: 'Business Owner' },
    { featured: false, avatar: '👨‍🚀', avatarBg: 'linear-gradient(135deg,rgba(168,85,247,0.3),rgba(124,58,237,0.2))', avatarBorder: 'rgba(168,85,247,0.3)', text: '"The AI Chatbot feature is like having a data scientist on call 24/7. Asking questions in plain English and instantly getting charts back is a total game-changer."', name: 'Abhishek', role: 'Product Manager' },
    { featured: false, avatar: '🧑‍🎨', avatarBg: 'linear-gradient(135deg,rgba(34,197,94,0.3),rgba(22,163,74,0.2))', avatarBorder: 'rgba(34,197,94,0.3)', text: '"I\'ve tried many ETL tools, but the pipeline speed from raw data to an Auto-ML model here is unmatched. It feels like an entire engineering team in one UI."', name: 'Virat ', role: 'Startup Founder' },
    { featured: false, avatar: '👩‍💻', avatarBg: 'linear-gradient(135deg,rgba(245,158,11,0.3),rgba(217,119,6,0.2))', avatarBorder: 'rgba(245,158,11,0.3)', text: '"The automated preprocessing tools are worth it alone. Handling missing values used to take me hours; now it happens instantly upon dataset upload. Fantastic experience."', name: 'Anushka', role: 'Growth Marketer' },
    { featured: false, avatar: '👨‍🔬', avatarBg: 'linear-gradient(135deg,rgba(0,102,255,0.3),rgba(0,212,255,0.2))', avatarBorder: 'rgba(0,102,255,0.3)', text: '"The decision engine provides such precise recommendations. We uploaded our sales Excel sheet, and within seconds Datalytics pointed out anomalies we had totally missed."', name: 'Saurav', role: 'Operations Head' },
  ];

  const faqs = [
    { q: 'What kind of insights can your platform generate?', a: 'Datalytics automatically generates deep correlations, detects hidden patterns, and identifies anomalies within your datasets. Our AI also provides customized, executive-level business strategies based entirely on your unique data.' },
    { q: 'Do I need technical or coding knowledge to use it?', a: 'Not at all! Datalytics is built 100% no-code. From simply uploading a CSV to building Power BI-style dashboards and training ML models, our intuitive interface handles all the complex data science under the hood.' },
    { q: 'What data formats and sources are supported?', a: 'Currently, we enthusiastically support direct uploads for CSV and Excel files. Our robust pipeline processes massive sheets securely, turning your static flat files into interactive insights in just seconds.' },
    { q: 'How does the AI analyze and interpret my data?', a: 'Upon upload, our engine profiles your schema and cleans the data. Then, our advanced AI scans all columns to detect statistical anomalies, key trends, and uses NLP so you can ask plain-English questions in the AI Chatbot.' },
    { q: 'Can the system automatically detect trends, patterns, or anomalies?', a: 'Yes. During the automated preprocessing and Auto-ML steps, the platform isolates outliers, calculates distributions, and highlights predictive trends without you having to write a single line of code or SQL.' },
    { q: 'Can I export, share, or integrate reports (API available)?', a: 'Absolutely. You can easily export your generated charts and dashboard snapshots as professional PDFs. For expanding functionality, our Enterprise plan offers a secure REST API to integrate Datalytics natively into your existing workflows.' },
  ];

  const marqueeItems = ['⚛️ React','🚀 Next.js','🐍 Python','⚡ FastAPI','🍃 MongoDB','🧠 OpenAI','📊 PowerBI','📄 CSV & Excel','🤖 Scikit-Learn','🤝 GroqAPI'];

  return (
    <div className="mm-wrap">
      {/* Authentication modal disabled for now. */}

      {isLaunching ? (
        <AuthSystem 
          initialView={authView} 
          onClose={() => setIsLaunching(false)} 
          onSuccess={() => {
            // Do NOT call setIsLaunching(false) here.
            // Let the modal stay until the page transition to /app is complete.
            router.push('/app');
          }} 
        />
      ) : null}

      <style>{styles}</style>

      {/* BG */}
      <div className="bg-wrap">
        <div className="blob blob1"/><div className="blob blob2"/><div className="blob blob3"/>
        <div className="blob blob4"/><div className="blob blob5"/>
      </div>
      <div className="grid-bg"/>

      <Navbar scrolled={scrolled} onLaunch={handleLaunchApp} onLogin={handleLoginOpen} />

      {/* HERO */}
      <section className="hero" id="hero">
        <div className="hero-left">
          <p className="hero-eyebrow">The next generation <span>analytics</span> platform</p>
          <h1 className="hero-h1">The new era of<br /><span className="accent">data</span><br />insights.</h1>
          <p className="hero-sub">Unlocking the power of AI-driven data insights.</p>
          <div className="hero-btns">
            <button className="btn-primary" onClick={handleLaunchApp}>Start Analyzing 🚀</button>
          </div>
        </div>
        <div className="hero-right">
          <HeroDashboard tickerPrice={tickerPrice} tickerChg={tickerChg} miniBarHeights={miniBarHeights} />
        </div>
      </section>

      {/* PIPELINE VISUALIZATION */}
      <div className="pipeline-strip">
        <h2 className="pipeline-title">One Pipeline. <span>Everything.</span></h2>
        <p className="pipeline-sub">10-step automated engine — runs itself end to end</p>
        <div className="pipeline-track">
          <div className="pipeline-scanner" />
          {[
            { icon: '📁', label: 'Dataset Upload' },
            { icon: '🛠️', label: 'Data Prep' },
            { icon: '🔍', label: 'Exploration' },
            { icon: '🧠', label: 'Auto-ML' },
            { icon: '🚀', label: 'Prediction' },
            { icon: '📊', label: 'Visualization' },
            { icon: '🖥️', label: 'Power BI' },
            { icon: '🤖', label: 'AI Insights' },
            { icon: '⚡', label: 'Decisions' },
            { icon: '📋', label: 'Reports' },
          ].map((step, i) => (
            <Fragment key={step.label}>
              <div className="pl-node" style={{ animationDelay: `${i * 0.12}s` }}>
                <div className="pl-circle">{step.icon}</div>
                <span className="pl-label">{step.label}</span>
              </div>
              {i < 9 && (
                <div className="pl-arrow" style={{ animationDelay: `${i * 0.12 + 0.06}s` }}>
                  <div className="pl-arrow-line" />
                  <div className="pl-arrow-head" />
                </div>
              )}
            </Fragment>
          ))}
        </div>
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

      {/* LIVE PRODUCT PREVIEW */}
      <section className="product-preview" id="preview">
        <div className="section-head center" style={{ marginBottom: 40 }}>
          <div className="section-tag green">Live Platform</div>
          <h2 className="section-title">See it in action</h2>
          <div className="section-divider center" style={{ background: 'linear-gradient(90deg,#22c55e,#16a34a)' }}/>
          <p className="section-sub" style={{ marginTop: 16, margin: '16px auto 0' }}>
            A real look inside the Datalytics pipeline — live data, real columns, zero setup.
          </p>
        </div>

        <ProductPreview />
      </section>

      {/* THE OLD WAY IS BROKEN */}
      <section className="old-way" id="oldway">
        <div className="section-head center">
          <h2 className="section-title" style={{ fontSize: '3rem', animation: 'cardRise 0.6s ease both' }}>The Old Way Is <span style={{ color: 'var(--red)' }}>Broken</span></h2>
          <p className="section-sub" style={{ marginTop: 16, marginBottom: 50, fontSize: '1.05rem', animation: 'cardRise 0.6s ease both', animationDelay: '0.1s' }}>Manual data work is slow, repetitive, and painful</p>
        </div>
        <div className="old-way-cards">
          {[
            { icon: '⏱️', text: 'Hours spent cleaning and formatting data by hand' },
            { icon: '📉', text: 'Charts built one by one across three different tools' },
            { icon: '🤷‍♂️', text: 'Dashboards with no clear decisions or next actions' },
            { icon: '🔄', text: 'Same pipeline repeated manually for every new dataset' },
          ].map((item, i) => (
            <div
              key={i}
              className="old-card"
              style={{ animationDelay: `${i * 0.1 + 0.2}s` }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                e.currentTarget.style.setProperty('--mx', `${x}%`);
                e.currentTarget.style.setProperty('--my', `${y}%`);
                const cur = e.currentTarget.querySelector('.old-cursor');
                if (cur) { cur.style.left = `${e.clientX - rect.left}px`; cur.style.top = `${e.clientY - rect.top}px`; }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.setProperty('--mx', '50%');
                e.currentTarget.style.setProperty('--my', '50%');
              }}
            >
              <div className="old-cursor" />
              <div className="old-icon">{item.icon}</div>
              <div className="old-text">{item.text}</div>
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
        <div className="services-grid-10">
          {services.map((s,i) => (
            <div
              key={s.title}
              className="service-card-10"
              style={{ animationDelay: `${i * 0.07}s` }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                e.currentTarget.style.setProperty('--mx', `${x}%`);
                e.currentTarget.style.setProperty('--my', `${y}%`);
                const cur = e.currentTarget.querySelector('.sc10-cursor');
                if (cur) { cur.style.left = `${e.clientX - rect.left}px`; cur.style.top = `${e.clientY - rect.top}px`; }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.setProperty('--mx', '50%');
                e.currentTarget.style.setProperty('--my', '50%');
              }}
            >
              <div className="sc10-cursor" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span className="service-tag-badge" style={{ background: s.tagBg, color: s.tagColor, border: `1px solid ${s.tagBorder}` }}>{s.tag}</span>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.08em' }}>STEP {s.step}</span>
              </div>
              <div className="service-icon-wrap" style={{ background: s.iconBg, border: `1px solid ${s.iconBorder}` }}>{s.icon}</div>
              <h3 className="service-title" style={{ color: s.tagColor }}>{s.title}</h3>
              <p className="service-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* LIVE METRICS */}
      <section className="metrics">
        <div className="metrics-inner">
          <div className="metrics-left">
            <div className="section-tag reveal">System Metrics</div>
            <h2 className="section-title reveal reveal-delay-1" style={{ maxWidth: 450 }}>Automated Pipeline Performance</h2>
            <div className="section-divider reveal reveal-delay-2"/>
            <p className="section-sub reveal reveal-delay-2" style={{ marginTop: 16, marginBottom: 32 }}>Our end-to-end architecture is optimized for rapid data ingestion, intelligent preprocessing, and instantaneous AI insights directly from your CSV and Excel files.</p>
            <div className="metric-list reveal reveal-delay-3">
              <MetricBar label="Data Preprocessing Speed" val="98%" color="var(--cyan)" cls="mf1" width={98} />
              <MetricBar label="Model Training Reliability" val="96%" color="var(--orange)" cls="mf2" width={96} />
              <MetricBar label="AI Insight Accuracy" val="94%" color="var(--red)" cls="mf3" width={94} />
              <MetricBar label="Dashboard Generation" val="99%" color="var(--green)" cls="mf4" width={99} />
            </div>
          </div>
          <div className="metrics-right reveal reveal-delay-2">
            {[
              { icon: '🤖', bg: 'linear-gradient(135deg,rgba(255,77,46,0.2),rgba(255,106,0,0.1))', border: 'rgba(255,77,46,0.25)', title: 'Automated AI Insights', val: '24/7', change: '▲ Zero Downtime', changeCls: 'up' },
              { icon: '🎨', bg: 'linear-gradient(135deg,rgba(0,212,255,0.2),rgba(0,102,255,0.1))', border: 'rgba(0,212,255,0.25)', title: 'Interface', val: 'Beginner Friendly', change: '★ 100% No-Code Layout', changeCls: 'up' },
              { icon: '⏱️', bg: 'linear-gradient(135deg,rgba(168,85,247,0.2),rgba(124,58,237,0.1))', border: 'rgba(168,85,247,0.25)', title: 'Avg. Pipeline Execution', val: '1.5s', change: '★ From CSV to visual', changeCls: 'neutral' },
              { icon: '📁', bg: 'linear-gradient(135deg,rgba(34,197,94,0.3),rgba(22,163,74,0.2))', border: 'rgba(34,197,94,0.3)', title: 'Supported Data Formats', val: 'CSV,Json,Google Sheet & Databses', change: '▲ Enterprise Scale', changeCls: 'up' },
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
          <div className="section-tag purple">Testimonials</div>
          <h2 className="section-title">What our users are saying</h2>
          <div className="section-divider center" style={{ background: 'linear-gradient(90deg,#a855f7,#7c3aed)' }}/>
          <p className="section-sub" style={{ marginTop: 16 }}>Over 2 million people trust Datalytics with their strategic future. Here's what some of them have to say.</p>
        </div>
        <div className="testi-grid">
          {testimonials.map((t,i) => (
            <div key={t.name} className={`testi-card${t.featured ? ' testi-featured' : ''}`}>
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
          <h2 className="section-title reveal reveal-delay-1">Choose Your Plan</h2>
          <div className="section-divider center reveal reveal-delay-2" style={{ background: 'linear-gradient(90deg,#10b981,#059669)' }}/>
          <p className="section-sub reveal reveal-delay-2" style={{ marginTop: 16 }}>Flexible pricing to match your analytics and data workflow goals.</p>
        </div>

        {paymentError && (
          <div className="max-w-2xl mx-auto mb-8 rounded-2xl bg-rose-500/10 border border-rose-500/30 px-5 py-4 text-sm text-rose-300 flex items-center justify-between gap-3 text-center">
            <span>⚠️ {paymentError}</span>
            <button onClick={() => setPaymentError(null)} className="text-rose-400 underline shrink-0">Dismiss</button>
          </div>
        )}

        <div className="pricing-grid">
          {/* Free */}
          <div className="price-card reveal reveal-delay-1" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="price-plan" style={{ color: '#fff', fontSize: '1.2rem', marginBottom: 0 }}>Free</div>
              <span style={{ fontSize: '0.65rem', background: '#1e293b', color: '#cbd5e1', padding: '4px 10px', borderRadius: 20, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Default</span>
            </div>
            <div className="price-amount" style={{ color: '#34d399' }}>₹0</div>
            <div className="price-period" style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: 20 }}>200 Credits</div>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: 24, height: 40 }}>Perfect for small analytics projects, quick dataset exploration, and insight snapshots.</p>
            <div className="price-features">
              {['200 Data Credits','Basic Analytics Report','Dataset Upload','Limited History Tracking'].map(f => (
                <div key={f} className="pf-item" style={{ alignItems: 'flex-start', color: '#cbd5e1' }}>
                  <div className="pf-check yes" style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', border: 'none', width: '18px', height: '18px', marginTop: 2 }}>✓</div>{f}
                </div>
              ))}
            </div>
          </div>

          {/* Starter Pack */}
          <div className="price-card featured reveal reveal-delay-2" style={{ background: 'linear-gradient(180deg, rgba(6,78,59,0.4) 0%, rgba(2,6,23,0.8) 100%)', borderColor: 'rgba(16,185,129,0.5)', boxShadow: '0 8px 32px rgba(16,185,129,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="price-plan" style={{ color: '#fff', fontSize: '1.2rem', marginBottom: 0 }}>Starter Pack</div>
            </div>
            <div className="price-amount" style={{ color: '#34d399' }}>₹100</div>
            <div className="price-period" style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: 20 }}>200 Credits</div>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: 24, height: 40 }}>Great for focused insight generation, dashboard building, and KPI tracking.</p>
            <div className="price-features" style={{ flex: 1 }}>
              {['200 Data Credits','Detailed Analytics Reports','Performance Analytics','Full Dataset History'].map(f => (
                <div key={f} className="pf-item" style={{ alignItems: 'flex-start', color: '#cbd5e1' }}>
                  <div className="pf-check yes" style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', border: 'none', width: '18px', height: '18px', marginTop: 2 }}>✓</div>{f}
                </div>
              ))}
            </div>
          </div>

          {/* Pro Pack */}
          <div className="price-card reveal reveal-delay-3" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="price-plan" style={{ color: '#fff', fontSize: '1.2rem', marginBottom: 0 }}>Pro Pack</div>
              <span style={{ fontSize: '0.65rem', background: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', padding: '4px 10px', borderRadius: 20, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Best Value</span>
            </div>
            <div className="price-amount" style={{ color: '#34d399' }}>₹500</div>
            <div className="price-period" style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: 20 }}>800 Credits</div>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: 24, height: 40 }}>Best value for advanced analytics, predictive modeling, and executive reporting.</p>
            <div className="price-features" style={{ flex: 1 }}>
              {['800 Data Credits','Advanced AI Insights','Predictive Trend Analysis','Priority Query Processing'].map(f => (
                <div key={f} className="pf-item" style={{ alignItems: 'flex-start', color: '#cbd5e1' }}>
                  <div className="pf-check yes" style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', border: 'none', width: '18px', height: '18px', marginTop: 2 }}>✓</div>{f}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '30px' }}>
           <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '16px', padding: '16px 24px', display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
             <p style={{ fontSize: '0.9rem', color: '#ccfbf1', margin: 0 }}>
               Each step requires <strong style={{ color: '#34d399', margin: '0 4px' }}>20 UC 🪙</strong>
               <span style={{ opacity: 0.5, margin: '0 12px' }}>|</span>
               Re-runs are <strong style={{ color: '#34d399', margin: '0 4px' }}>Free</strong>
             </p>
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
              <FAQItem 
                question={f.q} 
                answer={f.a} 
                isOpen={openFaqIndex === i}
                onToggle={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
              />
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-inner reveal">
          <div className="cta-glow"/>
          <h2 className="cta-title">Ready to take control of<br />your <span>data future?</span></h2>
          <p className="cta-desc">Transform your raw data into powerful insights with AI-driven analytics. Get started for free — no technical skills required.</p>
          <div className="cta-btns">
            <a className="cta-tag" style={{ cursor: 'pointer', textDecoration: 'none', marginBottom: 0 }} onClick={handleLaunchApp}>Start Analyzing 🚀</a>
          </div>
          <p className="cta-note">✓ No credit card required &nbsp;&nbsp; ✓ Setup in under 5 minutes &nbsp;&nbsp; ✓ Cancel anytime</p>
        </div>
      </section>

      {/* CONTACT */}
      <section className="contact-section" id="contact">
        <div className="contact-wrapper">
          <div className="contact-info-side">
            <div className="contact-info-tag">Get in Touch</div>
            <h2 className="contact-info-h2">Connect with <span>Datalytics</span></h2>
            <p className="contact-info-p">Have questions about our AI models or want to discuss a custom project? We're here to help you unlock the true potential of your data.</p>
            
            <ul className="contact-features-list">
              <li className="contact-feature-item"><i>✓</i> 24/7 AI-powered support desk</li>
              <li className="contact-feature-item"><i>✓</i> Strategic data consulting sessions</li>
              <li className="contact-feature-item"><i>✓</i> Custom enterprise API solutions</li>
            </ul>
          </div>

          <div className="contact-card">
            <h2 className="contact-title">Send Me a Message</h2>
            
            {contactDone ? (
              <div className="form-success">
                <p>✓ Thank you, {contactName}! Your message has been sent successfully.</p>
                <p style={{ fontSize: '0.8rem', marginTop: 8, color: 'rgba(255,255,255,0.4)' }}>I'll get back to you shortly.</p>
              </div>
            ) : (
              <div className="contact-form">
                <div className="form-group">
                  <label className="form-label">Your Name</label>
                  <input className="form-input" type="text" placeholder="Virat Kohli" 
                  value={contactName} onChange={e => setContactName(e.target.value)} />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Your Email</label>
                  <input className="form-input" type="email" placeholder="viratkohli18@example.com"
                    value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Your Message</label>
                  <textarea className="form-textarea" placeholder="Tell me about your project..."
                    value={contactMessage} onChange={e => setContactMessage(e.target.value)} />
                </div>
                
                <button className="form-btn" onClick={handleContact}>
                  <span style={{ fontSize: '1.2rem' }}>✈</span> Send Message
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mm-footer" id="footer" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Ghost watermark */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: 'clamp(80px, 14vw, 160px)',
          fontWeight: '900',
          letterSpacing: '-0.04em',
          color: 'transparent',
          WebkitTextStroke: '1.5px rgba(255,255,255,0.06)',
          userSelect: 'none',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 0,
          fontFamily: "'Inter', 'Outfit', sans-serif",
          lineHeight: 1,
        }}>
          DATALYTICS
        </div>
        <div className="footer-top" style={{ position: 'relative', zIndex: 1 }}>
          <div className="footer-brand">
            <div className="footer-logo">
              <div style={{
                position: 'relative',
                width: '34px',
                height: '26px',
                perspective: '110px',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                gap: '4px',
                flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', bottom: '-3px', left: '50%',
                  transform: 'translateX(-50%)',
                  width: '30px', height: '8px',
                  background: 'radial-gradient(ellipse, rgba(255,110,0,0.55) 0%, transparent 70%)',
                  filter: 'blur(4px)', borderRadius: '50%',
                  animation: 'logo3dPulse 2.5s ease-in-out infinite',
                }} />
                {[{ h: '55%' }, { h: '100%' }, { h: '72%' }].map((bar, i) => (
                  <div key={i} style={{
                    position: 'relative', width: '7px', height: bar.h,
                    borderRadius: '3px',
                    background: 'linear-gradient(180deg, #ffb347 0%, #ff6d00 45%, #cc2800 100%)',
                    boxShadow: '0 2px 8px rgba(255,100,0,0.5), inset 0 1px 0 rgba(255,255,255,0.35)',
                    transform: 'rotateX(16deg) rotateY(-5deg)',
                    transformStyle: 'preserve-3d',
                    animation: `logo3dBob ${1.5 + i * 0.2}s ease-in-out ${i * 0.15}s infinite`,
                  }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 100%)', borderRadius: '3px 3px 0 0' }} />
                    <div style={{ position: 'absolute', top: 0, right: 0, width: '30%', height: '100%', background: 'linear-gradient(270deg, rgba(0,0,0,0.3) 0%, transparent 100%)', borderRadius: '0 3px 3px 0' }} />
                  </div>
                ))}
              </div>
              Datalytics
            </div>
            <p>AI-powered analytics that turns complex data into clear, actionable insights.</p>
            <div className="footer-social">
              <a href="https://www.instagram.com/sangam__singh_/" target="_blank" rel="noopener noreferrer" className="soc-btn instagram" data-label="Instagram"><FaInstagram /></a>
              <a href="https://www.linkedin.com/in/sangam-singh-94a52633b" target="_blank" rel="noopener noreferrer" className="soc-btn linkedin" data-label="LinkedIn"><FaLinkedin /></a>
              <a href="https://github.com/sangamsingh18" target="_blank" rel="noopener noreferrer" className="soc-btn github" data-label="GitHub"><FaGithub /></a>
              <a href="https://sangam-ai-ml.vercel.app/" target="_blank" rel="noopener noreferrer" className="soc-btn portfolio" data-label="Portfolio"><FaGlobe /></a>
            </div>
          </div>
          {[
            { 
              title: 'Product', 
              links: [
                { name: 'Features', href: '#services' },
                { name: 'Pricing', href: '#pricing' }
              ] 
            },
            { 
              title: 'Company', 
              links: [
                { name: 'About Us', href: '#about' },
                { name: 'Contact', href: '#contact' }
              ] 
            },
            { 
              title: 'Legal', 
              links: [
                { 
                  name: 'Privacy Policy', 
                  desc: 'We are committed to protecting your personal information and your right to privacy. This policy outlines how we collect, use, and safeguard your data in compliance with global standards.',
                  isLarge: true 
                },
                { 
                  name: 'Terms of Service', 
                  desc: 'By accessing Datalytics, you agree to follow our terms of use. We provide tools for data analysis, and users are responsible for the data they upload and the insights they generate.',
                  isLarge: true 
                }
              ] 
            },
          ].map(col => (
            <div key={col.title} className="footer-col">
              <h4>{col.title}</h4>
              <ul>
                {col.links.map(l => (
                  <li key={l.name} className={l.isLarge ? 'legal-li' : ''}>
                    <a href={l.href || "#"}>{l.name}</a>
                    {l.desc && <div className={`footer-link-desc${l.isLarge ? ' large' : ''}`}>{l.desc}</div>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="footer-bottom" style={{ position: 'relative', zIndex: 1 }}>
          <div className="footer-copy">© 2026 Datalytics. Developed by SANGAM SINGH</div>
          <div className="footer-badge"><span className="badge-dot"/>All systems operational</div>
        </div>
      </footer>
    </div>
  );
}

