terraform {
  required_version = ">= 1.5"

  required_providers {
    # Extend with a real provider (e.g. aws, google, azurerm) as needed.
  }

  # Uncomment and configure a remote backend for team use:
  # backend "s3" {
  #   bucket = "your-tfstate-bucket"
  #   key    = "soroban-starter-kit/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

# ---------------------------------------------------------------------------
# Variables
# ---------------------------------------------------------------------------

variable "environment" {
  description = "Deployment environment (testnet | mainnet)"
  type        = string
  default     = "testnet"

  validation {
    condition     = contains(["testnet", "mainnet"], var.environment)
    error_message = "environment must be 'testnet' or 'mainnet'."
  }
}

variable "network_passphrase" {
  description = "Stellar network passphrase"
  type        = string
  sensitive   = true
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

output "environment" {
  description = "Active deployment environment"
  value       = var.environment
}
