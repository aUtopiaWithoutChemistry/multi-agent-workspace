#!/usr/bin/env python3
"""
Backend API for Task Pool + Claim Architecture
"""

import os
import json
import uuid
import requests
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, UploadFile, File, Query, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import shutil

# Project paths
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
SCHEMAS_DIR = BASE_DIR / "schemas"

app = FastAPI(title="Task Pool API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure data directories exist
DATA_DIR.mkdir(exist_ok=True)

# Database setup
DB_PATH = DATA_DIR / "taskpool.db"

def init_db():
    """Initialize SQLite database"""
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()

    # Projects table
    c.execute('''CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        agents TEXT,
        workspace TEXT,
        requirements_dir TEXT,
        requirements_meta TEXT,
        created_by TEXT,
        created_at TEXT,
        updated_at TEXT
    )''')

    # Tasks table
    c.execute('''CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'open',
        type TEXT,
        priority INTEGER DEFAULT 0,
        claimed_by TEXT,
        claimed_at TEXT,
        created_by TEXT,
        created_at TEXT,
        updated_at TEXT,
        parent_task_id TEXT,
        reject_count INTEGER DEFAULT 0,
        comments TEXT,
        artifacts TEXT,
        progress INTEGER DEFAULT 0,
        requirement_file TEXT,
        depends_on TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
    )''')

    # Add depends_on column if not exists (migration)
    try:
        c.execute("ALTER TABLE tasks ADD COLUMN depends_on TEXT DEFAULT '[]'")
    except:
        pass  # Column already exists

    # Activity table
    c.execute('''CREATE TABLE IF NOT EXISTS activity (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        action TEXT,
        details TEXT,
        timestamp TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
    )''')

    conn.commit()
    conn.close()

# Initialize database on startup
init_db()


def load_json_schema(schema_name: str) -> dict:
    """Load JSON schema from file"""
    with open(SCHEMAS_DIR / f"{schema_name}.schema.json") as f:
        return json.load(f)


def get_project_dir(project_id: str) -> Path:
    """Get project data directory"""
    dir_path = DATA_DIR / project_id
    dir_path.mkdir(exist_ok=True)
    return dir_path


# Database helper functions
def dict_from_row(row, columns):
    """Convert sqlite3 row to dict"""
    return dict(zip(columns, row))


def load_project(project_id: str) -> dict:
    """Load project data from SQLite"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    c.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = c.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Project not found")

    project = dict(row)
    # Parse JSON fields
    project["agents"] = json.loads(project.get("agents", "[]"))
    project["requirements_meta"] = json.loads(project.get("requirements_meta", "{}"))
    return project


def save_project(project: dict):
    """Save project to SQLite"""
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()

    c.execute("""INSERT OR REPLACE INTO projects
        (id, name, description, agents, workspace, requirements_dir, requirements_meta, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            project["id"],
            project["name"],
            project.get("description", ""),
            json.dumps(project.get("agents", [])),
            project.get("workspace", ""),
            project.get("requirements_dir", "requirements/"),
            json.dumps(project.get("requirements_meta", {})),
            project.get("created_by", "human"),
            project["created_at"],
            project["updated_at"]
        )
    )
    conn.commit()
    conn.close()


