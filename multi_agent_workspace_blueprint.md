# Multi-Agent Workspace Blueprint

## Goal
Build a **task-driven multi-agent workspace** where a small set of agents can:
- receive a top-level objective,
- decompose it into subtasks,
- communicate through structured messages,
- produce artifacts,
- review each other’s work,
- and expose everything to a human through a dashboard.

This first version should optimize for **control, observability, replayability, and extensibility**, not maximum autonomy.

---

## 1. System Architecture

```text
┌────────────────────────────────────────────────────────────────────┐
│                           Human Operator                           │
│      Web Dashboard / Inspect / Approve / Retry / Pause            │
└───────────────────────────────┬────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                         API + Orchestrator                         │
│  - receives objective                                              │
│  - creates tasks/subtasks                                          │
│  - assigns agents                                                  │
│  - tracks state transitions                                        │
│  - enforces approval/review rules                                  │
│  - emits events                                                    │
└───────────────┬───────────────────────┬────────────────────────────┘
                │                       │
                ▼                       ▼
┌──────────────────────────┐  ┌─────────────────────────────────────┐
│   Communication Layer    │  │           Artifact Layer            │
│ - message channels       │  │ - docs, code, plans, diffs          │
│ - direct messages        │  │ - test outputs, logs, patches       │
│ - event stream           │  │ - versioned references              │
└──────────────┬───────────┘  └──────────────────┬──────────────────┘
               │                                 │
               ▼                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│                           Data Layer                               │
│   PostgreSQL / SQLite                                              │
│   tasks, messages, artifacts, runs, reviews, approvals, agents     │
└───────────────┬───────────────────────┬────────────────────────────┘
                │                       │
                ▼                       ▼
┌──────────────────────────┐  ┌─────────────────────────────────────┐
│      Agent Runtime       │  │         Tool / Exec Layer           │
│ - Architect agent        │  │ - file read/write                   │
│ - Builder agent          │  │ - code execution                    │
│ - Reviewer agent         │  │ - search / docs / git / tests       │
│ - optional Librarian     │  │ - later: browser, deployment, APIs  │
└──────────────────────────┘  └─────────────────────────────────────┘
```

### Core principle
The **orchestrator** is the source of truth for workflow state.
Agents do not directly mutate arbitrary state. They:
1. read context,
2. produce structured outputs,
3. send messages,
4. submit artifacts,
5. request transitions.

The orchestrator validates and commits those changes.

---

## 2. Execution Flow

### Phase-1 happy path
1. Human submits objective.
2. Orchestrator creates a root task.
3. Architect agent reads the objective and produces:
   - system plan,
   - subtask list,
   - acceptance criteria.
4. Orchestrator stores subtasks and assigns one to Builder.
5. Builder creates implementation artifacts.
6. Reviewer evaluates outputs against acceptance criteria.
7. Reviewer returns either:
   - `approved`, or
   - `changes_requested` with issues.
8. If changes are requested, task returns to Builder.
9. If approved, task is marked done.
10. Dashboard updates in real time.

### Control loop
```text
objective
  -> planning
  -> task creation
  -> assignment
  -> build
  -> review
  -> revise if needed
  -> done
```

---

## 3. Agent Role Definitions

### A. Orchestrator (system service, not a free agent)
**Purpose:** workflow control and state integrity.

**Responsibilities**
- create root runs
- create tasks/subtasks
- assign tasks to agents
- validate task state transitions
- enforce human approval gates when needed
- schedule retries/timeouts
- emit audit events
- collect summaries

**Should not do**
- large creative implementation work
- direct code generation for main artifacts
- subjective review without explicit criteria

**Inputs**
- objective
- workflow rules
- agent registry
- current state

**Outputs**
- assignments
- state changes
- event log entries

---

### B. Architect Agent
**Purpose:** decompose work and define implementation intent.

**Responsibilities**
- analyze root objective
- propose system design
- break root work into subtasks
- define acceptance criteria
- specify dependencies
- write handoff briefs for Builder

**Good tasks**
- planning
- API proposals
- data model drafts
- sequencing work

**Deliverables**
- architecture note
- task breakdown
- task handoff messages
- review criteria draft

**Failure modes**
- overplanning
- creating vague tasks
- missing constraints

**Guardrails**
- limit number of subtasks per planning pass
- require measurable acceptance criteria
- require dependency labels

---

### C. Builder Agent
**Purpose:** implement a specific task.

**Responsibilities**
- read handoff and task context
- generate code/docs/config/schema/UI components
- attach artifacts
- report status and blockers
- request clarification through messages instead of guessing silently

