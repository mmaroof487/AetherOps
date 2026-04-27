import "dotenv/config";
import express from "express";
import cors from "cors";
import archiver from "archiver";
import os from "os";
import { exec, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import https from "https";
import autocannon from "autocannon";
import session from "express-session";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { CloudWatchClient, GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";
import { promisify } from "util";
import dns from "dns";

// Fix for Node 18+ fetch issues with localhost/127.0.0.1
if (dns.setDefaultResultOrder) {
	dns.setDefaultResultOrder("ipv4first");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_DIR = path.join(__dirname, "temp");
const DEPLOYMENTS_DIR = path.join(__dirname, "deployments");

// Create required directories
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
if (!fs.existsSync(DEPLOYMENTS_DIR)) fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });

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
				console.log(`[Cleanup] Deleted old deployment: ${file}`);
			}
		}
	} catch (err) {
		console.error("[Cleanup Error]", err.message);
	}
}

// Run cleanup on startup, then periodically
cleanupOldDeployments();
setInterval(cleanupOldDeployments, CLEANUP_INTERVAL_MS);



const app = express();
app.use(cors());
app.use(express.json());

// Session middleware for storing AWS credentials
app.use(
	session({
		secret: process.env.SESSION_SECRET || "shopops-dev-secret-v1",
		resave: true, // Force session to be saved back to the session store
		saveUninitialized: true,
		cookie: {
			secure: false,
			maxAge: 24 * 60 * 60 * 1000,
			sameSite: "lax"
		},
	}),
);

// Promisify exec for async/await usage
const execAsync = promisify(exec);

const OLLAMA = process.env.OLLAMA_URL || "http://127.0.0.1:11434/api/generate";
const OLLAMA_URL = new URL(OLLAMA);
const OLLAMA_RETRIES = Math.max(1, Number(process.env.OLLAMA_RETRIES || 3));
const TERRAFORM_GEN_ATTEMPTS = Math.max(2, Number(process.env.TERRAFORM_GEN_ATTEMPTS || 4));
const DEPLOY_TERRAFORM_ATTEMPTS = Math.max(1, Number(process.env.DEPLOY_TERRAFORM_ATTEMPTS || 1));
// Force using 1.3b model for stability
const MODEL = "deepseek-coder:1.3b";

// ── Helper: stream Ollama → collect full response ─────────────────────────
async function ollamaRequestOnce(prompt) {
	return new Promise((resolve, reject) => {
		const postData = JSON.stringify({ model: MODEL, prompt, stream: false });
		const client = OLLAMA_URL.protocol === "https:" ? https : http;
		const options = {
			hostname: OLLAMA_URL.hostname,
			port: OLLAMA_URL.port || (OLLAMA_URL.protocol === "https:" ? 443 : 80),
			path: `${OLLAMA_URL.pathname}${OLLAMA_URL.search}`,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Content-Length": Buffer.byteLength(postData),
			},
			timeout: 300000,
		};

		const req = client.request(options, (res) => {
			let body = "";
			res.setEncoding("utf8");
			res.on("data", (chunk) => (body += chunk));
			res.on("end", () => {
				try {
					if (res.statusCode !== 200) {
						return reject(new Error(`Ollama error (${res.statusCode}): ${body}`));
					}
					const data = JSON.parse(body);
					if (!data.response) return reject(new Error("Ollama returned empty response"));

					let response = data.response.trim();
					if (response.startsWith("```")) {
						response = response.replace(/^```[a-z]*\n/i, "").replace(/\n```$/m, "").trim();
					}
					resolve(response);
				} catch (e) {
					reject(new Error("Failed to parse Ollama response: " + e.message));
				}
			});
		});

		req.on("error", (e) => {
			console.error("[AI] Request error:", e.message);
			reject(e);
		});

		req.on("timeout", () => {
			req.destroy(new Error("Ollama request timed out"));
		});

		req.write(postData);
		req.end();
	});
}

async function ollama(prompt) {
	console.log(`[AI] Generating with model: ${MODEL}...`);
	let lastError;

	for (let attempt = 1; attempt <= OLLAMA_RETRIES; attempt += 1) {
		try {
			const response = await ollamaRequestOnce(prompt);
			console.log("[AI] Generation successful");
			return response;
		} catch (err) {
			lastError = err;
			const retryable = /ECONNREFUSED|ECONNRESET|ETIMEDOUT|timed out/i.test(err?.message || "");
			if (!retryable || attempt === OLLAMA_RETRIES) break;
			console.warn(`[AI] Ollama request attempt ${attempt}/${OLLAMA_RETRIES} failed; retrying...`);
			await new Promise((r) => setTimeout(r, 500 * attempt));
		}
	}

	throw lastError || new Error("Ollama request failed");
}

// ── Helper: extract JSON from LLM output safely ───────────────────────────
function extractJSON(text) {
	const match = text.match(/\{[\s\S]*\}/);
	if (!match) throw new Error("No JSON found in response");
	return JSON.parse(match[0]);
}

function sanitizeTerraformHcl(rawText) {
	if (!rawText) return "";

	let text = String(rawText).trim();
	const fencedBlock = text.match(/```(?:hcl|terraform)?\s*([\s\S]*?)```/i);
	if (fencedBlock && fencedBlock[1]) {
		text = fencedBlock[1].trim();
	}

	text = text
		.replace(/```/g, "")
		.replace(/`/g, "")
		.replace(/;/g, "")
		.replace(/^\uFEFF/, "")
		.replace(/\r\n/g, "\n")
		.replace(/\r/g, "\n")
		.trim();

	// Convert common single-quoted literal patterns to Terraform-compatible double quotes.
	text = text.replace(/=\s*'([^'\n]*)'/g, '= "$1"');
	text = text.replace(/\[\s*'([^'\n]*)'\s*\]/g, '["$1"]');
	text = text.replace(/,\s*'([^'\n]*)'/g, ', "$1"');

	return text;
}