def load_tasks(project_id: str) -> List[dict]:
    """Load all tasks for a project from SQLite"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    c.execute("SELECT * FROM tasks WHERE project_id = ?", (project_id,))
    rows = c.fetchall()
    conn.close()

    tasks = []
    for row in rows:
        task = dict(row)
        # Parse JSON fields
        task["comments"] = json.loads(task.get("comments", "[]"))
        task["artifacts"] = json.loads(task.get("artifacts", "[]"))
        task["depends_on"] = json.loads(task.get("depends_on", "[]"))
        tasks.append(task)
    return tasks


def save_tasks(project_id: str, tasks: List[dict]):
    """Save tasks to SQLite"""
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()

    # Delete existing tasks for this project
    c.execute("DELETE FROM tasks WHERE project_id = ?", (project_id,))

    # Insert all tasks
    for task in tasks:
        c.execute("""INSERT INTO tasks
            (id, project_id, title, description, status, type, priority, claimed_by, claimed_at,
             created_by, created_at, updated_at, parent_task_id, reject_count, comments, artifacts, progress, requirement_file, depends_on)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                task["id"],
                project_id,
                task["title"],
                task.get("description", ""),
                task.get("status", "open"),
                task.get("type", "code"),
                task.get("priority", 0),
                task.get("claimed_by"),
                task.get("claimed_at"),
                task.get("created_by", "human"),
                task["created_at"],
                task.get("updated_at"),
                task.get("parent_task_id"),
                task.get("reject_count", 0),
                json.dumps(task.get("comments", [])),
                json.dumps(task.get("artifacts", [])),
                task.get("progress", 0),
                task.get("requirement_file"),
                json.dumps(task.get("depends_on", []))
            )
        )

    conn.commit()
    conn.close()


def load_activity(project_id: str) -> List[dict]:
    """Load activity log from SQLite"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    c.execute("SELECT * FROM activity WHERE project_id = ? ORDER BY timestamp DESC LIMIT 100", (project_id,))
    rows = c.fetchall()
    conn.close()

    activities = []
    for row in rows:
        activity = dict(row)
        activity["details"] = json.loads(activity.get("details", "{}"))
        activities.append(activity)
    return activities


def save_activity(project_id: str, activity: List[dict]):
    """Save activity log to SQLite"""
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()

    # Delete existing activity for this project
    c.execute("DELETE FROM activity WHERE project_id = ?", (project_id,))

    # Insert all activity
    for entry in activity:
        c.execute("""INSERT INTO activity (id, project_id, action, details, timestamp)
            VALUES (?, ?, ?, ?, ?)""",
            (
                entry["id"],
                project_id,
                entry["action"],
                json.dumps(entry.get("details", {})),
                entry["timestamp"]
            )
        )

    conn.commit()
    conn.close()


def add_activity(project_id: str, action: str, details: dict):
    """Add activity log entry"""
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()

    entry = {
        "id": str(uuid.uuid4()),
        "action": action,
        "details": details,
        "timestamp": datetime.now().isoformat()
    }

    c.execute("""INSERT INTO activity (id, project_id, action, details, timestamp)
        VALUES (?, ?, ?, ?, ?)""",
        (entry["id"], project_id, action, json.dumps(details), entry["timestamp"])
    )

    # Keep only last 100 entries
    c.execute("""DELETE FROM activity WHERE project_id = ? AND id NOT IN
        (SELECT id FROM activity WHERE project_id = ? ORDER BY timestamp DESC LIMIT 100)""",
        (project_id, project_id)
    )

    conn.commit()
    conn.close()


# Request/Response models
class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    agents: List[str] = []
    workspace: str = ""  # Path to workspace directory for this project


class TaskCreate(BaseModel):
    title: str
    description: str = ""
    type: str  # spec, code, review, test, debug, docs, refactor, research
    depends_on: Optional[List[str]] = []  # List of task IDs this task depends on


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    progress: Optional[int] = None
    depends_on: Optional[List[str]] = None


class CommentCreate(BaseModel):
    author: str
    content: str


# Routes

@app.get("/")
def root():
    return FileResponse(BASE_DIR / "frontend" / "index.html")


@app.get("/api/projects")
def list_projects():
    """List all projects"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    c.execute("SELECT * FROM projects")
    rows = c.fetchall()
    conn.close()

    projects = []
    for row in rows:
        project = dict(row)
        project["agents"] = json.loads(project.get("agents", "[]"))
        project["requirements_meta"] = json.loads(project.get("requirements_meta", "{}"))
        projects.append(project)
    return projects


