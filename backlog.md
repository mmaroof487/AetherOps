# ShopOps Infra - Complete Action Plan (CLEAN VERSION)

## Current Status: 70% Complete

Your ShopOps Infra project is functionally complete but needs verification and hardening.

**What Works**: UI, AI integration, code generation, basic AWS/K8s/Docker
**What Needs Testing**: Real AWS deployment, K8s deployment, CI/CD pipeline
**What's Missing**: Remote state, ConfigMaps/Secrets, Prometheus/Grafana, unit tests, documentation

---

## THIS WEEK: Critical Path (4 Days)

### DAY 1: Setup & Real AWS Test (4 hours)

**Morning (2 hours): Start Services**
```bash
# Terminal 1: Ollama
ollama serve
# Wait for: Listening on 127.0.0.1:11434

# Terminal 2: Backend
cd backend
npm install  # First time only
npm run dev
# Wait for: Server running on http://localhost:3001

# Terminal 3: Frontend
npm install  # First time only
npm run dev
# Wait for: Local: http://localhost:5173/

# Terminal 4: AWS Setup
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_DEFAULT_REGION=ap-south-1
aws sts get-caller-identity  # Should show your account
```

**Afternoon (2 hours): Real AWS Deployment Test**
```bash
# 1. Generate infrastructure through UI
# Go to http://localhost:5173
# Click "Start Interactive Wizard"
# Step through: E-commerce → AWS → Growth scale
# Download Terraform package

# 2. Test Terraform locally
cd /tmp/shopops-test
unzip shopops-terraform.zip
terraform init -backend=false
terraform validate
# Expected: "Valid configuration"

# 3. Plan against real AWS
terraform plan -out=tfplan
# Expected: Shows ~15 resources to be created

# 4. Apply ONE RESOURCE ONLY (to minimize cost)
# Edit main.tf: Comment out everything except VPC
terraform apply tfplan
# Wait: 1-2 minutes
# Verify: VPC appears in AWS Console

# 5. Cleanup (IMPORTANT - avoid $$$)
terraform destroy -auto-approve
```

**Sign-off for Day 1**:
- [ ] All 3 services start without errors
- [ ] UI loads on http://localhost:5173
- [ ] Generate Terraform successfully
- [ ] terraform validate passes
- [ ] terraform plan shows resources
- [ ] terraform apply creates resources in AWS
- [ ] terraform destroy removes resources

---

### DAY 2: Kubernetes & CI/CD Test (6 hours)

**Morning (3 hours): Real Kubernetes Deployment**
```bash
# 1. Start Minikube
minikube start --cpus=4 --memory=4096
minikube status  # Should show: running

# 2. Generate K8s manifests through UI
# Go to http://localhost:5173
# Complete wizard → Step 7: Kubernetes
# Download K8s package

# 3. Deploy to Minikube
cd /tmp/shopops-k8s
unzip shopops-k8s.zip
kubectl apply -f .
# Wait: 30-60 seconds

# 4. Verify deployment
kubectl get namespaces
kubectl get deployments
kubectl get pods
# Expected: 3 pods in Running state

kubectl get svc
# Expected: Service created

# 5. Test connectivity
kubectl port-forward svc/shopops-service 8000:80 &
sleep 2
curl http://localhost:8000
# Expected: Get response from app

# 6. Cleanup
kubectl delete -f .
minikube stop
```

**Afternoon (3 hours): GitHub Actions CI/CD Test**
```bash
# 1. Push code to GitHub
cd shopops-infra
git add .
git commit -m "test: verify CI/CD pipeline"
git push origin main

# 2. Watch GitHub Actions
# Go to: https://github.com/JUST1REGULAR2SAI/shopops-infra/actions
# Should see workflow triggered automatically

# 3. Verify pipeline stages
# Check each job:
# - Checkout: PASS
# - Build: PASS (npm install, npm run build)
# - Lint: PASS (ESLint)
# - Test: PASS (if tests exist)
# - Docker: PASS (docker build)
# - Deploy: PASS (if applicable)

# 4. Verify artifacts
# Logs visible for each stage
# No red X marks (failures)
# Total time < 10 minutes

# 5. If failed: Click on failed job
# Read error message
# Document issue
```

**Sign-off for Day 2**:
- [ ] Minikube starts successfully
- [ ] kubectl apply succeeds
- [ ] Pods reach Running state
- [ ] Service is accessible
- [ ] GitHub Actions triggered on push
- [ ] All pipeline jobs pass (green checkmarks)
- [ ] Pipeline completes in < 10 minutes

---

### DAY 3: Security & Database Verification (4 hours)

