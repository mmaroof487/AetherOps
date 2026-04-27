#!/usr/bin/env bash
# cleanup-infrastructure.sh — Destroy all Terraform-managed resources
# Usage: ./scripts/cleanup-infrastructure.sh [--localstack] [--force]
set -euo pipefail
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

TERRAFORM_DIR="${TERRAFORM_DIR:-./terraform}"
USE_LOCALSTACK=false
FORCE=false

for arg in "$@"; do
  case $arg in
    --localstack) USE_LOCALSTACK=true ;;
    --force) FORCE=true ;;
    --dir) TERRAFORM_DIR="$2"; shift ;;
  esac
done

echo -e "${RED}🗑️  ShopOps Infrastructure Cleanup${NC}"
echo -e "   Directory : ${TERRAFORM_DIR}"
echo -e "   Mode      : $([ "$USE_LOCALSTACK" = true ] && echo 'LocalStack' || echo 'REAL AWS ⚠️')"

if [ "$FORCE" = false ]; then
  echo -e "${RED}⚠️  This will DESTROY all infrastructure resources!${NC}"
  read -rp "Type 'destroy' to confirm: " confirm
  [ "$confirm" = "destroy" ] || { echo "Aborted."; exit 1; }
fi

cd "$TERRAFORM_DIR"

echo -e "${YELLOW}→ Running terraform destroy...${NC}"
if [ "$USE_LOCALSTACK" = true ]; then
  AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test terraform destroy -auto-approve
else
  terraform destroy -auto-approve
fi

echo -e "${YELLOW}→ Verifying state is empty...${NC}"
REMAINING=$(terraform state list 2>/dev/null | wc -l)
if [ "$REMAINING" -eq 0 ]; then
  echo -e "${GREEN}✅ All resources destroyed. State is empty.${NC}"
else
  echo -e "${RED}⚠️  ${REMAINING} resources still in state:${NC}"
  terraform state list
fi

# Clean up local plan files
rm -f "${TERRAFORM_DIR}/tfplan"
echo -e "${GREEN}✅ Cleanup complete!${NC}"
