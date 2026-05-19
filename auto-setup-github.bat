@echo off
setlocal enabledelayedexpansion

REM ============================================================================
# GitHub Secrets Configuration and Build Trigger Script (Using gh CLI)
# ============================================================================

echo ========================================
echo GitHub Secrets Setup ^& Build Trigger
echo ========================================
echo.

REM Configuration
set REPO_OWNER=paijubuilder
set REPO_NAME=paiju-app
set EXPO_TOKEN=u9_M0SssgczXM3kFGLTvy6v2CY8Y3CsiJZT1qknD
set WORKFLOW_NAME=Build Android APK
set BRANCH=main
set FULL_REPO=%REPO_OWNER%/%REPO_NAME%

echo Repository: %FULL_REPO%
echo Workflow: %WORKFLOW_NAME%
echo Branch: %BRANCH%
echo.

REM Step 1: Check authentication
echo [Step 1/4] Checking GitHub authentication...
gh auth status >nul 2>&1
if %errorlevel% neq 0 (
    echo Not authenticated. Starting web-based login...
    echo.
    echo A browser window will open. Please follow the prompts to authenticate.
    echo.
    gh auth login --web --scopes repo,workflow
    if %errorlevel% neq 0 (
        echo Authentication failed.
        pause
        exit /b 1
    )
    echo Authentication successful!
) else (
    echo Already authenticated.
)
echo.

REM Step 2: Set EXPO_TOKEN secret
echo [Step 2/4] Setting EXPO_TOKEN secret...
echo %EXPO_TOKEN% | gh secret set EXPO_TOKEN --repo %FULL_REPO%
if %errorlevel% neq 0 (
    echo Failed to set EXPO_TOKEN secret.
    echo Please ensure you have admin access to the repository.
    pause
    exit /b 1
)
echo EXPO_TOKEN secret has been set successfully!
echo.

REM Step 3: Find and trigger workflow
echo [Step 3/4] Finding workflow '%WORKFLOW_NAME%'...
for /f "delims=" %%i in ('gh workflow list --repo %FULL_REPO% --json id,name --jq ".[] | select(.name==\"%WORKFLOW_NAME%\") | .id"') do set WORKFLOW_ID=%%i

if "%WORKFLOW_ID%"=="" (
    echo Error: Could not find workflow '%WORKFLOW_NAME%'
    echo.
    echo Available workflows:
    gh workflow list --repo %FULL_REPO%
    pause
    exit /b 1
)

echo Found workflow ID: %WORKFLOW_ID%
echo.

REM Step 4: Trigger workflow
echo [Step 4/4] Triggering workflow on branch '%BRANCH%'...
gh workflow run %WORKFLOW_ID% --repo %FULL_REPO% --ref %BRANCH%
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
echo Workflow '%WORKFLOW_NAME%' has been triggered.
echo.
echo View workflow runs at:
echo https://github.com/%FULL_REPO%/actions
echo.
echo To check run status:
echo gh run list --repo %FULL_REPO% --limit 3
echo.

pause
endlocal
