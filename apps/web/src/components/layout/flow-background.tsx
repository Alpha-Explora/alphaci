import { Fragment } from "react";

const particleOffsets = [
  { top: "8%", left: "10%", delay: "0s", size: "0.44rem", opacity: 0.45 },
  { top: "16%", left: "82%", delay: "1.6s", size: "0.32rem", opacity: 0.3 },
  { top: "26%", left: "32%", delay: "3.2s", size: "0.44rem", opacity: 0.5 },
  { top: "35%", left: "68%", delay: "4.6s", size: "0.32rem", opacity: 0.28 },
  { top: "44%", left: "16%", delay: "6.1s", size: "0.44rem", opacity: 0.55 },
  { top: "52%", left: "56%", delay: "7.4s", size: "0.32rem", opacity: 0.35 },
  { top: "60%", left: "88%", delay: "8.9s", size: "0.44rem", opacity: 0.42 },
  { top: "68%", left: "38%", delay: "10.1s", size: "0.32rem", opacity: 0.25 },
  { top: "76%", left: "72%", delay: "11.7s", size: "0.44rem", opacity: 0.48 },
  { top: "84%", left: "22%", delay: "13.3s", size: "0.32rem", opacity: 0.32 },
  { top: "90%", left: "52%", delay: "14.8s", size: "0.44rem", opacity: 0.4 },
  { top: "12%", left: "52%", delay: "16.2s", size: "0.32rem", opacity: 0.27 },
  { top: "20%", left: "6%", delay: "2.4s", size: "0.44rem", opacity: 0.52 },
  { top: "38%", left: "92%", delay: "9.6s", size: "0.32rem", opacity: 0.29 },
  { top: "55%", left: "44%", delay: "5.8s", size: "0.44rem", opacity: 0.46 },
  { top: "72%", left: "14%", delay: "12.4s", size: "0.32rem", opacity: 0.33 },
  { top: "48%", left: "76%", delay: "17.6s", size: "0.44rem", opacity: 0.53 },
  { top: "30%", left: "60%", delay: "18.9s", size: "0.32rem", opacity: 0.26 },
];

export function FlowBackground() {
  return (
    <div className="flow-ambient" aria-hidden="true">
      <div className="grid-haze" />
      <div className="flow-ribbon flow-ribbon-a" />
      <div className="flow-ribbon flow-ribbon-b" />
      <div className="flow-blob flow-blob-a" />
      <div className="flow-blob flow-blob-b" />
      <div className="flow-blob flow-blob-c" />
      {particleOffsets.map((particle) => (
        <Fragment key={`${particle.top}-${particle.left}`}>
          <span
            className="flow-particle"
            style={{
              top: particle.top,
              left: particle.left,
              animationDelay: particle.delay,
              width: particle.size,
              height: particle.size,
              opacity: particle.opacity,
            }}
          />
        </Fragment>
      ))}
    </div>
  );
}
