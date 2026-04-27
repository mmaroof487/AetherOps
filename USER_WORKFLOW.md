# 🚀 ShopOps Infra - Complete User Workflow

This document guides you through the complete end-to-end workflow for using ShopOps Infra to deploy real AWS infrastructure.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Starting the Platform](#starting-the-platform)
4. [Step-by-Step Workflow](#step-by-step-workflow)
5. [Feature Testing](#feature-testing)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Ensure you have these installed:

- **Node.js** ≥18
- **npm** (comes with Node.js)
- **Ollama** with models:
  ```bash
  ollama pull llama3
  ollama pull deepseek-coder
  ```
- **Docker** ≥24 (optional, for containerization)
- **Terraform** ≥1.5 (optional, already bundled for AWS)
- **AWS Account** with credentials (for Step 6: AWS Credentials)

---

## Environment Setup

### 1. Install Frontend Dependencies

```bash
cd c:/Users/mmuaz/Desktop/Projects/shopops-infra
npm install
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Verify Prerequisites

```bash
# Check Node.js version
node --version  # Should be ≥18

# Check Ollama is running
curl http://localhost:11434/api/tags

# Check if Ollama models are available
ollama list | grep -E "llama3|deepseek-coder"
```

---

## Starting the Platform

### Option A: Start Both Servers (Recommended)

**Terminal 1 - Frontend:**
```bash
cd c:/Users/mmuaz/Desktop/Projects/shopops-infra
npm run dev
# → http://localhost:5175
```

**Terminal 2 - Backend:**
```bash
cd c:/Users/mmuaz/Desktop/Projects/shopops-infra/backend
npm run dev
# → http://localhost:3001
```

Wait for both servers to show "ready" messages, then open [http://localhost:5175](http://localhost:5175) in your browser.

### Option B: Start Only Backend (API Testing)

```bash
cd backend && npm run dev
# → http://localhost:3001
# Use Postman, curl, or REST Client to test endpoints
```

---

## Step-by-Step Workflow

### **Step 1: Enter Business Description** (Frontend)

- Go to http://localhost:5175 (frontend)
- Enter a business description, e.g.:
  ```
  E-commerce platform for selling handmade products. Need 3 EC2 instances
  for the app layer, an RDS PostgreSQL database for products and orders,
  and S3 for product images.
  ```
- Click **"Next"**

**Expected Output:**
- Text appears in the form field
- No backend call yet (local wizard step)

---

### **Step 2: AI Architecture Analysis** (Backend)

- The wizard calls `/api/architecture` with your business description
- Backend queries `llama3` (Ollama) for cloud architecture reasoning
- Architecture is displayed on screen with resource recommendations

**Expected Output:**
```json
{
  "reasoning": "For an e-commerce platform...",
  "resources": {
    "compute": "EC2 t3.large (3 instances)",
    "database": "RDS PostgreSQL",
    "storage": "S3",
    ...
  }
}
```

**Troubleshooting:**
- If no response: Check Ollama is running with `ollama list`
- Timeout? Llama3 inference takes 30-60 seconds - wait for completion

---

### **Step 3: Generate Terraform Infrastructure Code** (Backend)

- Backend calls `/api/terraform` with business description
- `deepseek-coder` generates production-grade HCL
- Terraform code is displayed and ready for deployment

**Expected Output:**
```hcl
resource "aws_instance" "app" {
  count         = 3
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.large"
  ...
}

resource "aws_db_instance" "postgres" {
  engine = "postgres"
  ...
}
```

**What This Means:**
- Real, executable Terraform code ready to deploy to AWS
- Code follows AWS best practices
- All resources tagged and configured

---

### **Step 4: Generate Dockerfile** (Backend)

- Backend calls `/api/dockerfile`
- `deepseek-coder` generates optimized multi-stage Dockerfile
- Includes NODE/Python runtime, dependency caching, minimal image size

**Expected Output:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
...

FROM node:20-alpine
COPY --from=builder /app/node_modules ./node_modules
...
```

---

### **Step 5: Generate CI/CD Pipeline** (Backend)

- Backend calls `/api/cicd`
- `deepseek-coder` generates GitHub Actions workflow
- Includes build, test, push-to-registry, deploy steps

**Expected Output:**
```yaml
name: Deploy
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build image
        run: docker build -t myapp:${{ github.sha }} .
```

---

### **Step 6: AWS Credentials Setup** (New Feature!)

**This is where it becomes real - you're about to deploy to AWS**

1. In the wizard, reach **"Step 6: AWS Setup"**
2. Enter your AWS credentials:
   - **Access Key ID**: Your AWS IAM user access key
   - **Secret Access Key**: Your AWS IAM user secret key
   - **Region**: Select AWS region (us-east-1, us-west-2, etc.)
3. Click **"Verify Credentials"**

**Expected Output:**
- ✅ "Credentials verified successfully!"
- Backend connected to your real AWS account
- Session stores credentials in memory (local testing only)

**Security Note:**
- Credentials only stored in-memory for this session
- Not persisted to disk
- Lost when server restarts
- ⚠️ NOT production-safe (as per requirements, local-only deployment)

**Troubleshooting:**
- "Invalid credentials": Check Access Key ID and Secret Key are correct
- "Failed to list S3 buckets": Check IAM user has S3 permissions
- "Invalid region": Pick from dropdown

---

### **Step 7: Deploy to AWS** (New Feature!)

**Real Infrastructure Deployment**

1. Review your Terraform code from Step 3
2. Click **"Deploy to AWS"**
3. Watch real-time deployment progress via Server-Sent Events (SSE):
   - `terraform init` - Initialize Terraform working directory
   - `terraform validate` - Validate HCL syntax
   - `terraform plan` - Preview changes
   - `terraform apply` - Create AWS resources

**Expected Output:**
```
✓ terraform init ............................ 3s
✓ terraform validate ........................ 1s
✓ terraform plan ............................ 8s

Plan: 5 to add, 0 to change, 0 to destroy
↓ terraform apply ........................... 45s (in progress)

Resources created:
  + aws_instance.app[0]
  + aws_instance.app[1]
  + aws_instance.app[2]
  + aws_db_instance.postgres
  + aws_s3_bucket.images
```

**What Happens in AWS:**
- Real EC2 instances spin up (takes 2-3 minutes)
- RDS database created with automatic backups
- S3 bucket configured with lifecycle rules
- VPC, subnets, security groups configured
- All resources tagged with deployment ID

**Cost Implications:**
- ⚠️ Real resources = real AWS charges
- EC2 t3.large: ~$0.10/hour
- RDS db.t3.medium: ~$0.15/hour
- Monitor AWS billing if testing multiple deployments

**Troubleshooting:**
- "terraform: command not found": Terraform not in PATH
- "InsufficientInstanceCapacity": Region full, try different region
- "Failed to create RDS": Security group rules may be blocking

---

### **Step 8: View Live Dashboard** (New Feature!)

**Monitor Your Deployment**

1. After deployment completes, dashboard auto-loads
2. See all active deployments as cards:
   - Deployment ID
   - Status (Active/Failed)
   - AWS Region
   - Infrastructure Tier
   - Created time

3. Click deployment card to expand:
   - **CloudWatch Metrics Graph**: CPU usage over 1 hour
   - **Resource Outputs**: IP addresses, DNS names, database endpoint
   - **Scale Resources**: Change instance type or RDS size
   - **Destroy**: Tear down all resources

**CloudWatch Metrics:**
- Shows real CPU utilization from AWS
- Auto-refreshes every 30-60 seconds
- Helps identify if instances are under load

**Scale Resources:**
```
Current Configuration:
  Instance Type: t3.large
  RDS Size: db.t3.medium
  Min Replicas: 1
  Max Replicas: 3

[Update to t3.xlarge] [Apply Changes] → terraform plan/apply
```

---

## Feature Testing

### Test Scenario 1: Complete Workflow (15 minutes)

```bash
1. Start both servers (Terminal 1: npm run dev, Terminal 2: cd backend && npm run dev)
2. Open http://localhost:5175
3. Step 1: Enter business description
4. Step 2: Generate architecture
5. Step 3: Generate Terraform
6. Step 4: Generate Dockerfile
7. Step 5: Generate CI/CD
8. Step 6: Enter AWS credentials (if you have real AWS account)
9. Step 7: Deploy to AWS (if credentials verified)
10. Step 8: View dashboard and metrics
```

### Test Scenario 2: API Testing Only (5 minutes)

```bash
# Start backend only
cd backend && npm run dev

# Test architecture endpoint
curl -X POST http://localhost:3001/api/architecture \
  -H "Content-Type: application/json" \
  -d '{"description":"E-commerce platform with 3 app servers"}'

# Test Terraform generation
curl -X POST http://localhost:3001/api/terraform \
  -H "Content-Type: application/json" \
  -d '{"description":"E-commerce platform"}'
```

### Test Scenario 3: Deployment Workflow (30 minutes)

```bash
1. Start both servers
2. Go through Steps 1-5 (architecture generation)
3. At Step 6: Enter real AWS credentials (or skip to demo mode)
4. At Step 7: Click "Deploy to AWS"
5. Watch real-time terraform execution
6. Verify resources appear in AWS Console:
   - EC2 Dashboard → Running Instances
   - RDS → DB Instances
   - S3 → Buckets
7. Check dashboard metrics
8. Test scale resources (change instance type)
9. Destroy deployment at end
```

### Test Scenario 4: Multi-Deployment Management (20 minutes)

```bash
1. Complete Step 7 deploy (creates deployment_1)
2. Go back to Step 1, enter different business description
3. Go through Steps 2-7 again (creates deployment_2)
4. Now dashboard shows 2 deployments
5. Test:
   - Switching between deployments
   - Viewing metrics for each
   - Scaling different deployments independently
   - Destroying only one deployment
```

---

## Troubleshooting

### Issue: Frontend won't load

**Check:**
1. Is frontend server running? Should see "VITE v5.4.21 ready in X ms"
2. Port 5175 is free: `lsof -i :5175`
3. Open browser DevTools (F12) → Console tab for errors

**Fix:**
```bash
# Kill port 5175 if in use
powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 5175).OwningProcess -Force"

# Restart frontend
npm run dev
```

---

### Issue: Backend won't start

**Check:**
1. Node.js installed: `node --version`
2. Dependencies installed: `cd backend && npm install`
3. Port 3001 free: `netstat -ano | grep 3001`
4. Ollama running: `curl http://localhost:11434/api/tags`

**Fix:**
```bash
# Kill port 3001 if in use
powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess -Force"

# Reinstall and restart
cd backend
npm install
npm run dev
```

---

### Issue: "Architecture generation times out"

**Cause:** Ollama taking too long or not responding

**Check:**
```bash
# Is Ollama running?
curl http://localhost:11434/api/tags

# Are models downloaded?
ollama list | grep -E "llama3|deepseek-coder"
```

**Fix:**
```bash
# Pull missing models
ollama pull llama3
ollama pull deepseek-coder

# Restart Ollama and retry
```

---

### Issue: "Credentials verification failed"

**Cause:** AWS Access Key or Secret Key incorrect, or IAM user lacks permissions

**Check:**
1. Access Key ID correct (starts with AKIA...)
2. Secret Access Key copied exactly (no extra spaces)
3. IAM user has S3 permissions:
   - Go to AWS Console → IAM → Users
   - Select your user → Permissions
   - Ensure "AmazonS3FullAccess" or equivalent attached

**Fix:**
```bash
# Generate new credentials in AWS Console
# AWS Console → IAM → Users → Security credentials → Create Access Key
# Copy new credentials and retry Step 6
```

---

### Issue: Terraform deployment fails

**Cause:** Invalid AWS credentials, insufficient permissions, or resource limit

**Check:**
1. AWS credentials valid (test at Step 6 first)
2. AWS account has EC2/RDS limits not exceeded
3. Region selected has availability

**Fix:**
```bash
# View detailed error in deployment logs
# Dashboard → Deployment card → Click to view full logs
# Common fixes:
# - Try different region (us-east-1 usually has most availability)
# - Reduce instance count or size
# - Check AWS billing/credits
```

---

### Issue: CloudWatch metrics not showing

**Cause:** EC2 instances need 1-2 minutes to report metrics after startup

**Check:**
1. Wait 2-3 minutes after deployment completes
2. Click refresh button on dashboard
3. Check instances running in AWS Console

**Fix:**
```bash
# Manually refresh dashboard
# Click deployment card again, or refresh browser
# Metrics appear after first monitoring period
```

---

## Quick Reference: Endpoints

| Endpoint | Method | Purpose | Real AWS |
|----------|--------|---------|----------|
| `/api/architecture` | POST | Generate cloud architecture | ❌ Local (Ollama) |
| `/api/terraform` | POST | Generate Terraform HCL | ❌ Local (Ollama) |
| `/api/dockerfile` | POST | Generate Dockerfile | ❌ Local (Ollama) |
| `/api/cicd` | POST | Generate GitHub Actions YAML | ❌ Local (Ollama) |
| `/api/auth/set-credentials` | POST | Set AWS credentials | ✅ Verified with S3 |
| `/api/deploy` | POST | Deploy to AWS via Terraform | ✅ Creates real resources |
| `/api/deployments` | GET | List active deployments | ✅ AWS CloudWatch + Terraform |
| `/api/destroy/:id` | POST | Tear down deployment | ✅ Destroys real resources |
| `/api/metrics/:id` | GET | Get CloudWatch metrics | ✅ Real AWS metrics |
| `/api/scale/:id` | POST | Scale resources up/down | ✅ Updates real resources |

---

## Next Steps

After testing:

1. **Clean Up Deployments**: Use dashboard to destroy test deployments
2. **Review AWS Bill**: Check AWS Console for charges
3. **Optimize Configuration**: Adjust instance types and counts
4. **Production Readiness**:
   - Migrate to real secret management (not in-memory)
   - Set up multi-user authentication
   - Add deployment approval workflow
   - Implement cost controls and limits

---

## Support

For issues or questions:

1. Check the **Troubleshooting** section above
2. Review logs in dashboard deployment cards
3. Check AWS Console for resource details
4. Verify Ollama and all services running: `curl http://localhost:11434/api/tags`

---

**Happy Deploying! 🚀**
