import { useState, useEffect, useRef } from "react";

export function MermaidDiagram({ code }) {
	const ref = useRef(null);

	return (
		<div
			ref={ref}
			style={{
				padding: "30px",
				color: "#666",
				fontSize: 14,
				textAlign: "center",
				border: "1px solid #ddd",
				borderRadius: "8px",
				backgroundColor: "#f9f9f9",
			}}>
			<div style={{ marginBottom: "10px", fontWeight: "bold" }}>Architecture Diagram</div>
			<div style={{ fontSize: 12, color: "#999" }}>{code ? code.split("\n").slice(0, 3).join("\n") : "No diagram data"}</div>
		</div>
	);
}
