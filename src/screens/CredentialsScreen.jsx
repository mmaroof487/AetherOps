import React, { useState } from "react";
import { Syne, Mono, Alert, Check } from "../components/ui/Atoms";
import { StepHeader } from "../components/ui/Common";
import { styled } from "../stitches.config";

const Container = styled("div", {
	display: "flex",
	flexDirection: "column",
	gap: "24px",
	maxWidth: "600px",
	margin: "0 auto",
	padding: "32px",
});

const Form = styled("form", {
	display: "flex",
	flexDirection: "column",
	gap: "20px",
});

const FormGroup = styled("div", {
	display: "flex",
	flexDirection: "column",
	gap: "8px",
});

const Label = styled("label", {
	fontWeight: "600",
	fontSize: "14px",
	color: "#21405E",
});

const Input = styled("input", {
	padding: "12px",
	border: "2px solid #E0E0E0",
	borderRadius: "8px",
	fontSize: "14px",
	fontFamily: "monospace",
	transition: "all 0.2s",
	"&:focus": {
		outline: "none",
		borderColor: "#4CAF82",
		boxShadow: "0 0 0 3px rgba(76, 175, 130, 0.1)",
	},
	"&::placeholder": {
		color: "#AAA",
	},
});

const Select = styled("select", {
	padding: "12px",
	border: "2px solid #E0E0E0",
	borderRadius: "8px",
	fontSize: "14px",
	backgroundColor: "#FFF",
	transition: "all 0.2s",
	"&:focus": {
		outline: "none",
		borderColor: "#4CAF82",
		boxShadow: "0 0 0 3px rgba(76, 175, 130, 0.1)",
	},
});

const ButtonGroup = styled("div", {
	display: "flex",
	gap: "12px",
	justifyContent: "center",
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
				"&:hover": { backgroundColor: "#3A9969", transform: "translateY(-2px)", boxShadow: "0 4px 12px rgba(76, 175, 130, 0.3)" },
			},
			secondary: {
				backgroundColor: "#F5F5F5",
				color: "#21405E",
				border: "2px solid #E0E0E0",
				"&:hover": { backgroundColor: "#EFEFEF", transform: "translateY(-2px)" },
			},
		},
	},

	defaultVariants: {
		variant: "primary",
	},
});

const InfoBox = styled("div", {
	padding: "16px",
	backgroundColor: "#E8F5E9",
	border: "1px solid #A5D6A7",
	borderRadius: "8px",
	fontSize: "13px",
	color: "#1B5E20",
	lineHeight: "1.6",
});

const WarningBox = styled("div", {
	padding: "16px",
	backgroundColor: "#FFF3E0",
	border: "1px solid #FFB74D",
	borderRadius: "8px",
	fontSize: "13px",
	color: "#E65100",
	lineHeight: "1.6",
});

const StatusMessage = styled("div", {
	padding: "12px",
	borderRadius: "8px",
	fontSize: "14px",
	fontWeight: "500",

	variants: {
		status: {
			success: {
				backgroundColor: "#C8E6C9",
				color: "#2E7D32",
				display: "flex",
				alignItems: "center",
				gap: "8px",
			},
			error: {
				backgroundColor: "#FFCDD2",
				color: "#C62828",
				display: "flex",
				alignItems: "center",
				gap: "8px",
			},
			loading: {
				backgroundColor: "#E3F2FD",
				color: "#1565C0",
				display: "flex",
				alignItems: "center",
				gap: "8px",
			},
		},
	},
});

const AWS_REGIONS = [
	{ value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
	{ value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
	{ value: "us-east-1", label: "US East (N. Virginia)" },
	{ value: "us-west-2", label: "US West (Oregon)" },
	{ value: "eu-west-1", label: "Europe (Ireland)" },
];

export default function CredentialsScreen({ repoUrl = "", onRepoUrlChange, onCredentialsSet, onSkip }) {
	const [formData, setFormData] = useState({
		accessKeyId: "",
		secretAccessKey: "",
		region: "ap-south-1",
	});

	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState(null);

	const handleChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!formData.accessKeyId.trim() || !formData.secretAccessKey.trim()) {
			setMessage({ type: "error", text: "Please enter both Access Key ID and Secret Key" });
			return;
		}

		setLoading(true);
		setMessage({ type: "loading", text: "Verifying AWS credentials..." });

		try {
			const response = await fetch("/api/auth/set-credentials", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify(formData),
			});

			const data = await response.json();

			if (data.ok) {
				setMessage({
					type: "success",
					text: `✓ Credentials verified! Found ${data.bucketCount} S3 buckets.`,
				});
				setTimeout(() => {
					if (onCredentialsSet) onCredentialsSet(formData);
				}, 1500);
			} else {
				setMessage({ type: "error", text: `Error: ${data.error}` });
			}
		} catch (err) {
			setMessage({
				type: "error",
				text: `Connection error: ${err.message}. Make sure backend is running on port 3001.`,
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<Container>
			<StepHeader step={0} title="Connect Your AWS Account" description="Provide your AWS credentials to enable infrastructure deployment" />

			<Form onSubmit={handleSubmit}>
				<InfoBox>💡 Your credentials are stored locally in your browser session (24-hour expiration) and used only to deploy infrastructure to your AWS account.</InfoBox>

				<FormGroup>
					<Label htmlFor="repoUrl">GitHub Repository URL</Label>
					<Input id="repoUrl" name="repoUrl" type="url" placeholder="https://github.com/user/app" value={repoUrl} onChange={(e) => onRepoUrlChange && onRepoUrlChange(e.target.value)} disabled={loading} />
				</FormGroup>

				<FormGroup>
					<Label htmlFor="accessKeyId">AWS Access Key ID</Label>
					<Input id="accessKeyId" name="accessKeyId" type="text" placeholder="AKIA..." value={formData.accessKeyId} onChange={handleChange} disabled={loading} />
				</FormGroup>

				<FormGroup>
					<Label htmlFor="secretAccessKey">AWS Secret Access Key</Label>
					<Input id="secretAccessKey" name="secretAccessKey" type="password" placeholder="••••••••••••••••••" value={formData.secretAccessKey} onChange={handleChange} disabled={loading} />
				</FormGroup>

				<FormGroup>
					<Label htmlFor="region">AWS Region</Label>
					<Select id="region" name="region" value={formData.region} onChange={handleChange} disabled={loading}>
						{AWS_REGIONS.map((r) => (
							<option key={r.value} value={r.value}>
								{r.label}
							</option>
						))}
					</Select>
				</FormGroup>

				{message && (
					<StatusMessage status={message.type}>
						{message.type === "loading" && <span>⏳</span>}
						{message.type === "success" && <span>✓</span>}
						{message.type === "error" && <span>✕</span>}
						{message.text}
					</StatusMessage>
				)}

				<WarningBox>⚠️ Keep your credentials secret. Never share them in chat, emails, or public repositories.</WarningBox>

				<ButtonGroup>
					<Button type="submit" variant="primary" disabled={loading}>
						{loading ? "Verifying..." : "Connect AWS Account"}
					</Button>
					<Button type="button" variant="secondary" onClick={onSkip} disabled={loading}>
						Skip for Now
					</Button>
				</ButtonGroup>
			</Form>
		</Container>
	);
}
