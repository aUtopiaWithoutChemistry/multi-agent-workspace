// API Configuration
const API_BASE = window.location.origin;

// State
let currentProject = null;
let currentFilter = 'all';
let availableAgents = [];
let selectedAgents = [];

// DOM Elements
const projectSelect = document.getElementById('project-select');
const agentsList = document.getElementById('agents-list');
const taskList = document.getElementById('task-list');
const activityFeed = document.getElementById('activity-feed');

// Modals
const taskModal = document.getElementById('task-modal');
const projectModal = document.getElementById('project-modal');
const uploadModal = document.getElementById('upload-modal');
const taskCreateModal = document.getElementById('task-create-modal');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadProjects();
    setupEventListeners();
    renderSelectedAgents();
});

// Event Listeners
function setupEventListeners() {
    // Project select
    projectSelect.addEventListener('change', (e) => {
        const projectId = e.target.value;
        if (projectId) {
            loadProject(projectId);
        } else {
            clearProject();
        }
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            renderTasks();
        });
    });

    // Modal close buttons
    document.getElementById('modal-close').addEventListener('click', () => taskModal.classList.remove('active'));
    document.getElementById('project-modal-close').addEventListener('click', () => projectModal.classList.remove('active'));
    document.getElementById('upload-modal-close').addEventListener('click', () => uploadModal.classList.remove('active'));
    document.getElementById('task-create-modal-close').addEventListener('click', () => taskCreateModal.classList.remove('active'));

    // Close modal on background click
    [taskModal, projectModal, uploadModal, taskCreateModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });

    // Create project button
    document.getElementById('btn-create-project').addEventListener('click', async () => {
        await loadAvailableAgents();
        renderSelectedAgents();
        projectModal.classList.add('active');
    });
    document.getElementById('btn-save-project').addEventListener('click', createProject);

    // Agent selector - with null checks
    const agentSearch = document.getElementById('agent-search');
    const agentDropdown = document.getElementById('agent-dropdown');

    if (agentSearch && agentDropdown) {
        agentSearch.addEventListener('focus', () => {
            renderAgentDropdown();
            agentDropdown.classList.remove('hidden');
        });

        agentSearch.addEventListener('input', (e) => {
            renderAgentDropdown(e.target.value);
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.agent-search-wrapper')) {
                agentDropdown.classList.add('hidden');
            }
        });
    }

    // Upload requirement button
    document.getElementById('btn-upload-requirement').addEventListener('click', () => {
        if (!currentProject) {
            alert('Please select a project first');
            return;
        }
        uploadModal.classList.add('active');
    });
    document.getElementById('btn-upload-file').addEventListener('click', uploadRequirement);

    // Add task button (in header, right side)
    const addTaskBtn = document.createElement('button');
    addTaskBtn.className = 'btn btn-secondary';
    addTaskBtn.textContent = 'Add Task';
    addTaskBtn.addEventListener('click', () => {
        if (!currentProject) {
            alert('Please select a project first');
            return;
        }
        taskCreateModal.classList.add('active');
    });
    document.querySelector('.header-right').appendChild(addTaskBtn);

    document.getElementById('btn-save-task').addEventListener('click', createTask);

    // Add comment
    document.getElementById('btn-add-comment').addEventListener('click', addComment);
}

// API Functions
async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

async function apiRequestForm(endpoint, formData) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            body: formData
        });
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

// Load Projects
async function loadProjects() {
    const projects = await apiRequest('/api/projects');
    if (projects) {
        projectSelect.innerHTML = '<option value="">Select Project...</option>';
        projects.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.name;
            projectSelect.appendChild(option);
        });
    }
}

// Load Project
async function loadProject(projectId) {
    currentProject = await apiRequest(`/api/projects/${projectId}`);
    if (currentProject) {
        renderAgents();
        renderTasks();
        loadActivity();
        // Auto-refresh every 10 seconds
        startAutoRefresh();
    }
}

function clearProject() {
    currentProject = null;
    agentsList.innerHTML = '<div class="empty-state">Select a project to see agents</div>';
    taskList.innerHTML = '<div class="empty-state">Select a project to see tasks</div>';
    activityFeed.innerHTML = '<div class="empty-state">No activity yet</div>';
    stopAutoRefresh();
}

let refreshInterval;
function startAutoRefresh() {
    stopAutoRefresh();
    refreshInterval = setInterval(() => {
        if (currentProject) {
            loadProject(currentProject.id);
        }
    }, 10000);
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
}

