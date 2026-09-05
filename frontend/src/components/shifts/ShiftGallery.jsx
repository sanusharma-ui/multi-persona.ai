import { useState } from "react";
import { SHIFT_DETAILS } from "../../data/shifts";

export default function ShiftGallery({ shifts, selectedShift, avatars, onSelect, onClose }) {
  const [filter, setFilter] = useState("All");
  const categories = ["All", ...new Set(shifts.map((shift) => SHIFT_DETAILS[shift.key]?.category || "More"))];
  const visibleShifts = filter === "All"
    ? shifts
    : shifts.filter((shift) => (SHIFT_DETAILS[shift.key]?.category || "More") === filter);

  return (
    <div className="shift-gallery-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="shift-gallery" role="dialog" aria-modal="true" aria-labelledby="gallery-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="gallery-heading">
          <div>
            <span className="eyebrow">FIND YOUR FIT</span>
            <h2 id="gallery-title">Meet the Shifts</h2>
            <p>Different ways to think, create, learn, and talk.</p>
          </div>
          <button className="gallery-close" onClick={onClose} aria-label="Close Shift gallery">×</button>
        </div>
        <div className="gallery-filters" aria-label="Filter Shifts">
          {categories.map((category) => (
            <button key={category} className={filter === category ? "active" : ""} onClick={() => setFilter(category)}>
              {category}
            </button>
          ))}
        </div>
        <div className="shift-grid">
          {visibleShifts.map((shift) => {
            const details = SHIFT_DETAILS[shift.key] || { category: "More", vibe: "A different point of view", icon: "✦" };
            const isSelected = shift.key === selectedShift;
            return (
              <button
                key={shift.key}
                className={`shift-card persona-${shift.key} ${isSelected ? "selected" : ""}`}
                onClick={() => { onSelect(shift.key); onClose(); }}
              >
                <span className="shift-card-icon">{avatars[shift.key] || details.icon}</span>
                <span className="shift-card-copy">
                  <strong>{shift.label}</strong>
                  <small>{details.vibe}</small>
                </span>
                {isSelected && <span className="selected-mark">✓</span>}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