**Good tasks**
- endpoint implementation
- frontend component creation
- SQL migrations
- test writing
- small refactors

**Deliverables**
- artifact bundle
- implementation note
- self-check summary

**Failure modes**
- drifting outside task scope
- hidden assumptions
- incomplete implementation

**Guardrails**
- require explicit scope field
- require self-checklist before submission
- require list of changed files

---

### D. Reviewer Agent
**Purpose:** evaluate whether a task output meets its acceptance criteria.

**Responsibilities**
- compare implementation against acceptance criteria
- identify defects, omissions, and risks
- return structured verdict
- avoid rewriting the whole solution unless asked

**Verdicts**
- `approved`
- `changes_requested`
- `blocked`

**Deliverables**
- review report
- issue list
- severity labels
- optional follow-up tasks

**Failure modes**
- nitpicking without criteria
- approving shallow work
- vague feedback

**Guardrails**
- must reference acceptance criteria in review
- must label issue severity
- cannot reject without actionable reason

---

### E. Librarian / Memory Agent (optional in v1.1)
**Purpose:** keep summaries, canonical decisions, and retrievable context.

**Responsibilities**
- summarize long threads
- maintain project glossary
- store key architectural decisions
- attach context packets to future tasks

**Why optional**
In v1, simple summaries in the orchestrator are enough.
Only add a dedicated memory agent once thread volume becomes painful.

---

## 4. Recommended Initial Team

For your first implementation run:
- **1 Orchestrator service**
- **1 Architect agent**
- **1 Builder agent**
- **1 Reviewer agent**

Later expansion:
- Frontend Builder
- Backend Builder
- QA Builder
- Librarian
- Deployment agent

Do **not** start with more than 4 active agents.

---

## 5. Message Protocol

Use structured JSON messages as the default transport format.
Natural language can exist inside `content`, but the envelope should be strict.

## Base message schema
```json
{
  "id": "msg_123",
  "run_id": "run_001",
  "task_id": "task_014",
  "thread_id": "thread_backend_api",
  "from_agent": "architect",
  "to_agent": "builder",
  "channel": "task.task_014",
  "type": "handoff",
  "priority": "high",
  "content": {
    "summary": "Implement task CRUD endpoints",
    "details": "Create endpoints for create/list/update/status transition.",
    "acceptance_criteria": [
      "POST /tasks creates a task",
      "GET /tasks lists tasks",
      "PATCH /tasks/:id/status validates transitions"
    ],
    "constraints": [
      "Use FastAPI",
      "Return JSON only"
    ]
  },
  "artifact_refs": [],
  "in_reply_to": null,
  "created_at": "2026-03-10T15:00:00Z"
}
```

### Required message types
- `objective`
- `plan`
- `task_created`
- `handoff`
- `question`
- `answer`
- `status_update`
- `artifact_submitted`
- `review`
- `decision`
- `error`
- `summary`

### Recommended constraints
- every message belongs to a `run_id`
- task-specific messages should include `task_id`
- every review must reference acceptance criteria
- every artifact submission should include artifact refs
- free-form discussion should still have a message type

### Task handoff payload
```json
{
  "summary": "Build backend API for task board",
  "scope": "Backend only",
  "acceptance_criteria": [
    "Task CRUD works",
    "Status transitions validated",
    "Unit tests added"
  ],
  "dependencies": ["task_db_schema_done"],
  "blocked_by": [],
  "notes": "Use simple auth placeholder for now"
}
```

### Review payload
```json
{
  "verdict": "changes_requested",
  "criteria_check": [
    {
      "criterion": "Task CRUD works",
      "status": "pass"
    },
    {
      "criterion": "Status transitions validated",
      "status": "fail",
      "reason": "No invalid transition check"
    },
    {
      "criterion": "Unit tests added",
      "status": "partial",
      "reason": "Only happy-path tests exist"
    }
  ],
  "issues": [
    {
      "severity": "high",
      "title": "Missing transition validation",
      "action": "Add server-side transition guard"
    }
  ]
}
```

---

## 6. Task Model

A task should be a first-class object, not inferred from chat.

### Core task fields
- `id`
- `run_id`
- `parent_task_id`
- `title`
- `description`
- `status`
- `owner_agent`
- `created_by`
- `priority`
- `acceptance_criteria`
- `dependencies`
- `artifacts_expected`
- `artifacts_submitted`
- `review_status`
- `human_approval_required`
- `created_at`
- `updated_at`

