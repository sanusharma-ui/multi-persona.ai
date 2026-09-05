const AgreementPopup = ({ onAgree }) => (
  <div className="agreement-popup">
    <div
      className="popup-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notice-title"
    >
      <div className="popup-content">
        <div className="popup-icon-wrapper" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 id="notice-title" className="popup-title">
          Important Notice
        </h2>
        <div className="popup-text">
          This AI system is created strictly for:
        </div>
        <div className="popup-list">
          <ul>
            <li>Entertainment & Roleplay</li>
            <li>Educational experiments</li>
          </ul>
        </div>
        <div className="popup-text">This AI is NOT:</div>
        <div className="popup-list">
          <ul>
            <li>A medical professional or therapist</li>
            <li>A real human or legal advisor</li>
            <li>A guardian, partner, or emotional authority</li>
          </ul>
        </div>
        <div className="popup-text highlight-text">
          If you feel emotional distress or mental breakdown: Please seek REAL
          human help immediately.
        </div>
        <button className="popup-agree-btn" onClick={onAgree}>
          <span>I AGREE & CONTINUE</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
);


export default AgreementPopup;
