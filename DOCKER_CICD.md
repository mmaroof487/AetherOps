# 🐳 Docker & CI/CD Documentation

Complete Docker containerization and CI/CD pipeline for ShopOps Infra.

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Docker Setup](#docker-setup)
3. [Development](#development)
4. [Production](#production)
5. [CI/CD Pipelines](#cicd-pipelines)
6. [AWS Deployment](#aws-deployment)
7. [Kubernetes](#kubernetes)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Option A: Docker Compose (Recommended for Local Development)

```bash
# 1. Clone and setup
git clone <repo>
cd shopops-infra

# 2. Copy environment variables
cp .env.example .env

# 3. Start all services
npm run docker:dev

# 4. Open browser
# Frontend: http://localhost:5175
# Backend: http://localhost:3001
# Ollama: http://localhost:11434
```

### Option B: Direct Node.js (Keep Node installed)

```bash
# Terminal 1 - Frontend
npm run dev

# Terminal 2 - Backend
cd backend && npm run dev
```

---

## 🐳 Docker Setup

### Dockerfiles

#### **Backend Dockerfile** (`Dockerfile.backend`)
- Node.js 20 Alpine
- Multi-stage build (not used here, can be optimized)
- Health check on `/api/health`
- Exposes port `3001`

#### **Frontend Dockerfile** (`Dockerfile.frontend`)
- Node.js 20 Alpine builder
- Multi-stage build for optimization
- Production: uses `serve` to run built app
- Health check with wget
- Exposes port `5175`

### Docker Compose Files

#### **Development** (`docker-compose.yml`)
```yaml
Services:
- ollama        (LLM service)
- backend       (Express.js API)
- frontend      (React + Vite)

Networks: shopops-network
Volumes: ollama-data, deployments, temp
```

**Usage:**
```bash
npm run docker:dev        # Start all services
npm run docker:down       # Stop services
npm run docker:logs       # View logs
npm run docker:rebuild    # Rebuild from scratch
```

#### **Production** (`docker-compose.prod.yml`)
```yaml
Services:
- ollama        (LLM service)
- backend       (Express.js API with resource limits)
- frontend      (React + Vite)
- nginx         (Reverse proxy & load balancer)
- prometheus    (Metrics collection)
- grafana       (Dashboards & alerts)

Resource Limits:
- Backend: 2 CPU cores, 2GB memory
```

**Usage:**
```bash
npm run docker:prod           # Start production stack
npm run docker:down:prod      # Stop production stack
docker-compose -f docker-compose.prod.yml logs -f
```

---

## 💻 Development

### Local Development with Docker

```bash
# 1. Start containers
npm run docker:dev

# 2. View logs
npm run docker:logs

# 3. Build backend
npm run docker:build

# 4. Clean up
npm run docker:down
npm run docker:clean

# 5. Full rebuild
npm run docker:rebuild
```

### Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Key variables:
```env
NODE_ENV=development
REACT_APP_API_URL=http://localhost:3001
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama2
```

### Accessing Services

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:5175 | React app |
| Backend API | http://localhost:3001/api | Express.js API |
| Ollama | http://localhost:11434/api | LLM service |
| Docker | Docker daemon | Container runtime |

---

## 🏭 Production

### Production Stack

The production setup includes:
- **Nginx** (reverse proxy, load balancer, SSL termination)
- **Prometheus** (metrics collection)
- **Grafana** (dashboards, alerts)
- Resource limits on containers
- Persistent logging
- Health checks on all services

### Deploy Production Stack

```bash
# 1. Set environment
export NODE_ENV=production
export OLLAMA_MODEL=llama2-7b

# 2. Copy production env
cp .env.example .env
# Edit .env with production values

# 3. Start production
npm run docker:prod

# 4. Access services
# Frontend: http://localhost (via Nginx)
# Backend: http://localhost/api (via Nginx)
# Grafana: http://localhost:3000
# Prometheus: http://localhost:9090
```

### Scaling & Resource Management

Edit `docker-compose.prod.yml` to adjust resource limits:

```yaml
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 4G
    reservations:
      cpus: '2'
      memory: 2G
```

---

## 🔄 CI/CD Pipelines

### GitHub Actions Workflows

#### **1. CI/CD Pipeline** (`.github/workflows/ci-cd.yml`)

Triggered on: `push` to `main`, `pull_request`

**Jobs:**
- ✅ **Lint** - ESLint frontend & backend
- 📦 **Build** - Vite build, upload artifacts
- 🐳 **Docker** - Build & push Docker images
- 🏗️ **Terraform Validate** - Validate IaC
- ☸️ **K8s Validate** - Validate Kubernetes manifests
- 📊 **Summary** - Pipeline status

**Usage:**
```bash
git push origin main  # Triggers workflow
```

#### **2. Security Scanning** (`.github/workflows/security.yml`)

Triggered on: `push` to `main`/`develop`, Weekly schedule

**Checks:**
- 📦 **Dependency Check** - npm audit
- 🔍 **Trivy Scan** - Container vulnerabilities
- 🔐 **CodeQL** - SAST analysis
- 🚨 **Secret Detection** - TruffleHog
- ⚠️ **OWASP Check** - Dependency vulnerabilities

#### **3. Docker Build & Push** (`.github/workflows/docker-build.yml`)

Triggered on: `push` to `main`, Tags, Manual workflow dispatch

**Features:**
- Builds backend & frontend images
- Pushes to **AWS ECR** (if configured)
- Pushes to **DockerHub** (if credentials set)
- Multi-stage build optimization
- Cache via GitHub Actions

**Required Secrets:**
```
AWS_ACCOUNT_ID
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
DOCKERHUB_USERNAME
DOCKERHUB_TOKEN
```

#### **4. Deployment** (`.github/workflows/deploy.yml`)

Triggered on: `push` to `main`, Manual workflow dispatch

**Stages:**
1. 🎯 Prepare (environment, image tag)
2. 🐳 Deploy to ECS
3. ☸️ Deploy to Kubernetes
4. 💊 Health Checks (smoke tests)
5. 📢 Notifications (Slack)

**Deployment Targets:**
- AWS ECS (Elastic Container Service)
- AWS EKS (Elastic Kubernetes Service)
- Kubernetes clusters

**Required Secrets:**
```
AWS_ACCOUNT_ID
SLACK_WEBHOOK_URL
```

---

## ☁️ AWS Deployment

### Prerequisites

1. **AWS Account** with IAM permissions
2. **ECR Repositories** created:
   ```bash
   aws ecr create-repository --repository-name shopops-app-backend
   aws ecr create-repository --repository-name shopops-app-frontend
   ```

3. **GitHub OIDC Role** for AWS:
   ```bash
   # Create IAM role with GitHub as trusted entity
   # Attach policies for ECR, ECS, EKS, Lambda
   ```

### ECR Push

Images are automatically pushed to ECR on `main` branch push:

```
[AWS_ACCOUNT_ID].dkr.ecr.[REGION].amazonaws.com/shopops-app-backend:latest
[AWS_ACCOUNT_ID].dkr.ecr.[REGION].amazonaws.com/shopops-app-frontend:latest
```

### ECS Deployment

Update ECS task definitions with new image tags:

```bash
# Manual deployment
aws ecs update-service \
  --cluster shopops-cluster \
  --service shopops-production \
  --force-new-deployment
```

### EKS Deployment

Automatic rolling updates via kubectl:

```bash
kubectl set image deployment/shopops-backend \
  shopops-backend=[ECR_URI]:latest
```

---

## ☸️ Kubernetes

### K8s Manifests

Located in `k8s/`:
- `app-deployment-template.yaml` - Backend & Frontend
- `grafana-deployment.yaml` - Monitoring
- `prometheus-deployment.yaml` - Metrics

### Deploy to K8s

```bash
# 1. Create namespace
kubectl create namespace shopops-prod

# 2. Apply manifests
kubectl apply -f k8s/ -n shopops-prod

# 3. Check deployments
kubectl get deployments -n shopops-prod

# 4. View logs
kubectl logs -f deployment/shopops-backend -n shopops-prod

# 5. Port forward
kubectl port-forward svc/shopops-backend 3001:3001 -n shopops-prod
```

---

## 🧪 Testing

### Unit Tests

```bash
# Frontend
npm test

# Backend
cd backend && npm test
```

### Integration Tests

```bash
npm run docker:dev
npm run docker:test
```

### Performance Testing

Using `autocannon`:

```bash
cd backend
npm install autocannon
npx autocannon http://localhost:3001/api/health
```

---

## 📊 Monitoring & Observability

### Prometheus

Access: http://localhost:9090

**Metrics:**
- Container CPU/Memory usage
- Request rates
- Error rates
- Response times

### Grafana

Access: http://localhost:3000 (admin/admin)

**Default Dashboards:**
- System metrics
- Application performance
- Container statistics

### Logs

```bash
# View all logs
npm run docker:logs

# Backend only
npm run docker:logs:backend

# Frontend only
npm run docker:logs:frontend

# Docker compose logs
docker-compose logs -f --tail=100
```

---

## 🔐 Security

### Security Scanning

Automated security checks run on every push:

- ✅ Dependency vulnerabilities (npm audit)
- ✅ Container image scanning (Trivy)
- ✅ Static analysis (CodeQL)
- ✅ Secret detection (TruffleHog)
- ✅ OWASP vulnerabilities

**View Results:**
1. GitHub Repository → Security → Code scanning
2. Dependabot alerts
3. Container registry scan results

### Best Practices

```bash
# Don't commit secrets
git-secrets --install
git-secrets --register-aws

# Use .env.example for templates
cp .env.example .env
# Edit .env with real values

# Rotate credentials regularly
# Use AWS secrets manager for production
```

---

## 🐛 Troubleshooting

### Issue: Containers won't start

```bash
# 1. Check Docker daemon
docker ps

# 2. Check compose file
docker-compose config

# 3. View detailed logs
docker-compose logs

# 4. Rebuild everything
npm run docker:rebuild
```

### Issue: Port already in use

```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
```

### Issue: Out of disk space

```bash
# Clean up Docker
npm run docker:clean

# Remove all unused images
docker image prune -a

# Remove all unused volumes
docker volume prune
```

### Issue: Memory errors

Increase Docker memory limits:
- Windows/Mac: Docker Desktop Settings → Resources → Memory
- Linux: Edit docker-compose.yml resource limits

### Issue: Network connectivity

```bash
# Check network
docker network ls

# Inspect network
docker network inspect shopops-network

# Restart docker
docker-compose down
docker system prune
docker-compose up -d
```

### Issue: Building hangs

```bash
# Check BuildKit
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Rebuild with no cache
docker-compose build --no-cache

# Check Docker logs
docker logs docker_buildx
```

---

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS ECR Documentation](https://docs.aws.amazon.com/ecr/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)

---

## ✅ Checklist for Production Deployment

- [ ] All environment variables configured
- [ ] AWS credentials set up
- [ ] Docker images built and pushed to ECR
- [ ] SSL certificates configured for Nginx
- [ ] Database backups configured
- [ ] Monitoring & alerts set up
- [ ] Security scanning passed
- [ ] Load balancer configured
- [ ] Auto-scaling policies set
- [ ] Disaster recovery plan tested

---

## 🤝 Contributing

To contribute improvements to Docker/CI-CD:

1. Create a feature branch
2. Make changes
3. Test locally with `npm run docker:dev`
4. Push to trigger CI/CD
5. Create pull request

---

**Last Updated:** April 2026