@app.post("/api/projects")
def create_project(project: ProjectCreate):
    """Create a new project"""
    project_id = str(uuid.uuid4())[:8]
    now = datetime.now().isoformat()

    # Use provided workspace or create default in data directory
    workspace = project.workspace.strip()
    if not workspace:
        workspace = str(get_project_dir(project_id) / "workspace")

    new_project = {
        "id": project_id,
        "name": project.name,
        "description": project.description,
        "agents": project.agents,
        "workspace": workspace,
        "requirements_dir": "requirements/",
        "requirements_meta": {},
        "created_by": "human",
        "created_at": now,
        "updated_at": now
    }

    # Create project directory and workspace
    project_dir = get_project_dir(project_id)
    (project_dir / "requirements").mkdir(exist_ok=True)
    Path(workspace).mkdir(exist_ok=True)

    save_project(new_project)
    save_tasks(project_id, [])
    save_activity(project_id, [])

    add_activity(project_id, "project_created", {"name": project.name, "agents": project.agents, "workspace": workspace})

    return new_project


@app.post("/api/projects/{project_id}/agents/{agent_id}")
def add_agent_to_project(project_id: str, agent_id: str):
    """Add an agent to a project"""
    project = load_project(project_id)

    if agent_id not in project["agents"]:
        project["agents"].append(agent_id)
        project["updated_at"] = datetime.now().isoformat()
        save_project(project)

        add_activity(project_id, "agent_added", {"agent_id": agent_id})

    return project


@app.delete("/api/projects/{project_id}/agents/{agent_id}")
def remove_agent_from_project(project_id: str, agent_id: str):
    """Remove an agent from a project"""
    project = load_project(project_id)

    if agent_id in project["agents"]:
        project["agents"].remove(agent_id)
        project["updated_at"] = datetime.now().isoformat()
        save_project(project)

        add_activity(project_id, "agent_removed", {"agent_id": agent_id})

    return project


@app.get("/api/projects/{project_id}")
def get_project(project_id: str):
    """Get project details"""
    project = load_project(project_id)
    tasks = load_tasks(project_id)

    # Get task stats
    stats = {
        "total": len(tasks),
        "open": len([t for t in tasks if t["status"] == "open"]),
        "claimed": len([t for t in tasks if t["status"] == "claimed"]),
        "in_progress": len([t for t in tasks if t["status"] == "in_progress"]),
        "in_review": len([t for t in tasks if t["status"] == "in_review"]),
        "review": len([t for t in tasks if t["type"] == "review"]),
        "done": len([t for t in tasks if t["status"] == "done"])
    }

    return {
        **project,
        "stats": stats,
        "task_count": len(tasks)
    }


@app.patch("/api/projects/{project_id}")
def update_project(project_id: str, update: dict):
    """Update project details"""
    project = load_project(project_id)

    # Update fields if provided
    if "name" in update:
        project["name"] = update["name"]
    if "description" in update:
        project["description"] = update["description"]
    if "workspace" in update:
        project["workspace"] = update["workspace"]
    if "requirements_dir" in update:
        project["requirements_dir"] = update["requirements_dir"]

    project["updated_at"] = datetime.now().isoformat()
    save_project(project)

    tasks = load_tasks(project_id)
    stats = {
        "total": len(tasks),
        "open": len([t for t in tasks if t["status"] == "open"]),
        "claimed": len([t for t in tasks if t["status"] == "claimed"]),
        "in_progress": len([t for t in tasks if t["status"] == "in_progress"]),
        "in_review": len([t for t in tasks if t["status"] == "in_review"]),
        "review": len([t for t in tasks if t["type"] == "review"]),
        "done": len([t for t in tasks if t["status"] == "done"])
    }

    return {
        **project,
        "stats": stats,
        "task_count": len(tasks)
    }


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str, request: Request):
    """Delete a project - Only allowed from UI (human-initiated)"""
    # Security: Only allow deletion from web UI
    # Agents cannot delete projects via API
    x_human_request = request.headers.get("X-Human-Request", "")

    if not x_human_request:
        raise HTTPException(
            status_code=403,
            detail="Project deletion is not allowed via API. Please use the web interface."
        )

    # Load project to verify it exists
    project = load_project(project_id)

    # Delete from database
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    c.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    c.execute("DELETE FROM tasks WHERE project_id = ?", (project_id,))
    c.execute("DELETE FROM activity WHERE project_id = ?", (project_id,))
    conn.commit()
    conn.close()

    # Delete project directory
    project_dir = get_project_dir(project_id)
    if project_dir.exists():
        shutil.rmtree(project_dir)

    return {"message": "Project deleted"}


