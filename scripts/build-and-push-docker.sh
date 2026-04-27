#!/usr/bin/env bash
# build-and-push-docker.sh — Build, tag, and push Docker image to ECR or DockerHub
# Usage: ./scripts/build-and-push-docker.sh --registry ecr --account 123456789 --region us-east-1 --tag v1.0
set -euo pipefail
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

IMAGE_NAME="shopops-app"
TAG="latest"
REGISTRY="dockerhub"
DOCKERHUB_USER="${DOCKERHUB_USERNAME:-}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-}"
AWS_REGION="${AWS_REGION:-ap-south-1}"
DOCKERFILE_DIR="."

for arg in "$@"; do
  case $arg in
    --registry) REGISTRY="$2"; shift ;;
    --tag) TAG="$2"; shift ;;
    --account) AWS_ACCOUNT_ID="$2"; shift ;;
    --region) AWS_REGION="$2"; shift ;;
    --dir) DOCKERFILE_DIR="$2"; shift ;;
    --name) IMAGE_NAME="$2"; shift ;;
  esac
done

echo -e "${CYAN}🐳 ShopOps Docker Build & Push${NC}"
echo -e "   Image   : ${IMAGE_NAME}:${TAG}"
echo -e "   Registry: ${REGISTRY}"
echo ""

if ! command -v docker &>/dev/null; then
  echo -e "${RED}❌ docker not found${NC}"; exit 1
fi

# ── Build ────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}→ Building image...${NC}"
docker build -t "${IMAGE_NAME}:${TAG}" "${DOCKERFILE_DIR}"
echo -e "${GREEN}✅ Build complete: ${IMAGE_NAME}:${TAG}${NC}"

# ── Push ─────────────────────────────────────────────────────────────────────
if [ "$REGISTRY" = "ecr" ]; then
  if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo -e "${RED}❌ --account is required for ECR${NC}"; exit 1
  fi
  ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
  echo -e "${YELLOW}→ Logging in to ECR...${NC}"
  aws ecr get-login-password --region "$AWS_REGION" \
    | docker login --username AWS --password-stdin "$ECR_URI"
  docker tag "${IMAGE_NAME}:${TAG}" "${ECR_URI}/${IMAGE_NAME}:${TAG}"
  docker tag "${IMAGE_NAME}:${TAG}" "${ECR_URI}/${IMAGE_NAME}:latest"
  echo -e "${YELLOW}→ Pushing to ECR...${NC}"
  docker push "${ECR_URI}/${IMAGE_NAME}:${TAG}"
  docker push "${ECR_URI}/${IMAGE_NAME}:latest"
  echo -e "${GREEN}✅ Pushed to ECR: ${ECR_URI}/${IMAGE_NAME}:${TAG}${NC}"

elif [ "$REGISTRY" = "dockerhub" ]; then
  if [ -z "$DOCKERHUB_USER" ]; then
    echo -e "${YELLOW}⚠️  DOCKERHUB_USERNAME not set — skipping push${NC}"; exit 0
  fi
  docker tag "${IMAGE_NAME}:${TAG}" "${DOCKERHUB_USER}/${IMAGE_NAME}:${TAG}"
  docker tag "${IMAGE_NAME}:${TAG}" "${DOCKERHUB_USER}/${IMAGE_NAME}:latest"
  echo -e "${YELLOW}→ Pushing to DockerHub...${NC}"
  docker push "${DOCKERHUB_USER}/${IMAGE_NAME}:${TAG}"
  docker push "${DOCKERHUB_USER}/${IMAGE_NAME}:latest"
  echo -e "${GREEN}✅ Pushed to DockerHub: ${DOCKERHUB_USER}/${IMAGE_NAME}:${TAG}${NC}"
else
  echo -e "${RED}❌ Unknown registry: ${REGISTRY}. Use 'ecr' or 'dockerhub'${NC}"; exit 1
fi

echo ""
echo -e "${CYAN}Image sizes:${NC}"
docker images | grep "$IMAGE_NAME"
