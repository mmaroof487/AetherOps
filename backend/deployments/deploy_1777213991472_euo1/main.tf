# ShopOps Production Infrastructure — AWS Terraform
# Tier: Standard
# Region: ap-south-1 (Mumbai)
# Generated: 2026-04-26T14:33:11.481Z

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project     = "ShopOps"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Tier        = "Standard"
    }
  }
}

variable "app_name" {
  default = "store"
}
variable "environment" {
  default = "production"
}
variable "region" {
  default = "ap-south-1"
}
variable "vpc_cidr" {
  default = "10.0.0.0/16"
}
variable "availability_zones" {
  default = ["ap-south-1a", "ap-south-1b"]
}

resource "random_id" "suffix" {
  byte_length = 4
}

# ── VPC & NETWORKING ──────────────────────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Name = "${var.app_name}-vpc" }
}

resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 1}.0/24"
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true
  tags = { Name = "${var.app_name}-public-${count.index + 1}", Type = "Public" }
}

resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = var.availability_zones[count.index]
  tags = { Name = "${var.app_name}-private-${count.index + 1}", Type = "Private" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.app_name}-igw" }
}

resource "aws_eip" "nat" {
  domain     = "vpc"
  depends_on = [aws_internet_gateway.main]
}
resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  depends_on    = [aws_internet_gateway.main]
  tags          = { Name = "${var.app_name}-nat" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.app_name}-public-rt"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name = "${var.app_name}-private-rt"
  }
}
resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# ── SECURITY GROUPS ───────────────────────────────────────────────────────────
resource "aws_security_group" "app" {
  name   = "${var.app_name}-app"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.app_name}-app-sg"
  }
}

resource "aws_security_group" "rds" {
  name   = "${var.app_name}-rds"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.app_name}-rds-sg"
  }
}

# ── KMS KEY ───────────────────────────────────────────────────────────────────
resource "aws_kms_key" "main" {
  description             = "KMS key for ${var.app_name}"
  deletion_window_in_days = 10
  enable_key_rotation     = true

  tags = {
    Name = "${var.app_name}-kms"
  }
}

# ── IAM ───────────────────────────────────────────────────────────────────────
resource "aws_iam_role" "ec2" {
  name = "${var.app_name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${var.app_name}-ec2-profile"
  role = aws_iam_role.ec2.name
}

# ── EC2 ───────────────────────────────────────────────────────────────────────
resource "aws_instance" "app" {
  ami                         = "ami-0f58b397bc5c1f2e8"
  instance_type               = "t3.medium"
  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.app.id]
  iam_instance_profile        = aws_iam_instance_profile.ec2.name
  monitoring                  = true
  associate_public_ip_address = true

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 30
    encrypted             = true
    delete_on_termination = true
  }

  tags = {
    Name = "${var.app_name}-server"
  }

  depends_on = [aws_internet_gateway.main]
}

# ── RDS ───────────────────────────────────────────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name       = "${var.app_name}-db-subnet"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "${var.app_name}-db-subnet-group" }
}
resource "random_password" "db" {
  length  = 32
  special = true
}
resource "aws_db_instance" "main" {
  identifier              = "${var.app_name}-db"
  engine                  = "postgres"
  engine_version          = "15.4"
  instance_class          = "db.t3.micro"
  allocated_storage       = 20
  storage_encrypted       = true
  kms_key_id              = aws_kms_key.main.arn
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  db_name                 = "shopopsdb"
  username                = "shopopsadmin"
  password                = random_password.db.result
  backup_retention_period = 7
  multi_az                = false
  publicly_accessible     = false
  skip_final_snapshot     = false
  final_snapshot_identifier = "${var.app_name}-db-final-snapshot"
  performance_insights_enabled = true
  tags = { Name = "${var.app_name}-postgres" }
}

# ── S3 ────────────────────────────────────────────────────────────────────────
resource "aws_s3_bucket" "assets" {
  bucket = "${var.app_name}-assets-${random_id.suffix.hex}"
  tags   = { Name = "${var.app_name}-assets" }
}
resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── OUTPUTS ───────────────────────────────────────────────────────────────────
output "vpc_id" {
  value = aws_vpc.main.id
}

output "app_instance_ip" {
  value = aws_instance.app.public_ip
}

output "rds_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "rds_username" {
  value = aws_db_instance.main.username
}

output "rds_password" {
  value     = random_password.db.result
  sensitive = true
}

output "s3_bucket_name" {
  value = aws_s3_bucket.assets.id
}
