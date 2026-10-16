// SQL Drills' own loader, in Waffles' style (Waffles' only spinner was its logo). A neutral ring in the token
// colours, three sizes, an accessible label, and a still ring when the visitor prefers reduced motion.
import "./loader.scss";

const SIZES = { small: 18, medium: 32, large: 48 };

export default function Loader({ size = "medium", label = "Loading", inline = false, showLabel = false }) {
  const px = SIZES[size] || SIZES.medium;
  return (
    <span className={"wf-loader wf-loader--" + size + (inline ? " wf-loader--inline" : "")} role="status" aria-live="polite">
      <svg className="wf-loader__ring" width={px} height={px} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <circle className="wf-loader__track" cx="24" cy="24" r="20" fill="none" strokeWidth="5" />
        <circle className="wf-loader__arc" cx="24" cy="24" r="20" fill="none" strokeWidth="5" strokeLinecap="round" strokeDasharray="40 126" />
      </svg>
      <span className={showLabel ? "wf-loader__label" : "wf-sr-only"}>{label}</span>
    </span>
  );
}
