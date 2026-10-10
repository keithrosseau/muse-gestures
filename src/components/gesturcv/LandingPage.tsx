'use client';

// LandingPage: minimalist editorial-style landing for the Gestures → VCV project.
// Design rules:
//   - Pure black background, pure white text, no gradients.
//   - Montserrat: thin (200/300) for body, bold (700/800) for display headings.
//   - No border-radius anywhere — square corners only.
//   - No colored accents. Pure monochrome.
//   - Generous whitespace, large typographic scale, section numbering (01/02/03).
//   - Top CTA + bottom CTA both lead into the camera view.
//   - ENG/RU language toggle in the navbar. Default = English.
//
// Alignment: the navbar's horizontal padding lives on the <header> element
// (OUTSIDE the max-width container), matching the section layout. This ensures
// the navbar's left edge aligns exactly with the hero headline's left edge
// at every viewport width.

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowDown, Github, Instagram, Link as LinkIcon } from 'lucide-react';
import { useGesturCVStore } from '@/lib/gesturcv-store';
import type { Language } from '@/lib/i18n';

interface LandingPageProps {
  onLaunch: () => void;
}

export function LandingPage({ onLaunch }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const t = useGesturCVStore((s) => s.t);
  const language = useGesturCVStore((s) => s.language);
  const setLanguage = useGesturCVStore((s) => s.setLanguage);
  const loadSavedLanguage = useGesturCVStore((s) => s.loadSavedLanguage);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Load the saved language from localStorage after mount (avoids SSR
  // hydration mismatches — server always renders with 'en', client may
  // upgrade to 'ru' here after hydration completes).
  useEffect(() => {
    loadSavedLanguage();
  }, [loadSavedLanguage]);

  // Video autoplay — Safari is extremely strict. We need:
  // 1. preload="auto" + muted + playsInline on the <video> tag (done above)
  // 2. Call play() on 'canplay' event (not immediately)
  // 3. Unmute on first click/keydown/touchstart (not scroll — Safari ignores it)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // Safari needs play() called AFTER the video can play, not before.
    const onCanPlay = () => {
      v.play().catch(() => {
        // If even this fails, Safari is being Safari.
        // Video will start on first user interaction.
      });
    };

    if (v.readyState >= 2) {
      onCanPlay();
    } else {
      v.addEventListener('canplay', onCanPlay, { once: true });
    }

    // Unmute on first REAL user gesture.
    // Safari ONLY accepts click/keydown/touchstart — NOT scroll.
    const unmute = () => {
      if (v && v.muted) {
        v.muted = false;
        v.volume = 1;
      }
      window.removeEventListener('click', unmute, true);
      window.removeEventListener('keydown', unmute, true);
      window.removeEventListener('touchstart', unmute, true);
    };
    window.addEventListener('click', unmute, true);
    window.addEventListener('keydown', unmute, true);
    window.addEventListener('touchstart', unmute, true);

    return () => {
      v.removeEventListener('canplay', onCanPlay);
      window.removeEventListener('click', unmute, true);
      window.removeEventListener('keydown', unmute, true);
      window.removeEventListener('touchstart', unmute, true);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top nav */}
      <header
        className="fixed top-0 left-0 right-0 z-50 px-6 sm:px-10 transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(0,0,0,0.85)' : 'transparent',
          backdropFilter: scrolled ? 'blur(8px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
        }}
      >
        <div className="max-w-[1400px] mx-auto py-6 flex items-center justify-between">
          {/* Wordmark — SVG logo placeholder + project name */}
          <div className="flex items-center gap-2.5">
            {/* Logo placeholder — replace src with your actual logo SVG.
                Sized to match the text height (12px text → 16px logo). */}
            <img
              src="/logo.svg"
              alt="MUSE GESTURES logo"
              className="h-5 w-5"
            />
            <span className="text-[12px] tracking-[0.25em] uppercase font-light text-white/60">
              MUSE
            </span>
            <span className="text-[12px] tracking-[0.25em] uppercase font-light text-white/60">
              GESTURES
            </span>
          </div>

          {/* Right side: language toggle + launch */}
          <div className="flex items-center gap-6">
            {/* ENG / RU toggle — inline on desktop, compact dropdown on mobile */}
            <div className="hidden sm:flex items-center gap-2">
              <LangButton
                label="ENG"
                active={language === 'en'}
                onClick={() => setLanguage('en')}
              />
              <span className="text-white/20 text-[12px]">/</span>
              <LangButton
                label="RU"
                active={language === 'ru'}
                onClick={() => setLanguage('ru')}
              />
            </div>

            {/* Mobile: compact language dropdown (saves horizontal space) */}
            <div className="sm:hidden relative">
              <button
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="flex items-center gap-1 text-[12px] tracking-[0.25em] uppercase font-light text-white/80 hover:text-white border border-white/20 hover:border-white/30 px-2 py-1 transition-colors"
              >
                <span>{language.toUpperCase()}</span>
                <svg
                  className={`w-3 h-3 transition-transform ${langDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="square" d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {langDropdownOpen && (
                <>
                  {/* Click-outside overlay */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setLangDropdownOpen(false)}
                  />
                  {/* Dropdown menu — matches SampleSelector styling */}
                  <div className="absolute top-full right-0 mt-px bg-black border border-white/20 z-50 min-w-[80px]">
                    <button
                      onClick={() => { setLanguage('en'); setLangDropdownOpen(false); }}
                      className={`block w-full text-center px-3 py-2.5 text-[11px] tracking-[0.25em] uppercase font-light border-b border-white/10 last:border-b-0 transition-colors ${
                        language === 'en' ? 'text-white bg-white/5' : 'text-white/50 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      ENG
                    </button>
                    <button
                      onClick={() => { setLanguage('ru'); setLangDropdownOpen(false); }}
                      className={`block w-full text-center px-3 py-2.5 text-[11px] tracking-[0.25em] uppercase font-light border-b border-white/10 last:border-b-0 transition-colors ${
                        language === 'ru' ? 'text-white bg-white/5' : 'text-white/50 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      RU
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={onLaunch}
              className="group flex items-center gap-2 text-[12px] tracking-[0.25em] uppercase font-light hover:text-white text-white/70 transition-colors"
            >
              <span>{t.navLaunch}</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col justify-center px-6 sm:px-10 pt-32 pb-20 overflow-hidden">
        {/* Demo video background — centered, ~40% of screen width, behind
            the text, darkened with a semi-transparent black overlay.
            Autoplays on load (muted if browser requires, unmutes on first
            user gesture). Not looped. Sound plays.
            Place the video file at: /public/demo-video.mp4 */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 0 }}
        >
          <video
            ref={videoRef}
            src="/demo-video.mp4"
            autoPlay
            muted
            playsInline
            preload="auto"
            controls={false}
            className="block"
            style={{
              width: 'min(100vw, 1400px)',
              //maxWidth: '960px',
              height: 'auto',
              transform: 'translateY(-50px)',
              aspectRatio: '16 / 9',
              objectFit: 'cover',
              filter: 'brightness(0.6)',
            }}
          />
          {/* Dark overlay on top of the video to blend it with the background */}
          <div
            className="absolute inset-0 bg-black/40"
            style={{ zIndex: 0 }}
          />
        </div>
        <div className="max-w-[1400px] mx-auto w-full relative" style={{ zIndex: 1 }}>
          {/* Section number */}
          <div className="flex items-center gap-4 mb-12">
            <span className="text-[11px] tracking-[0.3em] text-white/40 font-light">01</span>
            <div className="h-px w-12 bg-white/20" />
            <span className="text-[11px] tracking-[0.3em] text-white/40 uppercase font-light">
              {t.heroLabel}
            </span>
          </div>

          {/* Headline */}
          <h1
            className="font-extrabold leading-[0.92] tracking-[-0.02em] text-white"
            style={{
              fontSize: 'clamp(3rem, 9vw, 9.5rem)',
              fontWeight: 800,
            }}
          >
            {t.heroTitleLine1}
            <br />
            {t.heroTitleLine2}
          </h1>

          {/* Sub */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-12 gap-y-10 md:gap-y-12 md:gap-x-12 md:items-center">
            {/* Row 1: paragraph on the right, empty spacer on the left. */}
            <div className="md:col-span-7 md:row-start-1" />
            <div className="md:col-span-5 md:row-start-1">
              <p className="text-base md:text-lg font-light text-white/70 leading-relaxed">
                {t.heroBody}
              </p>
            </div>

            {/* Row 2: social icons (left) + Launch camera button (right).
                Both cells share the same row, so md:items-center on the grid
                centers the icons vertically relative to the button. */}
            <div className="md:col-span-7 md:row-start-2 flex items-center gap-6">
              <a
                href="https://github.com/keithrosseau/muse-gestures"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="text-white/40 hover:text-white transition-colors duration-200"
              >
                <Github className="h-[26px] w-[26px]" strokeWidth={1.5} />
              </a>
              <a
                href="https://www.instagram.com/keithrosseau"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-white/40 hover:text-white transition-colors duration-200"
              >
                <Instagram className="h-[26px] w-[26px]" strokeWidth={1.5} />
              </a>
              <a
                href="https://keithrose.bio.link"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="bio.link"
                className="text-white/40 hover:text-white transition-colors duration-200"
              >
                <LinkIcon className="h-[26px] w-[26px]" strokeWidth={1.5} />
              </a>
            </div>
            <div className="md:col-span-5 md:row-start-2">
              <button
                onClick={onLaunch}
                className="group inline-flex items-center gap-3 border border-white px-8 py-4 hover:bg-white hover:text-black transition-colors duration-200"
              >
                <span className="text-[11px] tracking-[0.3em] uppercase font-medium">
                  {t.heroCta}
                </span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </div>

        {/* Scroll hint — at the very bottom of the hero section, centered.
            Positioned relative to the <section>, not the inner max-w
            container, so it sits at the bottom edge of the viewport. */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40 z-10">
          <span className="text-[10px] tracking-[0.3em] uppercase font-light">{t.scroll}</span>
          <ArrowDown className="h-3 w-3 animate-bounce" />
        </div>
      </section>

      {/* Tech section — plain, no animations */}
      <section className="px-6 sm:px-10 py-32 border-t border-white/10">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center gap-4 mb-16">
            <span className="text-[11px] tracking-[0.3em] text-white/40 font-light">02</span>
            <div className="h-px w-12 bg-white/20" />
            <span className="text-[11px] tracking-[0.3em] text-white/40 uppercase font-light">
              {t.techLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 mb-20">
            <div className="md:col-span-6">
              <h2
                className="font-bold leading-[1.0] tracking-[-0.02em] text-white"
                style={{ fontSize: 'clamp(2rem, 4vw, 4rem)', fontWeight: 700 }}
              >
                {t.techTitleLine1}
                <br />
                {t.techTitleLine2}
                <br />
                {t.techTitleLine3}
              </h2>
            </div>
            <div className="md:col-span-6 md:pt-4">
              <p className="text-base md:text-lg font-light text-white/70 leading-relaxed mb-6">
                {t.techBody1}
              </p>
              <p className="text-base md:text-lg font-light text-white/70 leading-relaxed">
                {t.techBody2}
              </p>
            </div>
          </div>

          {/* Tech grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-t border-l border-white/10">
            {[
              {
                label: t.techTrackingLabel,
                title: t.techTrackingTitle,
                desc: t.techTrackingDesc,
              },
              {
                label: t.techEngineLabel,
                title: t.techEngineTitle,
                desc: t.techEngineDesc,
              },
              {
                label: t.techSynthLabel,
                title: t.techSynthTitle,
                desc: t.techSynthDesc,
              },
            ].map((item, i) => (
              <div
                key={i}
                className="border-r border-b border-white/10 p-8 md:p-10 flex flex-col gap-4"
              >
                <span className="text-[10px] tracking-[0.3em] uppercase text-white/40 font-light">
                  {item.label}
                </span>
                <h3
                  className="text-white"
                  style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.01em' }}
                >
                  {item.title}
                </h3>
                <p className="text-sm font-light text-white/60 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gestures guide — plain, no animations */}
      <section className="px-6 sm:px-10 py-32 border-t border-white/10">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center gap-4 mb-16">
            <span className="text-[11px] tracking-[0.3em] text-white/40 font-light">03</span>
            <div className="h-px w-12 bg-white/20" />
            <span className="text-[11px] tracking-[0.3em] text-white/40 uppercase font-light">
              {t.gesturesLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 mb-16">
            <div className="md:col-span-6 md:pt-4">
              <h2
                className="font-bold leading-[1.0] tracking-[-0.02em] text-white"
                style={{ fontSize: 'clamp(2rem, 4vw, 4rem)', fontWeight: 700 }}
              >
                {t.gesturesTitleLine1}
                <br />
                {t.gesturesTitleLine2}
              </h2>
            </div>
            <div className="md:col-span-6 md:pt-4">
              <p className="text-base md:text-lg font-light text-white/70 leading-relaxed mb-6">
                {t.gesturesBody1}
              </p>
              <p className="text-base md:text-lg font-light text-white/70 leading-relaxed">
                {t.gesturesBody2}
              </p>
            </div>
          </div>

          {/* Guide image — language-specific, preloaded for seamless switch */}
          <figure className="overflow-hidden -m-[1%]">
            <img
              src={language === 'ru' ? '/gestures-guide/page-ru-1.png' : '/gestures-guide/page-en-1.png'}
              alt={t.gesturesCaption}
              className="w-[102%] h-auto block -ml-[1%]"
              style={{ maxWidth: 'none' }}
              loading="eager"
            />
          </figure>

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" style={{ paddingLeft: '18px' }}>
            <p className="text-xs font-light text-white/40">
              {t.gesturesCaption}
            </p>
            <a
              href={language === 'ru' ? '/gestures-guide-ru.pdf' : '/gestures-guide-en.pdf'}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase font-light text-white/60 hover:text-white transition-colors"
            >
              <span>{t.openPdf}</span>
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 sm:px-10 py-40 border-t border-white/10">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center gap-4 mb-16">
            <span className="text-[11px] tracking-[0.3em] text-white/40 font-light">04</span>
            <div className="h-px w-12 bg-white/20" />
            <span className="text-[11px] tracking-[0.3em] text-white/40 uppercase font-light">
              {t.finalLabel}
            </span>
          </div>

          <div className="text-center max-w-3xl mx-auto">
            <h2
              className="font-extrabold leading-[0.95] tracking-[-0.02em] text-white mb-8"
              style={{ fontSize: 'clamp(2.5rem, 7vw, 7rem)', fontWeight: 800 }}
            >
              {t.finalTitle}
            </h2>
            <p className="text-base md:text-lg font-light text-white/60 leading-relaxed mb-12 max-w-xl mx-auto">
              {t.finalBody}
            </p>

            <button
              onClick={onLaunch}
              className="group inline-flex items-center gap-4 border border-white px-12 py-6 hover:bg-white hover:text-black transition-colors duration-200"
            >
              <span
                className="uppercase font-medium"
                style={{ fontSize: '0.875rem', letterSpacing: '0.3em' }}
              >
                {t.finalCta}
              </span>
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer — centered, minimal. Two lines:
          1. "made with love & care by @keithrosseau" (Montserrat weight 100)
          2. "engineered for immersion 2026" italic (Montserrat weight 100) */}
      <footer className="px-6 sm:px-10 py-8 border-t border-white/10">
        <div className="max-w-[1400px] mx-auto flex flex-col items-center justify-center gap-2 text-center">
          <span
            className="text-[11px] tracking-[0.2em] uppercase text-white/80"
            style={{ fontFamily: "'Montserrat', system-ui, sans-serif", fontWeight: 100 }}
          >
            made with love &amp; care by @keithrosseau
          </span>
          <span
            className="text-[10px] tracking-[0.2em] uppercase italic text-white/70"
            style={{ fontFamily: "'Montserrat', system-ui, sans-serif", fontWeight: 100 }}
          >
            engineered for immersion 2026
          </span>
        </div>
      </footer>
    </div>
  );
}

// Small helper for the language toggle buttons.
function LangButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[12px] tracking-[0.25em] uppercase font-light transition-colors ${
        active ? 'text-white' : 'text-white/30 hover:text-white/60'
      }`}
    >
      {label}
    </button>
  );
}
