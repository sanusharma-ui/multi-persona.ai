import { useState } from "react";
import { SHIFT_DETAILS, ONBOARDING_PATHS } from "../../data/shifts";

export default function WelcomeOnboarding({ shifts, avatars, onChoose, onExplore }) {
  const [choice, setChoice] = useState(null);
  const recommended = ONBOARDING_PATHS.find((path) => path.id === choice);
  const shift = shifts.find((item) => item.key === recommended?.shift);

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-orb orb-one" /><div className="onboarding-orb orb-two" />
      <div className="onboarding-card">
        {!recommended ? (
          <>
            <span className="eyebrow">WELCOME TO SHIFTS</span>
            <h2 id="onboarding-title">One universe.<br /><em>Many stories.</em></h2>
            <p className="onboarding-intro">Shifts — An Interactive Comic Universe Powered by AI</p>
            <div className="onboarding-options">
              {ONBOARDING_PATHS.map((path) => (
                <button key={path.id} onClick={() => setChoice(path.id)}>
                  <span>{path.icon}</span><strong>{path.title}</strong><small>{path.description}</small>
                </button>
              ))}
            </div>
            <button className="text-action" onClick={onExplore}>I’ll explore on my own →</button>
          </>
        ) : (
          <div className={`recommendation persona-${recommended.shift}`}>
            <span className="eyebrow">YOUR FIRST CHARACTER</span>
            <div className="recommendation-avatar">{avatars[recommended.shift] || SHIFT_DETAILS[recommended.shift]?.icon}</div>
            <h2>{shift?.label || "Your guide"}</h2>
            <p>{SHIFT_DETAILS[recommended.shift]?.vibe}. Discover their world, one conversation at a time.</p>
            <button className="primary-action" onClick={() => onChoose(recommended.shift)}>
              Meet your Shift <span>→</span>
            </button>
            <button className="text-action" onClick={() => setChoice(null)}>Choose something else</button>
          </div>
        )}
      </div>
    </div>
  );
}