@app.get("/api/projects/{project_id}/tasks")
def list_tasks(
    project_id: str,
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    claimed_by: Optional[str] = Query(None)
):
    """List tasks for a project with optional filters"""
    tasks = load_tasks(project_id)

    # Apply filters
    if status:
        tasks = [t for t in tasks if t.get("status") == status]
    if type:
        tasks = [t for t in tasks if t.get("type") == type]
    if claimed_by:
        tasks = [t for t in tasks if t.get("claimed_by") == claimed_by]

    return tasks


@app.post("/api/projects/{project_id}/tasks")
def create_task(project_id: str, task: TaskCreate):
    """Create a new task"""
    load_project(project_id)  # Verify project exists

    tasks = load_tasks(project_id)

    now = datetime.now().isoformat()
    new_task = {
        "id": str(uuid.uuid4())[:8],
        "title": task.title,
        "description": task.description,
        "status": "open",
        "type": task.type,
        "priority": 0,
        "claimed_by": None,
        "claimed_at": None,
        "created_by": "human",
        "created_at": now,
        "updated_at": now,
        "parent_task_id": None,
        "reject_count": 0,
        "comments": [],
        "artifacts": [],
        "progress": 0,
        "depends_on": task.depends_on if task.depends_on else []
    }

    tasks.append(new_task)
    save_tasks(project_id, tasks)

    add_activity(project_id, "task_created", {
        "task_id": new_task["id"],
        "title": task.title,
        "type": task.type
    })

    return new_task


@app.get("/api/projects/{project_id}/tasks/{task_id}")
def get_task(project_id: str, task_id: str):
    """Get task details"""
    tasks = load_tasks(project_id)
    task = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.patch("/api/projects/{project_id}/tasks/{task_id}")
def update_task(project_id: str, task_id: str, update: TaskUpdate):
    """Update a task"""
    tasks = load_tasks(project_id)
    task_idx = next((i for i, t in enumerate(tasks) if t["id"] == task_id), None)
    if task_idx is None:
        raise HTTPException(status_code=404, detail="Task not found")

    task = tasks[task_idx]
    now = datetime.now().isoformat()

    # Apply updates
    if update.title is not None:
        task["title"] = update.title
    if update.description is not None:
        task["description"] = update.description
    if update.status is not None:
        old_status = task["status"]
        task["status"] = update.status
        add_activity(project_id, "task_status_changed", {
            "task_id": task_id,
            "old_status": old_status,
            "new_status": update.status
        })
    if update.progress is not None:
        task["progress"] = update.progress
    if update.depends_on is not None:
        task["depends_on"] = update.depends_on

    task["updated_at"] = now
    tasks[task_idx] = task

    save_tasks(project_id, tasks)
    return task


