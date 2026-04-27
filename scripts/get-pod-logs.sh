#!/usr/bin/env bash
# get-pod-logs.sh — Dump logs from all pods in a namespace
# Usage: ./scripts/get-pod-logs.sh [--namespace default] [--label app=shopops-app]
set -euo pipefail
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

NAMESPACE="default"
LABEL="app=shopops-app"
TAIL=100

for arg in "$@"; do
  case $arg in
    --namespace) NAMESPACE="$2"; shift ;;
    --label) LABEL="$2"; shift ;;
    --tail) TAIL="$2"; shift ;;
  esac
done

echo -e "${CYAN}📋 Pod Logs — namespace: ${NAMESPACE}, label: ${LABEL}${NC}"
echo ""

PODS=$(kubectl get pods -n "$NAMESPACE" -l "$LABEL" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null)

if [ -z "$PODS" ]; then
  echo -e "${YELLOW}⚠️  No pods found with label: ${LABEL}${NC}"
  echo "All pods in namespace:"
  kubectl get pods -n "$NAMESPACE"
  exit 0
fi

for POD in $PODS; do
  echo -e "${YELLOW}━━━ Pod: ${POD} ━━━${NC}"
  kubectl logs "$POD" -n "$NAMESPACE" --tail="$TAIL" 2>/dev/null || \
    echo -e "  (no logs available)"
  echo ""
done

echo -e "${GREEN}✅ Log dump complete.${NC}"
