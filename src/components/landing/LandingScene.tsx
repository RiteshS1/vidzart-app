"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useLayoutEffect, useRef, type ReactNode } from "react";

gsap.registerPlugin(ScrollTrigger, SplitText);

// All landing-page motion, driven by data attributes on server-rendered
// markup (so the page itself stays static HTML):
//
//   data-split="lines"      headline lines rise out of a mask, staggered
//   data-reveal             fades up when scrolled into view
//   data-demo               the live demo straightens out of a 3D tilt as you scroll
//   data-hscroll            pinned section; its data-hscroll-track slides sideways
//   data-marquee            endless sideways strip (content is doubled)
//   data-progress           a line that draws itself across the section as you scroll
//
// Everything runs only for people who haven't asked their OS for reduced
// motion (gsap.matchMedia), and is torn down on unmount (mm.revert()).
// Elements that animate in start hidden via CSS (globals.css, only when
// motion is welcome); each animation brings its own element back to opacity 1.

export function LandingScene({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const mm = gsap.matchMedia(el);

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // Headlines: split into lines (re-split when fonts load or the width
      // changes, so line breaks stay right), each line rising from a mask.
      el.querySelectorAll<HTMLElement>("[data-split]").forEach((heading) => {
        SplitText.create(heading, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          onSplit(self) {
            gsap.set(heading, { opacity: 1 });
            return gsap.from(self.lines, {
              yPercent: 110,
              duration: 1.1,
              stagger: 0.09,
              ease: "expo.out",
              scrollTrigger: heading.dataset.split === "scroll" ? { trigger: heading, start: "top 85%" } : undefined,
            });
          },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((item) => {
        gsap.fromTo(
          item,
          { opacity: 0, y: 28 },
          {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: "power3.out",
            delay: Number(item.dataset.reveal || 0),
            scrollTrigger: { trigger: item, start: "top 88%" },
          },
        );
      });

      const demo = el.querySelector<HTMLElement>("[data-demo]");
      if (demo) {
        gsap.fromTo(
          demo,
          { rotateX: 22, scale: 0.88, y: 40, transformPerspective: 1400, transformOrigin: "50% 0%" },
          {
            rotateX: 0,
            scale: 1,
            y: 0,
            ease: "none",
            scrollTrigger: { trigger: demo, start: "top 95%", end: "top 25%", scrub: 0.6 },
          },
        );
      }

      el.querySelectorAll<HTMLElement>("[data-marquee]").forEach((strip) => {
        gsap.to(strip, { xPercent: -50, duration: 28, ease: "none", repeat: -1 });
      });

      el.querySelectorAll<HTMLElement>("[data-progress]").forEach((line) => {
        gsap.fromTo(
          line,
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: "none",
            transformOrigin: "0% 50%",
            scrollTrigger: { trigger: line.parentElement, start: "top 75%", end: "bottom 60%", scrub: true },
          },
        );
      });
    });

    // The pinned sideways scroll only where there's room for it.
    mm.add("(prefers-reduced-motion: no-preference) and (min-width: 1024px)", () => {
      el.querySelectorAll<HTMLElement>("[data-hscroll]").forEach((section) => {
        const track = section.querySelector<HTMLElement>("[data-hscroll-track]");
        if (!track) return;
        const distance = () => track.scrollWidth - section.clientWidth;
        gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.8,
            invalidateOnRefresh: true,
          },
        });
      });
    });

    return () => mm.revert();
  }, []);

  return (
    <div ref={root} className="landing">
      {children}
    </div>
  );
}