@app.post("/api/projects/{project_id}/tasks/{task_id}/claim")
def claim_task(project_id: str, task_id: str, agent_id: str):
    """Claim a task for an agent"""
    project = load_project(project_id)
    tasks = load_tasks(project_id)
    task_idx = next((i for i, t in enumerate(tasks) if t["id"] == task_id), None)
    if task_idx is None:
        raise HTTPException(status_code=404, detail="Task not found")

    task = tasks[task_idx]

    if task["status"] != "open":
        raise HTTPException(status_code=400, detail="Task is not available for claiming")

    # Check if dependencies are satisfied
    deps = task.get("depends_on", [])
    if deps:
        for dep_id in deps:
            dep_task = next((t for t in tasks if t["id"] == dep_id), None)
            if not dep_task:
                raise HTTPException(status_code=400, detail=f"Dependency task {dep_id} not found")
            if dep_task["status"] != "done":
                raise HTTPException(status_code=400, detail=f"Dependency task '{dep_task['title']}' is not completed yet")

    # Check if agent is in project's agent list
    if agent_id not in project.get("agents", []):
        raise HTTPException(status_code=403, detail=f"Agent {agent_id} is not assigned to this project")

    # Check if agent already has an active task
    active_task = next(
        (t for t in tasks if t.get("claimed_by") == agent_id and t["status"] in ["claimed", "in_progress"]),
        None
    )
    if active_task:
        raise HTTPException(status_code=400, detail=f"Agent {agent_id} already has an active task: {active_task['title']}")

    # Check for self-review prevention
    if task["type"] == "review" and task.get("parent_task_id"):
        parent_task = next((t for t in tasks if t["id"] == task["parent_task_id"]), None)
        if parent_task and parent_task.get("claimed_by") == agent_id:
            raise HTTPException(status_code=400, detail="Cannot review your own task")

    now = datetime.now().isoformat()
    task["status"] = "claimed"
    task["claimed_by"] = agent_id
    task["claimed_at"] = now
    task["updated_at"] = now

    tasks[task_idx] = task
    save_tasks(project_id, tasks)

    add_activity(project_id, "task_claimed", {
        "task_id": task_id,
        "agent_id": agent_id,
        "title": task["title"]
    })

    # Include workspace info for the agent
    return {
        **task,
        "workspace": project.get("workspace", ""),
        "project_name": project.get("name", "")
    }


@app.post("/api/projects/{project_id}/tasks/{task_id}/start")
def start_task(project_id: str, task_id: str, agent_id: str):
    """Start working on a claimed task"""
    tasks = load_tasks(project_id)
    task_idx = next((i for i, t in enumerate(tasks) if t["id"] == task_id), None)
    if task_idx is None:
        raise HTTPException(status_code=404, detail="Task not found")

    task = tasks[task_idx]

    if task.get("claimed_by") != agent_id:
        raise HTTPException(status_code=403, detail="Task not claimed by this agent")

    now = datetime.now().isoformat()
    task["status"] = "in_progress"
    task["updated_at"] = now

    tasks[task_idx] = task
    save_tasks(project_id, tasks)

    add_activity(project_id, "task_started", {
        "task_id": task_id,
        "agent_id": agent_id,
        "title": task["title"]
    })

    return task


