# Task Pool + Claim Architecture Redesign

从固定角色制（architect/builder/reviewer）改为 **任务池 + 认领制**，所有 agent 都是全能型。

## 核心概念

**任务生命周期：**
```
open → claimed(agent_id) → in_progress → review → done
                                              ↑        |
                                              └── (reject) ──┘
```

**任务类型：**
`spec` · `code` · `review` · `test` · `debug` · `docs` · `refactor` · `research`

**核心规则：**
- 一个 agent 同时只能做一个任务
- 任务被 claim 后，其他 agent 不能动
- spec 任务拆成细粒度子任务（method 级别），供所有 agent 认领
- review 不能被原作者认领（回避自审）
- 超时（如 10 分钟无更新）→ 随机释放给下一个 agent
- review 打回 → 原作者重做，超过 10 次 → 随机换人
- 所有 agent 能力对等，无固定优先级
- 人类上传 requirement.md → 自动创建 spec 任务 → 拆解后加入任务池

---

## Data Layer

### [MODIFY] task.schema.json

```diff
- "status": { "enum": ["todo", "in_progress", "in_review", "pending_approval", "done"] }
- "assignee": { "enum": ["architect", "builder", "reviewer"] }

+ "status": { "enum": ["open", "claimed", "in_progress", "review", "done"] }
+ "type": { "enum": ["spec", "code", "review", "test", "debug", "docs", "refactor", "research"] }
+ "claimed_by": { "type": ["string", "null"] }     // agent_id or null
+ "claimed_at": { "type": ["string", "null"] }     // ISO timestamp
+ "created_by": { "type": "string" }               // agent_id or "human"
+ "reject_count": { "type": "number", "default": 0 }  // review 打回次数
+ "parent_task_id": { "type": ["string", "null"] } // spec 拆出的子任务指向父任务
+ "comments": [                                    // agent 工作记录/留言
+   { "author": "agent_id", "content": "...", "timestamp": "ISO" }
+ ]
+ "artifacts": [                                   // 产出文件列表
+   { "path": "...", "description": "..." }
+ ]
+ "progress": { "type": "number" }                 // 0-100
```

### [MODIFY] project.schema.json

```diff
- "agents": { architect, builder, reviewer }
+ "agents": ["agent-1", "agent-2", "agent-3", ...]  // flat list，被邀请参与此项目的 agent
+ "requirements_dir": "requirements/"              // 监控此目录下的 .md 文件
+ "requirements_meta": {                             // 记录哪些 requirement 已被处理
+   "filename": { "spec_task_id": "...", "processed": true/false }
+ }
```

### [NEW] data/{project_id}/requirements/ 目录

- 人类放入 .md 文件
- dispatch loop 监控此目录
- 新文件 → 创建 spec 任务 → 标记 processed=false
- spec 完成后标记 processed=true（避免重复创建）

---

## Dispatch Loop

### 核心逻辑

每个 agent 独立定时 poll（如每 30 秒），执行以下步骤：

```python
def agent_poll(agent_id, project_id):
    # 1. 检查是否有新的 requirement 文件 → 创建 spec 任务
    scan_requirements(project_id)

    # 2. 查找可认领的任务
    available = find_claimable_tasks(project_id, agent_id)
    if not available:
        return  # 无事可做

    # 3. 选一个任务认领（agent 自由选择）
    task = choose_task(available, agent_id)  # agent 偏好决定
    claim_task(task, agent_id)

    # 4. 执行任务
    task["status"] = "in_progress"
    result = execute_task(agent_id, task)

    # 5. 处理结果
    if task["type"] == "spec":
        # 拆成细粒度子任务，加入任务池
        sub_tasks = parse_spec_result(result)
        for sub in sub_tasks:
            create_task(project_id, sub)
        task["status"] = "done"

    elif task["type"] == "review":
        # 应用 review 结果
        if result["approved"]:
            update_parent_task_status(task["parent_task_id"], "done")
            task["status"] = "done"
        else:
            # 打回给原作者
            original_agent = task["parent_task_id"]["claimed_by"]
            update_task_status(task, "open")
            task["reject_count"] += 1
            if task["reject_count"] > 10:
                # 随机换人
                task["claimed_by"] = None

    else:
        # code/test/debug/docs/refactor/research
        # 保存产出，创建 review 任务
        save_artifacts(result, task)
        create_review_task(project_id, task)
        task["status"] = "done"
```

### 关键函数

| 函数 | 说明 |
|------|------|
| `scan_requirements()` | 扫描 requirements/ 目录，发现新文件 → 创建 spec 任务 |
| `find_claimable_tasks()` | 返回 open 状态任务列表（排除自审：review 任务不能是己创建的） |
| `choose_task()` | agent 根据偏好选择任务（可随机） |
| `claim_task()` | 设置 claimed_by, claimed_at, status=claimed |
| `check_timeout()` | 检查 claimed 状态超过 10 分钟的任务 → 释放回 open |
| `execute_task()` | 调用 LLM 执行任务 |

### 超时处理

- 定时检查（每分钟）所有 claimed 任务
- 超过 10 分钟无更新 → claimed_by = null, status = open
- 被释放的任务可以被任何 agent 随机接走

