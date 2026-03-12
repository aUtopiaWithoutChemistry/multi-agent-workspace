#!/usr/bin/env python3
"""
Dispatch Loop - Agent polling and task execution

Each agent runs this loop independently to:
1. Scan for new requirement files
2. Find and claim available tasks
3. Execute tasks based on type
4. Handle results (create subtasks, review tasks, etc.)
"""

import os
import sys
import json
import time
import random
import requests
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional

# Configuration
API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "30"))  # seconds
TIMEOUT_MINUTES = int(os.environ.get("TIMEOUT_MINUTES", "10"))

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))


def api_request(method: str, endpoint: str, **kwargs) -> Dict:
    """Make API request"""
    url = f"{API_BASE_URL}{endpoint}"
    try:
        response = requests.request(method, url, **kwargs)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"API request failed: {e}")
        return {}


def get_projects() -> List[Dict]:
    """Get all projects"""
    return api_request("GET", "/api/projects")


def get_project(project_id: str) -> Dict:
    """Get project details"""
    return api_request("GET", f"/api/projects/{project_id}")


def get_claimable_tasks(project_id: str, agent_id: str) -> List[Dict]:
    """Get tasks that can be claimed"""
    tasks = api_request("GET", f"/api/projects/{project_id}/tasks?status=open")

    # Filter out review tasks that would be self-review
    filtered = []
    for task in tasks:
        if task["type"] == "review":
            parent_id = task.get("parent_task_id")
            if parent_id:
                parent = api_request("GET", f"/api/projects/{project_id}/tasks/{parent_id}")
                if parent.get("claimed_by") == agent_id:
                    continue  # Skip self-review
        filtered.append(task)

    return filtered


def get_agents_status(project_id: str) -> List[Dict]:
    """Get agent status for a project"""
    return api_request("GET", f"/api/projects/{project_id}/agents")


def claim_task(project_id: str, task_id: str, agent_id: str) -> Optional[Dict]:
    """Try to claim a task"""
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/projects/{project_id}/tasks/{task_id}/claim",
            params={"agent_id": agent_id}
        )
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"Failed to claim task: {e}")
        return None


def start_task(project_id: str, task_id: str, agent_id: str) -> Optional[Dict]:
    """Start working on a claimed task"""
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/projects/{project_id}/tasks/{task_id}/start",
            params={"agent_id": agent_id}
        )
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"Failed to start task: {e}")
        return None


def add_comment(project_id: str, task_id: str, agent_id: str, content: str) -> Optional[Dict]:
    """Add a comment to a task"""
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/projects/{project_id}/tasks/{task_id}/comments",
            json={"author": agent_id, "content": content}
        )
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"Failed to add comment: {e}")
        return None


def update_task_progress(project_id: str, task_id: str, progress: int) -> Optional[Dict]:
    """Update task progress"""
    try:
        response = requests.patch(
            f"{API_BASE_URL}/api/projects/{project_id}/tasks/{task_id}",
            json={"progress": progress}
        )
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"Failed to update progress: {e}")
        return None


def create_task(project_id: str, title: str, description: str, task_type: str, parent_task_id: str = None) -> Optional[Dict]:
    """Create a new task"""
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/projects/{project_id}/tasks",
            json={
                "title": title,
                "description": description,
                "type": task_type
            }
        )
        if response.status_code == 200:
            task = response.json()
            if parent_task_id:
                # Link to parent
                patch_data = {"parent_task_id": parent_task_id}
                requests.patch(
                    f"{API_BASE_URL}/api/projects/{project_id}/tasks/{task['id']}",
                    json=patch_data
                )
            return task
        return None
    except Exception as e:
        print(f"Failed to create task: {e}")
        return None


def complete_task(project_id: str, task_id: str, agent_id: str, artifacts: List[Dict] = None) -> Optional[Dict]:
    """Complete a task"""
    try:
        # First add any artifacts as comments
        if artifacts:
            for artifact in artifacts:
                add_comment(
                    project_id, task_id, agent_id,
                    f"Created artifact: {artifact.get('path', 'unknown')} - {artifact.get('description', '')}"
                )

        response = requests.post(
            f"{API_BASE_URL}/api/projects/{project_id}/tasks/{task_id}/complete",
            params={"agent_id": agent_id}
        )
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"Failed to complete task: {e}")
        return None


def submit_review(project_id: str, task_id: str, approved: bool, comment: str = "") -> Optional[Dict]:
    """Submit a review decision"""
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/projects/{project_id}/tasks/{task_id}/review",
            params={"approved": approved, "comment": comment}
        )
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"Failed to submit review: {e}")
        return None


def check_timeouts(project_id: str) -> List[Dict]:
    """Check for timed out tasks and release them"""
    tasks = api_request("GET", f"/api/projects/{project_id}/tasks")
    now = datetime.now()
    released = []

    for task in tasks:
        if task["status"] in ["claimed", "in_progress"]:
            claimed_at = task.get("claimed_at")
            if claimed_at:
                claimed_time = datetime.fromisoformat(claimed_at)
                if (now - claimed_time).total_seconds() > TIMEOUT_MINUTES * 60:
                    # Release task
                    released_task = api_request(
                        "POST",
                        f"/api/projects/{project_id}/tasks/{task['id']}/release"
                    )
                    if released_task:
                        released.append(task)
                        print(f"Released timeout task: {task['title']} (was claimed by {task.get('claimed_by')})")

    return released


