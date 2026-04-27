# 🛍️ ShopOps Infra - AI-Powered Cloud Deployment Platform

> **Deploy Real AWS Infrastructure in Minutes**
> AI-powered platform that generates Terraform, Dockerfiles, and CI/CD pipelines from business descriptions.
> Fully functional SaaS with real-time deployment monitoring and AWS resource management.

---

## ⚡ Quick Start

### Option A: Docker Compose (Recommended)

```bash
# 1. Start all services
docker-compose up -d

# 2. Verify services
docker-compose ps

# 3. Open browser
# Navigate to http://localhost:5175
```

**Services started:**
- ✅ Ollama (LLM) on port 11434
- ✅ Backend (API) on port 3001
- ✅ Frontend (UI) on port 5175

**See [DOCKER_SETUP.md](DOCKER_SETUP.md) for detailed Docker guide**

### Option B: Direct Node.js

```bash
# 1. Install dependencies
npm install && cd backend && npm install

# 2. Start servers (open 2 terminals)
# Terminal 1 - Frontend
npm run dev                       # → http://localhost:5175

# Terminal 2 - Backend  
cd backend && npm run dev         # → http://localhost:3001

# 3. Open browser
# Navigate to http://localhost:5175
```

**That's it!** Follow the wizard to deploy real AWS infrastructure.

---

## � Documentation

| Document | Purpose | Read Time |
|----------|---------|-----------|
| [USER_WORKFLOW.md](USER_WORKFLOW.md) | Complete step-by-step deployment guide | 20 min |
| [DOCKER_SETUP.md](DOCKER_SETUP.md) | Docker & Docker Compose setup guide | 10 min |
| [CICD_GUIDE.md](CICD_GUIDE.md) | CI/CD pipeline documentation | 15 min |
| [QUICK_START.md](QUICK_START.md) | 5-minute quick start | 5 min |
| [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) | Technical architecture details | 10 min |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────┐
│          React Frontend (Vite)              │
│       Port 5175 | 8-Step Wizard             │
│                                             │
│  Steps 1-5: AI Code Generation              │
│  Step 6: AWS Credentials                    │
│  Step 7: Real Deployment (Terraform)        │
│  Step 8: Live Dashboard + Monitoring        │
└────────────────────┬────────────────────────┘
                     │ HTTP + SSE
┌────────────────────▼────────────────────────┐
│         Express Backend (Node.js)           │
│            Port 3001 | 6 Endpoints          │
│                                             │
│  • Architecture Generation (llama3)         │
│  • Terraform HCL Generation (deepseek)      │
│  • Dockerfile Generation                    │
│  • CI/CD Pipeline Generation                │
│  • AWS Credential Management                │
│  • Real Terraform Deployment & Destroy      │
│  • CloudWatch Metrics Retrieval              │
│  • Resource Scaling                         │
└────────────────────┬────────────────────────┘
                     │
         ┌───────────┴──────────────┬──────────────┐
         │                          │              │
    ┌────▼──────┐    ┌─────────────▼──┐  ┌───────▼────┐
    │   Ollama   │    │   AWS Account   │  │  Terraform │
    │ (Local AI) │    │  (Real Cloud)   │  │ (Execution)│
    └────────────┘    └─────────────────┘  └────────────┘
