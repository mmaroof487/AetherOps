import { sleep, parseSecurityChecks, parseCost, validateTerraform, parseCostBreakdown, formatCurrency, estimateAnnualCost, extractK8sInfo } from "../helpers";

describe("Helper Functions", () => {
	describe("sleep", () => {
		it("should delay execution", async () => {
			const start = Date.now();
			await sleep(100);
			const elapsed = Date.now() - start;
			expect(elapsed).toBeGreaterThanOrEqual(90);
		});
	});

	describe("parseSecurityChecks", () => {
		it("should identify security features in Terraform", () => {
			const terraform = `
        resource "aws_db_instance" "main" {
          storage_encrypted = true
          backup_retention_period = 7
        }
        resource "aws_vpc" "main" {
          cidr_block = "10.0.0.0/16"
        }
        resource "aws_security_group" "app" {}
      `;
			const checks = parseSecurityChecks(terraform);

			expect(checks[0].pass).toBe(true); // Database encrypted
			expect(checks[1].pass).toBe(true); // VPC
			expect(checks[2].pass).toBe(true); // Security group
			expect(checks[3].pass).toBe(true); // Backups
		});

		it("should handle incomplete Terraform", () => {
			const terraform = 'resource "aws_instance" "app" {}';
			const checks = parseSecurityChecks(terraform);

			expect(checks.some((c) => c.pass)).toBe(false);
		});
	});

	describe("parseCost", () => {
		it("should extract cost from Terraform output", () => {
			const terraform = "estimatedCost: 50.5";
			const cost = parseCost(terraform);

			expect(cost).toBeCloseTo(50.5, 1);
		});

		it("should return 0 for missing cost", () => {
			const terraform = 'resource "aws_instance" "app" {}';
			const cost = parseCost(terraform);

			expect(cost).toBe(0);
		});
	});

	describe("validateTerraform", () => {
		it("should validate correct Terraform", () => {
			const terraform = `
        terraform {
          required_providers {
            aws = { source = "hashicorp/aws" }
          }
        }
        provider "aws" {
          region = "ap-south-1"
        }
        resource "aws_vpc" "main" {}
      `;
			const result = validateTerraform(terraform);

			expect(result.valid).toBe(true);
			expect(result.checks.hasProvider).toBe(true);
			expect(result.checks.hasResources).toBe(true);
		});

		it("should reject invalid Terraform", () => {
			const result = validateTerraform("INVALID");

			expect(result.valid).toBe(false);
		});
	});

	describe("parseCostBreakdown", () => {
		it("should calculate cost breakdown", () => {
			const terraform = `
        resource "aws_instance" "app" {
          instance_type = "t3.medium"
        }
        resource "aws_db_instance" "main" {}
        resource "aws_s3_bucket" "assets" {}
      `;
			const breakdown = parseCostBreakdown(terraform);

			expect(breakdown.compute).toBe(50);
			expect(breakdown.database).toBeGreaterThan(0);
			expect(breakdown.storage).toBeGreaterThan(0);
		});
	});

	describe("formatCurrency", () => {
		it("should format Indian Rupee", () => {
			const formatted = formatCurrency(1000, "en-IN", "INR");

			expect(formatted).toContain("₹");
			expect(formatted).toContain("1");
		});

		it("should format USD", () => {
			const formatted = formatCurrency(50, "en-US", "USD");

			expect(formatted).toContain("$");
		});
	});

	describe("estimateAnnualCost", () => {
		it("should calculate annual cost from monthly", () => {
			const annual = estimateAnnualCost(50);

			expect(annual).toBe(600);
		});
	});

	describe("extractK8sInfo", () => {
		it("should extract K8s manifest information", () => {
			const manifests = `
        apiVersion: apps/v1
        kind: Deployment
        metadata:
          name: shopops-app
        spec:
          replicas: 3
          template:
            spec:
              containers:
              - image: nginx:latest
        ---
        apiVersion: autoscaling/v2
        kind: HorizontalPodAutoscaler
      `;
			const info = extractK8sInfo(manifests);

			expect(info.hasDeployment).toBe(true);
			expect(info.hasHPA).toBe(true);
			expect(info.replicas).toBe("3");
			expect(info.image).toContain("nginx");
		});
	});

	describe("AWS_TIPS", () => {
		it("should contain helpful tips", () => {
			expect(typeof AWS_TIPS).toBe("object");
			expect(AWS_TIPS.aws_instance).toBeDefined();
			expect(AWS_TIPS.storage_encrypted).toBeDefined();
		});
	});
});