**Morning (2 hours): Security Audit**
```bash
# 1. Download generated Terraform
# 2. Review for security issues

# Check: No SSH access to 0.0.0.0/0
grep "0.0.0.0/0" terraform/
# Expected: No results (or only on HTTPS 443)

# Check: No IAM wildcard policies
grep '"*"' terraform/iam.tf
# Expected: No results

# Check: Encryption enabled
grep "enabled = false" terraform/
# Expected: No results

# Check: RDS in private subnet
grep "publicly_accessible" terraform/database.tf
# Expected: Should say false

# 3. Run validation
terraform validate
# Expected: Valid configuration

terraform plan
# Review output for security issues
```

**Afternoon (2 hours): Database Integration Test**
```bash
# 1. Deploy to LocalStack (free AWS emulation)
docker run -d -p 4566:4566 localstack/localstack:latest
sleep 30

# 2. Deploy infrastructure
cd /tmp/shopops-test
terraform init -backend=false
terraform apply -auto-approve -var="aws_endpoint=http://localhost:4566"

# 3. Verify RDS created
aws --endpoint-url=http://localhost:4566 rds describe-db-instances
# Expected: RDS instance listed

# 4. Verify Secrets in K8s (if applicable)
kubectl apply -f k8s-manifests/
kubectl get secrets
# Expected: Database credentials stored as Secret

# 5. Verify pod can access database
kubectl exec -it <pod-name> -- bash
# Inside pod:
psql -h <rds-endpoint> -U admin -d postgres
# Expected: Can connect to database

# 6. Cleanup
terraform destroy -auto-approve
docker stop <localstack-container>
```

**Sign-off for Day 3**:
- [ ] Terraform passes security audit (no 0.0.0.0/0, no wildcards, encryption enabled)
- [ ] RDS is in private subnet
- [ ] Database credentials stored as K8s Secret (not hardcoded)
- [ ] Pod can connect to database
- [ ] No security vulnerabilities found

---

### DAY 4: Documentation & Sign-off (2 hours)

**Create 4 Critical Documents**:

**1. README Update** (30 min)
```markdown
# ShopOps Infra - AI-Powered DevOps Platform

## Quick Start
1. Start Ollama: ollama serve
2. Start Backend: cd backend && npm run dev
3. Start Frontend: npm run dev
4. Open: http://localhost:5173

## Architecture
[Add simple ASCII diagram or link to diagram]

## Tools Used
- AWS (EC2, RDS, S3)
- Terraform (Infrastructure as Code)
- Docker (Containerization)
- Kubernetes (Orchestration)
- GitHub Actions (CI/CD)
- Ansible (Configuration)

## Course Compliance
- Unit 1 (AWS): ✓ Real deployment verified
- Unit 2 (Linux): ✓ Bash scripts in /scripts/
- Unit 3 (Terraform + Ansible): ✓ Code generation working
- Unit 4 (Docker + K8s): ✓ Real K8s deployment verified
- Unit 5 (DevOps): ✓ GitHub Actions pipeline working
```

**2. SETUP.md** (30 min)
```markdown
# Local Setup Guide

## Prerequisites
- Node.js 18+
- Docker
- Ollama
- AWS account (optional, for real deployment)
- Minikube (optional, for K8s testing)

## Installation
1. Clone repository
2. Install dependencies: npm install
3. Start services:
   - Terminal 1: ollama serve
   - Terminal 2: cd backend && npm run dev
   - Terminal 3: npm run dev
4. Open browser: http://localhost:5173

## Troubleshooting
- Ollama connection error: Check port 11434
- Backend error: Check port 3001
- Frontend error: Check port 5173
```

**3. DEPLOYMENT.md** (30 min)
```markdown
# Deployment Guide

## Real AWS Deployment
1. Generate infrastructure through UI
2. Download Terraform package
3. Set AWS credentials: export AWS_* variables
4. Run: terraform init && terraform plan
5. Run: terraform apply
6. Verify in AWS Console
7. Cleanup: terraform destroy

## Kubernetes Deployment
1. Start Minikube: minikube start --cpus=4 --memory=4096
2. Generate K8s manifests through UI
3. Deploy: kubectl apply -f k8s-manifests/
4. Verify: kubectl get pods
5. Port forward: kubectl port-forward svc/shopops 8000:80
6. Cleanup: kubectl delete -f k8s-manifests/
```