```

---

## ✨ Key Features

| Feature | Details | Technology |
|---------|---------|------------|
| **AI Code Generation** | Terraform, Dockerfile, CI/CD from descriptions | Ollama (llama3 + deepseek-coder) |
| **Real AWS Deployment** | Provision EC2, RDS, S3, VPC, IAM in seconds | AWS SDK + Terraform |
| **Live Monitoring** | Real-time deployment progress streaming | Server-Sent Events (SSE) |
| **CloudWatch Metrics** | Monitor CPU, memory, network in real-time | AWS CloudWatch API |
| **Resource Scaling** | Change instance types and DB size on-the-fly | Terraform plan/apply |
| **Multi-Deployment** | Manage multiple deployments simultaneously | Session + deployment tracking |
| **Dashboard** | Unified view of all active infrastructure | React + Recharts |
| **Containerized** | Run entire platform in Docker | Docker + Docker Compose |
| **CI/CD Pipeline** | Automated testing, building, scanning, deploying | GitHub Actions |
| **Security Scanning** | Vulnerability detection in images & code | Trivy + ESLint |

---

## 🐳 Docker & Containerization

**Fully dockerized for easy deployment:**

- ✅ Backend Dockerfile (Node.js 20 Alpine)
- ✅ Frontend Dockerfile (multi-stage build)
- ✅ docker-compose.yml with Ollama, Backend, Frontend
- ✅ Health checks for all services
- ✅ Volume persistence for deployments
- ✅ Network isolation

**Start in one command:**
```bash
docker-compose up -d
```

See [DOCKER_SETUP.md](DOCKER_SETUP.md) for detailed guide.

---

## 🚀 CI/CD Pipeline (GitHub Actions)

**Automated workflows for quality & deployment:**

| Workflow | Purpose | Trigger |
|----------|---------|---------|
| **ci-cd.yml** | Test, build Docker, scan security | Every push/PR |
| **deploy.yml** | Build & push production images | Push to main |
| **integration-tests.yml** | End-to-end testing | Every push + nightly |
| **quality.yml** | Code quality & dependencies | Weekly + on demand |

**Features:**
- ✅ Parallel job execution
- ✅ Docker image caching
- ✅ Vulnerability scanning (Trivy)
- ✅ Terraform validation
- ✅ K8s manifest validation
- ✅ Dependency audits
- ✅ Code duplication detection
- ✅ License compliance

See [CICD_GUIDE.md](CICD_GUIDE.md) for detailed CI/CD documentation.

---

## 🚀 What You Can Do

1. **Describe your infrastructure in plain English**
   - "E-commerce with 3 app servers, PostgreSQL DB, and S3 storage"

2. **Get production-ready infrastructure code**
   - Terraform HCL (AWS resources)
   - Dockerfile (application container)
   - GitHub Actions workflow (CI/CD pipeline)

3. **Deploy to real AWS in real-time**
   - Watch terraform init → validate → plan → apply
   - See resources appear in AWS Console
   - Monitor resource creation progress

4. **Manage your deployment**
   - View live CloudWatch metrics
   - Scale resources up/down
   - Monitor costs
   - Destroy when done

---

## 📋 Prerequisites

- **Node.js** ≥18
- **Ollama** with models:
  ```bash
  ollama pull llama3
  ollama pull deepseek-coder
  ```
- **AWS Account** (optional - can test without real credentials)
- **Terraform** (optional - already configured in backend)

---

## 📁 Project Structure

```
shopops-infra/
├── src/                          # React frontend
│   ├── App.jsx                   # 8-step wizard
│   ├── screens/
│   │   ├── CredentialsScreen.jsx    # AWS credential input
│   │   ├── DeploymentScreen.jsx     # Real-time deployment progress
│   │   └── EnhancedDashboardScreen  # Deployment management & metrics
│   └── components/               # UI components
├── backend/
│   ├── server.js                 # Express + 6 main endpoints
│   └── deployments/              # Terraform state & outputs (auto-created)
├── scripts/                      # Ops scripts
├── USER_WORKFLOW.md              # Complete step-by-step guide
├── IMPLEMENTATION_SUMMARY.md     # Technical architecture
└── README.md                     # This file
```

---

## 🎯 Quick Examples

### Example 1: Deploy E-commerce Infrastructure

```
Step 1: Enter description
  → "E-commerce platform with 3 app servers, RDS PostgreSQL, and S3"

Step 2-5: Auto-generate code
  → Terraform HCL, Dockerfile, CI/CD pipeline

Step 6: Add AWS credentials
  → Access Key ID and Secret Key

Step 7: Deploy to AWS
  → Real resources created in your AWS account

Step 8: Monitor dashboard
  → View metrics, scale resources, or destroy
```

### Example 2: API Testing Only

```bash
# Start backend only
cd backend && npm run dev

# Test architecture generation
curl -X POST http://localhost:3001/api/architecture \
  -H "Content-Type: application/json" \
  -d '{"description":"3-tier web app"}'

# Test Terraform generation
curl -X POST http://localhost:3001/api/terraform \
  -H "Content-Type: application/json" \
  -d '{"description":"3-tier web app"}'
