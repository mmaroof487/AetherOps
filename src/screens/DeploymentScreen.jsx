import React, { useState, useEffect, useRef } from "react";
import { Syne, Mono, Spin } from "../components/ui/Atoms";
import { StepHeader } from "../components/ui/Common";
import { AlertTriangle } from "lucide-react";
import { styled } from "../stitches.config";

const Container = styled("div", {
	display: "flex",
	flexDirection: "column",
	gap: "24px",
	maxWidth: "800px",
	margin: "0 auto",
	padding: "32px",
});

const ProgressContainer = styled("div", {
	display: "flex",
	flexDirection: "column",
	gap: "16px",
});

const ProgressStep = styled("div", {
	display: "flex",
	alignItems: "center",
	gap: "12px",
	padding: "12px",
	borderRadius: "8px",
	backgroundColor: "#F5F5F5",
});

const StepIndicator = styled("div", {
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	width: "32px",
	height: "32px",
	borderRadius: "50%",
	fontWeight: "600",
	fontSize: "14px",
	flexShrink: 0,

	variants: {
		status: {
			pending: {
				backgroundColor: "#E0E0E0",
				color: "#666",
			},
			active: {
				backgroundColor: "#4CAF82",
				color: "#FFF",
			},
			complete: {
				backgroundColor: "#4CAF82",
				color: "#FFF",
			},
		},
	},
});

const StepContent = styled("div", {
	display: "flex",
	flexDirection: "column",
	gap: "4px",
	flex: 1,
});

const StepTitle = styled("div", {
	fontSize: "14px",
	fontWeight: "600",
	color: "#21405E",
});

const StepMessage = styled("div", {
	fontSize: "13px",
	color: "#666",
});

const LogPanel = styled("div", {
	backgroundColor: "#1E1E1E",
	color: "#D4D4D4",
	padding: "16px",
	borderRadius: "8px",
	fontFamily: "monospace",
	fontSize: "12px",
	maxHeight: "300px",
	overflowY: "auto",
	lineHeight: "1.5",
});

const LogLine = styled("div", {
	color: "#D4D4D4",

	variants: {
		type: {
			progress: { color: "#4EC9B0" },
			warning: { color: "#CE9178" },
			error: { color: "#F48771" },
			success: { color: "#6A9955" },
			info: { color: "#9CDCFE" },
		},
	},
});

const OutputsContainer = styled("div", {
	display: "flex",
	flexDirection: "column",
	gap: "12px",
});

const OutputItem = styled("div", {
	padding: "12px",
	backgroundColor: "#E8F5E9",
	border: "1px solid #A5D6A7",
	borderRadius: "8px",
});

const OutputKey = styled("div", {
	fontWeight: "600",
	fontSize: "13px",
	color: "#1B5E20",
	marginBottom: "4px",
});

const OutputValue = styled("div", {
	fontFamily: "monospace",
	fontSize: "12px",
	color: "#2E7D32",
	wordBreak: "break-all",
});

const Button = styled("button", {
	padding: "12px 24px",
	fontSize: "14px",
	fontWeight: "600",
	border: "none",
	borderRadius: "8px",
	cursor: "pointer",
	transition: "all 0.2s",

	variants: {
		variant: {
			primary: {
				backgroundColor: "#4CAF82",
				color: "#FFF",
				"&:hover": { backgroundColor: "#3A9969" },
			},
			secondary: {
				backgroundColor: "#F5F5F5",
				color: "#21405E",
				border: "2px solid #E0E0E0",
			},
		},
	},
});

const ButtonGroup = styled("div", {
	display: "flex",
	gap: "12px",
	justifyContent: "center",
});