@app.post("/api/projects/{project_id}/tasks/{task_id}/complete")
@app.post("/api/projects/{project_id}/tasks/{task_id}/complete")
def complete_task(project_id: str, task_id: str, agent_id: str, body: Optional[dict] = Body(None)):
    """Mark task as complete and create review task or sub-tasks for spec"""
    tasks = load_tasks(project_id)
    task_idx = next((i for i, t in enumerate(tasks) if t["id"] == task_id), None)
    if task_idx is None:
        raise HTTPException(status_code=404, detail="Task not found")

    task = tasks[task_idx]

    if task.get("claimed_by") != agent_id:
        raise HTTPException(status_code=403, detail="Task not claimed by this agent")

    now = datetime.now().isoformat()

    # Get sub_tasks from body
    sub_tasks = body.get("sub_tasks") if body else None

    # Task type determines what can be created
    task_type = task["type"]

    # For spec tasks: sub_tasks are REQUIRED
    if task_type == "spec":
        if not sub_tasks:
            raise HTTPException(
                status_code=400,
                detail="SPEC tasks must include sub_tasks in the request body. Decompose the requirement into specific coding tasks."
            )

    # For code tasks: can optionally create sub_tasks (test, docs, debug, refactor)
    # For debug/refactor: can create sub_tasks too
    # For other tasks: sub_tasks not allowed
    allowed_subtask_types = ["spec", "code", "debug", "refactor"]
    if sub_tasks and task_type not in allowed_subtask_types:
        raise HTTPException(
            status_code=400,
            detail=f"Task type '{task_type}' cannot create sub_tasks. Only {allowed_subtask_types} can create sub-tasks."
        )
        # Create sub-tasks
        created_subtasks = []
        for subtask_data in sub_tasks:
            subtask = {
                "id": str(uuid.uuid4())[:8],
                "title": subtask_data.get("title", "Untitled subtask"),
                "description": subtask_data.get("description", ""),
                "status": "open",
                "type": subtask_data.get("type", "code"),
                "priority": 0,
                "claimed_by": None,
                "claimed_at": None,
                "created_by": "system",
                "created_at": now,
                "updated_at": now,
                "parent_task_id": task_id,
                "reject_count": 0,
                "comments": [],
                "artifacts": [],
                "progress": 0,
                "depends_on": []
            }
            tasks.append(subtask)
            created_subtasks.append(subtask)

        # Resolve dependencies
        for subtask_data, subtask in zip(sub_tasks, created_subtasks):
            deps = subtask_data.get("depends_on", [])
            if deps:
                resolved_deps = []
                for dep_title in deps:
                    for st in created_subtasks:
                        if st["title"] == dep_title:
                            resolved_deps.append(st["id"])
                            break
                subtask["depends_on"] = resolved_deps

        add_activity(project_id, "spec_decomposed", {
            "task_id": task_id,
            "agent_id": agent_id,
            "subtask_count": len(sub_tasks)
        })
    # For other tasks: create review task (if not already a review task)
    elif task["type"] != "review":
        review_task = {
            "id": str(uuid.uuid4())[:8],
            "title": f"Review: {task['title']}",
            "description": f"Review the work done for: {task['description']}",
            "status": "open",
            "type": "review",
            "priority": 0,
            "claimed_by": None,
            "claimed_at": None,
            "created_by": "system",
            "created_at": now,
            "updated_at": now,
            "parent_task_id": task_id,
            "reject_count": 0,
            "comments": [],
            "artifacts": task.get("artifacts", []),
            "progress": 0
        }
        tasks.append(review_task)
        # For code/debug/refactor: mark as "in_review" until review passes
        if task["type"] in ["code", "debug", "refactor"]:
            task["status"] = "in_review"
            task["progress"] = 90  # Not fully complete yet
        else:
            task["status"] = "done"
            task["progress"] = 100
        task["updated_at"] = now
    tasks[task_idx] = task

    save_tasks(project_id, tasks)

    add_activity(project_id, "task_completed", {
        "task_id": task_id,
        "agent_id": agent_id,
        "title": task["title"],
        "subtasks_created": task["type"] == "spec" and sub_tasks,
        "review_created": task["type"] != "review" and task["type"] != "spec"
    })

    return task


@app.post("/api/projects/{project_id}/tasks/{task_id}/release")
def release_task(project_id: str, task_id: str):
    """Release a claimed task back to open"""
    tasks = load_tasks(project_id)
    task_idx = next((i for i, t in enumerate(tasks) if t["id"] == task_id), None)
    if task_idx is None:
        raise HTTPException(status_code=404, detail="Task not found")

    task = tasks[task_idx]

    if task["status"] not in ["claimed", "in_progress"]:
        raise HTTPException(status_code=400, detail="Task is not claimed")

    old_claimed_by = task.get("claimed_by")
    now = datetime.now().isoformat()
    task["status"] = "open"
    task["claimed_by"] = None
    task["claimed_at"] = None
    task["updated_at"] = now

    tasks[task_idx] = task
    save_tasks(project_id, tasks)

    add_activity(project_id, "task_released", {
        "task_id": task_id,
        "previous_agent": old_claimed_by,
        "title": task["title"]
    })

    return task


@app.post("/api/projects/{project_id}/tasks/{task_id}/comments")
def add_comment(project_id: str, task_id: str, comment: CommentCreate):
    """Add a comment to a task"""
    tasks = load_tasks(project_id)
    task_idx = next((i for i, t in enumerate(tasks) if t["id"] == task_id), None)
    if task_idx is None:
        raise HTTPException(status_code=404, detail="Task not found")

    task = tasks[task_idx]
    now = datetime.now().isoformat()

    new_comment = {
        "author": comment.author,
        "content": comment.content,
        "timestamp": now
    }

    task.setdefault("comments", []).append(new_comment)
    task["updated_at"] = now

    tasks[task_idx] = task
    save_tasks(project_id, tasks)

    add_activity(project_id, "comment_added", {
        "task_id": task_id,
        "author": comment.author
    })

    return new_comment