### Task statuses
Recommended minimal set:
- `todo`
- `ready`
- `in_progress`
- `in_review`
- `changes_requested`
- `blocked`
- `done`
- `failed`
- `cancelled`

### State transitions
```text
todo -> ready -> in_progress -> in_review -> done
                               -> changes_requested -> in_progress
                    -> blocked
                    -> failed
```

Only the orchestrator should finalize transitions.

---

## 7. Database Schema

Use PostgreSQL if possible. SQLite is fine for a local prototype.

## A. `runs`
Represents one top-level objective execution.

```sql
CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  status TEXT NOT NULL,
  created_by TEXT,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

## B. `agents`
Registry of agent types / instances.

```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  model TEXT,
  system_prompt_version TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

## C. `tasks`
```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  parent_task_id TEXT REFERENCES tasks(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  owner_agent_id TEXT REFERENCES agents(id),
  created_by_agent_id TEXT REFERENCES agents(id),
  priority TEXT,
  acceptance_criteria_json TEXT,
  dependency_ids_json TEXT,
  review_status TEXT,
  human_approval_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

## D. `messages`
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  task_id TEXT REFERENCES tasks(id),
  thread_id TEXT,
  from_agent_id TEXT REFERENCES agents(id),
  to_agent_id TEXT REFERENCES agents(id),
  channel TEXT,
  type TEXT NOT NULL,
  priority TEXT,
  content_json TEXT NOT NULL,
  in_reply_to_message_id TEXT REFERENCES messages(id),
  created_at TIMESTAMP NOT NULL
);
```

## E. `artifacts`
```sql
CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  task_id TEXT REFERENCES tasks(id),
  created_by_agent_id TEXT REFERENCES agents(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  storage_uri TEXT NOT NULL,
  mime_type TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  metadata_json TEXT,
  created_at TIMESTAMP NOT NULL
);
```

## F. `message_artifacts`
Many-to-many join.

```sql
CREATE TABLE message_artifacts (
  message_id TEXT NOT NULL REFERENCES messages(id),
  artifact_id TEXT NOT NULL REFERENCES artifacts(id),
  PRIMARY KEY (message_id, artifact_id)
);
```

## G. `reviews`
```sql
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  task_id TEXT NOT NULL REFERENCES tasks(id),
  reviewer_agent_id TEXT REFERENCES agents(id),
  verdict TEXT NOT NULL,
  review_json TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL
);
```

## H. `task_events`
Append-only audit log.

```sql
CREATE TABLE task_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  task_id TEXT REFERENCES tasks(id),
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  payload_json TEXT,
  created_at TIMESTAMP NOT NULL
);
```

## I. `approvals`
```sql
CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  task_id TEXT REFERENCES tasks(id),
  requested_by_agent_id TEXT REFERENCES agents(id),
  approved_by_human TEXT,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL,
  resolved_at TIMESTAMP
);
```

---

## 8. Suggested API Endpoints

### Run management
- `POST /runs`
- `GET /runs`
- `GET /runs/{id}`
- `POST /runs/{id}/pause`
- `POST /runs/{id}/resume`
- `POST /runs/{id}/cancel`

### Tasks
- `GET /runs/{id}/tasks`
- `POST /tasks`
- `GET /tasks/{id}`
- `PATCH /tasks/{id}`
- `POST /tasks/{id}/assign`
- `POST /tasks/{id}/submit`
- `POST /tasks/{id}/review`

### Messages
- `GET /runs/{id}/messages`
- `POST /messages`
- `GET /threads/{thread_id}`

### Artifacts
- `POST /artifacts`
- `GET /artifacts/{id}`
- `GET /tasks/{id}/artifacts`

### Dashboard streaming
- `GET /runs/{id}/events/stream` using SSE or WebSocket

---

## 9. Frontend Dashboard Design

Build the first UI as a **three-panel operator console**.

