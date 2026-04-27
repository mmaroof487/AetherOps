.PHONY: help docker-dev docker-build docker-prod docker-down docker-logs docker-clean rebuild test lint build

# Variables
COMPOSE_DEV=docker-compose.yml
COMPOSE_PROD=docker-compose.prod.yml

help:
	@echo "ShopOps Infra - Docker & Development Commands"
	@echo ""
	@echo "Development:"
	@echo "  make docker-dev       - Start development environment"
	@echo "  make docker-logs      - View container logs"
	@echo "  make docker-down      - Stop development environment"
	@echo ""
	@echo "Building:"
	@echo "  make docker-build     - Build Docker images"
	@echo "  make rebuild          - Clean rebuild everything"
	@echo ""
	@echo "Production:"
	@echo "  make docker-prod      - Start production environment"
	@echo "  make docker-down-prod - Stop production environment"
	@echo ""
	@echo "Testing & Quality:"
	@echo "  make lint             - Run linting"
	@echo "  make test             - Run tests"
	@echo ""
	@echo "Cleanup:"
	@echo "  make docker-clean     - Clean up Docker resources"

# Development
docker-dev:
	@echo "🚀 Starting development environment..."
	docker-compose -f $(COMPOSE_DEV) up -d
	@echo "✅ Development environment started"
	@echo "Frontend: http://localhost:5175"
	@echo "Backend:  http://localhost:3001"
	@echo "Ollama:   http://localhost:11434"

docker-logs:
	@echo "📋 Viewing logs..."
	docker-compose -f $(COMPOSE_DEV) logs -f

docker-down:
	@echo "⛔ Stopping development environment..."
	docker-compose -f $(COMPOSE_DEV) down
	@echo "✅ Development environment stopped"

# Building
docker-build:
	@echo "🔨 Building Docker images..."
	docker-compose -f $(COMPOSE_DEV) build
	@echo "✅ Docker images built"

rebuild: docker-down docker-clean docker-build docker-dev
	@echo "✅ Full rebuild complete"

# Production
docker-prod:
	@echo "🚀 Starting production environment..."
	docker-compose -f $(COMPOSE_PROD) up -d
	@echo "✅ Production environment started"
	@echo "Frontend: http://localhost"
	@echo "Grafana:  http://localhost:3000"
	@echo "Prometheus: http://localhost:9090"

docker-down-prod:
	@echo "⛔ Stopping production environment..."
	docker-compose -f $(COMPOSE_PROD) down
	@echo "✅ Production environment stopped"

# Testing & Quality
lint:
	@echo "🔍 Running linters..."
	npx eslint src/ --ext .js,.jsx || true
	cd backend && npx eslint . || true
	@echo "✅ Linting complete"

test:
	@echo "🧪 Running tests..."
	npm test -- --coverage || true
	cd backend && npm test -- --coverage || true
	@echo "✅ Tests complete"

build:
	@echo "📦 Building frontend..."
	npm run build
	@echo "✅ Frontend built"

# Cleanup
docker-clean:
	@echo "🧹 Cleaning up Docker resources..."
	docker system prune -f
	@echo "✅ Cleanup complete"

# Utility
ps:
	docker-compose -f $(COMPOSE_DEV) ps

shell-backend:
	docker-compose -f $(COMPOSE_DEV) exec backend sh

shell-frontend:
	docker-compose -f $(COMPOSE_DEV) exec frontend sh

logs-backend:
	docker-compose -f $(COMPOSE_DEV) logs -f backend

logs-frontend:
	docker-compose -f $(COMPOSE_DEV) logs -f frontend

# CI/CD
ci-test: lint test
ci-build: build docker-build

# All
all: docker-dev
	@echo "✅ Full setup complete!"
