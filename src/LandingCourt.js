/**
 * The floor behind the Query Prompt: a regulation NBA half court seen from the
 * broadcast camera. Units are tenths of a foot, so every mark sits where it
 * does on a real floor; the perspective lives in ModernSearch.css.
 *
 * Pure scenery: hidden from assistive technology and from pointer events.
 */
const LandingCourt = () => (
  <div className="landing-court" aria-hidden="true">
    <svg viewBox="-12 -12 524 494" focusable="false">
      <defs>
        {/* maple boards run baseline to half court */}
        <pattern id="landing-court-planks" width="9" height="470" patternUnits="userSpaceOnUse">
          <rect width="9" height="470" fill="#18120b" />
          <rect x="8.4" width="0.6" height="470" fill="#0b0805" />
          <rect y="163" width="9" height="0.6" fill="#0b0805" />
        </pattern>
        <radialGradient id="landing-court-spot" cx="50%" cy="30%" r="60%">
          <stop offset="0" stopColor="#e8a33d" stopOpacity="0.16" />
          <stop offset="1" stopColor="#e8a33d" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect className="court-wood" x="-12" y="-12" width="524" height="494" />
      <rect className="court-spot" x="-12" y="-12" width="524" height="494" />
      {/* the lane is 16 ft wide and 19 ft deep */}
      <rect className="court-paint" x="170" y="0" width="160" height="190" />
      <path className="court-paint" d="M 190 470 A 60 60 0 0 1 310 470 Z" />
      {/* boundary: 50 ft sideline to sideline, 47 ft baseline to half court */}
      <rect className="court-line court-draw" pathLength="1" x="0" y="0" width="500" height="470" />
      {/* three-point line: 22 ft in the corners for 14 ft, then 23.75 ft from the rim */}
      <path
        className="court-line court-draw court-draw-2"
        pathLength="1"
        d="M 30 0 L 30 142 A 237.5 237.5 0 0 0 470 142 L 470 0"
      />
      <rect
        className="court-line court-draw court-draw-2"
        pathLength="1"
        x="170"
        y="0"
        width="160"
        height="190"
      />
      {/* free-throw circle, 6 ft: solid toward half court, dashed inside the lane */}
      <path
        className="court-line court-draw court-draw-3"
        pathLength="1"
        d="M 190 190 A 60 60 0 0 0 310 190"
      />
      <path
        className="court-line court-soft court-dash court-fade"
        d="M 190 190 A 60 60 0 0 1 310 190"
      />
      {/* lane hash marks */}
      <path
        className="court-line court-soft court-fade"
        d="M 170 70 h -6 M 170 80 h -6 M 170 110 h -6 M 170 140 h -6 M 330 70 h 6 M 330 80 h 6 M 330 110 h 6 M 330 140 h 6"
      />
      {/* restricted area, 4 ft from the rim */}
      <path
        className="court-line court-soft court-draw court-draw-3"
        pathLength="1"
        d="M 210 40 L 210 52.5 A 40 40 0 0 0 290 52.5 L 290 40"
      />
      {/* backboard 4 ft in; rim 18 in across, centred 5.25 ft from the baseline */}
      <path className="court-line court-fade" d="M 220 40 L 280 40" />
      <circle className="court-line court-rim court-fade" cx="250" cy="52.5" r="7.5" />
      {/* centre circle (6 ft) and tip circle (2 ft) at half court */}
      <path
        className="court-line court-draw court-draw-3"
        pathLength="1"
        d="M 190 470 A 60 60 0 0 1 310 470"
      />
      <path
        className="court-line court-soft court-draw court-draw-3"
        pathLength="1"
        d="M 230 470 A 20 20 0 0 1 270 470"
      />
    </svg>
  </div>
);

export default LandingCourt;
