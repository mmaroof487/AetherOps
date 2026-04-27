# Docker & CI/CD Quick Reference

## 🐳 Docker Commands

### Start/Stop Services

```bash
# Start all services in background
docker-compose up -d

# Stop all services
docker-compose stop

# Restart services
docker-compose restart

# Remove containers (keep volumes)
docker-compose down

# Remove everything including volumes
docker-compose down -v

# Rebuild and start
docker-compose up -d --build
```

### View Status & Logs

```bash
# Show running services
docker-compose ps

# View logs (all services)
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f ollama

# Last 100 lines
docker-compose logs --tail=100
```

### Build & Push

```bash
# Build specific service
docker-compose build backend
docker-compose build frontend

# Rebuild without cache
docker-compose build --no-cache

# View built images
docker images | grep shopops
```

### Access Services

```bash
# Shell into backend
docker exec -it shopops-backend /bin/sh

# Shell into frontend
docker exec -it shopops-frontend /bin/sh

# Shell into ollama
docker exec -it shopops-ollama /bin/bash

# Run command in container
docker exec shopops-backend npm test
```

### Data Persistence

```bash
# View volumes
docker volume ls | grep shopops

# Inspect ollama volume
docker volume inspect shopops-infra_ollama-data

# Backup deployments
cp -r backend/deployments ./backup/

# Restore deployments
cp -r ./backup/deployments backend/
```

### Cleanup

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove unused networks
docker network prune

# Full cleanup (WARNING: destructive)
docker system prune -a --volumes
```

---

## 🚀 CI/CD Workflows

### Workflow Status in GitHub

```
Repository → Actions Tab → Select Workflow
```

**Check:**
- ✅ Status badge (green/red)
- ✅ Latest runs
- ✅ Job logs for failures
- ✅ Deployment history

### GitHub Actions URLs

- **CI/CD Runs**: `github.com/{owner}/{repo}/actions?query=workflow:CI%2FCD%20Pipeline`
- **Deploy Runs**: `github.com/{owner}/{repo}/actions?query=workflow:Deploy`
- **All Workflows**: `github.com/{owner}/{repo}/actions`

### Trigger Workflows

```bash
# Push code to trigger automatically
git push origin main

# Or manually trigger (if configured)
# GitHub Actions tab → Select workflow → Run workflow
```

### Monitor Workflow Progress

```bash
# Watch live on GitHub
# Actions tab → Select run → Watch jobs execute

# Or check locally (after push)
# Git logs show which commit triggered workflow
git log --oneline -n 5
```

### View Workflow Results

```
✅ Success:
- All jobs passed (green checkmarks)
- Images pushed to registry
- Deployment instructions generated

❌ Failed:
- Job failed (red X)
- Click job → View logs
- Debug and fix issue
- Push again to retry
```

---

## 📊 CI/CD Pipeline at a Glance

| Stage | Jobs | Time | Condition |
|-------|------|------|-----------|
| **Test** | Backend, Frontend | 3-5 min | Every push |
| **Build** | Docker build & push | 4-6 min | Every push |
| **Scan** | Trivy, ESLint, deps | 2-3 min | Every push |
| **Validate** | Terraform, K8s | 1-2 min | If files exist |
| **Deploy** | Build prod images | 5-7 min | main branch only |
| **Summary** | Report status | 1 min | Always last |

**Total Pipeline Time:** ~8-15 minutes per push

---

## 🔍 Checking Workflow Status

### From GitHub Web UI

```
1. Go to: github.com/JUST1REGULAR2SAI/shopops-infra
2. Click: "Actions" tab
3. Select: "CI/CD Pipeline" workflow
4. View: Latest runs with status
5. Click: Run ID to see details
6. Expand: Job name to see logs
```

### From Command Line

```bash
# Install GitHub CLI
# brew install gh (macOS)
# choco install gh (Windows)
# apt install gh (Linux)

# Login
gh auth login