@app.post("/api/projects/{project_id}/tasks/{task_id}/review")
def submit_review(project_id: str, task_id: str, approved: bool, comment: str = ""):
    """Submit a review decision"""
    tasks = load_tasks(project_id)
    task_idx = next((i for i, t in enumerate(tasks) if t["id"] == task_id), None)
    if task_idx is None:
        raise HTTPException(status_code=404, detail="Task not found")

    task = tasks[task_idx]

    if task["type"] != "review":
        raise HTTPException(status_code=400, detail="Task is not a review task")

    now = datetime.now().isoformat()
    parent_task_id = task.get("parent_task_id")

    if approved:
        # Mark parent task as done
        if parent_task_id:
            parent_idx = next((i for i, t in enumerate(tasks) if t["id"] == parent_task_id), None)
            if parent_idx is not None:
                tasks[parent_idx]["status"] = "done"
                tasks[parent_idx]["progress"] = 100
                tasks[parent_idx]["updated_at"] = now

        task["status"] = "done"
        task["progress"] = 100
        action = "review_approved"
    else:
        # Reject - send back to original agent for fixes
        if parent_task_id:
            parent_idx = next((i for i, t in enumerate(tasks) if t["id"] == parent_task_id), None)
            if parent_idx is not None:
                # Reset to in_progress so the original agent can fix it
                tasks[parent_idx]["status"] = "in_progress"
                tasks[parent_idx]["progress"] = 50  # Partial progress since some work was done
                tasks[parent_idx]["reject_count"] = tasks[parent_idx].get("reject_count", 0) + 1
                # If rejected too many times, release for others
                if tasks[parent_idx].get("reject_count", 0) > 3:
                    tasks[parent_idx]["claimed_by"] = None
                    tasks[parent_idx]["claimed_at"] = None
                    tasks[parent_idx]["status"] = "open"
                tasks[parent_idx]["updated_at"] = now

        task["status"] = "done"
        action = "review_rejected"

    # Add review comment
    task.setdefault("comments", []).append({
        "author": "reviewer",
        "content": f"Review result: {'Approved' if approved else 'Rejected'}. {comment}",
        "timestamp": now
    })

    task["updated_at"] = now
    tasks[task_idx] = task
    save_tasks(project_id, tasks)

    add_activity(project_id, action, {
        "task_id": task_id,
        "parent_task_id": parent_task_id,
        "approved": approved,
        "comment": comment
    })

    return task


# Requirements endpoints

@app.get("/api/projects/{project_id}/requirements")
def list_requirements(project_id: str):
    """List requirement files"""
    project = load_project(project_id)
    req_dir = get_project_dir(project_id) / "requirements"

    if not req_dir.exists():
        return []

    files = []
    for f in req_dir.iterdir():
        if f.is_file() and f.suffix == ".md":
            files.append({
                "name": f.name,
                "path": str(f.relative_to(DATA_DIR)),
                "size": f.stat().st_size,
                "processed": project.get("requirements_meta", {}).get(f.name, {}).get("processed", False)
            })

    return files


@app.post("/api/projects/{project_id}/requirements")
async def upload_requirement(project_id: str, file: UploadFile = File(...)):
    """Upload a requirement file"""
    project = load_project(project_id)
    req_dir = get_project_dir(project_id) / "requirements"
    req_dir.mkdir(exist_ok=True)

    file_path = req_dir / file.filename

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Mark as unprocessed
    if "requirements_meta" not in project:
        project["requirements_meta"] = {}
    project["requirements_meta"][file.filename] = {
        "spec_task_id": None,
        "processed": False
    }
    save_project(project)

    # Create a spec task for this requirement
    tasks = load_tasks(project_id)
    now = datetime.now().isoformat()

    with open(file_path, "r") as f:
        req_content = f.read()

    spec_task = {
        "id": str(uuid.uuid4())[:8],
        "title": f"Spec: {file.filename}",
        "description": f"Analyze and decompose requirement file: {file.filename}\n\n{req_content[:500]}...",
        "status": "open",
        "type": "spec",
        "priority": 0,
        "claimed_by": None,
        "claimed_at": None,
        "created_by": "human",
        "created_at": now,
        "updated_at": now,
        "parent_task_id": None,
        "reject_count": 0,
        "comments": [],
        "artifacts": [],
        "progress": 0,
        "requirement_file": file.filename
    }

    tasks.append(spec_task)
    save_tasks(project_id, tasks)

    # Update project with spec task id
    project["requirements_meta"][file.filename]["spec_task_id"] = spec_task["id"]
    save_project(project)

    add_activity(project_id, "requirement_uploaded", {
        "filename": file.filename,
        "spec_task_id": spec_task["id"]
    })

    return {
        "filename": file.filename,
        "spec_task_id": spec_task["id"],
        "task": spec_task
    }


