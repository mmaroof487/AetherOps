#!/usr/bin/env bash
# health-check.sh — Verify app connectivity with retries
# Usage: ./scripts/health-check.sh [--url http://localhost:8000] [--retries 5]
set -euo pipefail
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

URL="${HEALTH_CHECK_URL:-http://localhost:8000/health}"
RETRIES=5
INTERVAL=3

for arg in "$@"; do
  case $arg in
    --url) URL="$2"; shift ;;
    --retries) RETRIES="$2"; shift ;;
    --interval) INTERVAL="$2"; shift ;;
  esac
done

echo -e "${YELLOW}🩺 Health Check: ${URL}${NC}"

ATTEMPT=0
while [ $ATTEMPT -lt $RETRIES ]; do
  ATTEMPT=$((ATTEMPT + 1))
  echo -e "${YELLOW}→ Attempt ${ATTEMPT}/${RETRIES}...${NC}"
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$URL" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 400 ]; then
    echo -e "${GREEN}✅ Health check passed! HTTP ${HTTP_CODE}${NC}"; exit 0
  else
    echo -e "${RED}   HTTP ${HTTP_CODE}${NC}"
    [ $ATTEMPT -lt $RETRIES ] && sleep "$INTERVAL"
  fi
done

echo -e "${RED}❌ Health check failed after ${RETRIES} attempts.${NC}"; exit 1
