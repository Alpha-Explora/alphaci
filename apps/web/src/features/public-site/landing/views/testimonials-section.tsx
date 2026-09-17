"use client";

import Link from "next/link";
import { motion } from "framer-motion";


import { MorphingBlob, ScenePhoto } from "./landing-motion";

type TestimonialsSectionProps = Readonly<{ reduced?: boolean | null }>;

const heroEase: [number, number, number, number] = [0.25, 1, 0.5, 1];

// Real photographs (Unsplash, actual humans). Swap for your own customer/lab
// shots anytime — same layout, just change the URLs.
const STORY_PHOTOS = {
  quote: "https://images.pexels.com/photos/7988089/pexels-photo-7988089.jpeg",
  education: "https://res.cloudinary.com/dlk93aehl/image/upload/f_auto,q_auto,w_800/v1775011709/alpha3.jpg",
  wide: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1400&q=80",
};

export function TestimonialsSection({ reduced = false }: TestimonialsSectionProps) {
  return (
    <section
      className="relative overflow-hidden bg-[var(--bg-soft)] px-[clamp(2rem,7vw,8rem)] py-[clamp(4rem,6vw,6rem)]"
      aria-labelledby="testimonials-title"
      data-testimonials-section="true"
    >
      <MorphingBlob reduced={reduced} tone="accent" className="right-[-160px] top-[-80px] h-[420px] w-[520px]" />
      <MorphingBlob reduced={reduced} tone="violet" delay={9} className="bottom-[-200px] left-[-140px] h-[360px] w-[440px]" />

      <TestimonialsHeader reduced={reduced} />
      <TestimonialsStoryGrid reduced={reduced} />
      <TestimonialsWideStory reduced={reduced} />
      <TestimonialsReviewMarquee reduced={reduced} />
    </section>
  );
}

function TestimonialsHeader({ reduced }: TestimonialsSectionProps) {
  return (
      <motion.div
        className="relative z-[1] mb-[clamp(2rem,3.5vw,3rem)] flex flex-wrap items-end justify-between gap-6"
        initial={reduced ? undefined : { opacity: 0, y: 20 }}
        whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: heroEase }}
      >
        <div className="max-w-[40ch]">
          <p className="mb-4 inline-flex items-center gap-2 font-mono text-[0.85rem] font-bold uppercase tracking-[0.14em] text-[var(--brand)]">
            <span className="size-[0.4rem] rounded-full bg-[var(--brand-accent)] shadow-[0_0_16px_rgba(52,211,153,0.65)]" aria-hidden="true" />
            Stories
          </p>
          <h2 id="testimonials-title" className="m-0 text-[clamp(2rem,3.5vw,3rem)] font-extrabold leading-[1.1] tracking-normal text-[var(--text-primary)]">
            Built for the people who ship.
          </h2>
        </div>
        <motion.div whileHover={reduced ? undefined : { scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-6 py-[0.7rem] text-[0.78rem] font-semibold uppercase leading-none tracking-[0.1em] text-[var(--text-primary)] no-underline backdrop-blur-[10px]"
            href="mailto:sales@alphaci.dev"
          >
            Contact sales <span aria-hidden="true">&rarr;</span>
          </Link>
        </motion.div>
      </motion.div>
  );
}