def execute_task(agent_id: str, project_id: str, task: Dict) -> Dict:
    """
    Execute a task based on its type.
    This is a placeholder - in production, this would call the LLM.
    """
    task_type = task["type"]

    print(f"Agent {agent_id} executing task {task['id']}: {task['title']} (type: {task_type})")

    # Simulate work
    time.sleep(2)

    result = {
        "status": "success",
        "artifacts": [],
        "subtasks": []
    }

    if task_type == "spec":
        # Spec task: decompose into subtasks
        result["subtasks"] = [
            {"title": "Implement feature A", "description": "Implement the first part of the spec", "type": "code"},
            {"title": "Implement feature B", "description": "Implement the second part of the spec", "type": "code"},
            {"title": "Write tests", "description": "Write tests for the implemented features", "type": "test"}
        ]

    elif task_type == "code":
        result["artifacts"] = [
            {"path": f"src/feature_{task['id']}.py", "description": "Implementation file"}
        ]

    elif task_type == "test":
        result["artifacts"] = [
            {"path": f"tests/test_{task['id']}.py", "description": "Test file"}
        ]

    elif task_type == "review":
        # Review task: randomly approve or reject (for simulation)
        result["approved"] = random.random() > 0.3  # 70% approval rate
        result["comment"] = "Review completed. Code looks good." if result["approved"] else "Needs some fixes."

    return result


def agent_poll(agent_id: str, project_id: str):
    """
    Single agent's polling cycle.
    Returns True if work was done, False if idle.
    """
    print(f"\n=== Agent {agent_id} polling project {project_id} ===")

    # Check for timeouts first
    check_timeouts(project_id)

    # Find claimable tasks
    available = get_claimable_tasks(project_id, agent_id)

    if not available:
        print(f"No available tasks for {agent_id}")
        return False

    # Agent chooses a task (randomly for now)
    # In production, agent could use LLM to prioritize
    task = random.choice(available)
    print(f"Agent {agent_id} choosing task: {task['title']}")

    # Try to claim
    claimed = claim_task(project_id, task["id"], agent_id)
    if not claimed:
        print(f"Failed to claim task {task['id']}, it may have been taken")
        return False

    print(f"Successfully claimed task {task['id']}")

    # Add initial comment
    add_comment(project_id, task["id"], agent_id, f"Starting work on: {task['title']}")

    # Start the task
    start_task(project_id, task["id"], agent_id)
    update_task_progress(project_id, task["id"], 10)

    # Execute the task
    result = execute_task(agent_id, project_id, task)

    # Update progress
    update_task_progress(project_id, task["id"], 50)

    # Handle results based on task type
    if task["type"] == "spec":
        # Create subtasks
        for subtask in result.get("subtasks", []):
            create_task(
                project_id,
                subtask["title"],
                subtask["description"],
                subtask["type"],
                parent_task_id=task["id"]
            )
        add_comment(project_id, task["id"], agent_id, f"Created {len(result['subtasks'])} subtasks")
        complete_task(project_id, task["id"], agent_id)

    elif task["type"] == "review":
        # Submit review decision
        approved = result.get("approved", False)
        comment = result.get("comment", "")
        submit_review(project_id, task["id"], approved, comment)

    else:
        # Code/test/docs/etc - complete and create review task
        complete_task(project_id, task["id"], agent_id, result.get("artifacts", []))

    update_task_progress(project_id, task["id"], 100)
    print(f"Agent {agent_id} completed task {task['id']}")

    return True


def run_agent(agent_id: str, project_id: str = None):
    """
    Run an agent continuously.
    If project_id is None, the agent will work on all projects it's assigned to.
    """
    print(f"Starting agent {agent_id}")

    while True:
        try:
            if project_id:
                # Work on specific project
                agent_poll(agent_id, project_id)
            else:
                # Find all projects and work on them
                projects = get_projects()
                for proj in projects:
                    if agent_id in proj.get("agents", []):
                        agent_poll(agent_id, proj["id"])

        except KeyboardInterrupt:
            print(f"Agent {agent_id} stopping...")
            break
        except Exception as e:
            print(f"Error in agent loop: {e}")

        # Wait before next poll
        time.sleep(POLL_INTERVAL)


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Agent Dispatch Loop")
    parser.add_argument("--agent-id", "-a", required=True, help="Agent ID")
    parser.add_argument("--project-id", "-p", help="Project ID (optional)")
    parser.add_argument("--api-url", default="http://localhost:8000", help="API base URL")
    parser.add_argument("--poll-interval", type=int, default=30, help="Poll interval in seconds")
    parser.add_argument("--timeout", type=int, default=10, help="Task timeout in minutes")

    args = parser.parse_args()

    global API_BASE_URL, POLL_INTERVAL, TIMEOUT_MINUTES
    API_BASE_URL = args.api_url
    POLL_INTERVAL = args.poll_interval
    TIMEOUT_MINUTES = args.timeout

    print(f"Agent {args.agent_id} starting...")
    print(f"API: {API_BASE_URL}")
    print(f"Poll interval: {POLL_INTERVAL}s")
    print(f"Timeout: {TIMEOUT_MINUTES} minutes")

    run_agent(args.agent_id, args.project_id)


if __name__ == "__main__":
    main()