// Render Agents
function renderAgents() {
    if (!currentProject) return;

    const agents = currentProject.agents || [];
    if (agents.length === 0) {
        agentsList.innerHTML = '<div class="empty-state">No agents in this project</div>';
        return;
    }

    agentsList.innerHTML = agents.map(agentId => {
        const status = getAgentStatus(agentId);
        return `
            <div class="agent-card">
                <div class="agent-avatar">${agentId.charAt(0).toUpperCase()}</div>
                <div class="agent-info">
                    <div class="agent-name">${agentId}</div>
                    <div class="agent-status ${status.status}">${status.status === 'doing' ? 'Working on: ' + (status.task?.title || '') : 'Idle'}</div>
                </div>
            </div>
        `;
    }).join('');
}

function getAgentStatus(agentId) {
    // This would be better if we had an API to get agent status
    // For now, we'll check tasks to see if agent has active task
    return { status: 'idle', task: null };
}

// Render Tasks
async function renderTasks() {
    if (!currentProject) return;

    const tasks = await apiRequest(`/api/projects/${currentProject.id}/tasks`);
    if (!tasks) return;

    // Apply filter
    let filtered = tasks;
    if (currentFilter !== 'all') {
        filtered = tasks.filter(t => t.status === currentFilter);
    }

    // Sort: claimed/in_progress first, then open, then done
    filtered.sort((a, b) => {
        const order = { 'in_progress': 0, 'claimed': 1, 'review': 2, 'open': 3, 'done': 4 };
        return (order[a.status] || 99) - (order[b.status] || 99);
    });

    if (filtered.length === 0) {
        taskList.innerHTML = '<div class="empty-state">No tasks found</div>';
        return;
    }

    taskList.innerHTML = filtered.map(task => `
        <div class="task-card ${task.status}" data-task-id="${task.id}">
            <div class="task-card-header">
                <span class="task-badge ${task.type}">${task.type}</span>
                <span class="task-status-badge ${task.status}">${task.status.replace('_', ' ')}</span>
            </div>
            <div class="task-title">${escapeHtml(task.title)}</div>
            <div class="task-meta">
                <span class="task-assignee">
                    ${task.claimed_by ? '👤 ' + task.claimed_by : '⏳ Available'}
                </span>
                <span>${task.progress || 0}%</span>
            </div>
            ${task.progress > 0 ? `
                <div class="task-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${task.progress}%"></div>
                    </div>
                </div>
            ` : ''}
        </div>
    `).join('');

    // Add click handlers
    document.querySelectorAll('.task-card').forEach(card => {
        card.addEventListener('click', () => {
            openTaskModal(card.dataset.taskId);
        });
    });
}

// Load Activity
async function loadActivity() {
    if (!currentProject) return;

    const activity = await apiRequest(`/api/projects/${currentProject.id}/activity`);
    if (!activity) return;

    if (activity.length === 0) {
        activityFeed.innerHTML = '<div class="empty-state">No activity yet</div>';
        return;
    }

    activityFeed.innerHTML = activity.map(item => `
        <div class="activity-item">
            <div class="activity-time">${formatTime(item.timestamp)}</div>
            <div class="activity-action">${formatAction(item)}</div>
        </div>
    `).join('');
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
}

function formatAction(item) {
    const actions = {
        'project_created': `Project created`,
        'task_created': `Task created: ${item.details?.title || ''}`,
        'task_claimed': `Agent ${item.details?.agent_id} claimed task`,
        'task_started': `Agent ${item.details?.agent_id} started working on`,
        'task_completed': `Task completed`,
        'task_released': `Task released (was: ${item.details?.previous_agent})`,
        'requirement_uploaded': `Requirement uploaded: ${item.details?.filename}`,
        'comment_added': `Comment added by ${item.details?.author}`,
        'review_approved': `Review approved`,
        'review_rejected': `Review rejected`,
        'dispatch_triggered': `Dispatch triggered`
    };
    return actions[item.action] || item.action;
}

// Task Modal
let currentTaskId = null;

async function openTaskModal(taskId) {
    currentTaskId = taskId;
    const task = await apiRequest(`/api/projects/${currentProject.id}/tasks/${taskId}`);
    if (!task) return;

    document.getElementById('modal-task-title').textContent = task.title;
    document.getElementById('modal-task-type').textContent = task.type;
    document.getElementById('modal-task-type').className = `task-badge ${task.type}`;
    document.getElementById('modal-task-status').textContent = task.status.replace('_', ' ');
    document.getElementById('modal-task-status').className = `task-status-badge ${task.status}`;
    document.getElementById('modal-task-description').textContent = task.description || 'No description';
    document.getElementById('modal-progress-fill').style.width = `${task.progress || 0}%`;
    document.getElementById('modal-progress-text').textContent = `${task.progress || 0}%`;
    document.getElementById('modal-created-by').textContent = task.created_by;
    document.getElementById('modal-claimed-by').textContent = task.claimed_by || 'Unclaimed';
    document.getElementById('modal-created-at').textContent = formatTime(task.created_at);

    // Comments
    const comments = task.comments || [];
    if (comments.length === 0) {
        document.getElementById('modal-comments').innerHTML = '<div class="empty-state">No comments yet</div>';
    } else {
        document.getElementById('modal-comments').innerHTML = comments.map(c => `
            <div class="comment-item">
                <div class="comment-author">${c.author}</div>
                <div class="comment-content">${escapeHtml(c.content)}</div>
                <div class="comment-time">${formatTime(c.timestamp)}</div>
            </div>
        `).join('');
    }

    // Artifacts
    const artifacts = task.artifacts || [];
    if (artifacts.length === 0) {
        document.getElementById('modal-artifacts').innerHTML = '<div class="empty-state">No artifacts</div>';
    } else {
        document.getElementById('modal-artifacts').innerHTML = artifacts.map(a => `
            <div class="artifact-item">
                <div class="artifact-path">${escapeHtml(a.path)}</div>
                <div>${escapeHtml(a.description || '')}</div>
            </div>
        `).join('');
    }

    taskModal.classList.add('active');
}