## Layout

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Top Bar: Run selector | Status | Start/Pause/Resume | Cost | Time │
├───────────────┬──────────────────────────────┬──────────────────────┤
│ Left Panel    │ Center Panel                 │ Right Panel          │
│ Task Tree     │ Messages / Thread View       │ Artifact / Details   │
│               │                              │ / Review / Diff      │
└───────────────┴──────────────────────────────┴──────────────────────┘
```

### Left panel: Task Tree
Show:
- root objective
- subtasks hierarchy
- owner agent
- status badge
- dependency icons
- blocked indicators

Useful interactions:
- click task to filter center/right panels
- sort by status / owner / priority
- show only blocked or waiting tasks

### Center panel: Communication View
Default tab: thread messages for selected task.

Show per message:
- sender
- receiver/channel
- type badge
- timestamp
- short content summary
- linked artifacts

Tabs:
- task thread
- all run messages
- event stream

### Right panel: Artifact + Review View
Show selected item details:
- artifact preview
- review verdict
- acceptance criteria checklist
- changed files
- comments
- retry button
- approve/reject button if human action is required

---

## 10. Minimum Frontend Screens

### Screen 1: Run Overview
- objective
- overall status
- active agents
- task counts by state
- latest important events

### Screen 2: Task Detail
- title
- description
- owner
- dependencies
- acceptance criteria
- thread
- submitted artifacts
- latest review

### Screen 3: Agent Activity
- current task
- last message
- last active timestamp
- model used
- output count / error count

### Screen 4: Review Queue
- tasks waiting for review
- tasks waiting for human approval
- reviewer verdict history

---

## 11. Practical UX Rules

### Keep these visible at all times
- current run status
- task status counts
- blocked tasks
- pending approvals
- current active agent actions

### Use strong visual encoding
- status colors/badges
- message type tags
- agent avatars/labels
- artifact type icons

### Do not bury failure
Errors, blocked states, and review rejections should be impossible to miss.

---

## 12. Prompt Contract for Agents

Each agent should receive:
1. role definition,
2. current task,
3. relevant message history summary,
4. linked artifacts,
5. output format contract.

### Example Architect contract
```text
You are the Architect agent.
Your job is to decompose objectives into implementable subtasks.
Every subtask must include:
- title
- description
- owner role
- dependencies
- measurable acceptance criteria
Do not implement code.
Return valid JSON only.
```

### Example Builder contract
```text
You are the Builder agent.
Implement only the assigned task.
Do not change unrelated components.
Before finishing, provide:
- summary of work done
- changed files
- known limitations
- self-check against acceptance criteria
Return valid JSON plus artifact contents.
```

### Example Reviewer contract
```text
You are the Reviewer agent.
Evaluate outputs strictly against the acceptance criteria.
Return one of:
- approved
- changes_requested
- blocked
Every rejection must include concrete action items.
Return valid JSON only.
```

---

## 13. First Real Task You Can Give the Agents

Use this as the seed objective:

> Build the first version of an internal multi-agent workspace with:
> 1) task management,
> 2) structured agent messaging,
> 3) artifact storage,
> 4) a human dashboard for monitoring progress.
> Keep the implementation local-first and simple.

### Suggested subtask breakdown
1. Define backend data model and DB schema
2. Implement run/task/message/artifact APIs
3. Build task tree UI
4. Build thread/message UI
5. Build artifact panel UI
6. Implement review workflow
7. Add WebSocket/SSE live updates
8. Add seed/demo data for local testing

---

## 14. Recommended Tech Stack

### Backend
- Python + FastAPI
- SQLAlchemy
- PostgreSQL or SQLite
- Pydantic models
- SSE or WebSocket for live updates

### Frontend
- Next.js / React
- TypeScript
- Tailwind
- Zustand or Redux for UI state
- React Query for API data

### Local artifact storage
- local filesystem first
- later: S3-compatible object store

### Runtime queue
For v1, skip Kafka/Redis queue unless needed.
Simple DB-backed polling or in-process scheduler is enough.

---

## 15. What to Hand to Your Agents

When you hand this design to your agents, give them these implementation rules:

### Global rules
- optimize for traceability over cleverness
- all important state must be persisted
- no hidden side effects
- every task must have acceptance criteria
- every review must be actionable
- all UI should expose state clearly

### Engineering rules
- keep modules small
- define strict JSON schemas
- document every API contract
- write seed/demo fixtures
- prefer boring technology over premature complexity

### Constraints
- no autonomous spawning of unlimited agents
- no uncontrolled free-form chat loop
- no silent mutation of DB state outside orchestrator APIs

---

## 16. Implementation Order

### Step 1
Backend schema + REST API only.

### Step 2
Simple frontend with fake/demo data.

### Step 3
Connect frontend to backend.

### Step 4
Add one real end-to-end workflow:
objective -> planning -> build -> review.

### Step 5
Add live updates.

### Step 6
Add retry / approval / blocked-state handling.

---

## 17. Final Recommendation

Your system should initially feel less like a public forum and more like a **mission control console for a small AI engineering team**.

That means:
- structured tasks instead of vague chat,
- explicit handoffs instead of noisy discussion,
- versioned artifacts instead of buried outputs,
- review gates instead of blind autonomy,
- human visibility everywhere.

That is the right foundation for later scaling into a true multi-agent swarm.

