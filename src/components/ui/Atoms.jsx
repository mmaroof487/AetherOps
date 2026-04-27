import { C } from "../../utils/theme";

// Atomic UI components
export const Syne = ({ c, s = {}, ...p }) => <span style={{ fontFamily: "'Syne',sans-serif", color: c, ...s }} {...p} />;

export const Mono = ({ c, s = {}, ...p }) => <span style={{ fontFamily: "'JetBrains Mono',monospace", color: c, ...s }} {...p} />;

export const Pill = ({ children, color = C.navy }) => (
	<span className="pill" style={{ background: `${color}18`, color, border: `1px solid ${color}44` }}>
		{children}
	</span>
);

export const Prog = ({ pct }) => (
	<div className="prog-track">
		<div className="prog-fill" style={{ width: `${pct}%` }} />
	</div>
);

export const Spin = ({ size = 18 }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" className="spin">
		<circle cx="12" cy="12" r="10" fill="none" stroke={C.gold} strokeWidth="2.5" strokeDasharray="40 20" strokeLinecap="round" />
	</svg>
);

export const Check = ({ size = 16 }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none">
		<circle cx="12" cy="12" r="11" fill={`${C.green}22`} stroke={C.green} strokeWidth="1.5" />
		<path d="M7 12l3.5 3.5L17 8" stroke={C.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

export const Alert = ({ icon = "!", color = C.red, children }) => (
	<div
		style={{
			padding: "16px",
			background: `${color}12`,
			border: `1px solid ${color}44`,
			borderRadius: 12,
			color,
			fontSize: 14,
			display: "flex",
			gap: 12,
			alignItems: "center",
		}}>
		<span style={{ fontSize: 18, fontWeight: "bold" }}>{icon}</span>
		<div>{children}</div>
	</div>
);

export const Badge = ({ children, bg = C.navy, color = "white" }) => (
	<span
		style={{
			display: "inline-block",
			padding: "4px 12px",
			background: bg,
			color,
			borderRadius: 20,
			fontSize: 12,
			fontWeight: 600,
		}}>
		{children}
	</span>
);