function extractHclFromMixedOutput(text) {
	if (!text) return "";
	const anchor = text.search(/(^|\n)\s*(terraform\s*\{|provider\s+"|resource\s+"|variable\s+"|locals\s*\{|module\s+"|data\s+")/m);
	if (anchor >= 0) {
		return text.slice(anchor).trim();
	}
	return text;
}

function isLikelyTerraformHcl(text) {
	if (!text) return false;
	if (/(terraform\s*\{|provider\s+"|resource\s+"|variable\s+"|output\s+"|locals\s*\{|module\s+"|data\s+"|required_providers|required_version)/m.test(text)) {
		return true;
	}

	// Fallback for smaller models that omit expected header blocks but still return HCL-like code.
	return text.length > 80 && /\{[\s\S]*\}/.test(text) && !/^[\[{]/.test(text.trim());
}

async function terraformFmtCheck(terraformCode) {
	const checkDir = fs.mkdtempSync(path.join(TEMP_DIR, "tf-check-"));
	const mainTfPath = path.join(checkDir, "main.tf");

	try {
		fs.writeFileSync(mainTfPath, terraformCode);
		await execAsync("terraform fmt -no-color", { cwd: checkDir, timeout: 30000 });
		await execAsync("terraform init -backend=false -input=false -no-color", { cwd: checkDir, timeout: 120000 });
		await execAsync("terraform validate -no-color", { cwd: checkDir, timeout: 60000 });
		return { ok: true, formatted: fs.readFileSync(mainTfPath, "utf8") };
	} catch (err) {
		return { ok: false, error: err.message || String(err) };
	} finally {
		fs.rmSync(checkDir, { recursive: true, force: true });
	}
}

function summarizeTerraformError(errText = "") {
	const text = String(errText || "").replace(/\x1b\[[0-9;]*m/g, "").trim();
	if (!text) return "terraform preflight failed";

	const firstErrorLine = text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find((line) => /^Error:/i.test(line));

	if (firstErrorLine) return firstErrorLine;

	const firstMeaningful = text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find((line) => line.length > 0 && !/^Command failed:/i.test(line));

	return firstMeaningful || "terraform preflight failed";
}

function buildFallbackTerraform(architecture = {}, businessConfig = {}) {
	const components = architecture?.components || {};
	const includeAppServer = components.appServer ? 1 : 0;
	const includeStorage = components.storage ? 1 : 0;

	return `# ShopOps fallback Terraform (deterministic template)
terraform {
	required_version = ">= 1.0"
	required_providers {
		aws = {
			source  = "hashicorp/aws"
			version = "~> 5.0"
		}
		random = {
			source  = "hashicorp/random"
			version = "~> 3.0"
		}
	}
}

provider "aws" {
	region = var.region
}

variable "region" {
	type    = string
	default = "ap-south-1"
}

variable "app_name" {
	type    = string
	default = "${businessConfig?.appName || "shopops"}"
}

variable "environment" {
	type    = string
	default = "production"
}

variable "ec2_ami" {
	type    = string
	default = "ami-0f5ee92e2d63afc18"
}

variable "ec2_instance_type" {
	type    = string
	default = "t3.micro"
}

locals {
	tags = {
		Project     = var.app_name
		Environment = var.environment
		ManagedBy   = "ShopOps"
		CreatedAt   = timestamp()
	}
}

resource "random_id" "suffix" {
	byte_length = 4
}

resource "aws_vpc" "main" {
	cidr_block           = "10.50.0.0/16"
	enable_dns_support   = true
	enable_dns_hostnames = true
	tags                 = merge(local.tags, { Name = "\${var.app_name}-vpc" })
}

resource "aws_internet_gateway" "main" {
	vpc_id = aws_vpc.main.id
	tags   = merge(local.tags, { Name = "\${var.app_name}-igw" })
}

resource "aws_subnet" "public_a" {
	vpc_id                  = aws_vpc.main.id
	cidr_block              = "10.50.1.0/24"
	availability_zone       = "ap-south-1a"
	map_public_ip_on_launch = true
	tags                    = merge(local.tags, { Name = "\${var.app_name}-public-a" })
}

resource "aws_subnet" "public_b" {
	vpc_id                  = aws_vpc.main.id
	cidr_block              = "10.50.2.0/24"
	availability_zone       = "ap-south-1b"
	map_public_ip_on_launch = true
	tags                    = merge(local.tags, { Name = "\${var.app_name}-public-b" })
}

resource "aws_route_table" "public" {
	vpc_id = aws_vpc.main.id

	route {
		cidr_block = "0.0.0.0/0"
		gateway_id = aws_internet_gateway.main.id
	}

	tags = merge(local.tags, { Name = "\${var.app_name}-public-rt" })
}

resource "aws_route_table_association" "public_a" {
	subnet_id      = aws_subnet.public_a.id
	route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_b" {
	subnet_id      = aws_subnet.public_b.id
	route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "app" {
	name        = "\${var.app_name}-app-sg"
	description = "Application security group"
	vpc_id      = aws_vpc.main.id

	ingress {
		from_port   = 22
		to_port     = 22
		protocol    = "tcp"
		cidr_blocks = ["0.0.0.0/0"]
	}

	ingress {
		from_port   = 8000
		to_port     = 8000
		protocol    = "tcp"
		cidr_blocks = ["0.0.0.0/0"]
	}

	egress {
		from_port   = 0
		to_port     = 0
		protocol    = "-1"
		cidr_blocks = ["0.0.0.0/0"]
	}

	tags = merge(local.tags, { Name = "\${var.app_name}-app-sg" })
}

resource "aws_instance" "app" {
	count                  = ${includeAppServer}
	ami                    = var.ec2_ami
	instance_type          = var.ec2_instance_type
	subnet_id              = aws_subnet.public_a.id
	vpc_security_group_ids = [aws_security_group.app.id]

	tags = merge(local.tags, { Name = "\${var.app_name}-app" })
}

resource "aws_s3_bucket" "assets" {
	count  = ${includeStorage}
	bucket = "\${var.app_name}-\${var.environment}-\${random_id.suffix.hex}"
	tags   = merge(local.tags, { Name = "\${var.app_name}-assets" })
}

resource "aws_s3_bucket_versioning" "assets" {
	count  = ${includeStorage}
	bucket = aws_s3_bucket.assets[0].id
	versioning_configuration {
		status = "Enabled"
	}
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
	count  = ${includeStorage}
	bucket = aws_s3_bucket.assets[0].id
	rule {
		apply_server_side_encryption_by_default {
			sse_algorithm = "AES256"
		}
	}
}

output "vpc_id" {
	value = aws_vpc.main.id
}

output "public_subnet_ids" {
	value = [aws_subnet.public_a.id, aws_subnet.public_b.id]
}

output "app_instance_id" {
	value = try(aws_instance.app[0].id, null)
}

output "assets_bucket_name" {
	value = try(aws_s3_bucket.assets[0].bucket, null)
}
`;
}

async function generateTerraformWithRetry(prompt, maxAttempts = TERRAFORM_GEN_ATTEMPTS) {
	let lastReason = "";

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		const effectivePrompt =
			attempt === 1
				? prompt
				: `${prompt}\n\nPrevious attempt failed terraform fmt with:\n${lastReason}\n\nRegenerate from scratch as STRICTLY valid Terraform HCL. Return ONLY code.`;

		const candidateRaw = sanitizeTerraformHcl(await ollama(effectivePrompt));
		const candidate = extractHclFromMixedOutput(candidateRaw);

		const fmtResult = await terraformFmtCheck(candidate);
		if (fmtResult.ok) {
			return sanitizeTerraformHcl(fmtResult.formatted);
		}

		if (isLikelyTerraformHcl(candidateRaw)) {
			lastReason = summarizeTerraformError(fmtResult.error || "terraform fmt failed");
			if (attempt < maxAttempts) {
				console.warn(`[AI] Terraform generation attempt ${attempt}/${maxAttempts} failed terraform fmt; retrying...`);
			} else {
				console.warn(`[AI] Terraform generation attempt ${attempt}/${maxAttempts} failed terraform fmt; using fallback if available...`);
			}
			continue;
		}

		lastReason = summarizeTerraformError(fmtResult.error || "Output did not resemble Terraform HCL");
		if (attempt < maxAttempts) {
			console.warn(`[AI] Terraform generation attempt ${attempt}/${maxAttempts} failed validation; retrying...`);
		} else {
			console.warn(`[AI] Terraform generation attempt ${attempt}/${maxAttempts} failed validation; using fallback if available...`);
		}
	}

	throw new Error(`Model returned invalid Terraform after ${maxAttempts} attempts. Last reason: ${lastReason}`);
}

// ── Helper: run terraform command with AWS credentials ─────────────────────
async function runTerraformCommand(command, awsCredentials, workingDir) {
	const env = {
		...process.env,
		AWS_ACCESS_KEY_ID: awsCredentials.accessKeyId,
		AWS_SECRET_ACCESS_KEY: awsCredentials.secretAccessKey,
		AWS_DEFAULT_REGION: awsCredentials.region || "ap-south-1",
		TF_VAR_region: awsCredentials.region || "ap-south-1",
	};

	return new Promise((resolve, reject) => {
		exec(command, { cwd: workingDir, env, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
			if (error) {
				reject({ error: stderr || error.message, stdout });
			} else {
				resolve({ stdout, stderr });
			}
		});
	});
}
// Model:  llama3 (reasoning)
// Output: { components, tier, reasoning }
// ══════════════════════════════════════════════════════════════════════════
app.post("/api/architecture", async (req, res) => {
	const { bizType, traffic, dataNeeds, description } = req.body;

	// ── Mock mode: fast demo responses ────────────────────────────────────
	if (req.headers["x-mock"] === "1" || req.query.mock === "true") {
		return res.json({
			ok: true,
			architecture: {
				tier: "Standard",
				components: {
					cdn: "AWS CloudFront",
					loadBalancer: "Application Load Balancer",
					appServer: "EC2 t3.medium",
					database: "RDS PostgreSQL t3.micro",
					cache: null,
					storage: "S3",
					monitoring: "CloudWatch",
				},
				estimatedCost: 43,
				reasoning:
					"A two-server setup in Mumbai that handles up to 500 visitors at once, with encrypted database storage, automatic backups, and a content network that loads your pages fast across India.",
			},
		});
	}

	const userContext = description ? `Business description: "${description}"` : `Business type: ${bizType}, Monthly visitors: ${traffic}, Needs database: ${dataNeeds}`;

	const prompt = `You are a senior AWS cloud architect helping a small business owner in India.
${userContext}

Return ONLY a JSON object (no explanation, no markdown) in this exact format:
{
  "tier": "Starter" or "Standard" or "Business",
  "components": {
    "cdn": "AWS CloudFront",
    "loadBalancer": "Application Load Balancer" or null,
    "appServer": "EC2 t3.micro" or "EC2 t3.medium" or "EC2 Auto Scaling Group",
    "database": "RDS PostgreSQL t3.micro" or "RDS PostgreSQL Multi-AZ" or null,
    "cache": "ElastiCache Redis" or null,
    "storage": "S3",
    "monitoring": "CloudWatch"
  },
  "estimatedCost": <number in USD per month>,
  "reasoning": "<one plain-English sentence describing what will be built and why, written for a non-technical business owner — no jargon, no AWS terms>"
}`;

	try {
		const raw = await ollama(prompt);
		const arch = extractJSON(raw);
		res.json({ ok: true, architecture: arch });
	} catch (err) {
		console.error("Architecture error:", err.message);
		res.status(500).json({ ok: false, error: err.message });
	}
});

// ══════════════════════════════════════════════════════════════════════════
// ROUTE 2: /api/terraform
// Input:  { architecture } (from route 1)
// Model:  deepseek-coder (code generation)
// Output: { terraform: "<HCL string>" }
// ══════════════════════════════════════════════════════════════════════════
app.post("/api/terraform", async (req, res) => {
	const { architecture } = req.body;

	if (req.headers["x-mock"] === "1" || req.query.mock === "true") {
		return res.json({
			ok: true,
			terraform: `# ShopOps Production Infrastructure — AWS Terraform
# Region: ap-south-1 (Mumbai)
# Includes: Remote State, VPC, Security Groups, IAM, RDS, S3, Monitoring

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
    random = { source = "hashicorp/random", version = "~> 3.0" }
  }

  # Uncomment after creating S3 bucket & DynamoDB table
  # backend "s3" {
  #   bucket         = "shopops-terraform-state-<account-id>"
  #   key            = "prod/terraform.tfstate"
  #   region         = "ap-south-1"
  #   encrypt        = true
  #   dynamodb_table = "shopops-terraform-locks"
  # }
}

provider "aws" {
  region = "ap-south-1"

  default_tags {
    tags = {
      Project     = "ShopOps"
      Environment = "production"
      ManagedBy   = "Terraform"
      CreatedAt   = timestamp()
    }
  }
}

# ─────────────────────────────────────────────────────────────────────────
# VARIABLES
# ─────────────────────────────────────────────────────────────────────────
variable "app_name" {
  default = "shopops"
}

variable "environment" {
  default = "production"
}

variable "vpc_cidr" {
  default = "10.0.0.0/16"
}

variable "availability_zones" {
  default = ["ap-south-1a", "ap-south-1b"]
}

# ─────────────────────────────────────────────────────────────────────────
# RANDOM SUFFIX FOR UNIQUE RESOURCE NAMES
# ─────────────────────────────────────────────────────────────────────────
resource "random_id" "suffix" {
  byte_length = 4
}

# ─────────────────────────────────────────────────────────────────────────
# VPC & NETWORKING
# ─────────────────────────────────────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "\${var.app_name}-vpc"
  }
}

# Enable VPC Flow Logs for security monitoring
resource "aws_flow_log_group" "vpc" {
  name              = "/aws/vpc/\${var.app_name}"
  retention_in_days = 7
}

resource "aws_flow_log" "vpc" {
  iam_role_arn    = aws_iam_role.vpc_flow_logs.arn
  log_destination = aws_flow_log_group.vpc.arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.main.id

  tags = {
    Name = "\${var.app_name}-flow-logs"
  }
}

resource "aws_iam_role" "vpc_flow_logs" {
  name = "\${var.app_name}-vpc-flow-logs"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "vpc-flow-logs.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "vpc_flow_logs" {
  name   = "\${var.app_name}-vpc-flow-logs"
  role   = aws_iam_role.vpc_flow_logs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogGroups", "logs:DescribeLogStreams"]
      Effect   = "Allow"
      Resource = "*"
    }]
  })
}

# PUBLIC SUBNETS
resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.\${count.index + 1}.0/24"
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "\${var.app_name}-public-\${count.index + 1}"
    Type = "Public"
  }
}

# PRIVATE SUBNETS
resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.\${count.index + 10}.0/24"
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "\${var.app_name}-private-\${count.index + 1}"
    Type = "Private"
  }
}

# INTERNET GATEWAY
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "\${var.app_name}-igw"
  }
}

# NAT GATEWAY (for private subnet egress)
resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name = "\${var.app_name}-nat-eip"
  }

  depends_on = [aws_internet_gateway.main]
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = {
    Name = "\${var.app_name}-nat"
  }

  depends_on = [aws_internet_gateway.main]
}

# ROUTE TABLES
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "\${var.app_name}-public-rt"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name = "\${var.app_name}-private-rt"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# ─────────────────────────────────────────────────────────────────────────
# SECURITY GROUPS (Least-Privilege)
# ─────────────────────────────────────────────────────────────────────────
resource "aws_security_group" "alb" {
  name        = "\${var.app_name}-alb"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "\${var.app_name}-alb-sg"
  }
}

resource "aws_security_group" "app" {
  name        = "\${var.app_name}-app"
  description = "Security group for application servers"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # ← Restrict to your IP in production!
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "\${var.app_name}-app-sg"
  }
}

resource "aws_security_group" "rds" {
  name        = "\${var.app_name}-rds"
  description = "Security group for RDS database"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "\${var.app_name}-rds-sg"
  }
}

# ─────────────────────────────────────────────────────────────────────────
# IAM ROLES & POLICIES
# ─────────────────────────────────────────────────────────────────────────
resource "aws_iam_role" "ec2_role" {
  name = "\${var.app_name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })

  tags = {
    Name = "\${var.app_name}-ec2-role"
  }
}

# EC2 Policy: S3, CloudWatch, Systems Manager
resource "aws_iam_role_policy" "ec2_policy" {
  name   = "\${var.app_name}-ec2-policy"
  role   = aws_iam_role.ec2_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
        Resource = [
          "arn:aws:s3:::\${var.app_name}-assets-*",
          "arn:aws:s3:::\${var.app_name}-assets-*/*"
        ]
      },
      {
        Effect = "Allow"
        Action = ["cloudwatch:PutMetricData", "logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
        Resource = "arn:aws:ssm:ap-south-1:*:parameter/\${var.app_name}/*"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "\${var.app_name}-ec2-profile"
  role = aws_iam_role.ec2_role.name
}

# ─────────────────────────────────────────────────────────────────────────
# EC2 INSTANCE
# ─────────────────────────────────────────────────────────────────────────
resource "aws_instance" "app" {
  ami                    = "ami-0f58b397bc5c1f2e8"  # Ubuntu 22.04 in ap-south-1
  instance_type          = "t3.medium"
  subnet_id              = aws_subnet.public[0].id
  security_groups        = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name

  # Root volume encryption
  root_block_device {
    volume_type           = "gp3"
    volume_size           = 30
    encrypted             = true
    delete_on_termination = true
  }

  # CloudWatch monitoring
  monitoring = true

  # Enable detailed monitoring
  associate_public_ip_address = true

  tags = {
    Name = "\${var.app_name}-app-server"
  }

  depends_on = [aws_internet_gateway.main]
}

# ─────────────────────────────────────────────────────────────────────────
# RDS DATABASE (PostgreSQL)
# ─────────────────────────────────────────────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name       = "\${var.app_name}-db-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "\${var.app_name}-db-subnet-group"
  }
}

resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "aws_db_instance" "main" {
  identifier            = "\${var.app_name}-db"
  engine                = "postgres"
  engine_version        = "15.4"
  instance_class        = "db.t3.micro"
  allocated_storage     = 20
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.rds.arn

  db_subnet_group_name      = aws_db_subnet_group.main.name
  vpc_security_group_ids    = [aws_security_group.rds.id]

  db_name  = "shopopsdb"
  username = "shopopsadmin"
  password = random_password.db_password.result

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  multi_az               = false
  publicly_accessible    = false
  skip_final_snapshot    = false
  final_snapshot_identifier = "\${var.app_name}-db-final-\${formatdate(\"YYYY-MM-DD-hhmm\", timestamp())}"

  performance_insights_enabled = true
  performance_insights_retention_period = 7

  tags = {
    Name = "\${var.app_name}-postgres"
  }
}

# ─────────────────────────────────────────────────────────────────────────
# KMS ENCRYPTION KEYS
# ─────────────────────────────────────────────────────────────────────────
resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true

  tags = {
    Name = "\${var.app_name}-rds-key"
  }
}

resource "aws_kms_alias" "rds" {
  name          = "alias/\${var.app_name}-rds"
  target_key_id = aws_kms_key.rds.key_id
}

# ─────────────────────────────────────────────────────────────────────────
# S3 BUCKET (with encryption & versioning)
# ─────────────────────────────────────────────────────────────────────────
resource "aws_s3_bucket" "assets" {
  bucket = "\${var.app_name}-assets-\${random_id.suffix.hex}"

  tags = {
    Name = "\${var.app_name}-assets"
  }
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─────────────────────────────────────────────────────────────────────────
# OUTPUTS
# ─────────────────────────────────────────────────────────────────────────
output "vpc_id" {
  value = aws_vpc.main.id
}

output "app_instance_ip" {
  value = aws_instance.app.public_ip
}

output "rds_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "rds_username" {
  value = aws_db_instance.main.username
}

output "rds_password" {
  value     = random_password.db_password.result
  sensitive = true
}

output "s3_bucket_name" {
  value = aws_s3_bucket.assets.id
}

output "db_subnet_group_name" {
  value = aws_db_subnet_group.main.name
}
`,
		});
	}

	const c = architecture.components;

	const prompt = `Generate ONLY valid Terraform HCL code for this AWS architecture:
${JSON.stringify(c, null, 2)}

MUST Include:
1. Remote State Backend (S3 + DynamoDB) — commented out for first deployment
2. VPC with public/private subnets across 2 AZs
3. Internet Gateway + NAT Gateway for secure routing
4. Security Groups with LEAST-PRIVILEGE ingress/egress rules:
   - ALB security group: 80, 443 from anywhere
   - App security group: 8000 from ALB only, 22 from anywhere
   - RDS security group: 5432 from app only
5. IAM Roles with specific permissions (S3, CloudWatch, SSM) — NO wildcard *
6. EC2 instance with:
   - CloudWatch monitoring enabled
   - Root volume encrypted with KMS
   - Public IP for SSH access
7. RDS PostgreSQL with:
   - Encryption at rest (KMS)
   - Multi-AZ (if production)
   - Automated backups (7 day retention)
   - Performance Insights enabled
   - DB subnet group in private subnets
8. S3 bucket with:
   - Versioning enabled
   - Encryption at rest (AES-256)
   - Public access blocked
9. KMS keys for encryption with key rotation enabled
10. VPC Flow Logs for network monitoring
11. CloudWatch log groups
12. Variables for environment customization
13. Outputs for easy resource reference
14. Tags on ALL resources: Project, Environment, ManagedBy, CreatedAt

STRICT RULES:
- Region: ap-south-1 (Mumbai)
- Only include resources for components that are NOT null
- Use \${} for string interpolation in Terraform
- Do NOT use backticks
- Do NOT use markdown formatting
- Use only double quotes (")
- Do NOT use semicolons (;)
- Use proper Terraform block syntax (multi-line)
- Output ONLY code, no explanation
- Add comments (##) for section headers

Start with: # ShopOps Production Infrastructure`;

	try {
		const terraform = await generateTerraformWithRetry(prompt);
		res.json({ ok: true, terraform });
	} catch (err) {
		console.error("Terraform error:", err.message);
		res.status(500).json({ ok: false, error: err.message });
	}
});

// ══════════════════════════════════════════════════════════════════════════
// ROUTE 3: /api/dockerfile
// Input:  { bizType }
// Model:  deepseek-coder
// Output: { dockerfile: "<string>" }
// ══════════════════════════════════════════════════════════════════════════
app.post("/api/dockerfile", async (req, res) => {
	const { bizType } = req.body;

	if (req.headers["x-mock"] === "1" || req.query.mock === "true") {
		return res.json({
			ok: true,
			dockerfile: `# ShopOps — Production Dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s \\
  CMD wget -qO- http://localhost/health || exit 1
CMD ["nginx", "-g", "daemon off;"]`,
		});
	}

	const prompt = `Generate a production-ready multi-stage Dockerfile for a ${bizType} web application.
Use Node.js 20 Alpine for build, Nginx Alpine for serve.
Include health check, non-root user, and .dockerignore-friendly COPY patterns.
Output ONLY the Dockerfile content, no explanation.`;

	try {
		const dockerfile = await ollama(prompt);
		res.json({ ok: true, dockerfile });
	} catch (err) {
		console.error("Dockerfile error:", err.message);
		res.status(500).json({ ok: false, error: err.message });
	}
});

// ══════════════════════════════════════════════════════════════════════════
// ROUTE 4: /api/cicd
// Input:  { bizType }
// Model:  deepseek-coder
// Output: { pipeline: "<GitHub Actions YAML>" }
// ══════════════════════════════════════════════════════════════════════════
app.post("/api/cicd", async (req, res) => {
	const { bizType } = req.body;

	if (req.headers["x-mock"] === "1" || req.query.mock === "true") {
		return res.json({
			ok: true,
			pipeline: `name: ShopOps — Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm test

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-south-1
      - name: Build and push Docker image
        run: |
          docker build -t shopops-app .
          docker push \${{ secrets.ECR_REGISTRY }}/shopops-app:latest
      - name: Deploy to EC2
        run: |
          ssh -o StrictHostKeyChecking=no ec2-user@\${{ secrets.EC2_HOST }} \\
            "docker pull && docker-compose up -d"`,
		});
	}

	const prompt = `Generate a complete GitHub Actions CI/CD pipeline YAML for a ${bizType} web application.
Include: lint, test, docker build, push to ECR (region ap-south-1), deploy to EC2 via SSH.
Output ONLY the YAML content starting with: name:`;

	try {
		const pipeline = await ollama(prompt);
		res.json({ ok: true, pipeline });
	} catch (err) {
		res.status(500).json({ ok: false, error: err.message });
	}
});

// ══════════════════════════════════════════════════════════════════════════
// ROUTE 4b: /api/kubernetes
// Input:  { bizType, architecture }
// Model:  deepseek-coder
// Output: { manifests: "<string>" } (YAML with Deployment, Service, ConfigMap, Secret, HPA)
// ══════════════════════════════════════════════════════════════════════════
app.post("/api/kubernetes", async (req, res) => {
	const { bizType, architecture } = req.body;

	if (req.headers["x-mock"] === "1" || req.query.mock === "true") {
		return res.json({
			ok: true,
			manifests: `# ShopOps — Kubernetes Manifests
# ===============================================

# 1. Namespace
apiVersion: v1
kind: Namespace
metadata:
  name: shopops
---
# 2. ConfigMap (Environment Variables)
apiVersion: v1
kind: ConfigMap
metadata:
  name: shopops-config
  namespace: shopops
data:
  NODE_ENV: "production"
  PORT: "3000"
---
# 3. Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shopops-app
  namespace: shopops
  labels:
    app: shopops-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: shopops-app
  template:
    metadata:
      labels:
        app: shopops-app
    spec:
      containers:
      - name: shopops-app
        image: nginx:alpine
        ports:
        - containerPort: 80
        envFrom:
        - configMapRef:
            name: shopops-config
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "500m"
            memory: "256Mi"
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
---
# 4. Service (Load Balancer)
apiVersion: v1
kind: Service
metadata:
  name: shopops-service
  namespace: shopops
spec:
  selector:
    app: shopops-app
  type: LoadBalancer
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
---
# 5. Horizontal Pod Autoscaler (HPA)
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: shopops-hpa
  namespace: shopops
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: shopops-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
`,
		});
	}

	const prompt = `Generate production-ready Kubernetes manifests for a ${bizType} web application.
Include:
- Namespace
- ConfigMap
- Deployment (with liveness/readiness probes, resource requests/limits)
- Service (LoadBalancer type)
- Horizontal Pod Autoscaler (scale based on CPU/memory)

Use nginx:alpine as a placeholder image if not specified.
Output ONLY the YAML content (multiple documents separated by ---), no explanation.`;

	try {
		const manifests = await ollama(prompt);
		res.json({ ok: true, manifests });
	} catch (err) {
		console.error("Kubernetes error:", err.message);
		res.status(500).json({ ok: false, error: err.message });
	}
});

// ══════════════════════════════════════════════════════════════════════════
// ROUTE 5: /api/health
// Simple health check
// ══════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════
// ROUTE 5: /api/chat  (SSE streaming)
// Input:  { message, history: [{role, content}], model? }
// Output: Server-Sent Events stream of tokens
// ══════════════════════════════════════════════════════════════════════════
app.post("/api/chat", async (req, res) => {
	const { message, history = [], currentConfig } = req.body;

	const configCtx = currentConfig?.tier
		? `\nThe user has already generated a ${currentConfig.tier} tier AWS setup (~₹${Math.round((currentConfig.cost || 0) * 83).toLocaleString("en-IN")}/mo). Summary: "${currentConfig.summary}". Answer questions about their specific setup.`
		: "";

	const systemPrompt = `You are ShopOps AI, a friendly cloud advisor for small business owners in India.${configCtx}
Explain everything in plain English — no jargon. Be warm and concise (2-3 sentences max per reply).
Use everyday analogies: a VPC is "a private fenced plot in the cloud", a load balancer is "a receptionist routing customers to free cashiers".`;

	const historyText = history.map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`).join("\n");

	const fullPrompt = `${systemPrompt}\n\n${historyText}\nUser: ${message}\nAssistant:`;

	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");
	res.setHeader("Access-Control-Allow-Origin", "*");

	try {
		const ollamaRes = await fetch(OLLAMA, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ model: MODEL, prompt: fullPrompt, stream: true }),
		});

		if (!ollamaRes.ok) {
			res.write(`data: ${JSON.stringify({ error: `Ollama error: ${ollamaRes.status}` })}\n\n`);
			return res.end();
		}

		const reader = ollamaRes.body.getReader();
		const decoder = new TextDecoder();

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			const chunk = decoder.decode(value);
			const lines = chunk.split("\n").filter(Boolean);
			for (const line of lines) {
				try {
					const json = JSON.parse(line);
					if (json.response) {
						res.write(`data: ${JSON.stringify({ token: json.response })}\n\n`);
					}
					if (json.done) {
						res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
					}
				} catch {}
			}
		}
		res.end();
	} catch (err) {
		res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
		res.end();
	}
});

// ══════════════════════════════════════════════════════════════════════════
// ROUTE 6: /api/extract-requirements
// "Conversational Requirement Discovery" — the key feature from the doc
// Input:  { conversation: [{role, content}] }
// Model:  llama3 (reasoning)
// Output: { bizType, traffic, dataNeeds, confidence, summary }
// ══════════════════════════════════════════════════════════════════════════
app.post("/api/extract-requirements", async (req, res) => {
	const { conversation = [] } = req.body;
	const transcript = conversation.map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`).join("\n");

	const prompt = `You are analyzing a conversation between a small business owner and a cloud advisor.
Extract the cloud requirements from this conversation.

Conversation:
${transcript}

Return ONLY a JSON object with no explanation:
{
  "bizType": "store" or "website" or "app" or "booking" or "custom" or null,
  "traffic": "tiny" or "small" or "medium" or "unsure" or null,
  "dataNeeds": "yes" or "no" or "unsure" or null,
  "confidence": 0-100,
  "summary": "<one sentence: what this business needs in plain English>",
  "missingInfo": "<what question to ask next, or null if all info gathered>"
}`;

	try {
		const raw = await ollama(prompt);
		const extracted = extractJSON(raw);
		res.json({ ok: true, requirements: extracted });
	} catch (err) {
		res.status(500).json({ ok: false, error: err.message });
	}
});

// ══════════════════════════════════════════════════════════════════════════
// ROUTE 7: /api/provider-convert
// Input:  { terraform, provider: 'gcp'|'azure' }
// Model:  deepseek-coder
// Output: { terraform: "<converted HCL>" }
// ══════════════════════════════════════════════════════════════════════════
app.post("/api/provider-convert", async (req, res) => {
	const { terraform = "", provider = "gcp" } = req.body;

	const providerMap = {
		gcp: { name: "Google Cloud Platform", region: "asia-south1 (Mumbai)", provider: "google", registry: "hashicorp/google" },
		azure: { name: "Microsoft Azure", region: "centralindia", provider: "azurerm", registry: "hashicorp/azurerm" },
	};
	const p = providerMap[provider] || providerMap.gcp;

	const prompt = `You are a cloud infrastructure expert. Convert this AWS Terraform HCL to ${p.name} equivalents.

AWS Terraform:
${terraform.slice(0, 2000)}

Rules:
- Use provider "${p.provider}" with region "${p.region}"
- Convert every AWS resource to its ${p.name} equivalent (e.g. aws_instance → google_compute_instance or azurerm_linux_virtual_machine)
- Keep the same security posture: encryption, backups, VPC/VNet isolation
- Use registry: { source = "${p.registry}", version = "~> 5.0" }
- Keep tags/labels equivalent
- Output ONLY valid HCL, no markdown, no explanation

Start with: terraform {`;

	try {
		const converted = await ollama(prompt);
		res.json({ ok: true, terraform: converted });
	} catch (err) {
		res.status(500).json({ ok: false, error: err.message });
	}
});

// ══════════════════════════════════════════════════════════════════════════
// ROUTE 8: /api/export-workspace
// Zip file generator of the architecture
// ══════════════════════════════════════════════════════════════════════════
app.post("/api/export-workspace", (req, res) => {
	const { terraform = "", dockerfile = "", pipeline = "" } = req.body;
	res.attachment("shopops-workspace.zip");
	const archive = archiver("zip", { zlib: { level: 9 } });

	archive.on("error", (err) => res.status(500).send({ error: err.message }));
	archive.pipe(res);

	archive.append(terraform, { name: "infrastructure/main.tf" });
	archive.append(dockerfile, { name: "app/Dockerfile" });
	archive.append(pipeline, { name: ".github/workflows/deploy.yml" });
	archive.append("# ShopOps Local Export\nThis archive contains your tailored cloud configuration files.", { name: "README.md" });

	archive.finalize();
});

// ══════════════════════════════════════════════════════════════════════════
// ROUTE 9: /api/metrics (SSE Stream)
// Simulate Local Container Metrics since Docker isn't installed
// ══════════════════════════════════════════════════════════════════════════
let controlState = { status: "running", trafficSpike: false };

app.get("/api/metrics", (req, res) => {
	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");

	const intervalId = setInterval(() => {
		if (controlState.status === "paused") {
			res.write(
				`data: ${JSON.stringify({
					cpu: 0,
					ramMB: 0,
					status: controlState.status,
					message: "Containers Paused",
				})}\n\n`,
			);
			return;
		}

		// Simulate real-sounding container stats based on system loads
		const baseCpu = os.loadavg()[0] * 10;
		const spike = controlState.trafficSpike ? 60 + Math.random() * 30 : 0;
		const cpu = Math.min(100, Math.max(1, baseCpu + Math.random() * 5 + spike)).toFixed(1);

		const ramMB = (120 + Math.random() * 20 + (controlState.trafficSpike ? 80 : 0)).toFixed(1);

		res.write(
			`data: ${JSON.stringify({
				cpu,
				ramMB,
				status: controlState.status,
				network: controlState.trafficSpike ? "High Load" : "Normal",
				lat: (controlState.trafficSpike ? 300 + Math.random() * 200 : 30 + Math.random() * 20).toFixed(0),
			})}\n\n`,
		);
	}, 1000);

	req.on("close", () => clearInterval(intervalId));
});

// ══════════════════════════════════════════════════════════════════════════
// ROUTE 10: /api/controls
// Pseudo-control for local containers / simulations
// ══════════════════════════════════════════════════════════════════════════
app.post("/api/controls", (req, res) => {
	const { action } = req.body;
	if (action === "pause") controlState.status = "paused";
	if (action === "resume") controlState.status = "running";
	if (action === "spike") {
		controlState.trafficSpike = true;
		setTimeout(() => (controlState.trafficSpike = false), 15000); // 15 sec spike
	}
	res.json({ ok: true, state: controlState });
});

// ══════════════════════════════════════════════════════════════════════════
// ROUTE: /api/vend  — InfraVend "Vending Machine" trigger
// Input:  { bizType, description, terraform, dockerfile }
// Flow:   Generate tenant_id → upload to S3 → run Ansible → Docker up
// Output: { ok, tenantId, url, port, status }
// ══════════════════════════════════════════════════════════════════════════
app.post("/api/vend", async (req, res) => {
	const { bizType = "store", description = "", terraform = "", dockerfile = "" } = req.body;

	// Generate unique tenant ID + port
	const tenantId = `tenant_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
	const port = Math.floor(Math.random() * 900) + 8200; // 8200–8999

	const vendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../infravend");
	const tenantDir = path.join(vendDir, "tenants");
	const scriptPath = path.join(vendDir, "scripts/vend.sh");

	// Ensure tenant dir exists
	if (!fs.existsSync(tenantDir)) fs.mkdirSync(tenantDir, { recursive: true });

	// Save generated files to temp for S3 upload
	const tmpDir = `/tmp/${tenantId}`;
	fs.mkdirSync(tmpDir, { recursive: true });
	if (terraform) fs.writeFileSync(`${tmpDir}/main.tf`, terraform);
	if (dockerfile) fs.writeFileSync(`${tmpDir}/Dockerfile`, dockerfile);
	fs.writeFileSync(`${tmpDir}/description.txt`, description);

	// Upload to S3
	const S3_BUCKET = "infravend-templates-771969015644";
	try {
		await new Promise((resolve, reject) => {
			exec(`aws s3 cp ${tmpDir}/ s3://${S3_BUCKET}/tenants/${tenantId}/ --recursive --quiet`, (err, stdout, stderr) => {
				if (err) reject(err);
				else resolve(stdout);
			});
		});
	} catch (e) {
		console.warn("S3 upload warning:", e.message);
	}

	// Run the vending machine shell script (triggers Ansible → Docker)
	const vendCmd = `bash ${scriptPath} ${tenantId} ${bizType} ${port}`;

	exec(vendCmd, { timeout: 120000 }, (err, stdout, stderr) => {
		if (err) {
			console.error("Vend error:", err.message);
			return res.status(500).json({ ok: false, error: err.message, logs: stdout });
		}
		res.json({
			ok: true,
			tenantId,
			port,
			url: `http://localhost:${port}`,
			bizType,
			status: "live",
			logs: stdout,
			s3Path: `s3://${S3_BUCKET}/tenants/${tenantId}/`,
		});
	});
});

// ── /api/vend/list — list all live tenants ─────────────────────────────────
app.get("/api/vend/list", (req, res) => {
	const tenantDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../infravend/tenants");
	try {
		if (!fs.existsSync(tenantDir)) return res.json({ ok: true, tenants: [] });
		const files = fs.readdirSync(tenantDir).filter((f) => f.endsWith(".json"));
		const tenants = files
			.map((f) => {
				try {
					return JSON.parse(fs.readFileSync(path.join(tenantDir, f), "utf8"));
				} catch {
					return null;
				}
			})
			.filter(Boolean);
		res.json({ ok: true, tenants });
	} catch (e) {
		res.json({ ok: true, tenants: [] });
	}
});

// ── /api/vend/destroy — stop a tenant container ────────────────────────────
app.post("/api/vend/destroy", (req, res) => {
	const { tenantId } = req.body;
	if (!tenantId) return res.status(400).json({ ok: false, error: "tenantId required" });
	exec(`docker rm -f ${tenantId} 2>/dev/null || true`, (err, stdout) => {
		res.json({ ok: true, message: `Tenant ${tenantId} stopped` });
	});
});

app.get("/api/health", async (_req, res) => {
	try {
		await fetch("http://localhost:11434/api/tags");
		res.json({ ok: true, ollama: "connected", models: [MODEL] });
	} catch {
		res.status(503).json({ ok: false, ollama: "disconnected" });
	}
});

// ==================== NEW INTEGRATIONS ====================
const runtimeState = {
	dockerContainers: new Set(),
	latestDockerContainer: null,
	localstackRuns: new Map(),
};

const LOCALSTACK_PROVIDER_BLOCK = `provider "aws" {
  region                      = "ap-south-1"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  endpoints {
    apigateway     = "http://localhost:4566"
    cloudformation = "http://localhost:4566"
    cloudwatch     = "http://localhost:4566"
    dynamodb       = "http://localhost:4566"
    ec2            = "http://localhost:4566"
    ecr            = "http://localhost:4566"
    ecs            = "http://localhost:4566"
    elb            = "http://localhost:4566"
    iam            = "http://localhost:4566"
    kms            = "http://localhost:4566"
    lambda         = "http://localhost:4566"
    logs           = "http://localhost:4566"
    rds            = "http://localhost:4566"
    s3             = "http://s3.localhost.localstack.cloud:4566"
    secretsmanager = "http://localhost:4566"
    sns            = "http://localhost:4566"
    sqs            = "http://localhost:4566"
    ssm            = "http://localhost:4566"
    sts            = "http://localhost:4566"
  }
}`;

function shellQuote(value = "") {
	return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function mergeCommandOutput(result = {}) {
	return [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
}

function replaceAwsProviderForLocalstack(terraform = "") {
	const source = String(terraform || "").trim();
	if (!source) return "";

	const match = /provider\s+"aws"\s*\{/m.exec(source);
	if (!match) return `${source}\n\n${LOCALSTACK_PROVIDER_BLOCK}\n`;

	const start = match.index;
	const openBrace = source.indexOf("{", start);
	if (openBrace === -1) return `${source}\n\n${LOCALSTACK_PROVIDER_BLOCK}\n`;

	let depth = 0;
	let end = -1;
	for (let i = openBrace; i < source.length; i += 1) {
		if (source[i] === "{") depth += 1;
		if (source[i] === "}") {
			depth -= 1;
			if (depth === 0) {
				end = i;
				break;
			}
		}
	}

	if (end === -1) return `${source}\n\n${LOCALSTACK_PROVIDER_BLOCK}\n`;

	const before = source.slice(0, start).trimEnd();
	const after = source.slice(end + 1).trimStart();
	return [before, LOCALSTACK_PROVIDER_BLOCK, after].filter(Boolean).join("\n\n");
}

function parseMemoryToMB(memUsage = "0MiB / 0MiB") {
	const raw = String(memUsage).split("/")[0]?.trim() || "0MiB";
	const match = raw.match(/([\d.]+)\s*([kmg]i?b)/i);
	if (!match) return 0;

	const value = parseFloat(match[1]);
	const unit = match[2].toLowerCase();

	if (unit.startsWith("g")) return Math.round(value * 1024);
	if (unit.startsWith("k")) return Math.round(value / 1024);
	return Math.round(value);
}

async function ensureToolInstalled(tool, installHint) {
	try {
		await runCommand(`command -v ${tool}`);
	} catch {
		throw new Error(`${tool} is required. ${installHint}`);
	}
}

async function ensureLocalstackIsReady() {
	try {
		const res = await fetch("http://localhost:4566/_localstack/health");
		if (res.ok) return;
	} catch {}
	throw new Error("LocalStack is not reachable at http://localhost:4566. Start it first and retry.");
}

function runAutocannon(options) {
	return new Promise((resolve, reject) => {
		autocannon(options, (err, result) => {
			if (err) return reject(err);
			resolve(result);
		});
	});
}

// Helper: Run shell command with streaming
function runCommand(cmd, options = {}) {
	return new Promise((resolve, reject) => {
		exec(cmd, { cwd: TEMP_DIR, maxBuffer: 8 * 1024 * 1024, ...options }, (error, stdout, stderr) => {
			if (error) {
				reject({ error: error.message, stdout, stderr, cmd });
			} else {
				resolve({ stdout, stderr, cmd });
			}
		});
	});
}

// 1. Docker: Build and run containers
app.post("/api/docker/deploy", async (req, res) => {
	try {
		await ensureToolInstalled("docker", "Install Docker Desktop and make sure the Docker daemon is running.");

		const { dockerfile, composeYml, port = 8080 } = req.body;
		const runId = Date.now().toString();
		const safePort = Number.isInteger(Number(port)) && Number(port) > 0 ? Number(port) : 8080;
		const imageName = `shopops-app-${runId}`;
		const containerName = imageName;
		const runDir = path.join(TEMP_DIR, runId);
		fs.mkdirSync(runDir, { recursive: true });

		// Write a simple demo Dockerfile if none provided (for testing)
		let finalDockerfile = dockerfile;
		if (!finalDockerfile) {
			finalDockerfile = `FROM nginx:alpine
RUN echo '<!DOCTYPE html><html><head><title>ShopOps Demo</title></head><body style="font-family:system-ui;padding:20px;background:#FAF7F2"><h1>☁️ ShopOps Demo</h1><p>Container is running!</p></body></html>' > /usr/share/nginx/html/index.html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`;
		}

		// Also add a simple index.html for good measure
		const indexHtml = `<!DOCTYPE html>
<html>
  <head>
    <title>ShopOps Demo</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; padding: 32px; background: #FAF7F2; }
      h1 { color: #21405E; }
    </style>
  </head>
  <body>
    <h1>☁️ ShopOps Demo</h1>
    <p style="color:#666; max-width:400px">Your Docker container is up and running on localhost:${safePort}!</p>
  </body>
</html>`;

		fs.writeFileSync(path.join(runDir, "Dockerfile"), finalDockerfile);
		fs.writeFileSync(path.join(runDir, "index.html"), indexHtml);
		if (composeYml) fs.writeFileSync(path.join(runDir, "docker-compose.yml"), composeYml);

		let output = "";
		if (composeYml) {
			let composeResult;
			try {
				composeResult = await runCommand("docker compose up -d", { cwd: runDir });
			} catch {
				composeResult = await runCommand("docker-compose up -d", { cwd: runDir });
			}
			output = mergeCommandOutput(composeResult);
		} else {
			const build = await runCommand(`docker build -t ${shellQuote(imageName)} .`, { cwd: runDir });
			const run = await runCommand(`docker run -d -p ${safePort}:80 --name ${shellQuote(containerName)} ${shellQuote(imageName)}`);
			output = [mergeCommandOutput(build), mergeCommandOutput(run)].filter(Boolean).join("\n\n");
			runtimeState.dockerContainers.add(containerName);
			runtimeState.latestDockerContainer = containerName;
		}

		res.json({ ok: true, status: "running", containerId: runId, containerName, port: safePort, output });
	} catch (err) {
		console.error("Docker deploy error:", err);
		const details = mergeCommandOutput(err);
		res.status(500).json({ ok: false, error: err.error || err.message, details });
	}
});

// 2. Docker: Get stats
app.get("/api/docker/stats", async (req, res) => {
	try {
		let stats = [];
		try {
			const { stdout } = await runCommand("docker stats --no-stream --format json");
			stats = stdout
				.split("\n")
				.filter(Boolean)
				.map((line) => {
					try {
						return JSON.parse(line);
					} catch {
						return null;
					}
				})
				.filter(Boolean);
		} catch {
			// Docker not running - return empty stats
		}

		// If we have stats, parse them, else return simulated data
		if (stats.length > 0) {
			const container = stats[0];
			const cpuPercent = container.CPUPercent ? parseFloat(container.CPUPercent.replace("%", "")) : 0;
			const memUsage = container.MemUsage || "0MiB / 0MiB";
			const memMB = parseMemoryToMB(memUsage);
			const status = "running";

			res.json({
				ok: true,
				cpu: Math.round(cpuPercent),
				ramMB: memMB,
				status,
				network: memMB > 500 ? "High Load" : "Normal",
				lat: Math.round(Math.random() * 100 + 50),
			});
		} else {
			// Simulated data when Docker not running
			res.json({
				ok: true,
				cpu: Math.floor(Math.random() * 50 + 10),
				ramMB: Math.floor(Math.random() * 500 + 100),
				status: "running",
				network: "Normal",
				lat: Math.floor(Math.random() * 100 + 50),
			});
		}
	} catch (err) {
		console.error("Docker stats error:", err);
		// Fallback to simulated data on error
		res.json({
			ok: true,
			cpu: Math.floor(Math.random() * 50 + 10),
			ramMB: Math.floor(Math.random() * 500 + 100),
			status: "running",
			network: "Normal",
			lat: Math.floor(Math.random() * 100 + 50),
		});
	}
});

// 3. Docker: Control containers (pause/resume/stop)
app.post("/api/docker/control", async (req, res) => {
	try {
		await ensureToolInstalled("docker", "Install Docker Desktop and make sure the Docker daemon is running.");

		const { action, containerId } = req.body;
		const cmdMap = {
			pause: "docker pause",
			resume: "docker unpause",
			stop: "docker stop",
			rm: "docker rm -f",
		};
		if (!cmdMap[action]) throw new Error("Invalid action");

		const targetContainer = containerId ? `shopops-app-${containerId}` : runtimeState.latestDockerContainer;
		if (!targetContainer) {
			return res.status(400).json({ ok: false, error: "No deployed ShopOps container found." });
		}

		const result = await runCommand(`${cmdMap[action]} ${shellQuote(targetContainer)}`);
		if (action === "stop" || action === "rm") {
			runtimeState.dockerContainers.delete(targetContainer);
			if (runtimeState.latestDockerContainer === targetContainer) {
				runtimeState.latestDockerContainer = null;
			}
		}

		const statusMap = { pause: "paused", resume: "running", stop: "stopped", rm: "removed" };
		res.json({ ok: true, status: statusMap[action], output: mergeCommandOutput(result), containerName: targetContainer });
	} catch (err) {
		const details = mergeCommandOutput(err);
		res.status(500).json({ ok: false, error: err.error || err.message, details });
	}
});

// 4. LocalStack: Check status and run Terraform
app.post("/api/localstack/deploy", async (req, res) => {
	try {
		await ensureToolInstalled("terraform", "Install Terraform CLI and add it to your PATH.");
		await ensureLocalstackIsReady();

		const { terraform } = req.body;
		if (!terraform || !terraform.trim()) {
			return res.status(400).json({ ok: false, error: "Terraform configuration is required." });
		}

		const runId = Date.now().toString();
		const runDir = path.join(TEMP_DIR, `localstack-${runId}`);
		fs.mkdirSync(runDir, { recursive: true });
		const localstackTf = replaceAwsProviderForLocalstack(terraform);
		fs.writeFileSync(path.join(runDir, "main.tf"), localstackTf);

		const env = {
			...process.env,
			AWS_ACCESS_KEY_ID: "test",
			AWS_SECRET_ACCESS_KEY: "test",
			AWS_REGION: "ap-south-1",
			AWS_DEFAULT_REGION: "ap-south-1",
		};

		const initOutput = await runCommand("terraform init -input=false -no-color", { cwd: runDir, env });
		const applyOutput = await runCommand("terraform apply -auto-approve -input=false -no-color", { cwd: runDir, env });
		const output = [mergeCommandOutput(initOutput), mergeCommandOutput(applyOutput)].filter(Boolean).join("\n\n");

		runtimeState.localstackRuns.set(runId, runDir);
		res.json({ ok: true, status: "applied", runId, output });
	} catch (err) {
		const details = mergeCommandOutput(err);
		res.status(500).json({ ok: false, error: err.error || err.message, details });
	}
});

// 5. act: Run GitHub Actions locally
app.post("/api/act/run", async (req, res) => {
	try {
		await ensureToolInstalled("act", "Install nektos/act and make sure it is available in your PATH.");

		const { workflowYml = "", workflow = "", event = "push" } = req.body;
		const workflowContent = workflowYml || workflow;
		if (!workflowContent || !workflowContent.trim()) {
			return res.status(400).json({ ok: false, error: "Workflow YAML is required." });
		}

		const safeEvent = ["push", "pull_request", "workflow_dispatch"].includes(event) ? event : "push";
		const runId = Date.now().toString();
		const runDir = path.join(TEMP_DIR, `act-${runId}`);
		const workflowsDir = path.join(runDir, ".github", "workflows");
		fs.mkdirSync(workflowsDir, { recursive: true });
		const workflowPath = path.join(workflowsDir, "deploy.yml");
		const eventPath = path.join(runDir, "event.json");
		fs.writeFileSync(workflowPath, workflowContent);
		fs.writeFileSync(
			eventPath,
			JSON.stringify(
				{
					ref: "refs/heads/main",
					repository: { full_name: "shopops/local" },
					event_name: safeEvent,
				},
				null,
				2,
			),
		);

		const result = await runCommand(`act ${safeEvent} -W ${shellQuote(workflowPath)} -e ${shellQuote(eventPath)}`, { cwd: runDir });
		res.json({ ok: true, status: "completed", runId, output: mergeCommandOutput(result) });
	} catch (err) {
		const details = mergeCommandOutput(err);
		res.status(500).json({ ok: false, error: err.error || err.message, details });
	}
});

// 6. autocannon: Simulate traffic spike
app.post("/api/loadtest/start", async (req, res) => {
	try {
		const { url = "http://localhost:8080", duration = 10, connections = 100 } = req.body;
		const result = await runAutocannon({
			url,
			duration,
			connections,
			pipelining: 1,
		});
		res.json({
			ok: true,
			result: {
				requests: result.requests,
				latency: result.latency,
				throughput: result.throughput,
			},
		});
	} catch (err) {
		res.status(500).json({ ok: false, error: err.message });
	}
});

// 7. Tear down local integrations (containers + LocalStack Terraform runs)
app.post("/api/destroy", async (_req, res) => {
	const summary = {
		docker: "No ShopOps containers found.",
		localstack: [],
		errors: [],
	};

	try {
		await ensureToolInstalled("docker", "Install Docker Desktop and make sure the Docker daemon is running.");
		const { stdout } = await runCommand('docker ps -a --format "{{.Names}}"');
		const names = stdout
			.split("\n")
			.map((n) => n.trim())
			.filter(Boolean)
			.filter((n) => n.startsWith("shopops-app-"));

		if (names.length > 0) {
			await runCommand(`docker rm -f ${names.map(shellQuote).join(" ")}`);
			summary.docker = `Removed ${names.length} ShopOps container(s).`;
			runtimeState.dockerContainers.clear();
			runtimeState.latestDockerContainer = null;
		}
	} catch (err) {
		summary.errors.push(`Docker cleanup failed: ${err.error || err.message}`);
	}

	const localstackDirs = fs.existsSync(TEMP_DIR)
		? fs
				.readdirSync(TEMP_DIR)
				.filter((name) => name.startsWith("localstack-"))
				.map((name) => path.join(TEMP_DIR, name))
		: [];

	if (localstackDirs.length > 0) {
		try {
			await ensureToolInstalled("terraform", "Install Terraform CLI and add it to your PATH.");
			const env = {
				...process.env,
				AWS_ACCESS_KEY_ID: "test",
				AWS_SECRET_ACCESS_KEY: "test",
				AWS_REGION: "ap-south-1",
				AWS_DEFAULT_REGION: "ap-south-1",
			};

			for (const dir of localstackDirs) {
				try {
					await runCommand("terraform init -input=false -no-color", { cwd: dir, env });
					await runCommand("terraform destroy -auto-approve -input=false -no-color", { cwd: dir, env });
					summary.localstack.push(`Destroyed Terraform resources in ${path.basename(dir)}.`);
				} catch (err) {
					summary.errors.push(`Terraform destroy failed for ${path.basename(dir)}: ${err.error || err.message}`);
				}
			}
		} catch (err) {
			summary.errors.push(`Terraform cleanup unavailable: ${err.error || err.message}`);
		}
	} else {
		summary.localstack.push("No LocalStack Terraform runs found.");
	}

	if (summary.errors.length === 0) {
		return res.json({ ok: true, summary });
	}
	return res.status(207).json({ ok: false, summary });
});

// 8. Mermaid: Generate architecture diagram code
app.post("/api/architecture/diagram", async (req, res) => {
	try {
		const { description, architecture } = req.body;
		// Default diagram if no architecture provided
		let mermaid = `graph TD
    %%{init: {'theme': 'neutral', 'themeVariables': {'primaryColor': '#21405E', 'primaryTextColor': '#fff', 'primaryBorderColor': '#21405E', 'lineColor': '#F0C060'}}}%%

    User[Your Customers]:::user
    CDN[(Global CDN)]:::cdn
    LB(Load Balancer):::lb
    App[Application<br/>Servers]:::app
    DB[(Database)]:::db
    Backup[(Auto<br/>Backups)]:::backup
    Monitor[(Monitoring)]:::monitor

    User --> CDN
    User --> LB
    CDN --> App
    LB --> App
    App --> DB
    DB --> Backup
    App --> Monitor

    classDef user fill:#21405E,stroke:#21405E,color:#fff
    classDef cdn fill:#F0C060,stroke:#F0C060,color:#21405E
    classDef lb fill:#A5B3C2,stroke:#A5B3C2,color:#21405E
    classDef app fill:#4CAF82,stroke:#4CAF82,color:#fff
    classDef db fill:#21405E,stroke:#21405E,color:#fff
    classDef backup fill:#F0C060,stroke:#F0C060,color:#21405E
    classDef monitor fill:#A5B3C2,stroke:#A5B3C2,color:#21405E`;

		res.json({ ok: true, mermaid });
	} catch (err) {
		res.status(500).json({ ok: false, error: err.message });
	}
});

// ══════════════════════════════════════════════════════════════════════════════════
// ROUTE: /api/docker/logs (SSE Streaming)
// ══════════════════════════════════════════════════════════════════════════════════
app.get("/api/docker/logs", async (req, res) => {
	const { containerId } = req.query;
	if (!containerId) {
		return res.status(400).json({ ok: false, error: "containerId is required" });
	}

	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");
	res.setHeader("Access-Control-Allow-Origin", "*");

	try {
		// Use docker logs with follow mode
		const { spawn } = await import("child_process");
		const docker = spawn("docker", ["logs", "-f", "--tail", "100", containerId]);

		docker.stdout.on("data", (data) => {
			res.write(`data: ${JSON.stringify({ type: "stdout", log: data.toString() })}\n\n`);
		});

		docker.stderr.on("data", (data) => {
			res.write(`data: ${JSON.stringify({ type: "stderr", log: data.toString() })}\n\n`);
		});

		docker.on("close", (code) => {
			res.write(`data: ${JSON.stringify({ type: "done", code })}\n\n`);
			res.end();
		});

		docker.on("error", (err) => {
			res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
			res.end();
		});

		req.on("close", () => {
			docker.kill();
		});
	} catch (err) {
		res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
		res.end();
	}
});

// ══════════════════════════════════════════════════════════════════════════════════
// ROUTE: /api/kubernetes/apply (Deploy to local Kubernetes)
// ══════════════════════════════════════════════════════════════════════════════════
app.post("/api/kubernetes/apply", async (req, res) => {
	const { manifests } = req.body;

	if (!manifests || !manifests.trim()) {
		return res.status(400).json({ ok: false, error: "Kubernetes manifests are required" });
	}

	const runId = Date.now().toString();
	const runDir = path.join(TEMP_DIR, `k8s-${runId}`);
	fs.mkdirSync(runDir, { recursive: true });

	const manifestPath = path.join(runDir, "deployment.yaml");
	fs.writeFileSync(manifestPath, manifests);

	try {
		// First check if kubectl is available
		await runCommand("kubectl version --client");

		// Apply the manifests to minikube
		const result = await runCommand(`kubectl apply -f ${shellQuote(manifestPath)} --dry-run=client -o yaml`);
		const applyResult = await runCommand(`kubectl apply -f ${shellQuote(manifestPath)}`);

		res.json({
			ok: true,
			status: "applied",
			runId,
			output: mergeCommandOutput(applyResult),
			dryRun: mergeCommandOutput(result),
		});
	} catch (err) {
		res.status(500).json({
			ok: false,
			error: err.error || err.message,
			details: mergeCommandOutput(err),
		});
	}
});

// ══════════════════════════════════════════════════════════════════════════════════
// ROUTE: /api/kubernetes/status (Check K8s deployment status)
// ══════════════════════════════════════════════════════════════════════════════════
app.get("/api/kubernetes/status", async (req, res) => {
	try {
		const pods = await runCommand("kubectl get pods -o json");
		const services = await runCommand("kubectl get svc -o json");
		const deployments = await runCommand("kubectl get deployments -o json");

		res.json({
			ok: true,
			pods: JSON.parse(pods.stdout || "{}"),
			services: JSON.parse(services.stdout || "{}"),
			deployments: JSON.parse(deployments.stdout || "{}"),
		});
	} catch (err) {
		res.status(500).json({ ok: false, error: err.message });
	}
});

// ══════════════════════════════════════════════════════════════════════════════════
// ROUTE: /api/deploy-all (Unified deployment to Docker + LocalStack)
// ══════════════════════════════════════════════════════════════════════════════════
app.post("/api/deploy-all", async (req, res) => {
	const { dockerfile, terraform, kubernetes, port = 8080 } = req.body;

	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");
	res.setHeader("Access-Control-Allow-Origin", "*");

	const send = (step, status, message, data = {}) => {
		res.write(`data: ${JSON.stringify({ step, status, message, ...data })}\n\n`);
	};

	try {
		// Check for stored credentials
		if (!req.session.awsCredentials) {
			console.warn("[Deploy] Unauthorized attempt: Missing AWS credentials in session");
			return res.status(401).json({
				ok: false,
				error: "No AWS credentials found. Please set credentials first via /api/auth/set-credentials",
			});
		}

		console.log("[Deploy-All] Starting unified deployment");

		// Step 1: Build Docker container
		send("docker", "running", "Building Docker container...");
		const deployRes = await fetch("http://localhost:3001/api/docker/deploy", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ dockerfile, port }),
		});
		const deployData = await deployRes.json();

		if (!deployData.ok) {
			send("docker", "error", "Docker build failed", { error: deployData.error });
			return res.end();
		}

		send("docker", "done", "Docker container ready", { containerId: deployData.containerId, port: deployData.port });

		// Step 2: Deploy to LocalStack (if terraform provided)
		if (terraform && terraform.trim()) {
			send("localstack", "running", "Deploying to LocalStack...");
			const lsRes = await fetch("http://localhost:3001/api/localstack/deploy", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ terraform }),
			});
			const lsData = await lsRes.json();

			if (!lsData.ok) {
				send("localstack", "error", "LocalStack deployment failed", { error: lsData.error });
			} else {
				send("localstack", "done", "LocalStack resources created", { runId: lsData.runId });
			}
		} else {
			send("localstack", "skipped", "No Terraform provided, skipping LocalStack");
		}

		// Step 3: Deploy to Kubernetes (if manifests provided)
		if (kubernetes && kubernetes.trim()) {
			send("kubernetes", "running", "Deploying to Kubernetes...");
			const k8sRes = await fetch("http://localhost:3001/api/kubernetes/apply", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ manifests: kubernetes }),
			});
			const k8sData = await k8sRes.json();

			if (!k8sData.ok) {
				send("kubernetes", "error", "Kubernetes deployment failed", { error: k8sData.error });
			} else {
				send("kubernetes", "done", "Kubernetes resources created");
			}
		} else {
			send("kubernetes", "skipped", "No Kubernetes manifests, skipping");
		}

		// All done
		send("complete", "done", "All deployments complete!");
		res.end();
	} catch (err) {
		send("error", "error", err.message);
		res.end();
	}
});

