#!/usr/bin/env bash
# validate-terraform.sh — Validate & plan Terraform configuration
# Usage: ./scripts/validate-terraform.sh [--localstack] [--dir <path>]
set -euo pipefail
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

TERRAFORM_DIR="${TERRAFORM_DIR:-./terraform}"
USE_LOCALSTACK=false

for arg in "$@"; do
  case $arg in
    --localstack) USE_LOCALSTACK=true ;;
    --dir) TERRAFORM_DIR="$2"; shift ;;
  esac
done

echo -e "${YELLOW}🔍 Validating Terraform in: ${TERRAFORM_DIR}${NC}"

if [ ! -d "$TERRAFORM_DIR" ]; then
  echo -e "${RED}❌ Terraform directory not found: ${TERRAFORM_DIR}${NC}"
  exit 1
fi

cd "$TERRAFORM_DIR"

echo -e "${YELLOW}→ Running terraform fmt check...${NC}"
terraform fmt -check -recursive && echo -e "${GREEN}✅ Format OK${NC}" || {
  echo -e "${RED}❌ Format errors found. Run: terraform fmt -recursive${NC}"; exit 1
}

echo -e "${YELLOW}→ Running terraform init...${NC}"
if [ "$USE_LOCALSTACK" = true ]; then
  terraform init -backend=false -reconfigure
else
  terraform init -reconfigure
fi
echo -e "${GREEN}✅ Init OK${NC}"

echo -e "${YELLOW}→ Running terraform validate...${NC}"
terraform validate && echo -e "${GREEN}✅ Validate OK${NC}"

echo -e "${YELLOW}→ Running terraform plan...${NC}"
if [ "$USE_LOCALSTACK" = true ]; then
  echo -e "${YELLOW}   Using LocalStack endpoint${NC}"
  AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test \
    terraform plan -no-color 2>&1 | tail -20
else
  terraform plan -no-color 2>&1 | tail -20
fi

echo -e "${GREEN}✅ Terraform validation complete!${NC}"
