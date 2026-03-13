import React, { useState, useEffect, useRef } from 'react'

const API_BASE = 'http://localhost:8765'

const api = {
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      })
      return await response.json()
    } catch (error) {
      console.error('API Error:', error)
      return null
    }
  },

  // Projects
  getProjects: () => api.request('/api/projects'),
  getProject: (id) => api.request(`/api/projects/${id}`),
  updateProject: (id, data) => api.request(`/api/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  deleteProject: (id) => api.request(`/api/projects/${id}`, {
    method: 'DELETE',
    headers: { 'X-Human-Request': 'true' }
  }),
  createProject: (data) => api.request('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Tasks
  getTasks: (projectId) => api.request(`/api/projects/${projectId}/tasks`),
  getTask: (projectId, taskId) => api.request(`/api/projects/${projectId}/tasks/${taskId}`),
  createTask: (projectId, data) => api.request(`/api/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateTask: (projectId, taskId, data) => api.request(`/api/projects/${projectId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  claimTask: (projectId, taskId, agentId) => api.request(`/api/projects/${projectId}/tasks/${taskId}/claim?agent_id=${agentId}`, {
    method: 'POST'
  }),
  startTask: (projectId, taskId, agentId) => api.request(`/api/projects/${projectId}/tasks/${taskId}/start?agent_id=${agentId}`, {
    method: 'POST'
  }),
  completeTask: (projectId, taskId, agentId) => api.request(`/api/projects/${projectId}/tasks/${taskId}/complete?agent_id=${agentId}`, {
    method: 'POST'
  }),
  releaseTask: (projectId, taskId) => api.request(`/api/projects/${projectId}/tasks/${taskId}/release`, {
    method: 'POST'
  }),
  addComment: (projectId, taskId, data) => api.request(`/api/projects/${projectId}/tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  submitReview: (projectId, taskId, approved, comment) => api.request(`/api/projects/${projectId}/tasks/${taskId}/review?approved=${approved}&comment=${encodeURIComponent(comment)}`, {
    method: 'POST'
  }),

  // Agents
  getAvailableAgents: () => api.request('/api/agents'),
  getProjectAgents: (projectId) => api.request(`/api/projects/${projectId}/agents`),

  // Requirements
  uploadRequirement: async (projectId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/requirements`, {
      method: 'POST',
      body: formData
    })
    return await response.json()
  },

  // Activity
  getActivity: (projectId) => api.request(`/api/projects/${projectId}/activity`),

  // Workspace
  getWorkspaceFiles: (projectId) => api.request(`/api/projects/${projectId}/workspace`),
}

// Header Component
function Header({ projects, currentProject, onProjectChange, onNewProject, onUpload, onSettings, onToggleWorkspace, showWorkspace }) {
  return (
    <header className="header">
      <div className="header-left">
        <h1 className="logo">Task Pool</h1>
        <select
          className="project-select"
          value={currentProject?.id || ''}
          onChange={(e) => onProjectChange(e.target.value)}
        >
          <option value="">Select Project...</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div className="header-right">
        {currentProject && (
          <button className="btn btn-primary" onClick={onUpload}>
            📄 Add Requirement
          </button>
        )}
        {currentProject && currentProject.workspace && (
          <button className={`btn ${showWorkspace ? 'btn-primary' : 'btn-secondary'}`} onClick={onToggleWorkspace}>
            📁 Files
          </button>
        )}
        {currentProject && (
          <button className="btn btn-secondary" onClick={onSettings}>Settings</button>
        )}
        <button className="btn btn-secondary" onClick={onNewProject}>New Project</button>
      </div>
    </header>
  )
}

// Agents Panel
function AgentsPanel({ agentStatuses, onAddAgent, onRemoveAgent }) {
  return (
    <aside className="sidebar agents-panel">
      <div className="panel-header">Agents</div>
      <div className="agents-list">
        {agentStatuses.length === 0 ? (
          <div className="empty-state">No agents in this project</div>
        ) : (
          agentStatuses.map(agent => (
            <div key={agent.id} className="agent-card">
              <div className="agent-avatar">{agent.id.charAt(0).toUpperCase()}</div>
              <div className="agent-info">
                <div className="agent-name">{agent.id}</div>
                <div className={`agent-status ${agent.status}`}>
                  {agent.status === 'doing' ? 'Working' : 'Idle'}
                </div>
              </div>
              <button className="agent-remove-btn" onClick={() => onRemoveAgent(agent.id)}>×</button>
            </div>
          ))
        )}
        <button className="btn btn-secondary" style={{ width: '100%', marginTop: '10px' }} onClick={onAddAgent}>
          + Add Agent
        </button>
      </div>
    </aside>
  )
}

// Task Pool
function TaskPool({ tasks, filter, onFilterChange, onTaskClick }) {
  const filtered = tasks.filter(t => {
    if (filter === 'all') return true
    return t.status === filter
  })

  const sorted = [...filtered].sort((a, b) => {
    const order = { 'in_progress': 0, 'claimed': 1, 'in_review': 2, 'review': 3, 'open': 4, 'done': 5 }
    return (order[a.status] || 99) - (order[b.status] || 99)
  })

  return (
    <section className="task-pool">
      <div className="task-pool-header">
        <h2>Task Pool</h2>
      </div>
      <div className="task-filters">
        {['all', 'open', 'in_progress', 'in_review', 'review', 'done'].map(f => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => onFilterChange(f)}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>
      <div className="task-list">
        {sorted.length === 0 ? (
          <div className="empty-state">No tasks found</div>
        ) : (
          sorted.map(task => (
            <div key={task.id} className={`task-card ${task.status}`} onClick={() => onTaskClick(task)}>
              <div className="task-card-header">
                <span className={`task-badge ${task.type}`}>{task.type}</span>
                <span className={`task-status-badge ${task.status}`}>{task.status.replace('_', ' ')}</span>
              </div>
              <div className="task-title">{task.title}</div>
              <div className="task-meta">
                <span className="task-assignee">
                  {task.claimed_by ? `👤 ${task.claimed_by}` : '⏳ Available'}
                </span>
                <span>{task.progress || 0}%</span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

// Workspace Panel
function WorkspacePanel({ files, workspace }) {
  const renderFile = (file, depth = 0) => (
    <div key={file.path} style={{ paddingLeft: `${depth * 16}px` }}>
      <div className="file-item">
        <span style={{ marginRight: '6px' }}>{file.type === 'folder' ? '📁' : '📄'}</span>
        <span>{file.name}</span>
      </div>
      {file.children && file.children.map(child => renderFile(child, depth + 1))}
    </div>
  )

  if (!workspace) {
    return (
      <aside className="sidebar workspace-panel">
        <div className="panel-header">Workspace</div>
        <div className="empty-state">No workspace configured</div>
      </aside>
    )
  }

  return (
    <aside className="sidebar workspace-panel">
      <div className="panel-header">Workspace</div>
      <div style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
          {workspace}
        </div>
      </div>
      <div className="file-list" style={{ padding: '8px', overflow: 'auto', flex: 1 }}>
        {files.length === 0 ? (
          <div className="empty-state" style={{ fontSize: '12px' }}>Empty workspace</div>
        ) : (
          files.map(file => renderFile(file))
        )}
      </div>
    </aside>
  )
}

// Activity Feed
function ActivityFeed({ activities }) {
  const formatTime = (timestamp) => new Date(timestamp).toLocaleTimeString()

  return (
    <aside className="sidebar activity-panel">
      <div className="panel-header">Activity</div>
      <div className="activity-feed">
        {activities.length === 0 ? (
          <div className="empty-state">No activity yet</div>
        ) : (
          activities.slice(0, 50).map(item => (
            <div key={item.id} className="activity-item">
              <div className="activity-time">{formatTime(item.timestamp)}</div>
              <div className="activity-action">{item.action}</div>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}

// Agent Selector
function AgentSelector({ availableAgents, selectedAgents, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleAgent = (agentId) => {
    if (selectedAgents.includes(agentId)) {
      onChange(selectedAgents.filter(id => id !== agentId))
    } else {
      onChange([...selectedAgents, agentId])
    }
  }

  return (
    <div className="agent-selector" ref={wrapperRef}>
      <div className="agent-search-wrapper" onClick={() => setIsOpen(!isOpen)}>
        <div style={{ flex: 1 }}>
          {selectedAgents.length === 0 ? (
            <span style={{ color: 'var(--text-secondary)' }}>Select agents...</span>
          ) : (
            selectedAgents.map(id => (
              <span key={id} className="selected-agent-tag">{id}</span>
            ))
          )}
        </div>
        <span>▼</span>
      </div>
      {isOpen && (
        <div className="agent-dropdown">
          {availableAgents.length === 0 ? (
            <div className="empty-state">No agents found</div>
          ) : (
            availableAgents.map(agent => (
              <div
                key={agent.id}
                className={`agent-dropdown-item ${selectedAgents.includes(agent.id) ? 'selected' : ''}`}
                onClick={() => toggleAgent(agent.id)}
              >
                <span className="agent-status-dot"></span>
                <span className="agent-id">{agent.id}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// Create Project Modal
function CreateProjectModal({ isOpen, onClose, onSubmit, availableAgents }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [workspace, setWorkspace] = useState('')
  const [selectedAgents, setSelectedAgents] = useState([])
  const [isDragging, setIsDragging] = useState(false)

  if (!isOpen) return null

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    alert('Due to browser security restrictions, please manually enter the workspace path below.')
  }

  const handleBrowse = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.webkitdirectory = true
    input.onchange = (e) => {
      const files = e.target.files
      if (files.length === 0) {
        alert('Empty folder detected. Due to browser security restrictions, please manually enter the full path below.')
        return
      }
      const file = files[0]
      if (file.webkitRelativePath) {
        const dirPath = file.webkitRelativePath.split('/')[0]
        setWorkspace('/Users/jerry/' + dirPath)
      }
    }
    input.click()
  }

  const handleSubmit = () => {
    onSubmit({ name, description, workspace, agents: selectedAgents })
    setName('')
    setDescription('')
    setWorkspace('')
    setSelectedAgents([])
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal small" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create New Project</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Project"
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Project description..."
            />
          </div>
          <div className="form-group">
            <label>Workspace (folder for agent to work in)</label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleBrowse}
              style={{
                border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center',
                marginBottom: '8px',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📁</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                {isDragging ? 'Drop folder here' : 'Click to browse (or drag folder)'}
              </div>
            </div>
            <input
              type="text"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              placeholder="/path/to/workspace (leave empty for auto-generated)"
              style={{ width: '100%' }}
            />
          </div>
          <div className="form-group">
            <label>Add Agents (optional)</label>
            <AgentSelector
              availableAgents={availableAgents}
              selectedAgents={selectedAgents}
              onChange={setSelectedAgents}
            />
          </div>
          <button className="btn btn-primary" onClick={handleSubmit}>
            Create Project
          </button>
        </div>
      </div>
    </div>
  )
}

// Task Modal
function TaskModal({ task, onClose, onAddComment }) {
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState(task?.comments || [])

  if (!task) return null

  const handleAddComment = () => {
    if (!comment.trim()) return
    const newComment = {
      author: 'user',
      content: comment,
      timestamp: new Date().toISOString()
    }
    setComments([...comments, newComment])
    onAddComment(task.id, comment)
    setComment('')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Task Details</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="task-meta">
            <span className={`task-badge ${task.type}`}>{task.type}</span>
            <span className={`task-status-badge ${task.status}`}>{task.status.replace('_', ' ')}</span>
          </div>
          <div className="task-description">{task.description || 'No description'}</div>
          <div className="task-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${task.progress || 0}%` }}></div>
            </div>
            <span>{task.progress || 0}%</span>
          </div>
          <div className="task-info">
            <div className="info-row">
              <span className="info-label">Created by:</span>
              <span>{task.created_by || 'Unknown'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Claimed by:</span>
              <span>{task.claimed_by || 'Unclaimed'}</span>
            </div>
          </div>
          <div className="task-comments">
            <h4>Comments</h4>
            <div className="comments-list">
              {comments.length === 0 ? (
                <div className="empty-state">No comments yet</div>
              ) : (
                comments.map((c, i) => (
                  <div key={i} className="comment-item">
                    <div className="comment-author">{c.author}</div>
                    <div className="comment-content">{c.content}</div>
                  </div>
                ))
              )}
            </div>
            <div className="comment-form">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              />
              <button className="btn btn-small" onClick={handleAddComment}>Add</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Settings Modal
function SettingsModal({ isOpen, onClose, onSave, onDelete, project }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [workspace, setWorkspace] = useState('')

  useEffect(() => {
    if (project) {
      setName(project.name || '')
      setDescription(project.description || '')
      setWorkspace(project.workspace || '')
    }
  }, [project])

  if (!isOpen) return null

  const handleSave = () => {
    onSave({ name, description, workspace })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal small" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Project Settings</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Workspace</label>
            <input
              type="text"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
            <button className="btn btn-danger" onClick={onDelete}>Delete Project</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Upload Modal
function UploadModal({ isOpen, onClose, onUpload }) {
  const [file, setFile] = useState(null)

  if (!isOpen) return null

  const handleUpload = () => {
    if (file) {
      onUpload(file)
      setFile(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal small" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Requirement</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Select .md file</label>
            <input
              type="file"
              accept=".md"
              onChange={(e) => setFile(e.target.files[0])}
            />
          </div>
          <button className="btn btn-primary" onClick={handleUpload}>
            Upload
          </button>
        </div>
      </div>
    </div>
  )
}

// Add Agent Modal
function AddAgentModal({ isOpen, onClose, onAdd, availableAgents, currentAgents }) {
  const available = availableAgents.filter(a => !currentAgents.includes(a.id))

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal small" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Agent</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="agent-dropdown" style={{ position: 'relative', maxHeight: '200px', overflow: 'auto' }}>
            {available.length === 0 ? (
              <div className="empty-state">No more agents available</div>
            ) : (
              available.map(agent => (
                <div
                  key={agent.id}
                  className="agent-dropdown-item"
                  onClick={() => { onAdd(agent.id); onClose(); }}
                >
                  <span className="agent-status-dot"></span>
                  <span className="agent-id">{agent.id}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Main App
function App() {
  const [projects, setProjects] = useState([])
  const [currentProject, setCurrentProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [activities, setActivities] = useState([])
  const [filter, setFilter] = useState('all')
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showAddAgentModal, setShowAddAgentModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [availableAgents, setAvailableAgents] = useState([])
  const [agentStatuses, setAgentStatuses] = useState([])
  const [workspaceFiles, setWorkspaceFiles] = useState([])
  const [showWorkspacePanel, setShowWorkspacePanel] = useState(false)

  // Load projects
  useEffect(() => {
    loadProjects()
    loadAvailableAgents()
  }, [])

  // Load project data when project changes
  useEffect(() => {
    if (currentProject) {
      loadProjectData(currentProject.id)
    }
  }, [currentProject?.id])

  // Load workspace files
  useEffect(() => {
    if (currentProject?.workspace) {
      loadWorkspaceFiles()
    }
  }, [currentProject?.workspace])

  const loadProjects = async () => {
    const data = await api.getProjects()
    if (data) {
      setProjects(data)
      if (data.length > 0 && !currentProject) {
        setCurrentProject(data[0])
      }
    }
  }

  const loadAvailableAgents = async () => {
    const data = await api.getAvailableAgents()
    if (data) {
      setAvailableAgents(data)
    }
  }

  const loadProjectData = async (projectId) => {
    const [tasksData, activityData, projectData] = await Promise.all([
      api.getTasks(projectId),
      api.getActivity(projectId),
      api.getProject(projectId)
    ])
    if (tasksData) setTasks(tasksData)
    if (activityData) setActivities(activityData)
    if (projectData) {
      setCurrentProject(projectData)
      // Update agent statuses
      const agentData = await api.getProjectAgents(projectId)
      if (agentData) setAgentStatuses(agentData)
    }
  }

  const loadWorkspaceFiles = async () => {
    if (!currentProject?.id) return
    const data = await api.getWorkspaceFiles(currentProject.id)
    if (data) {
      setWorkspaceFiles(data.files || [])
    }
  }

  const handleProjectChange = (projectId) => {
    const project = projects.find(p => p.id === projectId)
    setCurrentProject(project)
  }

  const handleCreateProject = async (data) => {
    const result = await api.createProject(data)
    if (result) {
      await loadProjects()
      setCurrentProject(result)
    }
    setShowProjectModal(false)
  }

  const handleUpload = async (file) => {
    if (!currentProject) return
    await api.uploadRequirement(currentProject.id, file)
    await loadProjectData(currentProject.id)
    setShowUploadModal(false)
  }

  const handleSaveProject = async (data) => {
    if (!currentProject) return
    await api.updateProject(currentProject.id, data)
    await loadProjects()
    setShowSettingsModal(false)
  }

  const handleDeleteProject = async () => {
    if (!currentProject) return
    if (confirm('Are you sure you want to delete this project?')) {
      await api.deleteProject(currentProject.id)
      setProjects(projects.filter(p => p.id !== currentProject.id))
      setCurrentProject(projects[0] || null)
      setShowSettingsModal(false)
    }
  }

  const handleAddAgent = async (agentId) => {
    if (!currentProject) return
    await api.request(`/api/projects/${currentProject.id}/agents/${agentId}`, { method: 'POST' })
    await loadProjectData(currentProject.id)
  }

  const handleRemoveAgent = async (agentId) => {
    if (!currentProject) return
    await api.request(`/api/projects/${currentProject.id}/agents/${agentId}`, { method: 'DELETE' })
    await loadProjectData(currentProject.id)
  }

  const handleTaskClick = (task) => {
    setSelectedTask(task)
  }

  const handleAddComment = async (taskId, comment) => {
    if (!currentProject) return
    await api.addComment(currentProject.id, taskId, { author: 'user', content: comment })
    await loadProjectData(currentProject.id)
  }

  return (
    <div className="app">
      <Header
        projects={projects}
        currentProject={currentProject}
        onProjectChange={handleProjectChange}
        onNewProject={() => setShowProjectModal(true)}
        onUpload={() => setShowUploadModal(true)}
        onSettings={() => setShowSettingsModal(true)}
        onToggleWorkspace={() => setShowWorkspacePanel(!showWorkspacePanel)}
        showWorkspace={showWorkspacePanel}
      />

      <main className="main-content">
        <AgentsPanel
          agentStatuses={agentStatuses}
          onAddAgent={() => setShowAddAgentModal(true)}
          onRemoveAgent={handleRemoveAgent}
        />

        <TaskPool
          tasks={tasks}
          filter={filter}
          onFilterChange={setFilter}
          onTaskClick={handleTaskClick}
        />

        {showWorkspacePanel && currentProject?.workspace && (
          <WorkspacePanel
            files={workspaceFiles}
            workspace={currentProject.workspace}
          />
        )}

        <ActivityFeed activities={activities} />
      </main>

      <CreateProjectModal
        isOpen={showProjectModal}
        onClose={() => setShowProjectModal(false)}
        onSubmit={handleCreateProject}
        availableAgents={availableAgents}
      />

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUpload}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSave={handleSaveProject}
        onDelete={handleDeleteProject}
        project={currentProject}
      />

      <AddAgentModal
        isOpen={showAddAgentModal}
        onClose={() => setShowAddAgentModal(false)}
        onAdd={handleAddAgent}
        availableAgents={availableAgents}
        currentAgents={agentStatuses.map(a => a.id)}
      />

      <TaskModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onAddComment={handleAddComment}
      />
    </div>
  )
}

export default App
