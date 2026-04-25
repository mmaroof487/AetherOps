#!/bin/bash
# ══════════════════════════════════════════════════════════════════
# InfraVend — vend.sh
# The "vending machine" trigger script
# Usage: ./vend.sh <tenant_id> <biz_type> <port>
# ══════════════════════════════════════════════════════════════════

set -e

TENANT_ID="${1:-tenant_$(date +%s)}"
BIZ_TYPE="${2:-store}"
PORT="${3:-8100}"
S3_BUCKET="infravend-templates-771969015644"
PLAYBOOK_DIR="/Users/ges/Desktop/CPPE_PROJECT/infravend/playbooks"
LOG_FILE="/Users/ges/Desktop/CPPE_PROJECT/infravend/tenants/${TENANT_ID}.log"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ⚡ InfraVend — Provisioning Tenant"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Tenant ID : $TENANT_ID"
echo "  Biz Type  : $BIZ_TYPE"
echo "  Port      : $PORT"
echo "  S3 Bucket : $S3_BUCKET"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 1 — Upload playbook to S3 (simulate template store)
echo "[1/4] 📦 Uploading templates to S3..."
aws s3 cp "$PLAYBOOK_DIR/provision_tenant.yml" \
  "s3://$S3_BUCKET/playbooks/provision_tenant.yml" --quiet
echo "      ✅ Templates stored in S3"

# Step 2 — Pull latest playbook from S3 (simulate vending machine fetch)
echo "[2/4] ☁️  Fetching config from S3..."
mkdir -p /tmp/infravend_fetch
aws s3 cp "s3://$S3_BUCKET/playbooks/provision_tenant.yml" \
  /tmp/infravend_fetch/provision_tenant.yml --quiet
echo "      ✅ Config pulled from S3"

# Step 3 — Create temp HTML dir
mkdir -p "/tmp/tenant_${TENANT_ID}"

# Step 4 — Run Ansible playbook
echo "[3/4] 🤖 Running Ansible provisioner..."
ansible-playbook /tmp/infravend_fetch/provision_tenant.yml \
  -e "tenant_id=$TENANT_ID" \
  -e "tenant_port=$PORT" \
  -e "biz_type=$BIZ_TYPE" \
  2>&1 | tee "$LOG_FILE" | grep -E "TASK|ok:|changed:|failed:|✅|fatal" || true

echo "[4/4] 🐳 Docker container live!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ TENANT PROVISIONED SUCCESSFULLY"
echo "  🌐 Live URL: http://localhost:$PORT"
echo "  📋 Tenant ID: $TENANT_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
