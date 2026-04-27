#!/usr/bin/env bash
# setup-ssh-access.sh — Generate SSH keypair and configure EC2 access
# Usage: ./scripts/setup-ssh-access.sh [--key-name shopops] [--region ap-south-1]
set -euo pipefail
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

KEY_NAME="shopops"
REGION="${AWS_REGION:-ap-south-1}"
KEY_DIR="${HOME}/.ssh"

for arg in "$@"; do
  case $arg in
    --key-name) KEY_NAME="$2"; shift ;;
    --region) REGION="$2"; shift ;;
  esac
done

KEY_PATH="${KEY_DIR}/${KEY_NAME}.pem"

echo -e "${CYAN}🔑 ShopOps SSH Key Setup${NC}"
echo -e "   Key name : ${KEY_NAME}"
echo -e "   Region   : ${REGION}"
echo -e "   Key path : ${KEY_PATH}"
echo ""

if [ -f "$KEY_PATH" ]; then
  echo -e "${YELLOW}⚠️  Key already exists at ${KEY_PATH}${NC}"
  read -rp "Overwrite? (yes/no): " confirm
  [ "$confirm" = "yes" ] || { echo "Aborted."; exit 0; }
  rm -f "$KEY_PATH"
fi

echo -e "${YELLOW}→ Creating EC2 key pair in AWS...${NC}"
aws ec2 create-key-pair \
  --key-name "$KEY_NAME" \
  --region "$REGION" \
  --query 'KeyMaterial' \
  --output text > "$KEY_PATH"

chmod 400 "$KEY_PATH"
echo -e "${GREEN}✅ Key saved to: ${KEY_PATH}${NC}"
echo ""
echo -e "${CYAN}To SSH into your EC2 instance:${NC}"
echo -e "  ssh -i ${KEY_PATH} ec2-user@<your-instance-ip>"
echo ""
echo -e "${YELLOW}To find your instance IP:${NC}"
echo -e "  aws ec2 describe-instances --region ${REGION} \\"
echo -e "    --query 'Reservations[*].Instances[*].PublicIpAddress' \\"
echo -e "    --output text"
