@echo off
setlocal enabledelayedexpansion

REM ============================================================================
REM GitHub Secrets Configuration and Build Trigger Script
REM ============================================================================
REM This script automates:
REM 1. Checking and installing GitHub CLI (gh)
REM 2. Authenticating with GitHub
REM 3. Setting EXPO_TOKEN secret in GitHub repository
REM 4. Triggering "Build Android APK" workflow
REM ============================================================================

echo ========================================
echo GitHub Secrets Setup ^& Build Trigger
echo ========================================
echo.

REM Step 1: Check if GitHub CLI is installed
echo [Step 1/5] Checking GitHub CLI installation...
where gh >nul 2>&1
if %errorlevel% neq 0 (
    echo GitHub CLI (gh) is not installed.
    echo.
    echo Please install GitHub CLI from: https://cli.github.com/
    echo Or run: winget install --id GitHub.cli
    echo.
    pause
    exit /b 1
) else (
    echo GitHub CLI is installed.
    gh --version
    echo.
)

REM Step 2: Check authentication status
echo [Step 2/5] Checking GitHub authentication...
gh auth status >nul 2>&1
if %errorlevel% neq 0 (
    echo Not authenticated with GitHub.
    echo.
    echo Starting authentication process...
    echo Please follow the prompts to log in to GitHub.
    echo.
    gh auth login --scopes repo,workflow
    if %errorlevel% neq 0 (
        echo Authentication failed. Please try again.
        pause
        exit /b 1
    )
    echo Authentication successful!
    echo.
) else (
    echo Already authenticated with GitHub.
    gh auth status
    echo.
)

REM Step 3: Set repository variables
echo [Step 3/5] Configuring repository settings...
set REPO_OWNER=paijubuilder
set REPO_NAME=paiju-app
set EXPO_TOKEN=u9_M0SssgczXM3kFGLTvy6v2CY8Y3CsiJZT1qknD
set WORKFLOW_NAME=Build Android APK
set BRANCH=main

echo Repository: %REPO_OWNER%/%REPO_NAME%
echo Workflow: %WORKFLOW_NAME%
echo Branch: %BRANCH%
echo.

REM Step 4: Set EXPO_TOKEN secret
echo [Step 4/5] Setting EXPO_TOKEN secret...
echo %EXPO_TOKEN% | gh secret set EXPO_TOKEN --repo %REPO_OWNER%/%REPO_NAME%
if %errorlevel% neq 0 (
    echo Failed to set EXPO_TOKEN secret.
    echo Please ensure you have admin access to the repository.
    pause
    exit /b 1
)
echo EXPO_TOKEN secret has been set successfully!
echo.

REM Step 5: Trigger workflow
echo [Step 5/5] Triggering workflow "%WORKFLOW_NAME%"...
echo.

REM Get workflow ID by name
for /f "tokens=*" %%i in ('gh workflow list --repo %REPO_OWNER%/%REPO_NAME% --json id,name --jq ".[] | select(.name==\"%WORKFLOW_NAME%\") | .id"') do set WORKFLOW_ID=%%i

if "!WORKFLOW_ID!"=="" (
    echo Error: Could not find workflow "%WORKFLOW_NAME%"
    echo Available workflows:
    gh workflow list --repo %REPO_OWNER%/%REPO_NAME%
    pause
    exit /b 1
)

echo Found workflow ID: !WORKFLOW_ID!
echo Triggering workflow on branch: %BRANCH%
echo.

REM Trigger the workflow
gh workflow run !WORKFLOW_ID! --repo %REPO_OWNER%/%REPO_NAME% --ref %BRANCH%
if %errorlevel% neq 0 (
    echo Failed to trigger workflow.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Success!
echo ========================================
echo.
echo Workflow "%WORKFLOW_NAME%" has been triggered successfully.
echo.
echo View workflow runs at:
echo https://github.com/%REPO_OWNER%/%REPO_NAME%/actions
echo.
echo To view the specific run, use:
echo gh run list --repo %REPO_OWNER%/%REPO_NAME% --workflow !WORKFLOW_ID! --limit 1
echo.

pause
endlocal
