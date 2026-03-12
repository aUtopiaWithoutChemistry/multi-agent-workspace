# OpenCLAW Agent Integration Test Requirements

## Overview

This document outlines the test requirements for verifying that OpenCLAW agents can interact with the Task Pool system.

## Test Project Setup

### Create a New Project

1. Open the Task Pool web interface
2. Click "New Project" button
3. Fill in the project details:
   - **Name**: `Agent Integration Test`
   - **Description**: `Test project for verifying OpenCLAW agent integration`
   - **Workspace**: `/Users/jerry/dev/multi-agent-workspace/data/test/workspace`
   - **Requirements Directory**: `requirements/`
4. Add at least one agent to the project (e.g., `oscar` or `main`)

## Test Cases

### 1. Agent Discovery Test

**Objective**: Verify that agents from `~/.openclaw/agents/` are detected by the system.

**Steps**:
1. Navigate to the Task Pool interface
2. Click on a project or create a new one
3. Click "Add Agent" in the Agents panel
4. Verify that agents from the OpenCLAW directory appear in the dropdown

**Expected Result**: Agents from `~/.openclaw/agents/` are listed in the agent selection dropdown.

### 2. Task Claiming Test

**Objective**: Verify that agents can claim open tasks through the API.

**Steps**:
1. Create a task in the project (via Upload Requirement or manual creation)
2. Use the OpenCLAW agent skill to call the claim API:
   ```
   POST /api/projects/{project_id}/tasks/{task_id}/claim?agent_id={agent_id}
   ```
3. Verify the task status changes from "open" to "claimed"

**Expected Result**:
- Task status changes to "claimed"
- Task is assigned to the agent
- Other agents cannot claim the same task

### 3. Single Task Constraint Test

**Objective**: Verify that an agent cannot claim multiple tasks simultaneously.

**Steps**:
1. Have an agent with an active task (status: "claimed" or "in_progress")
2. Attempt to claim another task with the same agent
3. Verify the API returns an error

**Expected Result**:
- API returns: `Agent {agent_id} already has an active task: {task_title}`
- Second claim is rejected

### 4. Task Dependency Test

**Objective**: Verify that tasks with dependencies can only be claimed when dependencies are completed.

**Steps**:
1. Create Task A (type: code, status: open)
2. Create Task B (type: test, depends_on: [Task A ID])
3. Attempt to claim Task B before Task A is done
4. Verify the API returns an error
5. Complete Task A (status: done)
6. Attempt to claim Task B again
7. Verify the claim succeeds

**Expected Result**:
- Step 3 returns: `Dependency task '{Task A title}' is not completed yet`
- Step 6 succeeds - Task B is claimed

### 5. Task Lifecycle Test

**Objective**: Verify the complete task lifecycle from creation to completion.

**Steps**:
1. Create or upload a requirement to generate tasks
2. Agent claims the task (POST `/claim`)
3. Agent starts work (POST `/start`)
4. Agent adds progress comments
5. Agent completes the task (POST `/complete`)
6. Task goes to "review" status
7. Human approves or rejects (POST `/review`)

**Expected Result**:
- Task progresses through: open → claimed → in_progress → review → done
- Activity log records all state changes

### 6. Review Rejection Test

**Objective**: Verify that rejected reviews can be picked up by other agents after 10 rejections.

**Steps**:
1. Have a task in "review" status
2. Original agent attempts review and gets rejected
3. Repeat rejection 10 times
4. After 10th rejection, another agent attempts to claim

**Expected Result**:
- After 10 rejections, the task becomes available for other agents to claim

### 7. Agent Status Sync Test

**Objective**: Verify that agent status is correctly displayed in the UI.

**Steps**:
1. Agent claims a task
2. Check the Agents panel in the UI
3. Verify agent shows "doing" status with current task name
4. Agent completes the task
5. Verify agent shows "idle" status

**Expected Result**:
- UI correctly shows agent status: "doing" (with task name) or "idle"

## API Endpoints Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | GET | List all projects |
| `/api/projects/{id}` | GET | Get project details |
| `/api/projects/{id}/tasks` | GET | List tasks (supports `status`, `type`, `claimed_by` filters) |
| `/api/projects/{id}/tasks` | POST | Create a new task |
| `/api/projects/{id}/tasks/{task_id}` | GET | Get task details |
| `/api/projects/{id}/tasks/{task_id}` | PATCH | Update task |
| `/api/projects/{id}/tasks/{task_id}/claim?agent_id={id}` | POST | Agent claims task |
| `/api/projects/{id}/tasks/{task_id}/start?agent_id={id}` | POST | Agent starts working |
| `/api/projects/{id}/tasks/{task_id}/complete?agent_id={id}` | POST | Agent completes work |
| `/api/projects/{id}/tasks/{task_id}/release` | POST | Release task back to pool |
| `/api/projects/{id}/tasks/{task_id}/review?approved={true/false}&comment={text}` | POST | Submit review |
| `/api/projects/{id}/tasks/{task_id}/comments` | POST | Add comment |
| `/api/agents` | GET | Get available agents |
| `/api/projects/{id}/agents` | GET | Get agents assigned to project |
| `/api/projects/{id}/agents/{agent_id}` | POST | Add agent to project |
| `/api/projects/{id}/agents/{agent_id}` | DELETE | Remove agent from project |

## Test Data

### Sample Requirement File (requirements/test.md)

```markdown
# Test Requirement

## Task 1: Implement Feature X
- Type: code
- Description: Implement the feature X according to specifications
- Acceptance Criteria: Feature works as expected

## Task 2: Write Tests for Feature X
- Type: test
- Description: Write unit tests for feature X
- Depends on: Task 1
- Acceptance Criteria: All tests pass
```

## Verification Checklist

- [ ] Agent discovery works (agents from ~/.openclaw/agents/ detected)
- [ ] Agents can be added to projects
- [ ] Agents can claim tasks
- [ ] Single task constraint enforced (no parallel tasks)
- [ ] Task dependencies enforced
- [ ] Task lifecycle works (claim → start → complete → review → done)
- [ ] Review rejection handling works
- [ ] Agent status displays correctly in UI
- [ ] Activity log records all actions

## Expected Test Duration

- Full test suite: ~30-45 minutes
- Individual tests: 2-5 minutes each