export default function DeploymentScreen({ architecture, businessConfig, onComplete, onCancel }) {
	const [steps, setSteps] = useState([
		{ id: 1, title: "Initializing Terraform", message: "Waiting to start...", status: "pending" },
		{ id: 2, title: "Validating Configuration", message: "Waiting...", status: "pending" },
		{ id: 3, title: "Planning Changes", message: "Waiting...", status: "pending" },
		{ id: 4, title: "Applying Infrastructure", message: "Waiting...", status: "pending" },
		{ id: 5, title: "Retrieving Resources", message: "Waiting...", status: "pending" },
	]);

	const [logs, setLogs] = useState([]);
	const [deploymentId, setDeploymentId] = useState(null);
	const [outputs, setOutputs] = useState(null);
	const [deploymentComplete, setDeploymentComplete] = useState(false);
	const [error, setError] = useState(null);
	const logsEndRef = useRef(null);
	const appPublicIp = outputs?.app_public_ip?.value;
	const appUrl = appPublicIp ? `http://${appPublicIp}:3000` : null;

	useEffect(() => {
		logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [logs]);

	const hasDeployed = useRef(false);

	useEffect(() => {
		if (hasDeployed.current) return;
		
		if (!architecture) {
			setError("No architecture provided");
			return;
		}

		hasDeployed.current = true;

		const deploy = async () => {
			try {
				const response = await fetch("/api/deploy", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({ architecture, businessConfig }),
				});

				if (!response.ok) {
					if (response.status === 401) {
						setError("AWS Credentials missing. Your session may have expired. Please go back and provide your credentials.");
						addLog({ type: "error", message: "Deployment aborted: Missing AWS credentials. Redirecting to settings..." });
						return;
					}
					throw new Error(`Server error (${response.status}): Generation failed. Check if Ollama is running.`);
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
							addLog(json);
							updateSteps(json);
						} catch (e) {
							console.error("Parse error:", e);
						}
					}
				}
			} catch (err) {
				setError(err.message);
				addLog({ type: "error", message: `Deployment failed: ${err.message}` });
			}
		};

		deploy();
	}, [architecture]);

	const addLog = (event) => {
		if (event.type === "progress") {
			setLogs((prev) => [...prev, { type: "progress", message: event.message }]);
		} else if (event.type === "error") {
			setLogs((prev) => [...prev, { type: "error", message: event.message }]);
			setError(event.message);
		} else if (event.type === "warning") {
			setLogs((prev) => [...prev, { type: "warning", message: event.message }]);
		} else if (event.type === "complete") {
			setDeploymentId(event.deploymentId);
			setOutputs(event.outputs);
			setDeploymentComplete(true);
			setLogs((prev) => [...prev, { type: "success", message: `Deployment complete! ID: ${event.deploymentId}` }]);
		}
	};

	const updateSteps = (event) => {
		if (event.type === "progress" && event.step) {
			setSteps((prev) => prev.map((s) => (s.id <= event.step ? { ...s, status: s.id === event.step ? "active" : "complete", message: event.message } : s)));
		} else if (event.type === "complete") {
			setSteps((prev) => prev.map((s) => ({ ...s, status: "complete" })));
		}
	};

	return (
		<Container>
			<StepHeader step={5} title="Deploying to AWS" description="Your infrastructure is being created in real-time" />

			<ProgressContainer>
				{steps.map((step) => (
					<ProgressStep key={step.id}>
						<StepIndicator status={step.status}>{step.status === "active" ? <Spin size={16} /> : step.status === "complete" ? "✓" : step.id}</StepIndicator>
						<StepContent>
							<StepTitle>{step.title}</StepTitle>
							<StepMessage>{step.message}</StepMessage>
						</StepContent>
					</ProgressStep>
				))}
			</ProgressContainer>

			<div>
				<h3 style={{ margin: "16px 0 8px 0", fontSize: "14px", fontWeight: "600" }}>Deployment Log</h3>
				<LogPanel>
					{logs.map((log, i) => (
						<LogLine key={i} type={log.type}>
							[{log.type.toUpperCase()}] {log.message}
						</LogLine>
					))}
					<div ref={logsEndRef} />
				</LogPanel>
			</div>

			{deploymentComplete && outputs && (
				<div>
					<h3 style={{ margin: "16px 0 8px 0", fontSize: "14px", fontWeight: "600" }}>Deployment Outputs</h3>
					{appUrl && (
						<div
							style={{
								padding: "12px",
								backgroundColor: "#E8F5E9",
								border: "1px solid #A5D6A7",
								borderRadius: "8px",
								marginBottom: "12px",
								fontSize: "13px",
							}}>
							<strong>App URL:</strong> {appUrl}
						</div>
					)}
					<OutputsContainer>
						{Object.entries(outputs).map(([key, value]) => (
							<OutputItem key={key}>
								<OutputKey>{key}</OutputKey>
								<OutputValue>{typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}</OutputValue>
							</OutputItem>
						))}
					</OutputsContainer>
				</div>
			)}

			{error && (
				<div
					style={{
						padding: "16px",
						background: "#FFCDD2",
						borderRadius: "12px",
						color: "#C62828",
						marginBottom: "24px",
						display: "flex",
						flexDirection: "column",
						gap: "12px",
					}}>
					<div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
						<AlertTriangle size={20} />
						Deployment Failed
					</div>
					<div style={{ fontSize: "14px" }}>{error}</div>
					<button
						className="btn-g"
						onClick={onCancel}
						style={{
							alignSelf: "flex-start",
							backgroundColor: "#C62828",
							color: "white",
							border: "none",
							padding: "8px 16px",
						}}>
						← Back to Credentials
					</button>
				</div>
			)}

			<ButtonGroup>
				{deploymentComplete && (
					<Button variant="primary" onClick={() => onComplete && onComplete(deploymentId, outputs)}>
						Go to Dashboard
					</Button>
				)}
				{!deploymentComplete && (
					<Button variant="secondary" onClick={onCancel}>
						Cancel Deployment
					</Button>
				)}
			</ButtonGroup>
		</Container>
	);
}