function TestimonialsStoryGrid({ reduced }: TestimonialsSectionProps) {
  return (
      <div className="relative z-[1] grid grid-cols-2 gap-[clamp(1rem,2vw,1.5rem)] max-[960px]:grid-cols-1">
        {/* Quote story card — dark, big photo beside the quote (monday.com style) */}
        <motion.figure
          className="m-0 grid grid-cols-[1fr_0.9fr] overflow-hidden rounded-3xl border border-white/10 bg-[#0f0f12]/90 backdrop-blur-md max-[640px]:grid-cols-1"
          data-story-card="quote"
          initial={reduced ? undefined : { opacity: 0, y: 22 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          whileHover={reduced ? undefined : { y: -6 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: heroEase }}
        >
          <div className="flex flex-col justify-between gap-8 p-[clamp(1.5rem,2.5vw,2.25rem)]">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="text-[var(--brand)]">
              <path d="M9.5 6C6.5 7.4 5 9.9 5 13.5V18h5v-5H7.6c.1-1.8.9-3 2.6-3.8L9.5 6zm9 0c-3 1.4-4.5 3.9-4.5 7.5V18h5v-5h-2.4c.1-1.8.9-3 2.6-3.8L18.5 6z" />
            </svg>
            <blockquote className="m-0 text-[clamp(1.05rem,1.6vw,1.35rem)] font-semibold leading-[1.5] text-[var(--text-primary)]">
              &ldquo;CI/CD feels like having an autopilot for code — faster releases, fewer errors,<span className="text-[var(--brand)]"> and more confidence  </span>  in every deployment.&rdquo;
            </blockquote>
            <figcaption className="text-[0.82rem] leading-[1.5] text-[var(--text-muted)]">
              &mdash; E. De Guzman <span className="text-[var(--text-secondary)]">Lead Backend Developer, Tech startup</span>
            </figcaption>
          </div>
          <div className="relative p-3 max-[640px]:order-first max-[640px]:pb-0">
            <ScenePhoto
              src={STORY_PHOTOS.quote}
              alt="Engineer working at her laptop"
              className="size-full min-h-[240px] rounded-2xl"
            />
            <span className="absolute bottom-6 right-6 rounded-lg border border-white/15 bg-[#09090b]/80 px-3 py-[0.4rem] font-mono text-[0.68rem] font-bold text-[var(--text-secondary)] backdrop-blur-md">
              Tech startup
            </span>
          </div>
        </motion.figure>

        {/* Stat story card — tinted panel with an honest number (monday.com style) */}
        <motion.article
          className="grid grid-cols-[1fr_0.9fr] overflow-hidden rounded-3xl border border-emerald-400/20 bg-[radial-gradient(circle_at_15%_0%,rgba(52,211,153,0.14),transparent_18rem),linear-gradient(180deg,rgba(6,20,17,0.95),rgba(4,13,11,0.9))] backdrop-blur-md max-[640px]:grid-cols-1"
          data-story-card="stat"
          initial={reduced ? undefined : { opacity: 0, y: 22 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          whileHover={reduced ? undefined : { y: -6 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: 0.12, ease: heroEase }}
        >
          <div className="flex flex-col justify-between gap-8 p-[clamp(1.5rem,2.5vw,2.25rem)]">
            <span className="w-fit rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-3 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-emerald-400">
              Developer Experience
            </span>
            <div>
              <p className="m-0 text-[clamp(2.6rem,4.5vw,3.8rem)] font-extrabold leading-none text-[var(--text-primary)]">
                Zero <span className="text-emerald-400">Config</span>
              </p>
              <p className="mb-0 mt-3 max-w-[24ch] text-[0.9rem] leading-[1.6] text-[var(--text-secondary)]">
                Stop wrestling with complex pipeline scripts. Just push your code and let AlphaCI handle the rest.
              </p>
            </div>
            <Link
              className="inline-flex w-fit items-center gap-2 text-[0.82rem] font-bold text-emerald-400 no-underline underline-offset-4 hover:underline"
              href="/signup"
            >
              Explore features <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
          <div className="relative p-3 max-[640px]:order-first max-[640px]:pb-0">
            <ScenePhoto
              src={STORY_PHOTOS.education}
              alt="Students in a workshop session"
              className="size-full min-h-[240px] rounded-2xl"
            />
          </div>
        </motion.article>
      </div>
  );
}

function TestimonialsWideStory({ reduced }: TestimonialsSectionProps) {
  return (
      <motion.figure
        className="relative z-[1] m-0 mt-[clamp(1rem,2vw,1.5rem)] overflow-hidden rounded-3xl border border-white/10"
        data-story-card="wide"
        initial={reduced ? undefined : { opacity: 0, y: 22 }}
        whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.55, delay: 0.2, ease: heroEase }}
      >
        <ScenePhoto
          src={STORY_PHOTOS.wide}
          alt="Team collaborating around a table"
          className="h-[clamp(280px,38vw,420px)] w-full"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.15)_0%,rgba(9,9,11,0.55)_55%,rgba(9,9,11,0.92)_100%)]"
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-[clamp(1.5rem,3vw,2.5rem)]">
          <div className="max-w-[52ch]">
            <blockquote className="m-0 text-[clamp(1.05rem,1.8vw,1.5rem)] font-semibold leading-[1.45] text-white">
              &ldquo;CI/CD triggers my anger issues by <span className="text-[var(--brand)]">identifying my errors automatically</span>&rdquo;
            </blockquote>
            <figcaption className="mt-3 text-[0.82rem] text-white/70">
              &mdash; S. Go, <span className="text-white/90">Intern Developer, University of Santo Tomas</span>
            </figcaption>
          </div>
        </div>
      </motion.figure>
  );
}

function TestimonialsReviewMarquee({ reduced }: TestimonialsSectionProps) {
  return (
      <div className="relative z-[1] mt-[clamp(4rem,8vw,6rem)] flex w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <motion.div
          className="flex w-max gap-6 pr-6"
          animate={reduced ? undefined : { x: ["0%", "-50%"] }}
          transition={reduced ? undefined : { duration: 40, ease: "linear", repeat: Infinity }}
        >
          {[
            { name: "L. Lim.", text: "“It turns our deployments from stress into speed.”" },
            { name: "B. Ramos.", text: "“Shipping code finally feels effortless and reliable.”" },
            { name: "A. Torres.", text: "“AlphaCI is my safety net — catching bugs before they reach production.”" },
            { name: "A. Go", text: "“Every release is now smoother, faster, and much less risky.”" },
            { name: "J. Flores", text: "“The backbone of our modern development — automation that never sleeps.”" },
            { name: "M. Perez", text: "“No more deployment anxiety. We just push code and let it work.”" },
            // Duplicate for smooth infinite scroll
            { name: "L. Lim.", text: "“It turns our deployments from stress into speed.”" },
            { name: "B. Ramos.", text: "“Shipping code finally feels effortless and reliable.”" },
            { name: "A. Torres.", text: "“AlphaCI is my safety net — catching bugs before they reach production.”" },
            { name: "A. Go", text: "“Every release is now smoother, faster, and much less risky.”" },
            { name: "J. Flores", text: "“The backbone of our modern development — automation that never sleeps.”" },
            { name: "M. Perez", text: "“No more deployment anxiety. We just push code and let it work.”" },
          ].map((review, i) => (
            <div key={i} className="w-[320px] shrink-0 rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-sm">
              <p className="mb-6 text-[0.92rem] leading-[1.65] text-[var(--text-secondary)]">{review.text}</p>
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--brand),var(--brand-accent))] font-bold text-[#09090b]">
                  {review.name.charAt(0)}
                </div>
                <span className="text-[0.85rem] font-medium text-[var(--text-primary)]">{review.name}</span>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
  );
}

