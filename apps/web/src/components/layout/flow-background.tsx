import { Fragment } from "react";

const particleOffsets = [
  { top: "8%", left: "10%", delay: "0s" },
  { top: "16%", left: "82%", delay: "1.6s" },
  { top: "26%", left: "32%", delay: "3.2s" },
  { top: "35%", left: "68%", delay: "4.6s" },
  { top: "44%", left: "16%", delay: "6.1s" },
  { top: "52%", left: "56%", delay: "7.4s" },
  { top: "60%", left: "88%", delay: "8.9s" },
  { top: "68%", left: "38%", delay: "10.1s" },
  { top: "76%", left: "72%", delay: "11.7s" },
  { top: "84%", left: "22%", delay: "13.3s" },
  { top: "90%", left: "52%", delay: "14.8s" },
  { top: "12%", left: "52%", delay: "16.2s" },
];

export function FlowBackground() {
  return (
    <div className="flow-ambient" aria-hidden="true">
      <div className="flow-ribbon flow-ribbon-a" />
      <div className="flow-ribbon flow-ribbon-b" />
      <div className="flow-blob flow-blob-a" />
      <div className="flow-blob flow-blob-b" />
      <div className="flow-blob flow-blob-c" />
      {particleOffsets.map((particle, index) => (
        <Fragment key={`${particle.top}-${particle.left}`}>
          <span
            className="flow-particle"
            style={{
              top: particle.top,
              left: particle.left,
              animationDelay: particle.delay,
              opacity: index % 2 === 0 ? 0.45 : 0.3,
            }}
          />
        </Fragment>
      ))}
    </div>
  );
}
