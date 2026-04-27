#!/usr/bin/env bash
# apply-infrastructure.sh — Apply Terraform against LocalStack or real AWS
# Usage: ./scripts/apply-infrastructure.sh [--localstack] [--auto-approve]
set -euo pipefail
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

TERRAFORM_DIR="${TERRAFORM_DIR:-./terraform}"
USE_LOCALSTACK=false
AUTO_APPROVE=false

for arg in "$@"; do
  case $arg in
    --localstack) USE_LOCALSTACK=true ;;
    --auto-approve) AUTO_APPROVE=true ;;
    --dir) TERRAFORM_DIR="$2"; shift ;;
  esac
done

echo -e "${CYAN}🚀 ShopOps Infrastructure Apply${NC}"
echo -e "   Directory : ${TERRAFORM_DIR}"
echo -e "   Mode      : $([ "$USE_LOCALSTACK" = true ] && echo 'LocalStack (safe)' || echo 'REAL AWS ⚠️')"
echo ""

if [ "$USE_LOCALSTACK" = false ]; then
  echo -e "${RED}⚠️  WARNING: This will create REAL AWS resources and incur costs!${NC}"
  read -rp "Type 'yes' to continue: " confirm
  [ "$confirm" = "yes" ] || { echo "Aborted."; exit 1; }
fi

if ! command -v terraform &>/dev/null; then
  echo -e "${RED}❌ terraform not found. Install from https://terraform.io${NC}"; exit 1
fi

cd "$TERRAFORM_DIR"

echo -e "${YELLOW}→ Initializing...${NC}"
terraform init -reconfigure

echo -e "${YELLOW}→ Planning...${NC}"
PLAN_ARGS="-out=tfplan"
if [ "$USE_LOCALSTACK" = true ]; then
  AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test terraform plan $PLAN_ARGS
else
  terraform plan $PLAN_ARGS
fi

echo -e "${YELLOW}→ Applying...${NC}"
APPLY_ARGS="tfplan"
[ "$AUTO_APPROVE" = true ] && APPLY_ARGS="-auto-approve"

if [ "$USE_LOCALSTACK" = true ]; then
  AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test terraform apply $APPLY_ARGS
else
  terraform apply $APPLY_ARGS
fi

echo -e "${GREEN}✅ Infrastructure apply complete!${NC}"
echo ""
echo -e "${YELLOW}→ Current state:${NC}"
terraform state list