```

---

## 🔗 Documentation

- **[USER_WORKFLOW.md](USER_WORKFLOW.md)** - Complete end-to-end user guide with all 8 steps, testing scenarios, and troubleshooting
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Technical implementation details and API reference
- **[QUICK_START.md](QUICK_START.md)** - 5-minute quick start for impatient users
- **[SAAS_USER_GUIDE.md](SAAS_USER_GUIDE.md)** - Comprehensive feature guide with advanced scenarios

---

## ⚠️ Important Notes

- **Local Testing Only**: Credentials stored in-memory, not encrypted (per requirements)
- **Real AWS Charges**: Deploying creates real resources that incur AWS charges
- **Session-Based**: Deployments destroyed when backend restarts
- **Terraform State**: Stored in `backend/deployments/` - do not delete during active deployments

---

## 🐛 Troubleshooting

**Frontend won't load?**
```bash
npm run dev  # Ensure running on port 5175
```

**Backend won't start?**
```bash
cd backend && npm install && npm run dev
```

**Ollama not responding?**
```bash
ollama list  # Verify models are downloaded
curl http://localhost:11434/api/tags  # Check if running
```

**AWS deployment failed?**
- Check credentials at Step 6
- Verify IAM permissions (S3FullAccess minimum)
- Try different AWS region
- Check AWS account limits

**See [USER_WORKFLOW.md](USER_WORKFLOW.md#troubleshooting) for complete troubleshooting guide**

---

## 🎓 Learning Outcomes

By using ShopOps Infra, you'll learn:
- ✅ Infrastructure as Code (Terraform)
- ✅ Cloud Architecture Design
- ✅ AWS Resource Management
- ✅ DevOps & CI/CD Pipelines
- ✅ Real-time Application Monitoring
- ✅ Full-stack application development

---

**Ready to deploy? Start with [USER_WORKFLOW.md](USER_WORKFLOW.md)! 🚀**

---

## 🔧 Features

### AI Infrastructure Wizard
- Chat-based onboarding: describe your business in plain English
- AI determines the right AWS tier (Starter / Standard / Business)
- Generates Terraform HCL, Dockerfile, K8s manifests, GitHub Actions YAML

### Interactive Infrastructure Diagram
- SVG-based animated flow diagram showing EC2, RDS, S3, CloudFront connections
- Animated "data flow" dots along connections
- Cloud Mentor tooltips: hover over any component for a plain-English explanation

### Multi-Cloud Translation
- Convert generated AWS Terraform → Google Cloud (GCP)
- Convert generated AWS Terraform → Azure

### Live Metrics Dashboard
- Real-time CPU/RAM charts streamed via Server-Sent Events (SSE)
- Uses `os.loadavg()` when Docker is not running (graceful mock mode)

### InfraVend (Tenant Provisioning)
- Generates a unique `tenant_id`
- Uploads configs to S3
- Triggers Ansible playbook to spin up an isolated Docker container per tenant
- Live terminal log streaming to the browser

---

## 📁 Project Structure

```
shopops-infra/
├── backend/
│   ├── server.js           # Express API + Ollama integration
│   ├── temp/               # Temp files for archive generation
│   └── package.json
├── infravend/
│   ├── playbooks/
│   │   └── provision_tenant.yml   # Ansible automation
│   └── scripts/
│       └── vend.sh                # Tenant vending trigger
├── k8s/
│   ├── app-deployment-template.yaml
│   ├── prometheus-deployment.yaml
│   └── grafana-deployment.yaml
├── scripts/                # Bash ops scripts (Unit 2)
│   ├── validate-terraform.sh
│   ├── apply-infrastructure.sh
│   ├── cleanup-infrastructure.sh
│   ├── build-and-push-docker.sh
│   ├── deploy-k8s.sh
│   ├── health-check.sh
│   ├── get-pod-logs.sh
│   ├── get-cluster-metrics.sh
│   └── setup-ssh-access.sh
├── src/
│   ├── components/         # Modular React components
│   ├── App.jsx             # Main app shell
│   ├── ChatOnboarding.jsx  # AI chat onboarding
│   ├── stitches.config.js  # Design system
│   ├── main.jsx
│   └── index.css
├── .github/
│   └── workflows/
│       └── ci-cd.yml       # GitHub Actions pipeline
├── package.json
├── vite.config.js
├── COURSE_MAPPING.md
└── VERIFICATION_REPORT.md
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/architecture` | Determine cloud tier from business input |
| POST | `/api/terraform` | Generate Terraform HCL |
| POST | `/api/dockerfile` | Generate multi-stage Dockerfile |
| POST | `/api/k8s` | Generate Kubernetes manifests |
| POST | `/api/cicd` | Generate GitHub Actions workflow |
| POST | `/api/provider-convert` | Translate AWS → GCP or Azure |
| GET | `/api/metrics` | SSE stream of CPU/RAM metrics |
| POST | `/api/vend` | Trigger InfraVend tenant provisioning |
| POST | `/api/load-test` | Run autocannon load test |
| GET | `/api/download-bundle` | Download generated files as ZIP |

---

## 🛠️ Ops Scripts

All scripts live in `scripts/`. Make them executable first:

```bash
chmod +x scripts/*.sh
```

| Script | Usage |
|--------|-------|
| `validate-terraform.sh` | Validates and plans Terraform |
| `apply-infrastructure.sh` | Applies Terraform with LocalStack or AWS |
| `cleanup-infrastructure.sh` | Destroys all resources |
| `build-and-push-docker.sh` | Builds, tags, pushes Docker image |
| `deploy-k8s.sh` | Applies K8s manifests, waits for pod readiness |
| `health-check.sh` | Verifies app connectivity |
| `get-pod-logs.sh` | Dumps logs from all pods |
| `get-cluster-metrics.sh` | Shows cluster resource usage |
| `setup-ssh-access.sh` | Configures SSH key for EC2 |

---

## 🔒 Security Notes

- Never commit real AWS credentials — use environment variables
- Generated Terraform uses least-privilege IAM policies
- K8s Secrets are base64-encoded (not hardcoded in Deployment)
- LocalStack is used for safe local testing before real AWS runs

---

## 📖 More Documentation

- [VERIFICATION_REPORT.md](./VERIFICATION_REPORT.md) — Tool verification results
- [COURSE_MAPPING.md](./COURSE_MAPPING.md) — Course unit to tool mapping

---

## 👤 Author

Built by **JUST1REGULAR2SAI** for 21CSE333 Cloud & DevOps.
GitHub: [JUST1REGULAR2SAI/shopops-infra](https://github.com/JUST1REGULAR2SAI/shopops-infra)