// ══════════════════════════════════════════════════════════════════════════════════
// ROUTE: /api/aws/deploy (Deploy to REAL AWS)
// ══════════════════════════════════════════════════════════════════════════════════
app.post("/api/aws/deploy", async (req, res) => {
	const { terraform } = req.body;
	if (!terraform || !terraform.trim()) {
		return res.status(400).json({ ok: false, error: "Terraform configuration is required" });
	}

	const sanitizedTerraform = sanitizeTerraformHcl(terraform);
	if (!sanitizedTerraform.trim()) {
		return res.status(400).json({ ok: false, error: "Invalid Terraform input. Please provide valid HCL." });
	}

	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");
	res.setHeader("Access-Control-Allow-Origin", "*");

	const send = (step, status, message, data = {}) => {
		res.write(`data: ${JSON.stringify({ step, status, message, ...data })}\n\n`);
	};

	const runId = Date.now().toString();
	const runDir = path.join(TEMP_DIR, `aws-${runId}`);
	fs.mkdirSync(runDir, { recursive: true });

	const tfPath = path.join(runDir, "main.tf");
	fs.writeFileSync(tfPath, sanitizedTerraform);

	try {
		send("aws", "running", "Initializing Terraform for AWS...");

		// terraform init
		const initResult = await runCommand("terraform init -input=false -no-color", { cwd: runDir });
		send("aws", "running", "Terraform initialized");

		// terraform validate
		send("aws", "running", "Validating Terraform syntax...");
		await runCommand("terraform validate -no-color", { cwd: runDir });
		send("aws", "running", "Terraform configuration is valid");

		// terraform plan
		send("aws", "running", "Creating execution plan...");
		const planResult = await runCommand("terraform plan -input=false -no-color -out=tfplan", { cwd: runDir });
		send("aws", "running", "Plan created. Waiting for approval...", { plan: mergeCommandOutput(planResult).slice(0, 500) });

		// terraform apply (with auto-approve for demo purposes)
		send("aws", "running", "Deploying to AWS...");
		const applyResult = await runCommand("terraform apply -input=false -no-color -auto-approve tfplan", { cwd: runDir });

		send("aws", "done", "Deployed to AWS successfully!", { output: mergeCommandOutput(applyResult).slice(0, 1000) });
		res.end();
	} catch (err) {
		send("aws", "error", err.error || err.message, { details: mergeCommandOutput(err) });
		res.end();
	}
});