# View workflow runs
gh run list --workflow=ci-cd.yml

# View specific run
gh run view <RUN_ID> --log

# Trigger workflow manually
gh workflow run ci-cd.yml
```

---

## 🐛 Debugging Failed Workflows

### Steps to Debug

1. **Go to Actions tab**
   - Find failed workflow run
   - Click to expand details

2. **Click failed job**
   - View full log output
   - Search for error message

3. **Identify failure**
   - Test failure → Check test code
   - Build failure → Check Dockerfile
   - Scan failure → Fix code/dependency
   - Deploy failure → Check credentials

4. **Fix and push**
   - Make fix locally
   - Commit and push
   - Workflow runs automatically
   - Check Actions tab for pass

### Common Failures

**Test Failed**
```
Solution: Run tests locally, fix, commit
Command: npm test
```

**Docker Build Failed**
```
Solution: Build locally to debug
Command: docker build -f Dockerfile.backend -t test .
```

**Security Scan Failed**
```
Solution: Update dependencies or fix code
Command: npm audit fix
```

**Terraform Validate Failed**
```
Solution: Fix Terraform syntax
Command: terraform fmt -recursive terraform/
```

---

## 📈 Performance Optimization

### Speed Up Docker Builds

```bash
# Use cache
docker-compose build --cache-from=type=local,src=.docker-cache

# Parallel builds
docker-compose build --parallel

# Only rebuild changed services
# Docker will automatically detect and skip unchanged services
```

### Speed Up CI/CD

```yaml
# In workflow file, use caching:
- uses: actions/cache@v3
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

### Local Testing Before Push

```bash
# Build locally first
docker-compose build

# Run tests locally
npm test && cd backend && npm test

# Only push if passing
git push origin feature-branch
```

---

## 🔐 Security Best Practices

### Docker Security

```bash
# Don't run containers as root
# Already configured in Dockerfiles

# Scan images for vulnerabilities
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image shopops-backend:latest

# Keep images updated
docker-compose pull
```

### CI/CD Security

```bash
# Don't commit secrets to repo
# Use GitHub Secrets instead

# Review Actions permissions
# Settings → Actions → General → Permissions

# Enable branch protection
# Settings → Branches → Add rule
# Require status checks to pass
```

---

## 📞 Getting Help

### Documentation
- `DOCKER_SETUP.md` - Detailed Docker guide
- `CICD_GUIDE.md` - Detailed CI/CD guide
- `README.md` - Overview

### Common Issues

| Issue | Solution |
|-------|----------|
| Port already in use | Kill process or change port in docker-compose.yml |
| Build timeout | Increase timeout-minutes in workflow |
| Permission denied | Run with `sudo` or add user to docker group |
| Out of disk space | Remove unused images: `docker prune -a` |

### Debug Commands

```bash
# Check Docker daemon
docker ps

# Test connectivity
docker exec shopops-backend curl http://ollama:11434/api/tags

# View environment variables
docker exec shopops-backend env

# Check volume mounts
docker inspect shopops-backend | grep -A 10 "Mounts"
```

---

## ✅ Verification Checklist

### Docker Verification

- [ ] `docker-compose ps` shows 3 services
- [ ] All services show "healthy" status
- [ ] Can access http://localhost:5175 (frontend)
- [ ] Can access http://localhost:3001 (backend)
- [ ] Backend can reach Ollama at http://ollama:11434
- [ ] Deployments persist in `backend/deployments/`

### CI/CD Verification

- [ ] Workflows appear in GitHub Actions tab
- [ ] Status badge shows (green/red)
- [ ] Latest run completed successfully
- [ ] Images pushed to GitHub Container Registry
- [ ] Can pull images: `docker pull ghcr.io/...`
- [ ] No security vulnerabilities in scan

---

**Last Updated:** April 26, 2026

For detailed guides, see `DOCKER_SETUP.md` and `CICD_GUIDE.md`