---

## Backend API

### 改动

**项目相关：**
- `POST /api/projects` — agents 改为 flat array
- `GET /api/projects` — 返回项目列表（供 Dashboard 切换）
- `GET /api/projects/:id` — 获取单个项目详情 + 任务池

**任务相关：**
- `GET /api/projects/:id/tasks` — 获取任务列表（支持 filter: status, type, claimed_by）
- `POST /api/projects/:id/tasks` — 手动创建任务
- `GET /api/projects/:id/tasks/:task_id` — 获取任务详情（含 comments, artifacts）
- `POST /api/projects/:id/tasks/:task_id/comments` — 添加工作记录

**Requirement 相关：**
- `POST /api/projects/:id/requirements` — 上传 requirement.md 文件
- `GET /api/projects/:id/requirements` — 列出已上传的文件

**Dispatch：**
- `POST /api/dispatch/:project_id` — 手动触发一次 dispatch（调试用）
- 删除 `dispatch/start|stop`（改为 agent 独立定时）

**活动流：**
- `GET /api/projects/:id/activity` — 获取项目活动记录

---

## Frontend UI

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [Project Selector ▼]              [Upload Requirement]     │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────┐  ┌─────────────────────────────────┐│
│ │      Agents        │  │         Task Pool               ││
│ │                     │  │  ┌─────────────────────────────┐││
│ │  ● agent-1         │  │  │ [spec] 实现用户登录功能      │││
│ │    Doing: 任务A    │  │  │ 👤 agent-1  ████████░░ 80%   │││
│ │                     │  │  └─────────────────────────────┘││
│ │  ● agent-2         │  │  ┌─────────────────────────────┐││
│ │    Idle            │  │  │ [code] 编写 LoginAPI        │││
│ │                     │  │  │ 👤 agent-2  ████░░░░░░ 40%   │││
│ │  ● agent-3         │  │  └─────────────────────────────┘││
│ │    Idle            │  │  ┌─────────────────────────────┐││
│ │                     │  │  │ [review] 审核 LoginAPI     │││
│ └─────────────────────┘  │  │ ⏳ 待认领                   │││
│                          │  └─────────────────────────────┘││
│ ┌─────────────────────┐  └─────────────────────────────────┘│
│ │   Activity Feed    │                                      │
│ │                     │                                      │
│ │  agent-1 认领任务A  │                                      │
│ │  agent-2 完成代码   │                                      │
│ │  agent-3 提交review │                                      │
│ └─────────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

### 组件说明

**Project Selector:**
- 下拉菜单，切换不同 project
- 切换后刷新任务池和 agent 状态

**Agent Panel:**
- 显示所有参与此项目的 agent
- 每人一行：状态（Idle/Doing）+ 当前任务（如果在做）

**Task Pool:**
- 任务卡片列表
- 每张卡片显示：type badge、标题、claimed_by、progress bar
- open 状态任务：灰色/半透明
- claimed 状态任务：锁定图标 + agent 名
- 点击卡片 → 展开详情

**Task Detail（展开后）：**
- 完整描述
- 工作记录（comments）：agent 的每一步操作/留言
- 产出文件列表（artifacts）
- Review 结果（通过/打回原因）

**Activity Feed:**
- 实时滚动显示最近操作
- agent 认领、完成、提交 review 等

**Upload Requirement:**
- 按钮点击 → 弹出文件选择器
- 选择 .md 文件 → 上传到 requirements/ 目录

### 样式

- 每种 task type 一个颜色 badge（spec=紫, code=蓝, review=橙, test=绿...）
- claimed 状态：锁图标 + agent 名字
- progress bar：渐变色
- Activity Feed：简洁的时间线样式

---

## 实施步骤

### Phase 1: 数据层
1. 修改 task.schema.json
2. 修改 project.schema.json
3. 实现 requirements 目录监控逻辑

### Phase 2: Dispatch Loop
1. 重写 dispatch_loop.py
2. 实现 agent_poll 核心逻辑
3. 实现超时检查
4. 实现 requirements 扫描

### Phase 3: Backend API
1. 修改现有 API 端点
2. 新增 requirements 上传 API
3. 新增 activity feed API

### Phase 4: Frontend
1. 实现 Project Selector
2. 改写 Task Pool 展示
3. 实现 Task Detail 展开
4. 实现 Activity Feed
5. 实现 Requirement 上传

### Phase 5: 测试
1. 创建 project + 添加 agents
2. 上传 requirement.md
3. 验证 spec 任务创建 + 拆分
4. 验证 agent 认领 + 执行
5. 验证 review 流程 + 打回
6. 验证超时释放

---

## Verification Plan

### Manual Test
1. 启动 server → Dashboard 加载
2. 创建 2 个 project（A 和 B）
3. 各加入 3 个 agent
4. Project A 上传 requirement.md
5. 验证 spec 任务创建 → 被 agent 认领 → 拆分子任务
6. 验证子任务被不同 agent 认领
7. 验证 review 任务创建 → 审核 → done
8. 切换到 Project B，验证任务池独立
9. 验证 Activity Feed 记录所有操作
