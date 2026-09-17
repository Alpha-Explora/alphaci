"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { MorphingBlob, PersonAvatar, ScenePhoto } from "./landing-motion";
import { cn } from "@/shared/ui/cn";

type EducationSectionProps = Readonly<{ reduced?: boolean | null }>;

const heroEase: [number, number, number, number] = [0.25, 1, 0.5, 1];

const LAB_POINTS = ["Hands-on DevSecOps", "Per-lab student workspaces", "Instructor oversight"];

// Class roster — letter chips for now; drop real photos in /public/people/ to replace them.
const CLASS_AVATARS = [
  { initials: "JR", photo: "/people/class-1.jpg", tone: "brand" as const },
  { initials: "LM", photo: "/people/class-2.jpg", tone: "accent" as const },
  { initials: "KP", photo: "/people/class-3.jpg", tone: "violet" as const },
  { initials: "TN", photo: "/people/class-4.jpg", tone: "amber" as const },
  { initials: "SD", photo: "/people/class-5.jpg", tone: "rose" as const },
];

// Real classroom photograph for the visual panel (replace with your own lab photo anytime).
const CLASSROOM_PHOTO = "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80";

export function EducationSection({ reduced = false }: EducationSectionProps) {
  return (
    <section
      className="relative overflow-hidden bg-[var(--bg-soft)] px-[clamp(2rem,7vw,8rem)] py-[clamp(4rem,6vw,6rem)]"
      aria-labelledby="education-title"
      data-education-section="true"
    >
      <MorphingBlob reduced={reduced} tone="accent" className="left-[-180px] top-[-60px] h-[460px] w-[540px]" />
      <MorphingBlob reduced={reduced} tone="brand" delay={7} className="bottom-[-160px] right-[-100px] h-[340px] w-[420px]" />

      <div className="relative z-[1] grid grid-cols-2 items-center gap-[clamp(2.5rem,5vw,5rem)] max-[860px]:grid-cols-1">
        <motion.div
          initial={reduced ? undefined : { opacity: 0, x: -24 }}
          whileInView={reduced ? undefined : { opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: heroEase }}
        >
          <p className="mb-4 inline-flex items-center gap-2 font-mono text-[0.85rem] font-bold uppercase tracking-[0.14em] text-emerald-400">
            <span className="size-[0.4rem] rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.65)]" aria-hidden="true" />
            AlphaCI Education
            <span className="ml-1 rounded-full border border-zinc-400/20 bg-zinc-400/[0.08] px-2 py-[0.15rem] font-mono text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-zinc-400">
              Coming soon
            </span>
          </p>
          <h2 id="education-title" className="m-0 max-w-[16ch] text-[clamp(2rem,3.5vw,3rem)] font-extrabold leading-[1.1] tracking-normal text-[var(--text-primary)]">
            Teach real DevSecOps, not slideware.
          </h2>
          <p className="mt-5 max-w-[48ch] text-[clamp(0.95rem,1.3vw,1.1rem)] leading-[1.7] text-[var(--text-secondary)]">
            Every student gets a real pipeline. Graduates walk into their first job already
            knowing how modern teams ship.
          </p>

          <ul className="m-0 mt-8 flex list-none flex-wrap gap-3 p-0">
            {LAB_POINTS.map((point) => (
              <li key={point} className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-2 text-[0.85rem] font-semibold text-[var(--text-primary)]">
                <span className="inline-flex size-[1.1rem] items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-400" aria-hidden="true">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-wrap gap-4">
           
            <motion.div whileHover={reduced ? undefined : { scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] px-8 py-[0.9rem] text-[0.8rem] font-semibold uppercase leading-none tracking-[0.1em] text-[var(--text-primary)] no-underline backdrop-blur-[10px]"
                href="/signup"
              >
                See plans
              </Link>
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          className="relative"
          initial={reduced ? undefined : { opacity: 0, x: 24 }}
          whileInView={reduced ? undefined : { opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.15, ease: heroEase }}
        >
          <div className="relative flex min-h-[clamp(400px,44vw,500px)] flex-col justify-between overflow-hidden rounded-3xl border border-emerald-400/20 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
            <ScenePhoto
              src={CLASSROOM_PHOTO}
              alt="Students working together on laptops in a lab"
              className="absolute inset-0"
              overlay={false}
            />
            <div
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.55)_0%,rgba(9,9,11,0.15)_35%,rgba(9,9,11,0.88)_100%)]"
              aria-hidden="true"
            />

            <div className="relative z-[1] flex items-center gap-[0.6rem] p-[clamp(1.25rem,2vw,1.75rem)]">
              <span className="text-[var(--brand-accent)]" aria-hidden="true">./</span>
              <p className="m-0 font-mono text-[0.72rem] tracking-[0.04em] text-white/70">classroom/lab-401.roster</p>
              <span className="ml-auto inline-flex items-center gap-[0.35rem] rounded-md border border-emerald-400/30 bg-[#09090b]/70 px-2 py-[0.15rem] font-mono text-[0.62rem] font-bold text-emerald-400 backdrop-blur-md">
                <span className="size-1 rounded-full bg-emerald-400" aria-hidden="true" />
                32 active
              </span>
            </div>

            <div className="relative z-[1] grid gap-3 p-[clamp(1.25rem,2vw,1.75rem)]">
              <div className="flex -space-x-2">
                {CLASS_AVATARS.map((avatar) => (
                  <PersonAvatar
                    key={avatar.initials}
                    photo={avatar.photo}
                    initials={avatar.initials}
                    name={`Student ${avatar.initials}`}
                    tone={avatar.tone}
                    ringClassName="ring-[#09090b]"
                    className="size-9 text-[0.72rem]"
                  />
                ))}
                <span className="inline-flex size-9 items-center justify-center rounded-full border border-white/15 bg-[#09090b]/70 font-mono text-[0.66rem] font-bold text-white/80 ring-2 ring-[#09090b] backdrop-blur-md">
                  +27
                </span>
              </div>

              {[
                { student: "student-jr", action: "Pipeline generated", state: "passing" },
                { student: "student-kp", action: "Pushed to UAT", state: "running" },
              ].map((row) => (
                <div key={row.student} className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#09090b]/75 px-3 py-2 backdrop-blur-md">
                  <span
                    className={cn(
                      "size-[7px] shrink-0 rounded-full",
                      row.state === "passing" ? "bg-[var(--brand-accent)] shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-[var(--brand)] shadow-[0_0_6px_color-mix(in_srgb,var(--brand)_60%,transparent)]",
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-[92px] font-mono text-[0.72rem] font-semibold text-white">{row.student}</span>
                  <span className="flex-1 text-[0.8rem] text-white/75">{row.action}</span>
                  <span className={cn("font-mono text-[0.62rem] font-bold", row.state === "passing" ? "text-[var(--brand-accent)]" : "text-[var(--brand)]")}>{row.state}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}


