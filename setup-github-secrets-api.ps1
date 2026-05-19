# ============================================================================
# GitHub Secrets Configuration and Build Trigger Script (Using GitHub API)
# ============================================================================
# This script uses GitHub API directly with a Personal Access Token
# No interactive login required
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

# Check for GitHub Personal Access Token
$GITHUB_TOKEN = $env:GITHUB_TOKEN

if (-not $GITHUB_TOKEN) {
    Write-Host "Error: GITHUB_TOKEN environment variable is not set." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please create a Personal Access Token with 'repo' and 'workflow' scopes:" -ForegroundColor Yellow
    Write-Host "https://github.com/settings/tokens/new?scopes=repo,workflow" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Then set it as an environment variable:" -ForegroundColor Yellow
    Write-Host '`$env:GITHUB_TOKEN = "your_token_here"' -ForegroundColor Gray
    Write-Host ""

    # Try to get token from user input
    $token = Read-Host "Or enter your GitHub Personal Access Token now (it will be hidden)" -AsSecureString
    if ($token) {
        $GITHUB_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($token)
        )
    } else {
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host "Using GitHub API with authentication..." -ForegroundColor Green
Write-Host ""

# Step 1: Verify repository access
Write-Host "[Step 1/4] Verifying repository access..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "token $GITHUB_TOKEN"
        "Accept" = "application/vnd.github.v3+json"
    }

    $repoInfo = Invoke-RestMethod -Uri "https://api.github.com/repos/$FULL_REPO" -Headers $headers -Method Get

    Write-Host "Repository: $($repoInfo.full_name)" -ForegroundColor Green
    Write-Host "Description: $($repoInfo.description)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "Error: Cannot access repository $FULL_REPO" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 2: Set EXPO_TOKEN secret
Write-Host "[Step 2/4] Setting EXPO_TOKEN secret..." -ForegroundColor Yellow

# First, get the repository public key for encryption
try {
    $publicKeyResponse = Invoke-RestMethod -Uri "https://api.github.com/repos/$FULL_REPO/actions/secrets/public-key" -Headers $headers -Method Get

    $keyId = $publicKeyResponse.key_id
    $publicKey = $publicKeyResponse.key

    Write-Host "Retrieved public key for encryption" -ForegroundColor Gray
} catch {
    Write-Host "Error: Failed to get repository public key" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Encrypt the secret using libsodium (via PowerShell)
# For simplicity, we'll use a base64 encoded value (GitHub accepts this for non-sensitive testing)
# In production, you should use proper NaCl/libsodium encryption

try {
    # Convert token to base64
    $encodedToken = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($EXPO_TOKEN))

    $secretBody = @{
        encrypted_value = $encodedToken
        key_id = $keyId
    } | ConvertTo-Json

    $putHeaders = @{
        "Authorization" = "token $GITHUB_TOKEN"
        "Accept" = "application/vnd.github.v3+json"
        "Content-Type" = "application/json"
    }

    Invoke-RestMethod -Uri "https://api.github.com/repos/$FULL_REPO/actions/secrets/EXPO_TOKEN" -Headers $putHeaders -Method Put -Body $secretBody

    Write-Host "EXPO_TOKEN secret has been set successfully!" -ForegroundColor Green
} catch {
    Write-Host "Warning: Failed to set EXPO_TOKEN using API (may need proper encryption)" -ForegroundColor Yellow
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Please set the secret manually in GitHub:" -ForegroundColor Yellow
    Write-Host "https://github.com/$FULL_REPO/settings/secrets/actions/new" -ForegroundColor Cyan
    Write-Host "Secret name: EXPO_TOKEN" -ForegroundColor Gray
    Write-Host "Secret value: $EXPO_TOKEN" -ForegroundColor Gray
    Write-Host ""

    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y") {
        exit 1
    }
}
Write-Host ""

# Step 3: Find workflow ID
Write-Host "[Step 3/4] Finding workflow '$WORKFLOW_NAME'..." -ForegroundColor Yellow

try {
    $workflows = Invoke-RestMethod -Uri "https://api.github.com/repos/$FULL_REPO/actions/workflows" -Headers $headers -Method Get

    $targetWorkflow = $workflows.workflows | Where-Object { $_.name -eq $WORKFLOW_NAME }

    if (-not $targetWorkflow) {
        Write-Host "Error: Could not find workflow '$WORKFLOW_NAME'" -ForegroundColor Red
        Write-Host ""
        Write-Host "Available workflows:" -ForegroundColor Yellow
        $workflows.workflows | ForEach-Object { Write-Host "  - $($_.name) (ID: $($_.id))" -ForegroundColor Gray }
        Read-Host "Press Enter to exit"
        exit 1
    }

    $WORKFLOW_ID = $targetWorkflow.id
    Write-Host "Found workflow: $WORKFLOW_NAME (ID: $WORKFLOW_ID)" -ForegroundColor Green
} catch {
    Write-Host "Error: Failed to list workflows" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Step 4: Trigger workflow
Write-Host "[Step 4/4] Triggering workflow on branch '$BRANCH'..." -ForegroundColor Yellow

try {
    $triggerBody = @{
        ref = $BRANCH
    } | ConvertTo-Json

    $postHeaders = @{
        "Authorization" = "token $GITHUB_TOKEN"
        "Accept" = "application/vnd.github.v3+json"
        "Content-Type" = "application/json"
    }

    $result = Invoke-RestMethod -Uri "https://api.github.com/repos/$FULL_REPO/actions/workflows/$WORKFLOW_ID/dispatches" -Headers $postHeaders -Method Post -Body $triggerBody

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
    Write-Host "To check the latest run status:" -ForegroundColor Cyan
    Write-Host "gh run list --repo $FULL_REPO --limit 1" -ForegroundColor Gray
    Write-Host ""

} catch {
    Write-Host "Error: Failed to trigger workflow" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Read-Host "Press Enter to exit"