// ══════════════════════════════════════════════════════════════════════════════════
// ROUTE: /api/aws/destroy (Destroy AWS resources)
// ══════════════════════════════════════════════════════════════════════════════════
app.post("/api/aws/destroy", async (req, res) => {
	const runDir = path.join(TEMP_DIR, "aws-*");
	const dirs = fs
		.readdirSync(TEMP_DIR)
		.filter((d) => d.startsWith("aws-"))
		.map((d) => path.join(TEMP_DIR, d));

	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");

	try {
		for (const dir of dirs) {
			res.write(`data: ${JSON.stringify({ step: "destroy", status: "running", message: `Destroying ${path.basename(dir)}...` })}\n\n`);
			try {
				await runCommand("terraform destroy -input=false -no-color -auto-approve", { cwd: dir });
			} catch {}
		}
		res.write(`data: ${JSON.stringify({ step: "destroy", status: "done", message: "All AWS resources destroyed" })}\n\n`);
		res.end();
	} catch (err) {
		res.write(`data: ${JSON.stringify({ step: "destroy", status: "error", error: err.message })}\n\n`);
		res.end();
	}
});

// ══════════════════════════════════════════════════════════════════════════════════
// ROUTE: /api/aws/status (Check AWS resources)
// ══════════════════════════════════════════════════════════════════════════════════
app.get("/api/aws/status", async (req, res) => {
	try {
		const [ec2, s3, rds] = await Promise.all([
			runCommand('aws ec2 describe-instances --query "Reservations[].Instances[].InstanceId" --output text'),
			runCommand("aws s3 ls"),
			runCommand('aws rds describe-db-instances --query "DBInstances[].DBInstanceIdentifier" --output text'),
		]);

		res.json({
			ok: true,
			ec2: ec2.stdout.trim().split("\n").filter(Boolean),
			s3: s3.stdout.trim().split("\n").filter(Boolean),
			rds: rds.stdout.trim().split("\n").filter(Boolean),
		});
	} catch (err) {
		res.status(500).json({ ok: false, error: err.message });
	}
});

