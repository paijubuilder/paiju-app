# GitHub Actions 自动化配置说明

## 概述

本项目提供了两个脚本来自动化配置 GitHub Secrets 并触发 Android APK 构建工作流。

## 前提条件

1. **GitHub CLI (gh)** 必须已安装
   - 下载地址: https://cli.github.com/
   - 或使用 winget 安装: `winget install --id GitHub.cli`

2. **GitHub 仓库访问权限**
   - 需要对 `paijubuilder/paiju-app` 仓库的管理员权限
   - 用于设置 Secrets 和触发工作流

## 可用脚本

### 1. PowerShell 脚本（推荐）
```powershell
.\setup-github-secrets-and-build.ps1
```

### 2. 批处理脚本
```batch
setup-github-secrets-and-build.bat
```

## 脚本功能

两个脚本都会执行以下步骤：

1. **检查 GitHub CLI** - 验证 `gh` 是否已安装
2. **GitHub 认证** - 如果未登录，会引导您完成登录流程
3. **配置仓库信息** - 显示目标仓库和工作流信息
4. **设置 EXPO_TOKEN** - 将 Expo token 添加到 GitHub Secrets
5. **触发工作流** - 启动 "Build Android APK" 工作流

## 配置参数

脚本中已预配置以下参数：

- **仓库**: `paijubuilder/paiju-app`
- **工作流名称**: `Build Android APK`
- **分支**: `main`
- **Expo Token**: `u9_M0SssgczXM3kFGLTvy6v2CY8Y3CsiJZT1qknD`

如需修改这些参数，请编辑脚本文件中的配置部分。

## 执行步骤

### PowerShell 脚本（Windows 10/11 推荐）

1. 右键点击 `setup-github-secrets-and-build.ps1`
2. 选择"使用 PowerShell 运行"

或在 PowerShell 中执行：
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\setup-github-secrets-and-build.ps1
```

### 批处理脚本

双击 `setup-github-secrets-and-build.bat` 或在命令提示符中运行：
```batch
setup-github-secrets-and-build.bat
```

## 成功执行后的输出

脚本成功执行后会显示：
- EXPO_TOKEN 设置成功的确认信息
- 工作流触发成功的消息
- GitHub Actions 页面的链接

您可以点击链接查看构建进度。

## 故障排除

### 问题 1: "GitHub CLI is not installed"
**解决方案**: 从 https://cli.github.com/ 下载并安装 GitHub CLI

### 问题 2: "Authentication failed"
**解决方案**:
- 确保您的 GitHub 账号有正确的权限
- 尝试重新运行脚本进行认证
- 手动运行 `gh auth logout` 然后重新运行脚本

### 问题 3: "Failed to set EXPO_TOKEN secret"
**解决方案**:
- 确认您对仓库有管理员权限
- 检查仓库名称是否正确
- 手动在 GitHub 网页界面设置 Secret

### 问题 4: "Could not find workflow"
**解决方案**:
- 确认仓库中存在名为 "Build Android APK" 的工作流
- 检查工作流文件是否在 `.github/workflows/` 目录中
- 运行 `gh workflow list --repo paijubuilder/paiju-app` 查看可用工作流

## 手动操作替代方案

如果脚本无法正常工作，您可以手动执行以下步骤：

### 1. 登录 GitHub CLI
```bash
gh auth login --scopes repo,workflow
```

### 2. 设置 EXPO_TOKEN Secret
```bash
echo u9_M0SssgczXM3kFGLTvy6v2CY8Y3CsiJZT1qknD | gh secret set EXPO_TOKEN --repo paijubuilder/paiju-app
```

### 3. 触发工作流
```bash
# 先获取工作流 ID
gh workflow list --repo paijubuilder/paiju-app

# 然后触发工作流（替换 <WORKFLOW_ID> 为实际 ID）
gh workflow run <WORKFLOW_ID> --repo paijubuilder/paiju-app --ref main
```

### 4. 查看构建状态
```bash
gh run list --repo paijubuilder/paiju-app --limit 5
```

## 注意事项

- Expo Token 是敏感信息，请勿将包含 token 的脚本提交到版本控制系统
- 建议将 token 存储在环境变量中，而不是硬编码在脚本中
- GitHub Actions 的运行时间取决于队列情况和构建复杂度

## 安全建议

为了提高安全性，建议：

1. 定期轮换 Expo Token
2. 使用 GitHub Environments 来限制工作流触发
3. 启用 GitHub Actions 的审批要求
4. 审查工作流文件以确保没有安全风险
