# Spec: OpenCLAW Agent Integration Test

## 项目概述

本项目用于验证OpenCLAW Agent能够与Task Pool系统进行交互，包括任务发现、领取、完成等核心功能。

## 分解的任务

### Task 1: Agent发现测试
- **类型**: test
- **描述**: 验证系统能检测到 ~/.openclaw/agents/ 下的agent
- **验收标准**: agent选择下拉菜单显示oscar和main agent

### Task 2: 任务领取测试
- **类型**: test
- **描述**: 验证agent能通过API领取开放任务
- **验收标准**: 任务状态从open变为claimed，分配给agent

### Task 3: 单任务约束测试
- **类型**: test
- **描述**: 验证agent不能同时领取多个任务
- **验收标准**: 尝试领取第二个任务时返回错误

### Task 4: 任务依赖测试
- **类型**: test
- **描述**: 验证有依赖的任务必须按顺序完成
- **验收标准**: 依赖任务未完成时无法领取下游任务

### Task 5: 任务生命周期测试
- **类型**: test
- **描述**: 验证任务完整流程: open → claimed → in_progress → review → done
- **验收标准**: 所有状态转换正常工作

### Task 6: 审核拒绝测试
- **类型**: test
- **描述**: 验证被拒绝10次后任务可被其他agent领取
- **验收标准**: 第10次拒绝后任务变为可领取状态

### Task 7: Agent状态同步测试
- **类型**: test
- **描述**: 验证UI正确显示agent状态
- **验收标准**: idle/doing状态正确显示

## 技术实现

### API集成
- 使用 http://localhost:8000 API
- 项目ID: 617350de
- Agent ID: oscar

### 测试数据
- 工作区: /Users/jerry/dev/multi-agent-workspace/data/617350de/workspace
- 测试目录: /Users/jerry/dev/multi-agent-workspace/data/617350de/requirements/

## 实施计划

1. 首先完成Agent发现测试
2. 依次进行各项功能测试
3. 记录测试结果和发现的问题
4. 更新任务状态和进度
