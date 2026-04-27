import React, { useState, useEffect } from "react";
import { Syne, Mono } from "../components/ui/Atoms";
import { StepHeader } from "../components/ui/Common";
import { styled } from "../stitches.config";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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
	const [metrics, setMetrics] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [scalingForm, setScalingForm] = useState({
		instanceType: "",
		rdsSize: "",
		minReplicas: "",
		maxReplicas: "",
	});

	// Fetch deployments on mount and when activeDeploymentId changes
	useEffect(() => {
		const fetchDeployments = async () => {
			try {
				const response = await fetch("/api/deployments", {
					credentials: "include",
				});
				const data = await response.json();
				if (data.ok) {
					setDeployments(data.deployments || []);
					if (activeDeploymentId) {
						const deployment = data.deployments.find((d) => d.deploymentId === activeDeploymentId);
						setSelectedDeployment(deployment || data.deployments[0]);
					} else if (data.deployments.length > 0) {
						setSelectedDeployment(data.deployments[0]);
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

	// Fetch metrics for selected deployment
	useEffect(() => {
		if (!selectedDeployment?.deploymentId) return;

		const fetchMetrics = async () => {
			try {
				const response = await fetch(`/api/metrics/${selectedDeployment.deploymentId}`, { credentials: "include" });
				const data = await response.json();
				if (data.ok) {
					// Convert AWS metrics to chart format
					const chartData = (data.metrics || [])
						.sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp))
						.slice(-20) // Last 20 datapoints
						.map((m) => ({
							time: new Date(m.Timestamp).toLocaleTimeString(),
							cpu: m.Average || 0,
							max: m.Maximum || 0,
						}));
					setMetrics(chartData);
				}
			} catch (err) {
				console.error("Metrics error:", err);
			}
		};

		fetchMetrics();
		const interval = setInterval(fetchMetrics, 60000); // Refresh every 60 seconds
		return () => clearInterval(interval);
	}, [selectedDeployment?.deploymentId]);

	const handleScale = async () => {
		if (!selectedDeployment?.deploymentId) return;

		try {
			const response = await fetch(`/api/scale/${selectedDeployment.deploymentId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify(scalingForm),
			});

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
							alert("Scaling completed successfully!");
							setScalingForm({ instanceType: "", rdsSize: "", minReplicas: "", maxReplicas: "" });
						}
					} catch (e) {
						console.error("Parse error:", e);
					}
				}
			}
		} catch (err) {
			alert(`Scaling error: ${err.message}`);
		}
	};

	const handleDestroy = async (depId) => {
		if (!window.confirm("Are you sure you want to destroy this deployment? This cannot be undone.")) {
			return;
		}

		try {
			const response = await fetch(`/api/destroy/${depId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
			});

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
						{metrics.length > 0 ? (
							<ChartContainer>
								<ResponsiveContainer width="100%" height="100%">
									<LineChart data={metrics}>
										<CartesianGrid strokeDasharray="3 3" />
										<XAxis dataKey="time" />
										<YAxis />
										<Tooltip />
										<Line type="monotone" dataKey="cpu" stroke="#4CAF82" name="CPU %" />
										<Line type="monotone" dataKey="max" stroke="#FF9800" name="Max %" />
									</LineChart>
								</ResponsiveContainer>
							</ChartContainer>
						) : (
							<EmptyState>No metrics available yet. Check again in a moment.</EmptyState>
						)}
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
						<Button variant="primary" style={{ marginTop: "12px" }} onClick={handleScale}>
							Apply Scaling Changes
						</Button>
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
