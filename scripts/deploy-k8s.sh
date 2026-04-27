#!/usr/bin/env bash
# deploy-k8s.sh — Apply K8s manifests and wait for pod readiness
# Usage: ./scripts/deploy-k8s.sh --manifest k8s/deployment.yaml [--namespace shopops] [--timeout 120]
set -euo pipefail
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

MANIFEST="${1:-k8s/app-deployment-template.yaml}"
NAMESPACE="default"
TIMEOUT=120
DEPLOYMENT_NAME="shopops-app"

for arg in "$@"; do
  case $arg in
    --manifest) MANIFEST="$2"; shift ;;
    --namespace) NAMESPACE="$2"; shift ;;
    --timeout) TIMEOUT="$2"; shift ;;
    --name) DEPLOYMENT_NAME="$2"; shift ;;
  esac
done

echo -e "${CYAN}☸️  ShopOps Kubernetes Deploy${NC}"
echo -e "   Manifest  : ${MANIFEST}"
echo -e "   Namespace : ${NAMESPACE}"
echo -e "   Timeout   : ${TIMEOUT}s"
echo ""

if ! command -v kubectl &>/dev/null; then
  echo -e "${RED}❌ kubectl not found${NC}"; exit 1
fi

# ── Check cluster ────────────────────────────────────────────────────────────
echo -e "${YELLOW}→ Checking cluster connectivity...${NC}"
kubectl cluster-info --request-timeout=5s || {
  echo -e "${RED}❌ Cannot connect to cluster. Is minikube running?${NC}"
  echo "   Run: minikube start"
  exit 1
}

# ── Dry run ──────────────────────────────────────────────────────────────────
echo -e "${YELLOW}→ Validating manifests (dry-run)...${NC}"
kubectl apply -f "$MANIFEST" --dry-run=client -n "$NAMESPACE"
echo -e "${GREEN}✅ Manifest validation passed${NC}"

# ── Apply ────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}→ Applying manifests...${NC}"
kubectl apply -f "$MANIFEST" -n "$NAMESPACE"

# ── Wait for pods ────────────────────────────────────────────────────────────
echo -e "${YELLOW}→ Waiting for deployment to be ready (timeout: ${TIMEOUT}s)...${NC}"
kubectl rollout status deployment/"$DEPLOYMENT_NAME" \
  -n "$NAMESPACE" --timeout="${TIMEOUT}s" && \
  echo -e "${GREEN}✅ Deployment ready!${NC}" || {
    echo -e "${RED}❌ Deployment timed out. Checking pod status:${NC}"
    kubectl get pods -n "$NAMESPACE" -l "app=$DEPLOYMENT_NAME"
    kubectl describe pods -n "$NAMESPACE" -l "app=$DEPLOYMENT_NAME" | tail -30
    exit 1
  }

# ── Status ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}Current deployment status:${NC}"
kubectl get deployments -n "$NAMESPACE"
kubectl get pods -n "$NAMESPACE"
kubectl get svc -n "$NAMESPACE"

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "   Port forward with: kubectl port-forward svc/${DEPLOYMENT_NAME} 8000:8000 -n ${NAMESPACE}"
