# ============================================================================
# GitHub Secrets Configuration and Build Trigger Script (PowerShell)
# ============================================================================
# This script automates:
# 1. Checking and installing GitHub CLI (gh)
# 2. Authenticating with GitHub
# 3. Setting EXPO_TOKEN secret in GitHub repository
# 4. Triggering "Build Android APK" workflow
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "GitHub Secrets Setup & Build Trigger" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$REPO_OWNER = "paijubuilder"
$REPO_NAME = "paiju-app"
$EXPO_TOKEN = "u9_M0SssgczXM3kFGLTvy6v2CY8Y3CsiJZT1qknD"
$WORKFLOW_NAME = "Build Android APK"
$BRANCH = "main"
$FULL_REPO = "$REPO_OWNER/$REPO_NAME"

# Step 1: Check if GitHub CLI is installed
Write-Host "[Step 1/5] Checking GitHub CLI installation..." -ForegroundColor Yellow
try {
    $ghVersion = gh --version 2>&1
    Write-Host "GitHub CLI is installed." -ForegroundColor Green
    Write-Host $ghVersion[0] -ForegroundColor Gray
} catch {
    Write-Host "GitHub CLI (gh) is not installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install GitHub CLI from: https://cli.github.com/" -ForegroundColor Yellow
    Write-Host "Or run: winget install --id GitHub.cli" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Step 2: Check authentication status
Write-Host "[Step 2/5] Checking GitHub authentication..." -ForegroundColor Yellow
try {
    $authStatus = gh auth status 2>&1
    Write-Host "Already authenticated with GitHub." -ForegroundColor Green
    Write-Host $authStatus -ForegroundColor Gray
} catch {
    Write-Host "Not authenticated with GitHub." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Starting authentication process..." -ForegroundColor Yellow
    Write-Host "Please follow the prompts to log in to GitHub." -ForegroundColor Yellow
    Write-Host ""

    try {
        gh auth login --scopes repo,workflow
        Write-Host "Authentication successful!" -ForegroundColor Green
    } catch {
        Write-Host "Authentication failed. Please try again." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}
Write-Host ""

# Step 3: Display configuration
Write-Host "[Step 3/5] Configuration:" -ForegroundColor Yellow
Write-Host "  Repository: $FULL_REPO" -ForegroundColor Gray
Write-Host "  Workflow: $WORKFLOW_NAME" -ForegroundColor Gray
Write-Host "  Branch: $BRANCH" -ForegroundColor Gray
Write-Host ""

# Step 4: Set EXPO_TOKEN secret
Write-Host "[Step 4/5] Setting EXPO_TOKEN secret..." -ForegroundColor Yellow
try {
    $EXPO_TOKEN | gh secret set EXPO_TOKEN --repo $FULL_REPO
    Write-Host "EXPO_TOKEN secret has been set successfully!" -ForegroundColor Green
} catch {
    Write-Host "Failed to set EXPO_TOKEN secret." -ForegroundColor Red
    Write-Host "Please ensure you have admin access to the repository." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Step 5: Trigger workflow
Write-Host "[Step 5/5] Triggering workflow '$WORKFLOW_NAME'..." -ForegroundColor Yellow
Write-Host ""

# Get workflow ID by name
try {
    $workflows = gh workflow list --repo $FULL_REPO --json id,name | ConvertFrom-Json
    $targetWorkflow = $workflows | Where-Object { $_.name -eq $WORKFLOW_NAME }

    if (-not $targetWorkflow) {
        Write-Host "Error: Could not find workflow '$WORKFLOW_NAME'" -ForegroundColor Red
        Write-Host ""
        Write-Host "Available workflows:" -ForegroundColor Yellow
        gh workflow list --repo $FULL_REPO
        Read-Host "Press Enter to exit"
        exit 1
    }

    $WORKFLOW_ID = $targetWorkflow.id
    Write-Host "Found workflow ID: $WORKFLOW_ID" -ForegroundColor Green
    Write-Host "Triggering workflow on branch: $BRANCH" -ForegroundColor Gray
    Write-Host ""

    # Trigger the workflow
    gh workflow run $WORKFLOW_ID --repo $FULL_REPO --ref $BRANCH

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Success!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Workflow '$WORKFLOW_NAME' has been triggered successfully." -ForegroundColor Green
    Write-Host ""
    Write-Host "View workflow runs at:" -ForegroundColor Cyan
    Write-Host "https://github.com/$FULL_REPO/actions" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To view the specific run, use:" -ForegroundColor Cyan
    Write-Host "gh run list --repo $FULL_REPO --workflow $WORKFLOW_ID --limit 1" -ForegroundColor Cyan
    Write-Host ""

} catch {
    Write-Host "Failed to trigger workflow." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Read-Host "Press Enter to exit"