@app.get("/api/projects/{project_id}/activity")
def get_activity(project_id: str, limit: int = Query(50, ge=1, le=100)):
    """Get activity feed"""
    activity = load_activity(project_id)
    return activity[:limit]


# Dispatch endpoint

@app.post("/api/dispatch/{project_id}")
def trigger_dispatch(project_id: str):
    """Trigger dispatch for a project (manual/one-shot)"""
    # This endpoint is for manual triggering
    # In production, agents would poll independently
    project = load_project(project_id)
    tasks = load_tasks(project_id)

    available_tasks = [t for t in tasks if t["status"] == "open"]

    add_activity(project_id, "dispatch_triggered", {
        "available_tasks": len(available_tasks),
        "agents": project["agents"]
    })

    return {
        "project_id": project_id,
        "available_tasks": len(available_tasks),
        "message": "Dispatch triggered. Agents will poll for available tasks."
    }


@app.get("/api/agents")
def list_available_agents():
    """
    List available agents from OpenCLAW.
    Reads agents from ~/.openclaw/agents/ directory.
    """
    openclaw_dir = Path.home() / ".openclaw" / "agents"

    agents = []
    if openclaw_dir.exists():
        for agent_dir in openclaw_dir.iterdir():
            if agent_dir.is_dir() and not agent_dir.name.startswith('.'):
                agents.append({
                    "id": agent_dir.name,
                    "name": agent_dir.name.capitalize(),
                    "status": "online",
                    "capabilities": ["spec", "code", "test", "review"]
                })

    # If no agents found, fallback to mock data
    if not agents:
        agents = [
            {"id": "main", "name": "Main", "status": "online", "capabilities": ["spec", "code", "test", "review"]},
            {"id": "oscar", "name": "Oscar", "status": "online", "capabilities": ["spec", "code", "test", "review"]},
        ]

    return agents


@app.get("/api/projects/{project_id}/agents")
def get_project_agents(project_id: str):
    """Get agents status for a project"""
    project = load_project(project_id)
    tasks = load_tasks(project_id)

    agent_status = []
    for agent_id in project["agents"]:
        active_task = next(
            (t for t in tasks if t.get("claimed_by") == agent_id and t["status"] in ["claimed", "in_progress"]),
            None
        )
        agent_status.append({
            "id": agent_id,
            "status": "doing" if active_task else "idle",
            "current_task": active_task
        })

    return agent_status


# Workspace file operations
@app.get("/api/projects/{project_id}/workspace")
def list_workspace_files(project_id: str):
    """List files and folders in project workspace"""
    project = load_project(project_id)
    workspace = project.get("workspace", "")
    if not workspace or not Path(workspace).exists():
        return {"files": [], "workspace": workspace}

    def get_tree(path: Path, prefix: str = ""):
        items = []
        try:
            for item in sorted(path.iterdir()):
                rel_path = item.relative_to(path)
                item_info = {
                    "name": rel_path.name,
                    "type": "folder" if item.is_dir() else "file",
                    "path": str(rel_path)
                }
                if item.is_dir():
                    item_info["children"] = get_tree(item, prefix + "  ")
                items.append(item_info)
        except PermissionError:
            pass
        return items

    workspace_path = Path(workspace)
    return {
        "workspace": workspace,
        "files": get_tree(workspace_path)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)