async function addComment() {
    if (!currentTaskId) return;

    const content = document.getElementById('comment-input').value.trim();
    if (!content) return;

    // In a real app, we'd get the current user from auth
    const author = 'human';

    const result = await apiRequest(`/api/projects/${currentProject.id}/tasks/${currentTaskId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ author, content })
    });

    if (result) {
        document.getElementById('comment-input').value = '';
        openTaskModal(currentTaskId); // Refresh
    }
}

// Create Project
async function createProject() {
    const name = document.getElementById('project-name').value.trim();
    const description = document.getElementById('project-description').value.trim();

    if (!name) {
        alert('Please enter a project name');
        return;
    }

    const result = await apiRequest('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name, description, agents: selectedAgents })
    });

    if (result) {
        projectModal.classList.remove('active');
        document.getElementById('project-name').value = '';
        document.getElementById('project-description').value = '';
        // Reset agent selector
        selectedAgents = [];
        document.getElementById('agent-search').value = '';
        renderSelectedAgents();
        loadProjects();
    }
}

// Agent Selector Functions
async function loadAvailableAgents() {
    availableAgents = await apiRequest('/api/agents');
    renderAgentDropdown();
}

function renderAgentDropdown(searchTerm = '') {
    const agentList = document.getElementById('agent-list');
    const filtered = availableAgents.filter(agent => {
        const term = searchTerm.toLowerCase();
        return agent.id.toLowerCase().includes(term) ||
               (agent.name && agent.name.toLowerCase().includes(term));
    });

    if (filtered.length === 0) {
        agentList.innerHTML = '<div class="empty-state">No agents found</div>';
        return;
    }

    agentList.innerHTML = filtered.map(agent => {
        const isSelected = selectedAgents.includes(agent.id);
        return `
            <div class="agent-dropdown-item ${isSelected ? 'selected' : ''}" data-agent-id="${agent.id}">
                <span class="agent-status-dot"></span>
                <span class="agent-id">${agent.id}</span>
            </div>
        `;
    }).join('');

    // Add click handlers
    agentList.querySelectorAll('.agent-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            toggleAgent(item.dataset.agentId);
        });
    });
}

function toggleAgent(agentId) {
    const index = selectedAgents.indexOf(agentId);
    if (index > -1) {
        selectedAgents.splice(index, 1);
    } else {
        selectedAgents.push(agentId);
    }
    renderSelectedAgents();
    renderAgentDropdown(document.getElementById('agent-search').value);
}

function renderSelectedAgents() {
    const container = document.getElementById('selected-agents');
    if (selectedAgents.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding: 8px; font-size: 12px;">No agents selected (can add later)</div>';
        return;
    }

    container.innerHTML = selectedAgents.map(agentId => `
        <div class="selected-agent-tag">
            <span>${agentId}</span>
            <button type="button" onclick="toggleAgent('${agentId}')">&times;</button>
        </div>
    `).join('');
}

// Upload Requirement
async function uploadRequirement() {
    const fileInput = document.getElementById('requirement-file');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a file');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const result = await apiRequestForm(`/api/projects/${currentProject.id}/requirements`, formData);

    if (result) {
        uploadModal.classList.remove('active');
        fileInput.value = '';
        loadProject(currentProject.id);
    }
}

// Create Task
async function createTask() {
    const title = document.getElementById('task-title').value.trim();
    const type = document.getElementById('task-type').value;
    const description = document.getElementById('task-description').value.trim();

    if (!title) {
        alert('Please enter a task title');
        return;
    }

    const result = await apiRequest(`/api/projects/${currentProject.id}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ title, type, description })
    });

    if (result) {
        taskCreateModal.classList.remove('active');
        document.getElementById('task-title').value = '';
        document.getElementById('task-description').value = '';
        loadProject(currentProject.id);
    }
}

// Utility
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