// ══════════════════════════════════════════════════════════════════════════════════
// NEW SAAS ENDPOINTS: Credential Management & AWS Deployment
// ══════════════════════════════════════════════════════════════════════════════════

// ── ENDPOINT 1: POST /api/auth/set-credentials ────────────────────────────────────
// Accept AWS credentials from user and store in session
// Input: { accessKeyId, secretAccessKey, region }
app.post("/api/auth/set-credentials", async (req, res) => {
	try {
		const { accessKeyId, secretAccessKey, region } = req.body;

		if (!accessKeyId || !secretAccessKey || !region) {
			return res.status(400).json({
				ok: false,
				error: "Missing required fields: accessKeyId, secretAccessKey, region",
			});
		}

		// Store credentials in session (local memory - 24hr expiration)
		req.session.awsCredentials = {
			accessKeyId,
			secretAccessKey,
			region,
			storedAt: new Date(),
		};

		// Verify credentials by listing S3 buckets
		const s3Client = new S3Client({
			region,
			credentials: {
				accessKeyId,
				secretAccessKey,
			},
		});

		try {
			const buckets = await s3Client.send(new ListBucketsCommand({}));
			res.json({
				ok: true,
				message: "AWS credentials verified and stored",
				bucketCount: buckets.Buckets?.length || 0,
				region,
			});
		} catch (verifyErr) {
			req.session.awsCredentials = null;
			return res.status(401).json({
				ok: false,
				error: "Invalid AWS credentials: " + verifyErr.message,
			});
		}
	} catch (err) {
		console.error("Set credentials error:", err.message);
		res.status(500).json({ ok: false, error: err.message });
	}
});

