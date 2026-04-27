# Docker Setup Guide

This document explains how to run ShopOps Infra using Docker and Docker Compose.

## Prerequisites

- **Docker** ≥ 24.0
- **Docker Compose** ≥ 2.20
- At least 4GB RAM available for Docker

## Quick Start

### 1. Start all services

```bash
docker-compose up -d
```

This will start:
- **Ollama** (Local LLM) on port 11434
- **Backend** (Express API) on port 3001
- **Frontend** (React UI) on port 5175

### 2. Verify services are running

```bash
docker-compose ps
```

Expected output:
```
NAME              STATUS          PORTS
shopops-ollama    Up (healthy)    0.0.0.0:11434->11434/tcp
shopops-backend   Up (healthy)    0.0.0.0:3001->3001/tcp
shopops-frontend  Up (healthy)    0.0.0.0:5175->5175/tcp
```

### 3. Open in browser

Navigate to: **http://localhost:5175**

## Commands

### View logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f ollama
```

### Stop services

```bash
# Stop all services (keep volumes)
docker-compose stop

# Remove containers but keep volumes
docker-compose down

# Remove everything (including volumes)
docker-compose down -v
```

### Rebuild images

```bash
# Rebuild specific service
docker-compose build backend
docker-compose build frontend

# Rebuild all and restart
docker-compose up -d --build
```

### Pull latest Ollama models

```bash
# SSH into Ollama container and pull models
docker exec -it shopops-ollama ollama pull llama3
docker exec -it shopops-ollama ollama pull deepseek-coder
```

### Access backend shell

```bash
docker exec -it shopops-backend /bin/sh
```

### Access frontend shell

```bash
docker exec -it shopops-frontend /bin/sh
```

## Volumes & Persistence

The docker-compose configuration creates these volumes:

1. **ollama-data**: Ollama models storage
   - Location: `/root/.ollama` inside container
   - Host location: Docker named volume

2. **deployments**: Terraform deployment state
   - Location: `/app/backend/deployments` inside container
   - Host location: `./backend/deployments`

3. **temp**: Temporary files
   - Location: `/app/backend/temp` inside container
   - Host location: `./backend/temp`

## Health Checks

All services have health checks configured:

```bash
# Check if services are healthy
docker-compose ps --format "table {{.Names}}\t{{.Status}}"
```

Health checks verify:
- **Ollama**: Can reach `/api/tags` endpoint
- **Backend**: Can reach `/api/health` endpoint
- **Frontend**: Can reach home page

## Environment Variables

Edit `.env.docker` to customize:

```bash
NODE_ENV=production
OLLAMA_HOST=http://ollama:11434
REACT_APP_API_URL=http://localhost:3001
```

## Networking

Services communicate via the `shopops-network` bridge network:

- **Backend** connects to **Ollama** at: `http://ollama:11434`
- **Frontend** connects to **Backend** at: `http://localhost:3001` (from browser)
- **Frontend** connects to **Backend** at: `http://backend:3001` (from container)

## Troubleshooting

### Services won't start

```bash
# Check Docker daemon
docker ps

# Review logs
docker-compose logs

# Rebuild images
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Port already in use

```bash
# Find process using port
# On Windows:
netstat -ano | findstr :5175

# Kill process (replace PID)
taskkill /PID <PID> /F

# Or change ports in docker-compose.yml
```

### Ollama models not found

```bash
# Pull models
docker exec -it shopops-ollama ollama pull llama3
docker exec -it shopops-ollama ollama pull deepseek-coder

# Verify models
docker exec -it shopops-ollama ollama list
```

### Deployment volumes not persisting

```bash
# Check volume mounts
docker inspect shopops-backend | grep -A 10 "Mounts"

# Ensure backend/deployments exists
mkdir -p backend/deployments backend/temp
```

## Performance Tips

### Reduce memory usage

```yaml
# In docker-compose.yml, add to services:
resources:
  limits:
    memory: 2G
  reservations:
    memory: 1G
```

### Use lighter Ollama models

```bash
docker exec -it shopops-ollama ollama pull neural-chat
```

### Clear old images

```bash
docker image prune -a
```

## Production Deployment

For production, consider:

1. Use `.env` file for secrets
2. Enable image signing and verification
3. Use private Docker registry
4. Configure resource limits
5. Enable restart policies
6. Use Docker secrets for sensitive data
7. Implement log aggregation
8. Set up monitoring and alerts

Example production docker-compose override:

```yaml
services:
  backend:
    restart: always
    resources:
      limits:
        memory: 2G
      reservations:
        memory: 1G
  frontend:
    restart: always
```

## Next Steps

- Read [USER_WORKFLOW.md](../USER_WORKFLOW.md) for complete usage guide
- Check [README.md](../README.md) for architecture overview
- Review CI/CD workflows in `.github/workflows/`
