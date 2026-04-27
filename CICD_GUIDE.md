# CI/CD Pipeline Documentation

This document explains the complete CI/CD pipeline for ShopOps Infra.

## Overview

The project uses **GitHub Actions** for automated testing, building, scanning, and deployment.

## Workflows

### 1. Main CI/CD Pipeline (`ci-cd.yml`)

Runs on: **push to main/mm/features** or **pull requests**

**Jobs:**
1. **test-backend**: Unit tests, linting, dependency audit
2. **test-frontend**: Build, tests, dependency check
3. **build-docker**: Build Docker images, push to GitHub Container Registry
4. **security-scan**: Trivy vulnerability scanning
5. **terraform-validate**: Validate Terraform configurations (if present)
6. **k8s-validate**: Validate Kubernetes manifests (if present)
7. **summary**: Pipeline status report

**Status Page:** Check GitHub Actions tab for real-time status

---

### 2. Deployment Workflow (`deploy.yml`)

Runs on: **push to main** or **manual trigger**

**Steps:**
1. Check if changes warrant deployment
2. Build production images
3. Push to GitHub Container Registry
4. Generate deployment instructions

**Deploy Instructions:**
```bash
# On your server:
git clone https://github.com/JUST1REGULAR2SAI/shopops-infra.git
cd shopops-infra
docker-compose pull
docker-compose up -d
```

---

### 3. Integration Tests (`integration-tests.yml`)

Runs on: **every push** and **nightly schedule (2 AM UTC)**

**Tests:**
- Backend API endpoints health check
- Frontend build validation
- Docker Compose configuration validation
- Service integration with Ollama

---

### 4. Code Quality & Dependencies (`quality.yml`)

Runs on: **push/PR** and **weekly schedule (1 AM Monday UTC)**

**Checks:**
- Dependency audits (npm audit)
- Outdated packages detection
- ESLint code quality
- Code duplication analysis
- Docker image security scanning (Trivy)
- License compliance

---

## Pipeline Status

### Success Criteria ✅

- All tests pass
- No critical security vulnerabilities
- Docker images build successfully
- All manifests validate

### Failure Handling 🔴

If any job fails:
1. GitHub sends notification to PR/push author
2. CI/CD badge shows "failed" on README
3. Merge to main is blocked (if branch protection enabled)
4. Logs available in GitHub Actions tab

---

## Secrets & Configuration

### Required Secrets (Optional for GitHub Container Registry)

No secrets required by default. GitHub Container Registry uses `GITHUB_TOKEN`.

### Optional Secrets

Add to GitHub Settings → Secrets:

- `DOCKERHUB_USERNAME`: For DockerHub push
- `DOCKERHUB_TOKEN`: DockerHub authentication
- `DEPLOY_SSH_KEY`: For server deployment
- `DEPLOY_HOST`: Target server IP/domain

---

## Monitoring & Notifications

### GitHub Actions Tab

View all workflow runs: **Settings → Actions → Workflows**

### Badge in README

```markdown
![CI/CD](https://github.com/JUST1REGULAR2SAI/shopops-infra/workflows/CI%2FCD%20Pipeline/badge.svg)
```

### Email Notifications

- ✅ Failure notifications (default)
- ✅ Success notifications (optional)
- ✅ Scheduled run notifications (disable optional)

Configure: **GitHub → Notifications Settings**

---

## Docker Image Registry

### Location

GitHub Container Registry: `ghcr.io/JUST1REGULAR2SAI/shopops-infra`

### Tags

- `latest` - Latest stable release
- `main` - Latest from main branch
- `mm/features` - Latest from mm/features branch
- `prod-{sha}` - Production release with commit SHA

### Pull Images

```bash
docker pull ghcr.io/JUST1REGULAR2SAI/shopops-infra-backend:latest
docker pull ghcr.io/JUST1REGULAR2SAI/shopops-infra-frontend:latest
```

### Authentication

```bash
echo $CR_PAT | docker login ghcr.io -u USERNAME --password-stdin
```

---

## Local CI/CD Simulation

Run tests locally before pushing:

### Backend Tests

```bash
cd backend
npm install
npm test
npm run lint --if-present
```

### Frontend Tests

```bash
npm install
npm run build
npm test --if-present
```

### Docker Build

```bash
docker build -f Dockerfile.backend -t shopops-backend:test .
docker build -f Dockerfile.frontend -t shopops-frontend:test .
```

### Terraform Validation

```bash
terraform -version
terraform init -backend=false
terraform validate
terraform fmt -check
```

---

## Troubleshooting

### Workflow Won't Start

- ✅ Check if workflow file syntax is valid (YAML)
- ✅ Verify branch protection rules
- ✅ Check if `on:` triggers are correct
- ✅ Review `.github/workflows/` files

**Fix:**
```bash
# Validate YAML
npm install -g yamllint
yamllint .github/workflows/
```

### Tests Failing on Main But Passing Locally

**Possible causes:**
- Node version mismatch
- Environment variables missing
- Dependency caching issue

**Fix:**
```bash
# Clear GitHub Actions cache
# In repo: Settings → Actions → Clear all caches

# Or rebuild without cache locally
docker build --no-cache -f Dockerfile.backend -t shopops-backend:test .
```

### Docker Build Timeout

**Cause:** Large dependencies or slow network

**Fix:**
```yaml
# In .github/workflows/ci-cd.yml
jobs:
  build-docker:
    timeout-minutes: 60  # Increase timeout
```

### Security Scan Failures

**Common issues:**
- Vulnerable dependencies detected
- Container image CVEs

**Resolution:**
```bash
# Update dependencies
npm update
npm audit fix

# Update Docker base images
docker pull node:20-alpine
docker pull nginx:latest
```

---

## Best Practices

### 1. Commit Messages
```
feat: Add new feature
fix: Fix bug
docs: Update documentation
test: Add tests
ci: Update CI/CD
```

### 2. Branch Protection
- Require status checks to pass
- Require code review (1+ approvals)
- Dismiss stale reviews
- Require updated branches

### 3. Pull Requests
- Link to issues
- Provide description
- Add labels (bug, feature, etc.)
- Wait for CI/CD to pass

### 4. Deployments
- Always deploy from main
- Review deployment logs
- Monitor application health
- Have rollback plan

---

## Next Steps

1. **Enable Branch Protection**: Settings → Branches → Add rule
2. **Configure Secrets**: Settings → Secrets → Add repository secret
3. **Monitor Runs**: Actions tab → Watch workflow progress
4. **Review Logs**: Failed job → View logs
5. **Deploy**: Merge to main → Automatic deployment

---

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Build Action](https://github.com/docker/build-push-action)
- [Trivy Security Scanner](https://aquasecurity.github.io/trivy/)
- [Terraform Testing](https://www.terraform.io/docs/cli/commands/validate.html)

---

**Last Updated:** April 26, 2026
