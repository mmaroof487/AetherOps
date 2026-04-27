const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const cleanupCode = `
// Background cleanup for old deployments (older than 24 hours)
const CLEANUP_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

function cleanupOldDeployments() {
	try {
		const now = Date.now();
		const files = fs.readdirSync(DEPLOYMENTS_DIR);
		for (const file of files) {
			const filePath = path.join(DEPLOYMENTS_DIR, file);
			const stats = fs.statSync(filePath);
			if (stats.isDirectory() && now - stats.mtimeMs > MAX_AGE_MS) {
				fs.rmSync(filePath, { recursive: true, force: true });
				console.log(\`[Cleanup] Deleted old deployment: \${file}\`);
			}
		}
	} catch (err) {
		console.error("[Cleanup Error]", err.message);
	}
}

// Run cleanup on startup, then periodically
cleanupOldDeployments();
setInterval(cleanupOldDeployments, CLEANUP_INTERVAL_MS);
`;

const targetContent = "if (!fs.existsSync(DEPLOYMENTS_DIR)) fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });";

if (code.includes(targetContent)) {
    code = code.replace(targetContent, targetContent + "\n" + cleanupCode);
    fs.writeFileSync('backend/server.js', code);
    console.log("Cleanup added successfully.");
} else {
    console.log("Could not find target content.");
}
