import { useState, useEffect } from "react";
import { C } from "../../utils/theme";
import { AWS_TIPS } from "../../utils/helpers";

export function TypeWriter({ text = "", speed = 14 }) {
	const [out, setOut] = useState("");
	const [done, setDone] = useState(false);

	useEffect(() => {
		setOut("");
		setDone(false);
		let i = 0;
		const id = setInterval(() => {
			i++;
			setOut(text.slice(0, i));
			if (i >= text.length) {
				clearInterval(id);
				setDone(true);
			}
		}, speed);
		return () => clearInterval(id);
	}, [text]);

	return (
		<>
			{out}
			{!done && <span className="tw-cursor">|</span>}
		</>
	);
}

export const Tip = ({ term, children }) => {
	const hint = Object.entries(AWS_TIPS).find(([k]) => term?.includes(k))?.[1];
	if (!hint) return <>{children}</>;
	return (
		<span className="tip-wrap">
			{children}
			<span className="tip-icon">i</span>
			<span className="tip-box">{hint}</span>
		</span>
	);
};

export const HealthDot = ({ status }) => {
	const cfg = {
		ok: { cls: "hdot hdot-green", label: "AI ready" },
		slow: { cls: "hdot hdot-amber", label: "AI warming up — first run may take 20s" },
		offline: { cls: "hdot hdot-red", label: "AI offline — run: ollama serve" },
		checking: { cls: "", label: "Checking AI…" },
	}[status] || { cls: "", label: "…" };

	return (
		<div className="health-row">
			{status === "checking" ? (
				<svg width="10" height="10" viewBox="0 0 24 24" className="spin">
					<circle cx="12" cy="12" r="10" fill="none" stroke={C.gold} strokeWidth="2.5" strokeDasharray="40 20" strokeLinecap="round" />
				</svg>
			) : (
				<span className={cfg.cls} />
			)}
			<span>{cfg.label}</span>
		</div>
	);
};

export const StepHeader = ({ step, total, onBack }) => {
	const pct = Math.round(((step - 1) / (total - 1)) * 100);
	return (
		<div className="stepper">
			<button className="btn-g btn-back" onClick={onBack} disabled={!onBack}>
				← Back
			</button>
			<div className="stepper-track">
				<div className="stepper-fill" style={{ width: `${pct}%` }} />
				{Array.from({ length: total }).map((_, i) => {
					const left = (i / (total - 1)) * 100;
					const on = i < step;
					return <span key={i} className={`step-dot ${on ? "on" : ""}`} style={{ left: `${left}%` }} />;
				})}
			</div>
			<div className="stepper-label">
				<span className="mono">Step {step}</span>
				<span className="muted"> / {total}</span>
			</div>
		</div>
	);
};

export const MiniChart = () => {
	const points = [6, 12, 8, 16, 10, 18, 14, 21, 16, 26, 18, 28, 20, 32];
	const max = Math.max(...points);
	const min = Math.min(...points);
	const h = 120;
	const w = 520;
	const step = w / (points.length - 1);
	const d = points
		.map((p, i) => {
			const x = i * step;
			const y = h - ((p - min) / (max - min)) * (h - 10) - 5;
			return `${i === 0 ? "M" : "L"} ${x} ${y}`;
		})
		.join(" ");

	return (
		<svg width="100%" height="140" viewBox={`0 0 ${w} ${h}`} className="mini-chart">
			<defs>
				<linearGradient id="chartStroke" x1="0" y1="0" x2="1" y2="0">
					<stop offset="0%" stopColor={C.navy} />
					<stop offset="100%" stopColor={C.gold} />
				</linearGradient>
				<linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor={`${C.gold}55`} />
					<stop offset="100%" stopColor={`${C.gold}00`} />
				</linearGradient>
			</defs>
			<path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill="url(#chartFill)" opacity="0.8" />
			<path d={d} fill="none" stroke="url(#chartStroke)" strokeWidth="3" strokeLinecap="round" />
			{points.map((p, i) => {
				const x = i * step;
				const y = h - ((p - min) / (max - min)) * (h - 10) - 5;
				return <circle key={i} cx={x} cy={y} r="3.2" fill={C.surface} stroke={C.navy} strokeWidth="1.5" />;
			})}
		</svg>
	);
};

export const LoadingSpinner = ({ label = "Loading..." }) => (
	<div style={{ textAlign: "center", padding: "40px 20px" }}>
		<svg width="40" height="40" viewBox="0 0 24 24" className="spin" style={{ margin: "0 auto 20px" }}>
			<circle cx="12" cy="12" r="10" fill="none" stroke={C.gold} strokeWidth="2.5" strokeDasharray="40 20" strokeLinecap="round" />
		</svg>
		<p style={{ color: C.muted }}>{label}</p>
	</div>
);

export const ErrorBox = ({ title, message, onRetry }) => (
	<div
		style={{
			padding: "24px",
			background: `${C.red}12`,
			border: `1px solid ${C.red}44`,
			borderRadius: 14,
			textAlign: "center",
		}}>
		<h3 style={{ color: C.red, marginBottom: 8 }}>⚠️ {title}</h3>
		<p style={{ color: C.muted, fontSize: 14, marginBottom: 20 }}>{message}</p>
		{onRetry && (
			<button className="btn-p" onClick={onRetry} style={{ padding: "10px 24px" }}>
				🔄 Retry
			</button>
		)}
	</div>
);
