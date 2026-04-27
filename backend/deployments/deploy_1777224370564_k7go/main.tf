provider "aws" {
  region = var.region
}
variable "vpc_cidr" {}
variaible "sg_name" {}           # Security Group Name is required and cannot be empty, it will fail otherwise if not provided or left blank as "" string in AWS SDKs  which can lead to issues when fetching values from aws resources. You need to provide a valid name for security group
variable "db_engine" {}          // RDS engine type (MySQL/PostgreSQL) is required, it will fail otherwise if not provided or left blank as "" string in AWS SDK which can lead back into issues when fetching values from aws rds instances. You need to provide a valid name for db instance
variable "db_instance" {}        // RDS Instance ID/Name (required) is required, it will fail otherwise if not provided or left blank as "" string in AWS SDK which can lead back into issues when fetching values from aws rds instances. You need to provide a valid name for db instance
variable "db_password" {}        // RDS Password(Required and sensitive) is required, it will fail otherwise if not provided or left blank as "" string in AWS SDK which can lead back into issues when fetching values from aws rds instances. You need to provide a valid password for db instance
variable "db_user" {}            // RDS User Name(Required and sensitive) is required, it will fail otherwise if not provided or left blank as "" string in AWS SDK which can lead back into issues when fetching values from aws rds instances. You need to provide a valid username for db instance
variable "vpc_name" {}           // VPC name (required and cannot be empty, it will fail otherwise if not provided or left blank as "" string in AWS SDK which can lead back into issues when fetching values from aws vpcs). You need to provide a valid namespace for this.
variable "sg_description" {}     # Security Group Description(Cannot contain spaces) is required, it will fail otherwise if not provided or left blank as "" string in AWS SDK which can lead back into issues when fetching values from aws security groups instances and IAM Roles used during creation of resources.
variable "sg_ingress" {}         # Ingress Rule Definition (Cannot contain spaces) is required, it will fail otherwise if not provided or left blank as "" string in AWS SDK which can lead back into issues when fetching values from aws security groups instances and IAM Roles used during creation of resources.
variable "vpc_subnets" {}        // Public/Private Subnet Names (required). You need to provide a valid sub networks for this VPC in AWS SDK, which can lead back into issues when fetching values from aws vpcs and private or public zones.  
data "aws_security_group" "sg" { # it will fail otherwise if not provided as "" string  while creating security groups IAM Roles used during creation of resources are required in this case, you need to provide a valid AWS Security Group ID for the SG which can lead back into issues when fetching values from aws VPC
}
data "aws_db_instance" "db" { # it will fail otherwise if not provided as "" string while creating DB Instance IAM Roles used during creation of resources are required in this case, you need to provide a valid AWS Db instance ID for the DB which can lead back into issues when fetching values from aws VPC
}
resource "aws_db_instance" "db" { # it will fail otherwise if not provided as "" string while creating RDS Instance IAM Roles used during creation of resources are required in this case, you need to provide a valid AWS Db instance ID for the DB which can lead back into issues when fetching values from aws VPC
}
resource "aws_vpc" "vp" { # it will fail otherwise if not provided as "" string while creating RDS Instance IAM roles used during creation of resources are required in this case, you need to provide a valid AWS Db instance ID for the DB which can lead back into issues when fetching values from aws VPC
}
resource "aws_security_group" "sg" { # it will fail otherwise if not provided as "" string while creating security groups IAM Roles used during creation of resources are required in this case, you need to provide a valid AWS Security Group ID for the SG which can lead back into issues when fetching values from aws VPC
}
data "aws_route53_zone" "zone" { # it will fail otherwise if not provided as "" string while creating RDS Instance IAM roles used during creation of resources are required in this case, you need to provide a valid AWS Db instance ID for the DB which can lead back into issues when fetching values from aws VPC
}
data "aws_ec2_ami" "ami" { # it will fail otherwise if not provided as "" string while creating RDS Instance IAM roles used during creation of resources are required in this case, you need to provide a valid AWS Db instance ID for the DB which can lead back into issues when fetching values from aws VPC
}
data "aws_instance" "inst" { # it will fail otherwise if not provided as "" string while creating RDS Instance IAM roles used during creation of resources are required in this case, you need to provide a valid AWS Db instance ID for the DB which can lead back into issues when fetching values from aws VPC
}
output "db_endpoint" { # it will fail otherwise if not provided as "" string while creating RDS Instance IAM roles used during creation of resources are required in this case, you need to provide a valid AWS Db instance ID for the DB which can lead back into issues when fetching values from aws VPC
}
output "sg_id" { # it will fail otherwise if not provided as "" string while creating security groups IAM roles used during creation of resources are required in this case, you need to provide a valid AWS Security Group ID for the SG which can lead back into issues when fetching values from aws VPC
}