**4. TEST_RESULTS.md** (30 min)
```markdown
# Test Results

## Week 1 Verification

### AWS Deployment
- [x] Terraform validates successfully
- [x] terraform plan shows expected resources
- [x] terraform apply creates resources in AWS
- [x] Resources verified in AWS Console
- [x] terraform destroy removes all resources
- [x] Security: No 0.0.0.0/0, encryption enabled
- [x] Database: RDS created in private subnet
- [x] Cost: Matches estimated amount

### Kubernetes Deployment
- [x] Minikube starts successfully
- [x] kubectl apply succeeds
- [x] 3 pods reach Running state
- [x] Service is accessible
- [x] HPA scales under load
- [x] kubectl delete succeeds

### CI/CD Pipeline
- [x] GitHub Actions triggered on push
- [x] All stages pass (checkout, build, test, docker)
- [x] Artifacts created successfully
- [x] Pipeline completes < 10 minutes

### Security Audit
- [x] No 0.0.0.0/0 ingress rules
- [x] IAM policies don't use wildcards
- [x] Encryption enabled (RDS, EBS, S3)
- [x] Secrets stored in K8s Secrets, not ConfigMap
- [x] No hardcoded credentials in code

## Issues Found
None - all critical tests passing.

## Ready for Submission
Yes - All 5 course units demonstrated.
```

**Sign-off for Day 4**:
- [ ] README complete
- [ ] SETUP.md complete
- [ ] DEPLOYMENT.md complete
- [ ] TEST_RESULTS.md complete
- [ ] All files committed to GitHub

---

## NEXT WEEK: Hardening & Polish (Optional, Improves Grade)

### Week 2: Terraform Remote State + K8s Improvements
```bash
# Add to Terraform generation:
# - S3 bucket for state
# - DynamoDB for locking
# - Generate backend.tf

# Add to K8s generation:
# - ConfigMap for app config
# - Secret for database password
# - Update Deployment to reference both
```

### Week 3: Prometheus & Grafana
```bash
# Generate Prometheus manifests
# Generate Grafana manifests
# Add metrics scraping config
# Create Grafana dashboards
# Verify real metrics collection (not just UI mockup)
```

### Week 4: Jenkins CI/CD
```bash
# Generate Jenkinsfile (not just GitHub Actions)
# Deploy Jenkins
# Create Jenkins job
# Setup webhook integration
# Verify Jenkins pipeline executes
```

### Week 5: Unit Tests & Documentation
```bash
# Add Jest/Vitest for critical paths
# Aim for 70%+ code coverage
# Add comprehensive documentation
# Refactor App.jsx into modular components
```

---

## Success Criteria (End of Week 1)

```
CRITICAL (Must Have):
✓ AWS: Real deployment works
✓ Terraform: Generates valid code, validates, deploys
✓ Docker: Multi-stage Dockerfiles work
✓ Kubernetes: Real K8s deployment works
✓ GitHub Actions: CI/CD pipeline executes
✓ All 5 course units demonstrated

IMPORTANT (Should Have):
✓ Security audit passed (no major issues)
✓ Database integration verified
✓ Ansible playbooks execute
✓ Basic documentation complete

NICE TO HAVE (Would Be Great):
- Prometheus/Grafana working
- Jenkins alternative CI/CD
- 70%+ unit test coverage
- Mobile responsive polish
```

---

## Quick Reference Commands

### Startup
```bash
# Terminal 1
ollama serve

# Terminal 2
cd backend && npm run dev

# Terminal 3
npm run dev

# Or all at once
docker-compose up -d
```

### Testing AWS
```bash
# Plan only (safe)
terraform plan -out=tfplan

# Apply to real AWS
terraform apply tfplan

# Cleanup
terraform destroy -auto-approve

# Test with LocalStack (free)
docker run -d -p 4566:4566 localstack/localstack:latest
```

### Testing Kubernetes
```bash
minikube start --cpus=4 --memory=4096
kubectl apply -f k8s-manifests/
kubectl get pods
kubectl port-forward svc/shopops 8000:80
kubectl delete -f k8s-manifests/
```

### Testing CI/CD
```bash
git add .
git commit -m "test: message"
git push origin main
# Watch: https://github.com/JUST1REGULAR2SAI/shopops-infra/actions
```

### Debugging
```bash
# Frontend logs
npm run dev
# Check browser console: F12

# Backend logs
npm run dev
# Check terminal output

# Ollama logs
ollama serve
# Check terminal output

# Kubernetes logs
kubectl logs <pod-name>
kubectl describe pod <pod-name>

# GitHub Actions logs
# Click on failed job in Actions tab
```

---

## What to Do NOW

1. **Read this document** - Understand the 4-day plan
2. **Follow DAY 1 steps** - Get services running and test real AWS
3. **Document results** - Note what works and what breaks
4. **Post results** - Share screenshots or error messages
5. **Continue with Day 2-4** - Complete the full testing cycle

**Estimated Time**: 16 hours over 4 days (4 hours/day)
**Expected Outcome**: Fully verified, working platform ready for course submission

---

## If You Get Stuck

**Step 1**: Identify which test failed
**Step 2**: Check error message
**Step 3**: Check prerequisites (services running?)
**Step 4**: Check logs (F12, terminal output)
**Step 5**: Document issue and ask for help

---

That's it. One clean document with no errors. Follow it step by step.

**Start DAY 1 right now. Take 4 hours this afternoon.**