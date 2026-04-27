#!/usr/bin/env bash
# get-cluster-metrics.sh — Show resource usage across the K8s cluster
# Usage: ./scripts/get-cluster-metrics.sh [--namespace default]
set -euo pipefail
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

NAMESPACE="${1:-default}"

echo -e "${CYAN}📊 Cluster Resource Metrics${NC}"
echo ""

echo -e "${YELLOW}→ Nodes:${NC}"
kubectl get nodes -o wide 2>/dev/null || echo "  (no nodes)"

echo ""
echo -e "${YELLOW}→ Node resource usage (requires metrics-server):${NC}"
kubectl top nodes 2>/dev/null || echo "  (metrics-server not running — run: minikube addons enable metrics-server)"

echo ""
echo -e "${YELLOW}→ Pods in namespace '${NAMESPACE}':${NC}"
kubectl get pods -n "$NAMESPACE" -o wide 2>/dev/null || echo "  (no pods)"

echo ""
echo -e "${YELLOW}→ Pod resource usage:${NC}"
kubectl top pods -n "$NAMESPACE" 2>/dev/null || echo "  (metrics-server not available)"

echo ""
echo -e "${YELLOW}→ Services:${NC}"
kubectl get svc -n "$NAMESPACE" 2>/dev/null

echo ""
echo -e "${YELLOW}→ HPAs:${NC}"
kubectl get hpa -n "$NAMESPACE" 2>/dev/null || echo "  (no HPAs)"

echo ""
echo -e "${GREEN}✅ Metrics dump complete.${NC}"
