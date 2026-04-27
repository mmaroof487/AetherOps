// Error Boundary Component
import React from "react";
import { C } from "../utils/theme";

export class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error) {
		return { hasError: true, error };
	}

	componentDidCatch(error, errorInfo) {
		console.error("ErrorBoundary caught:", error, errorInfo);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div
					style={{
						padding: "40px 20px",
						textAlign: "center",
						background: `${C.red}12`,
						borderRadius: 14,
						margin: "20px",
					}}>
					<h2 style={{ color: C.red, marginBottom: 12 }}>⚠️ Something went wrong</h2>
					<p style={{ color: C.muted, marginBottom: 20 }}>{this.state.error?.message || "An unexpected error occurred"}</p>
					<button className="btn-p" onClick={() => window.location.reload()} style={{ padding: "12px 24px" }}>
						🔄 Reload Page
					</button>
				</div>
			);
		}

		return this.props.children;
	}
}

// Global error handler for API calls
export class APIError extends Error {
	constructor(message, status, details = {}) {
		super(message);
		this.name = "APIError";
		this.status = status;
		this.details = details;
	}
}

export const handleApiError = (error, context = "Unknown operation") => {
	if (error instanceof APIError) {
		console.error(`API Error (${error.status}) in ${context}:`, error.message, error.details);
		return {
			title: "Request Failed",
			message: error.message || `Failed to ${context.toLowerCase()}`,
			retryable: error.status >= 500 || error.status === 0,
		};
	}

	if (error instanceof TypeError) {
		console.error(`Network Error in ${context}:`, error);
		return {
			title: "Network Error",
			message: "Unable to connect. Check your internet connection.",
			retryable: true,
		};
	}

	console.error(`Unexpected Error in ${context}:`, error);
	return {
		title: "Unexpected Error",
		message: "An unexpected error occurred. Please try again.",
		retryable: true,
	};
};

// Retry logic with exponential backoff
export const retryWithBackoff = async (fn, maxRetries = 3, delay = 1000) => {
	let lastError;

	for (let i = 0; i < maxRetries; i++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			if (i < maxRetries - 1) {
				const waitTime = delay * Math.pow(2, i);
				console.log(`Retry attempt ${i + 1}/${maxRetries} after ${waitTime}ms`);
				await new Promise((r) => setTimeout(r, waitTime));
			}
		}
	}

	throw lastError;
};

// Validation helpers
export const validateJSON = (str) => {
	try {
		JSON.parse(str);
		return { valid: true };
	} catch (e) {
		return { valid: false, error: e.message };
	}
};

export const validateTerraformSyntax = (terraform) => {
	const errors = [];

	// Check for common syntax errors
	if (!terraform.includes("terraform")) errors.push("Missing terraform block");
	if (!terraform.includes("provider")) errors.push("Missing provider block");
	if (!terraform.includes("resource")) errors.push("No resources defined");

	// Check for unclosed braces
	const openBraces = (terraform.match(/\{/g) || []).length;
	const closeBraces = (terraform.match(/\}/g) || []).length;
	if (openBraces !== closeBraces) errors.push("Unbalanced braces");

	return {
		valid: errors.length === 0,
		errors,
	};
};
