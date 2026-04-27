import React, { useState, useEffect } from "react";
import { Syne, Mono } from "../components/ui/Atoms";
import { StepHeader } from "../components/ui/Common";
import { styled } from "../stitches.config";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const PIE_COLORS = ["#4CAF82", "#E05A4A", "#F0C060"];

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function fmtTime(date) {
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function createInitialSeries(points = 20) {
	const out = [];
	let cpu = 38;
	let memory = 56;
	let instances = 2;
	let cost = 12;
	const now = Date.now();

	for (let i = points - 1; i >= 0; i -= 1) {
		if (Math.random() < 0.12) {
			instances = clamp(instances + (Math.random() < 0.5 ? -1 : 1), 1, 5);
		}
		cpu = clamp(cpu + (Math.random() * 16 - 8), 15, 90);
		memory = clamp(memory + (Math.random() * 10 - 5), 30, 92);
		cost = Number((cost + instances * (0.08 + Math.random() * 0.15)).toFixed(2));

		const incoming = Number((8 + cpu / 7 + Math.random() * 6).toFixed(2));
		const outgoing = Number((6 + memory / 10 + Math.random() * 5).toFixed(2));

		out.push({
			time: fmtTime(new Date(now - i * 60 * 1000)),
			cpu: Number(cpu.toFixed(1)),
			max: Number(clamp(cpu + 6 + Math.random() * 6, cpu, 100).toFixed(1)),
			memory: Number(memory.toFixed(1)),
			instances,
			cost,
			incoming,
			outgoing,
		});
	}

	return out;
}

function nextPoint(previous) {
	const prev = previous || {
		cpu: 40,
		memory: 55,
		instances: 2,
		cost: 10,
		incoming: 10,
		outgoing: 8,
	};

	let instances = prev.instances;
	if (Math.random() < 0.16) {
		instances = clamp(instances + (Math.random() < 0.5 ? -1 : 1), 1, 5);
	}

	const cpu = clamp(prev.cpu + (Math.random() * 16 - 8), 15, 92);
	const memory = clamp(prev.memory + (Math.random() * 10 - 5), 30, 94);
	const cost = Number((prev.cost + instances * (0.08 + Math.random() * 0.16)).toFixed(2));
	const incoming = Number((8 + cpu / 7 + Math.random() * 6).toFixed(2));
	const outgoing = Number((6 + memory / 10 + Math.random() * 5).toFixed(2));

	return {
		time: fmtTime(new Date()),
		cpu: Number(cpu.toFixed(1)),
		max: Number(clamp(cpu + 6 + Math.random() * 6, cpu, 100).toFixed(1)),
		memory: Number(memory.toFixed(1)),
		instances,
		cost,
		incoming,
		outgoing,
	};
}

function useCpuMetrics(deploymentId, authExpired, onAuthExpired) {
	const [cpuMetrics, setCpuMetrics] = useState([]);
	const [loadingMetrics, setLoadingMetrics] = useState(true);
	const [usingFallback, setUsingFallback] = useState(false);
	const [metricsError, setMetricsError] = useState(null);

	useEffect(() => {
		if (!deploymentId || authExpired) {
			setLoadingMetrics(false);
			return;
		}

		let cancelled = false;

		const fetchMetrics = async () => {
			if (!cancelled && cpuMetrics.length === 0) setLoadingMetrics(true);

			try {
				const response = await fetch(`/api/metrics/${deploymentId}`, { credentials: "include" });
				if (response.status === 401) {
					onAuthExpired();
					if (!cancelled) {
						setMetricsError("AWS session expired. Reconnect credentials.");
						setLoadingMetrics(false);
					}
					return;
				}

				const payload = await response.json();
				const points = Array.isArray(payload) ? payload : [];
				const mapped = points
					.filter((p) => p?.time)
					.slice(-20)
					.map((p) => ({
						time: new Date(p.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
						value: Number(p.value || 0),
					}));

				if (!cancelled) {
					setCpuMetrics(mapped);
					setUsingFallback(response.headers.get("x-metrics-fallback") === "true");
					setMetricsError(response.headers.get("x-metrics-error") || null);
					setLoadingMetrics(false);
				}
			} catch (err) {
				if (!cancelled) {
					setMetricsError(err.message || "Failed to fetch metrics");
					setLoadingMetrics(false);
				}
			}
		};

		fetchMetrics();
		const interval = setInterval(fetchMetrics, 60000);

		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, [deploymentId, authExpired]);

	return { cpuMetrics, loadingMetrics, usingFallback, metricsError };
}

const Container = styled("div", {
	display: "flex",
	flexDirection: "column",
	gap: "32px",
	padding: "32px",
});

const Section = styled("div", {
	display: "flex",
	flexDirection: "column",
	gap: "16px",
});

const SectionTitle = styled("h2", {
	fontSize: "18px",
	fontWeight: "700",
	color: "#21405E",
	margin: "0 0 12px 0",
});

const DeploymentsGrid = styled("div", {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
	gap: "16px",
});

const DeploymentCard = styled("div", {
	padding: "16px",
	border: "2px solid #E0E0E0",
	borderRadius: "12px",
	backgroundColor: "#FAFAFA",
	transition: "all 0.2s",
});

const CardHeader = styled("div", {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	marginBottom: "12px",
});

const DeploymentId = styled("div", {
	fontFamily: "monospace",
	fontSize: "12px",
	color: "#666",
	wordBreak: "break-all",
});

const StatusBadge = styled("div", {
	padding: "4px 8px",
	borderRadius: "4px",
	fontSize: "12px",
	fontWeight: "600",

	variants: {
		status: {
			active: {
				backgroundColor: "#C8E6C9",
				color: "#2E7D32",
			},
			error: {
				backgroundColor: "#FFCDD2",
				color: "#C62828",
			},
		},
	},
});

const CardBody = styled("div", {
	display: "flex",
	flexDirection: "column",
	gap: "12px",
	marginBottom: "12px",
});

const CardRow = styled("div", {
	display: "flex",
	justifyContent: "space-between",
	fontSize: "13px",
});

const CardLabel = styled("span", {
	color: "#666",
	fontWeight: "500",
});

const CardValue = styled("span", {
	color: "#21405E",
	fontWeight: "600",
});

const ChartContainer = styled("div", {
	width: "100%",
	height: "300px",
	backgroundColor: "#FAFAFA",
	borderRadius: "12px",
	padding: "16px",
	border: "1px solid #E0E0E0",
});

const ChartGrid = styled("div", {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
	gap: "16px",
});

const ButtonGroup = styled("div", {
	display: "flex",
	gap: "8px",
	marginTop: "12px",
});

const Button = styled("button", {
	flex: 1,
	padding: "8px 12px",
	fontSize: "12px",
	fontWeight: "600",
	border: "none",
	borderRadius: "6px",
	cursor: "pointer",
	transition: "all 0.2s",

	variants: {
		variant: {
			primary: {
				backgroundColor: "#4CAF82",
				color: "#FFF",
				"&:hover": { backgroundColor: "#3A9969" },
			},
			warning: {
				backgroundColor: "#FFB74D",
				color: "#FFF",
				"&:hover": { backgroundColor: "#FFA726" },
			},
			danger: {
				backgroundColor: "#F44336",
				color: "#FFF",
				"&:hover": { backgroundColor: "#E53935" },
			},
		},
	},
});

const EmptyState = styled("div", {
	padding: "32px",
	textAlign: "center",
	color: "#666",
	backgroundColor: "#F5F5F5",
	borderRadius: "12px",
});

const OutputsContainer = styled("div", {
	display: "flex",
	flexDirection: "column",
	gap: "8px",
});

const OutputItem = styled("div", {
	padding: "8px",
	backgroundColor: "#E8F5E9",
	borderRadius: "4px",
	fontSize: "12px",
});

const OutputKey = styled("div", {
	fontWeight: "600",
	color: "#1B5E20",
});

const OutputValue = styled("div", {
	fontFamily: "monospace",
	color: "#2E7D32",
	wordBreak: "break-all",
	marginTop: "4px",
});

export default function EnhancedDashboardScreen({ deploymentId: activeDeploymentId = null }) {
	const [deployments, setDeployments] = useState([]);
	const [selectedDeployment, setSelectedDeployment] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [authExpired, setAuthExpired] = useState(false);
	const [scalingInProgress, setScalingInProgress] = useState(false);
	const [scaleStatus, setScaleStatus] = useState({ type: "idle", message: "" });
	const [simSeries, setSimSeries] = useState(() => createInitialSeries(20));
	const [scalingForm, setScalingForm] = useState({
		instanceType: "",
		rdsSize: "",
		minReplicas: "",
		maxReplicas: "",
	});

	const { cpuMetrics, loadingMetrics, usingFallback, metricsError } = useCpuMetrics(selectedDeployment?.deploymentId, authExpired, () => {
		setAuthExpired(true);
		setError("AWS session expired. Please reconnect your AWS credentials and retry.");
	});

	const displayedSeries = simSeries.map((point, index) => {
		const fromReal = cpuMetrics[index];
		return fromReal
			? {
					...point,
					time: fromReal.time || point.time,
					cpu: Number((fromReal.value ?? point.cpu).toFixed(1)),
					max: Number(clamp((fromReal.value ?? point.cpu) + 6, fromReal.value ?? point.cpu, 100).toFixed(1)),
				}
			: point;
	});

	const deploymentStatusData = (() => {
		const acc = { Active: 0, Failed: 0, Destroyed: 0 };
		for (const d of deployments) {
			const s = String(d.status || "").toLowerCase();
			if (s.includes("destroy")) acc.Destroyed += 1;
			else if (s.includes("error") || s.includes("fail") || s.includes("unknown")) acc.Failed += 1;
			else acc.Active += 1;
		}
		if (acc.Active + acc.Failed + acc.Destroyed === 0) acc.Active = 1;
		return Object.entries(acc).map(([name, value]) => ({ name, value }));
	})();

	useEffect(() => {
		const interval = setInterval(() => {
			setSimSeries((prev) => {
				const next = nextPoint(prev[prev.length - 1]);
				return [...prev.slice(Math.max(0, prev.length - 19)), next];
			});
		}, 60000);

		return () => clearInterval(interval);
	}, []);

	// Fetch deployments on mount and when activeDeploymentId changes
	useEffect(() => {
		const fetchDeployments = async () => {
			try {
				const response = await fetch("/api/deployments", {
					credentials: "include",
				});
				const data = await response.json();
				if (data.ok) {
					const allDeployments = data.deployments || [];
					setDeployments(allDeployments);
					const scalableDeployments = allDeployments.filter((d) => d.scalable !== false);
					const preferredList = scalableDeployments.length > 0 ? scalableDeployments : allDeployments;
					if (activeDeploymentId) {
						const deployment = allDeployments.find((d) => d.deploymentId === activeDeploymentId);
						setSelectedDeployment(deployment || preferredList[0]);
					} else if (preferredList.length > 0) {
						setSelectedDeployment(preferredList[0]);
					}
				}
			} catch (err) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		};

		fetchDeployments();
		const interval = setInterval(fetchDeployments, 30000); // Refresh every 30 seconds
		return () => clearInterval(interval);
	}, [activeDeploymentId]);

	const handleScale = async () => {
		if (!selectedDeployment?.deploymentId) {
			setError("Select a deployment before applying scaling changes.");
			setScaleStatus({ type: "error", message: "Select a deployment first." });
			return;
		}
		if (authExpired) {
			setScaleStatus({ type: "error", message: "AWS session expired. Reconnect credentials first." });
			alert("AWS session expired. Reconnect credentials first.");
			return;
		}

		console.log("[scale] starting", { deploymentId: selectedDeployment.deploymentId, scalingForm });
		setScalingInProgress(true);
		setError("Applying scaling changes. This may take a few minutes...");
		setScaleStatus({ type: "progress", message: "Applying scaling changes..." });

		try {
			const response = await fetch(`/api/scale/${selectedDeployment.deploymentId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify(scalingForm),
			});
			console.log("[scale] response", { status: response.status, ok: response.ok });

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				if (response.status === 401) {
					setAuthExpired(true);
					setError("AWS session expired. Please reconnect your AWS credentials and retry.");
					setScaleStatus({ type: "error", message: "AWS session expired. Reconnect credentials first." });
				}
				throw new Error(data.error || `Scaling failed (HTTP ${response.status})`);
			}

			if (!response.body) {
				throw new Error("Scale endpoint returned no stream body");
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value);
				const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

				for (const line of lines) {
					try {
						const json = JSON.parse(line.slice(6));
						console.log("[scale] event", json);
						if (json.type === "progress") {
							setError(json.message || "Scaling in progress...");
							setScaleStatus({ type: "progress", message: json.message || "Scaling in progress..." });
						}
						if (json.type === "error") {
							setError(json.message || "Scaling failed.");
							setScaleStatus({ type: "error", message: json.message || "Scaling failed." });
						}
						if (json.type === "complete") {
							setError("Scaling completed successfully.");
							setScaleStatus({ type: "success", message: "Scaling completed successfully." });
							alert("Scaling completed successfully!");
							setScalingForm({ instanceType: "", rdsSize: "", minReplicas: "", maxReplicas: "" });
						}
					} catch (e) {
						console.error("Parse error:", e);
					}
				}
			}
		} catch (err) {
			setError(`Scaling error: ${err.message}`);
			setScaleStatus({ type: "error", message: `Scaling error: ${err.message}` });
			console.error("[scale] error", err);
			alert(`Scaling error: ${err.message}`);
		} finally {
			setScalingInProgress(false);
		}
	};

	const handleDestroy = async (depId) => {
		if (!window.confirm("Are you sure you want to destroy this deployment? This cannot be undone.")) {
			return;
		}
		if (authExpired) {
			alert("AWS session expired. Reconnect credentials first.");
			return;
		}

		try {
			const response = await fetch(`/api/destroy/${depId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				if (response.status === 401) {
					setAuthExpired(true);
					setError("AWS session expired. Please reconnect your AWS credentials and retry.");
				}
				throw new Error(data.error || `Destroy failed (HTTP ${response.status})`);
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value);
				const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

				for (const line of lines) {
					try {
						const json = JSON.parse(line.slice(6));
						if (json.type === "complete") {
							alert("Deployment destroyed successfully!");
							setDeployments((prev) => prev.filter((d) => d.deploymentId !== depId));
							setSelectedDeployment(null);
						}
					} catch (e) {
						console.error("Parse error:", e);
					}
				}
			}
		} catch (err) {
			alert(`Destroy error: ${err.message}`);
		}
	};

	if (loading) {
		return (
			<Container>
				<StepHeader title="Dashboard" description="Loading..." />
				<div style={{ textAlign: "center", color: "#666" }}>Loading deployments...</div>
			</Container>
		);
	}

	return (
		<Container>
			<StepHeader step={6} title="Infrastructure Dashboard" description="Monitor and manage your AWS deployments" />

			{error && (
				<div
					style={{
						padding: "12px",
						backgroundColor: "#FFCDD2",
						borderRadius: "8px",
						color: "#C62828",
						fontSize: "13px",
					}}>
					✕ {error}
				</div>
			)}

			<Section>
				<SectionTitle>Active Deployments</SectionTitle>
				{deployments.length === 0 ? (
					<EmptyState>No active deployments. Start by deploying infrastructure.</EmptyState>
				) : (
					<DeploymentsGrid>
						{deployments.map((dep) => (
							<DeploymentCard
								key={dep.deploymentId}
								onClick={() => setSelectedDeployment(dep)}
								style={{
									borderColor: selectedDeployment?.deploymentId === dep.deploymentId ? "#4CAF82" : "#E0E0E0",
									backgroundColor: selectedDeployment?.deploymentId === dep.deploymentId ? "#F0F8F5" : "#FAFAFA",
								}}>
								<CardHeader>
									<div>
										<div style={{ fontSize: "14px", fontWeight: "600", color: "#21405E", marginBottom: "4px" }}>{dep.businessConfig?.appName || "Deployment"}</div>
										<DeploymentId>{dep.deploymentId.slice(0, 30)}...</DeploymentId>
									</div>
									<StatusBadge status={dep.status || "active"}>{dep.status || "Active"}</StatusBadge>
								</CardHeader>

								<CardBody>
									<CardRow>
										<CardLabel>Created:</CardLabel>
										<CardValue>{new Date(dep.createdAt).toLocaleDateString()}</CardValue>
									</CardRow>
									<CardRow>
										<CardLabel>Region:</CardLabel>
										<CardValue>{dep.credentials?.region || "N/A"}</CardValue>
									</CardRow>
									<CardRow>
										<CardLabel>Tier:</CardLabel>
										<CardValue>{dep.architecture?.tier || "Standard"}</CardValue>
									</CardRow>
								</CardBody>

								<ButtonGroup>
									<Button variant="primary" onClick={() => setSelectedDeployment(dep)}>
										View
									</Button>
									<Button variant="danger" onClick={() => handleDestroy(dep.deploymentId)}>
										Destroy
									</Button>
								</ButtonGroup>
							</DeploymentCard>
						))}
					</DeploymentsGrid>
				)}
			</Section>

			{selectedDeployment && (
				<>
					<Section>
						<SectionTitle>Performance Metrics</SectionTitle>
						{loadingMetrics && <div style={{ fontSize: "12px", color: "#666" }}>Loading metrics...</div>}
						{usingFallback && <div style={{ fontSize: "12px", color: "#B26A00" }}>Showing fallback metrics while CloudWatch data is unavailable.</div>}
						{metricsError && <div style={{ fontSize: "12px", color: "#C62828" }}>{metricsError}</div>}
						<ChartGrid>
							<ChartContainer>
								<div style={{ fontSize: "13px", fontWeight: 700, color: "#21405E", marginBottom: "8px" }}>CPU Utilization</div>
								<ResponsiveContainer width="100%" height="90%">
									<LineChart data={displayedSeries}>
										<CartesianGrid strokeDasharray="3 3" />
										<XAxis dataKey="time" />
										<YAxis domain={[0, 100]} />
										<Tooltip />
										<Line type="monotone" dataKey="cpu" stroke="#4CAF82" name="CPU %" strokeWidth={2} dot={false} />
										<Line type="monotone" dataKey="max" stroke="#FF9800" name="Peak %" strokeWidth={1.5} dot={false} />
									</LineChart>
								</ResponsiveContainer>
							</ChartContainer>

							<ChartContainer>
								<div style={{ fontSize: "13px", fontWeight: 700, color: "#21405E", marginBottom: "8px" }}>Memory Usage</div>
								<ResponsiveContainer width="100%" height="90%">
									<LineChart data={displayedSeries}>
										<CartesianGrid strokeDasharray="3 3" />
										<XAxis dataKey="time" />
										<YAxis domain={[0, 100]} />
										<Tooltip />
										<Line type="monotone" dataKey="memory" stroke="#3F51B5" name="Memory %" strokeWidth={2} dot={false} />
									</LineChart>
								</ResponsiveContainer>
							</ChartContainer>
						</ChartGrid>
					</Section>

					<Section>
						<SectionTitle>Scaling Activity</SectionTitle>
						<ChartContainer>
							<ResponsiveContainer width="100%" height="100%">
								<LineChart data={displayedSeries}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="time" />
									<YAxis domain={[1, 5]} allowDecimals={false} />
									<Tooltip />
									<Line type="stepAfter" dataKey="instances" stroke="#009688" name="Instance Count" strokeWidth={2} dot />
								</LineChart>
							</ResponsiveContainer>
						</ChartContainer>
					</Section>

					<Section>
						<ChartGrid>
							<ChartContainer>
								<div style={{ fontSize: "13px", fontWeight: 700, color: "#21405E", marginBottom: "8px" }}>Deployment Status Distribution</div>
								<ResponsiveContainer width="100%" height="90%">
									<PieChart>
										<Pie data={deploymentStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label>
											{deploymentStatusData.map((entry, index) => (
												<Cell key={`cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
											))}
										</Pie>
										<Tooltip />
										<Legend />
									</PieChart>
								</ResponsiveContainer>
							</ChartContainer>

							<ChartContainer>
								<div style={{ fontSize: "13px", fontWeight: 700, color: "#21405E", marginBottom: "8px" }}>Estimated Cost Trend</div>
								<ResponsiveContainer width="100%" height="90%">
									<LineChart data={displayedSeries}>
										<CartesianGrid strokeDasharray="3 3" />
										<XAxis dataKey="time" />
										<YAxis />
										<Tooltip formatter={(val) => [`$${val}`, "Estimated Cost"]} />
										<Line type="monotone" dataKey="cost" stroke="#7E57C2" name="USD" strokeWidth={2} dot={false} />
									</LineChart>
								</ResponsiveContainer>
							</ChartContainer>
						</ChartGrid>
					</Section>

					<Section>
						<SectionTitle>Network Traffic</SectionTitle>
						<ChartContainer>
							<ResponsiveContainer width="100%" height="100%">
								<LineChart data={displayedSeries}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="time" />
									<YAxis />
									<Tooltip formatter={(val) => [`${val} MB/s`, "Traffic"]} />
									<Line type="monotone" dataKey="incoming" stroke="#00897B" name="Incoming" strokeWidth={2} dot={false} />
									<Line type="monotone" dataKey="outgoing" stroke="#FF7043" name="Outgoing" strokeWidth={2} dot={false} />
								</LineChart>
							</ResponsiveContainer>
						</ChartContainer>
					</Section>

					<Section>
						<SectionTitle>Scale Resources</SectionTitle>
						<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
							<div>
								<label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Instance Type</label>
								<input
									type="text"
									placeholder="t3.medium"
									value={scalingForm.instanceType}
									onChange={(e) => setScalingForm((prev) => ({ ...prev, instanceType: e.target.value }))}
									style={{
										width: "100%",
										padding: "8px",
										border: "1px solid #E0E0E0",
										borderRadius: "6px",
										fontFamily: "monospace",
										fontSize: "12px",
									}}
								/>
							</div>
							<div>
								<label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>RDS Size</label>
								<input
									type="text"
									placeholder="db.t3.small"
									value={scalingForm.rdsSize}
									onChange={(e) => setScalingForm((prev) => ({ ...prev, rdsSize: e.target.value }))}
									style={{
										width: "100%",
										padding: "8px",
										border: "1px solid #E0E0E0",
										borderRadius: "6px",
										fontFamily: "monospace",
										fontSize: "12px",
									}}
								/>
							</div>
							<div>
								<label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Min Replicas</label>
								<input
									type="number"
									placeholder="2"
									value={scalingForm.minReplicas}
									onChange={(e) => setScalingForm((prev) => ({ ...prev, minReplicas: e.target.value }))}
									style={{
										width: "100%",
										padding: "8px",
										border: "1px solid #E0E0E0",
										borderRadius: "6px",
										fontFamily: "monospace",
										fontSize: "12px",
									}}
								/>
							</div>
							<div>
								<label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Max Replicas</label>
								<input
									type="number"
									placeholder="10"
									value={scalingForm.maxReplicas}
									onChange={(e) => setScalingForm((prev) => ({ ...prev, maxReplicas: e.target.value }))}
									style={{
										width: "100%",
										padding: "8px",
										border: "1px solid #E0E0E0",
										borderRadius: "6px",
										fontFamily: "monospace",
										fontSize: "12px",
									}}
								/>
							</div>
						</div>
						<Button variant="primary" style={{ marginTop: "12px" }} onClick={handleScale} disabled={scalingInProgress}>
							{scalingInProgress ? "Applying Scaling..." : "Apply Scaling Changes"}
						</Button>
						{scaleStatus.message && (
							<div
								style={{
									marginTop: "8px",
									fontSize: "12px",
									fontWeight: 600,
									color: scaleStatus.type === "error" ? "#C62828" : scaleStatus.type === "success" ? "#2E7D32" : "#1565C0",
								}}>
								{scaleStatus.message}
							</div>
						)}
					</Section>

					{selectedDeployment.outputs && (
						<Section>
							<SectionTitle>Resource Outputs</SectionTitle>
							<OutputsContainer>
								{Object.entries(selectedDeployment.outputs).map(([key, value]) => (
									<OutputItem key={key}>
										<OutputKey>{key}</OutputKey>
										<OutputValue>{typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}</OutputValue>
									</OutputItem>
								))}
							</OutputsContainer>
						</Section>
					)}
				</>
			)}
		</Container>
	);
}