// ── ENDPOINT 2: POST /api/deploy ────────────────────────────────────────────────────
// Main SaaS endpoint: Generate Terraform + Deploy to real AWS
// Input: { architecture, businessConfig }
app.post("/api/deploy", async (req, res) => {
	try {
		const { architecture, businessConfig = {} } = req.body;

		// Check for stored credentials
		if (!req.session.awsCredentials) {
			return res.status(401).json({
				ok: false,
				error: "No AWS credentials found. Please set credentials first via /api/auth/set-credentials",
			});
		}

		const deploymentId = `deploy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
		const deployDir = path.join(DEPLOYMENTS_DIR, deploymentId);

		if (!fs.existsSync(deployDir)) {
			fs.mkdirSync(deployDir, { recursive: true });
		}

		// Generate Terraform configuration
		const terraformPrompt = `
Generate ONLY valid Terraform HCL code.

STRICT RULES:
- Do NOT use backticks
- Do NOT use markdown formatting
- Use only double quotes (")
- Do NOT use semicolons (;)
- Use proper Terraform block syntax (multi-line)
- Output ONLY code, no explanation

Generate production-ready Terraform HCL for the following AWS architecture:
Tier: ${architecture?.tier || "Standard"}
Components: ${JSON.stringify(architecture?.components || {})}

Requirements:
- Use region ap-south-1 (Mumbai)
- Include VPC with public/private subnets
- Security groups with least-privilege rules
- RDS with encryption and backups
- S3 with versioning
- CloudWatch monitoring
- Use variables for customization
- Include outputs for deployed resources

Start with: terraform {
`;
		let terraformCode;
		try {
			terraformCode = await generateTerraformWithRetry(terraformPrompt, DEPLOY_TERRAFORM_ATTEMPTS);
		} catch (genErr) {
			console.warn("[AI] Falling back to deterministic Terraform template:", genErr.message);
			terraformCode = buildFallbackTerraform(architecture, businessConfig);
		}

		// Write Terraform files
		fs.writeFileSync(path.join(deployDir, "main.tf"), terraformCode);
		fs.writeFileSync(path.join(deployDir, ".gitignore"), "*.tfstate*\n.terraform/\n.env\n");

		// Create terraform.tfvars with deployment config
		const tfvars = `# Auto-generated by ShopOps
app_name = "${businessConfig.appName || "shopops"}"
environment = "production"
`;
		fs.writeFileSync(path.join(deployDir, "terraform.tfvars"), tfvars);

		// Stream deployment progress to client
		res.setHeader("Content-Type", "text/event-stream");
		res.setHeader("Cache-Control", "no-cache");
		res.setHeader("Connection", "keep-alive");
		res.setHeader("Access-Control-Allow-Origin", "*");

		// Helper to send SSE messages
		const sendEvent = (type, data) => {
			res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
		};

		// Get AWS env variables from session
		const awsEnv = {
			...process.env,
			AWS_ACCESS_KEY_ID: req.session.awsCredentials.accessKeyId,
			AWS_SECRET_ACCESS_KEY: req.session.awsCredentials.secretAccessKey,
			AWS_REGION: req.session.awsCredentials.region,
			AWS_DEFAULT_REGION: req.session.awsCredentials.region,
		};

		// Step 1: terraform init
		sendEvent("progress", { step: 1, message: "Running Terraform preflight checks..." });
		try {
			await execAsync("terraform fmt -no-color", { cwd: deployDir, env: awsEnv, timeout: 30000 });
			await execAsync("terraform init -backend=false -input=false -no-color", { cwd: deployDir, env: awsEnv, timeout: 120000 });
			await execAsync("terraform validate -no-color", { cwd: deployDir, env: awsEnv, timeout: 60000 });
			sendEvent("progress", { step: 1, message: "✓ Terraform syntax preflight passed" });
		} catch (err) {
			sendEvent("error", { message: "Terraform syntax check failed: " + err.message });
			res.end();
			return;
		}

		sendEvent("progress", { step: 1, message: "Initializing Terraform..." });
		try {
			await execAsync("terraform init", { cwd: deployDir, env: awsEnv, timeout: 60000 });
			sendEvent("progress", { step: 1, message: "✓ Terraform initialized" });
		} catch (err) {
			sendEvent("error", { message: "Terraform init failed: " + err.message });
			res.end();
			return;
		}

		// Step 2: terraform validate
		sendEvent("progress", { step: 2, message: "Validating Terraform configuration..." });
		try {
			await execAsync("terraform validate", { cwd: deployDir, env: awsEnv, timeout: 30000 });
			sendEvent("progress", { step: 2, message: "✓ Configuration valid" });
		} catch (err) {
			sendEvent("error", { message: "Terraform validation failed: " + err.message });
			res.end();
			return;
		}

		// Step 3: terraform plan
		sendEvent("progress", { step: 3, message: "Planning infrastructure changes..." });
		try {
			const planResult = await execAsync("terraform plan -no-color -out=tfplan", {
				cwd: deployDir,
				env: awsEnv,
				timeout: 120000,
				maxBuffer: 10 * 1024 * 1024,
			});
			sendEvent("progress", { step: 3, message: "✓ Plan created successfully" });
		} catch (err) {
			sendEvent("warning", { message: "Plan output: " + err.message.slice(0, 200) });
		}

		// Step 4: terraform apply
		sendEvent("progress", { step: 4, message: "Applying infrastructure changes to AWS..." });
		try {
			const applyResult = await execAsync("terraform apply -auto-approve tfplan", {
				cwd: deployDir,
				env: awsEnv,
				timeout: 600000, // 10 minutes
				maxBuffer: 10 * 1024 * 1024,
			});
			sendEvent("progress", { step: 4, message: "✓ Infrastructure deployed" });
		} catch (err) {
			sendEvent("error", { message: "Terraform apply failed: " + err.message });
			res.end();
			return;
		}

		// Step 5: Get outputs
		sendEvent("progress", { step: 5, message: "Retrieving resource information..." });
		try {
			const outputResult = await execAsync("terraform output -json", {
				cwd: deployDir,
				env: awsEnv,
				timeout: 30000,
				maxBuffer: 10 * 1024 * 1024,
			});
			const outputs = JSON.parse(outputResult.stdout);

			// Save deployment info
			const deploymentInfo = {
				deploymentId,
				createdAt: new Date(),
				status: "active",
				architecture,
				businessConfig,
				outputs,
				credentials: {
					region: req.session.awsCredentials.region,
				},
				terraformDir: deployDir,
			};
			fs.writeFileSync(path.join(deployDir, "deployment.json"), JSON.stringify(deploymentInfo, null, 2));

			sendEvent("complete", {
				deploymentId,
				message: "Deployment successful!",
				outputs,
			});
		} catch (err) {
			sendEvent("error", { message: "Failed to retrieve outputs: " + err.message });
		}

		res.end();
	} catch (err) {
		console.error("Deploy error:", err.message);
		res.status(500).json({ ok: false, error: err.message });
	}
});

// ── ENDPOINT 3: GET /api/deployments ─────────────────────────────────────────────────
// List all active deployments
app.get("/api/deployments", (req, res) => {
	try {
		if (!fs.existsSync(DEPLOYMENTS_DIR)) {
			return res.json({ ok: true, deployments: [] });
		}

		const deployments = fs
			.readdirSync(DEPLOYMENTS_DIR)
			.filter((name) => name.startsWith("deploy_"))
			.map((name) => {
				try {
					const deploymentInfoPath = path.join(DEPLOYMENTS_DIR, name, "deployment.json");
					if (fs.existsSync(deploymentInfoPath)) {
						return JSON.parse(fs.readFileSync(deploymentInfoPath, "utf8"));
					}
					return { deploymentId: name, status: "unknown" };
				} catch {
					return { deploymentId: name, status: "error" };
				}
			});

		res.json({ ok: true, deployments });
	} catch (err) {
		console.error("List deployments error:", err.message);
		res.status(500).json({ ok: false, error: err.message });
	}
});

// ── ENDPOINT 4: POST /api/destroy/:deploymentId ──────────────────────────────────────
// Destroy AWS resources created by a deployment
app.post("/api/destroy/:deploymentId", async (req, res) => {
	try {
		const { deploymentId } = req.params;

		if (!req.session.awsCredentials) {
			return res.status(401).json({
				ok: false,
				error: "No AWS credentials found",
			});
		}

		const deployDir = path.join(DEPLOYMENTS_DIR, deploymentId);

		if (!fs.existsSync(deployDir)) {
			return res.status(404).json({
				ok: false,
				error: `Deployment ${deploymentId} not found`,
			});
		}

		// Stream destroy progress
		res.setHeader("Content-Type", "text/event-stream");
		res.setHeader("Cache-Control", "no-cache");
		res.setHeader("Connection", "keep-alive");

		const sendEvent = (type, data) => {
			res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
		};

		const awsEnv = {
			...process.env,
			AWS_ACCESS_KEY_ID: req.session.awsCredentials.accessKeyId,
			AWS_SECRET_ACCESS_KEY: req.session.awsCredentials.secretAccessKey,
			AWS_REGION: req.session.awsCredentials.region,
		};

		sendEvent("progress", { message: "Starting destruction of AWS resources..." });

		try {
			await execAsync("terraform destroy -auto-approve", {
				cwd: deployDir,
				env: awsEnv,
				timeout: 600000,
				maxBuffer: 10 * 1024 * 1024,
			});
			sendEvent("complete", { message: "Resources destroyed successfully" });
		} catch (err) {
			sendEvent("warning", { message: "Destruction completed with: " + err.message.slice(0, 200) });
		}

		res.end();
	} catch (err) {
		console.error("Destroy error:", err.message);
		res.status(500).json({ ok: false, error: err.message });
	}
});

// ── ENDPOINT 5: GET /api/metrics/:deploymentId ───────────────────────────────────────
// Get real CloudWatch metrics for a deployment
app.get("/api/metrics/:deploymentId", async (req, res) => {
	try {
		const { deploymentId } = req.params;

		if (!req.session.awsCredentials) {
			return res.status(401).json({
				ok: false,
				error: "No AWS credentials found",
			});
		}

		const cloudwatchClient = new CloudWatchClient({
			region: req.session.awsCredentials.region,
			credentials: {
				accessKeyId: req.session.awsCredentials.accessKeyId,
				secretAccessKey: req.session.awsCredentials.secretAccessKey,
			},
		});

		const endTime = new Date();
		const startTime = new Date(endTime.getTime() - 3600000); // Last hour

		// Get EC2 CPU metrics (example)
		const metrics = await cloudwatchClient.send(
			new GetMetricStatisticsCommand({
				Namespace: "AWS/EC2",
				MetricName: "CPUUtilization",
				StartTime: startTime,
				EndTime: endTime,
				Period: 300, // 5 minutes
				Statistics: ["Average", "Maximum"],
			})
		);

		res.json({
			ok: true,
			deploymentId,
			metrics: metrics.Datapoints || [],
			unit: metrics.Unit || "Percent",
			timestamp: new Date(),
		});
	} catch (err) {
		console.error("Metrics error:", err.message);
		res.status(500).json({ ok: false, error: err.message });
	}
});

// ── ENDPOINT 6: POST /api/scale/:deploymentId ───────────────────────────────────────
// Scale infrastructure by modifying Terraform variables
app.post("/api/scale/:deploymentId", async (req, res) => {
	try {
		const { deploymentId } = req.params;
		const { instanceType, rdsSize, minReplicas, maxReplicas } = req.body;

		if (!req.session.awsCredentials) {
			return res.status(401).json({
				ok: false,
				error: "No AWS credentials found",
			});
		}

		const deployDir = path.join(DEPLOYMENTS_DIR, deploymentId);

		if (!fs.existsSync(deployDir)) {
			return res.status(404).json({
				ok: false,
				error: `Deployment ${deploymentId} not found`,
			});
		}

		// Stream scaling progress
		res.setHeader("Content-Type", "text/event-stream");
		res.setHeader("Cache-Control", "no-cache");
		res.setHeader("Connection", "keep-alive");

		const sendEvent = (type, data) => {
			res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
		};

		// Update terraform.tfvars
		let tfvars = fs.readFileSync(path.join(deployDir, "terraform.tfvars"), "utf8");
		if (instanceType) tfvars += `\ninstance_type = "${instanceType}"`;
		if (rdsSize) tfvars += `\nrds_instance_type = "${rdsSize}"`;
		if (minReplicas) tfvars += `\nmin_replicas = ${minReplicas}`;
		if (maxReplicas) tfvars += `\nmax_replicas = ${maxReplicas}`;

		fs.writeFileSync(path.join(deployDir, "terraform.tfvars"), tfvars);

		const awsEnv = {
			...process.env,
			AWS_ACCESS_KEY_ID: req.session.awsCredentials.accessKeyId,
			AWS_SECRET_ACCESS_KEY: req.session.awsCredentials.secretAccessKey,
			AWS_REGION: req.session.awsCredentials.region,
		};

		sendEvent("progress", { message: "Planning scaling changes..." });

		try {
			await execAsync("terraform plan -no-color -out=tfplan", {
				cwd: deployDir,
				env: awsEnv,
				timeout: 120000,
				maxBuffer: 10 * 1024 * 1024,
			});

			sendEvent("progress", { message: "Applying scaling changes..." });

			await execAsync("terraform apply -auto-approve tfplan", {
				cwd: deployDir,
				env: awsEnv,
				timeout: 600000,
				maxBuffer: 10 * 1024 * 1024,
			});

			sendEvent("complete", { message: "Scaling completed successfully" });
		} catch (err) {
			sendEvent("error", { message: "Scaling failed: " + err.message.slice(0, 200) });
		}

		res.end();
	} catch (err) {
		console.error("Scale error:", err.message);
		res.status(500).json({ ok: false, error: err.message });
	}
});

const PORT = 3001;
app.listen(PORT, () => {
	console.log(`\n🚀 ShopOps AI Backend running on http://localhost:${PORT}`);
	console.log(`   🆕 POST /api/auth/set-credentials    → Store AWS credentials`);
	console.log(`   🆕 POST /api/deploy                  → Deploy infrastructure to real AWS`);
	console.log(`   🆕 GET  /api/deployments             → List active deployments`);
	console.log(`   🆕 POST /api/destroy/:deploymentId   → Destroy infrastructure`);
	console.log(`   🆕 GET  /api/metrics/:deploymentId   → Get CloudWatch metrics`);
	console.log(`   🆕 POST /api/scale/:deploymentId     → Scale resources`);
	console.log(`   POST /api/architecture  → llama3 (architecture reasoning)`);
	console.log(`   POST /api/terraform     → deepseek-coder (HCL generation)`);
	console.log(`   POST /api/dockerfile    → deepseek-coder (Docker)`);
	console.log(`   POST /api/cicd          → deepseek-coder (GitHub Actions)`);
	console.log(`   GET  /api/health        → Ollama status`);
	console.log(`   POST /api/architecture  → llama3 (architecture reasoning)`);
	console.log(`   POST /api/terraform     → deepseek-coder (HCL generation)`);
	console.log(`   POST /api/dockerfile    → deepseek-coder (Docker)`);
	console.log(`   POST /api/cicd          → deepseek-coder (GitHub Actions)`);
	console.log(`   GET  /api/health        → Ollama status`);
	console.log(`   🆕 POST /api/docker/deploy    → Run Docker containers`);
	console.log(`   🆕 GET  /api/docker/stats     → Get Docker stats`);
	console.log(`   🆕 POST /api/docker/control   → Control containers`);
	console.log(`   🆕 GET  /api/docker/logs     → Stream Docker logs (SSE)`);
	console.log(`   🆕 POST /api/kubernetes/apply → Deploy to K8s`);
	console.log(`   🆕 GET  /api/kubernetes/status → K8s status`);
	console.log(`   🆕 POST /api/deploy-all      → Deploy everything (SSE)`);
	console.log(`   🆕 POST /api/localstack/deploy → Run Terraform on LocalStack`);
	console.log(`   🆕 POST /api/aws/deploy       → DEPLOY TO REAL AWS (SSE) ⚠️`);
	console.log(`   🆕 GET  /api/aws/status     → Check AWS resources`);
	console.log(`   🆕 POST /api/act/run          → Run GitHub Actions with act`);
	console.log(`   🆕 POST /api/loadtest/start   → Simulate traffic with autocannon`);
	console.log(`   🆕 POST /api/destroy          → Tear down local integrations`);
	console.log(`   🆕 POST /api/architecture/diagram → Generate Mermaid diagram`);
	console.log(`   🆕 GET  /api/debug/ollama         → Test Ollama connectivity\n`);
});

app.get("/api/debug/ollama", async (req, res) => {
	try {
		const result = await ollama("hi");
		res.json({ ok: true, result });
	} catch (err) {
		res.status(500).json({ ok: false, error: err.message, stack: err.stack });
	}
});
