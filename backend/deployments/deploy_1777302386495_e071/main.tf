# ShopOps fallback Terraform (deterministic template)
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
}

variable "region" {
  type    = string
  default = "ap-south-1"
}

variable "app_name" {
  type    = string
  default = "store"
}

variable "environment" {
  type    = string
  default = "production"
}

variable "ec2_ami" {
  type    = string
  default = "ami-0f5ee92e2d63afc18"
}

variable "ec2_instance_type" {
  type    = string
  default = "t3.micro"
}

locals {
  tags = {
    Project     = var.app_name
    Environment = var.environment
    ManagedBy   = "ShopOps"
    CreatedAt   = timestamp()
  }
}

resource "random_id" "suffix" {
  byte_length = 4
}

resource "aws_vpc" "main" {
  cidr_block           = "10.50.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = merge(local.tags, { Name = "${var.app_name}-vpc" })
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = merge(local.tags, { Name = "${var.app_name}-igw" })
}

resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.50.1.0/24"
  availability_zone       = "ap-south-1a"
  map_public_ip_on_launch = true
  tags                    = merge(local.tags, { Name = "${var.app_name}-public-a" })
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.50.2.0/24"
  availability_zone       = "ap-south-1b"
  map_public_ip_on_launch = true
  tags                    = merge(local.tags, { Name = "${var.app_name}-public-b" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.tags, { Name = "${var.app_name}-public-rt" })
}

resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_b" {
  subnet_id      = aws_subnet.public_b.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "app" {
  name        = "${var.app_name}-app-sg"
  description = "Application security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 22
    to_port     = 22
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

  tags = merge(local.tags, { Name = "${var.app_name}-app-sg" })
}

resource "aws_instance" "app" {
  count                  = 1
  ami                    = var.ec2_ami
  instance_type          = var.ec2_instance_type
  subnet_id              = aws_subnet.public_a.id
  vpc_security_group_ids = [aws_security_group.app.id]

  tags = merge(local.tags, { Name = "${var.app_name}-app" })
}

resource "aws_s3_bucket" "assets" {
  count  = 0
  bucket = "${var.app_name}-${var.environment}-${random_id.suffix.hex}"
  tags   = merge(local.tags, { Name = "${var.app_name}-assets" })
}

resource "aws_s3_bucket_versioning" "assets" {
  count  = 0
  bucket = aws_s3_bucket.assets[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  count  = 0
  bucket = aws_s3_bucket.assets[0].id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = [aws_subnet.public_a.id, aws_subnet.public_b.id]
}

output "app_instance_id" {
  value = try(aws_instance.app[0].id, null)
}

output "assets_bucket_name" {
  value = try(aws_s3_bucket.assets[0].bucket, null)
}
