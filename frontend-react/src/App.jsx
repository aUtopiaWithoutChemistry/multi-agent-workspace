import React, { useState, useEffect, useRef } from 'react'
import api from './api'
import './App.css'
import './agent-panel.css'

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
        {currentProject && currentProject.workspace && (
          <button className={`btn ${showWorkspace ? 'btn-primary' : 'btn-secondary'}`} onClick={onToggleWorkspace}>
            📁 Files
          </button>
        )}
        {currentProject && (
          <button className="btn btn-secondary" onClick={onSettings}>Settings</button>
        )}
        <button className="btn btn-secondary" onClick={onNewProject}>New Project</button>
        <button className="btn btn-primary" onClick={onUpload} disabled={!currentProject}>
          Upload Requirement
        </button>
      </div>
    </header>
  )
}

// Agents Panel Component
function AgentsPanel({ agentStatuses, onAddAgent, onRemoveAgent }) {
  return (
    <aside className="sidebar agents-panel">
      <h2>Agents</h2>
      <div className="agents-list">
        {!agentStatuses || agentStatuses.length === 0 ? (
          <div className="empty-state">No agents in this project</div>
        ) : (
          agentStatuses.map(agent => (
            <div key={agent.id} className="agent-card">
              <div className="agent-avatar">{agent.id.charAt(0).toUpperCase()}</div>
              <div className="agent-info">
                <div className="agent-name">{agent.id}</div>
                <div className={`agent-status ${agent.status}`}>
                  {agent.status === 'doing' ? `Working: ${agent.current_task?.title || 'Unknown'}` : 'Idle'}
                </div>
              </div>
              {onRemoveAgent && (
                <button
                  className="agent-remove-btn"
                  onClick={() => onRemoveAgent(agent.id)}
                  title="Remove agent"
                >
                  &times;
                </button>
              )}
            </div>
          ))
        )}
        {onAddAgent && (
          <button className="btn btn-secondary" style={{ width: '100%', marginTop: '10px' }} onClick={onAddAgent}>
            + Add Agent
          </button>
        )}
      </div>
    </aside>
  )
}

// Task Card Component
function TaskCard({ task, onClick, selected, onSelect }) {
  const handleSelect = (e) => {
    e.stopPropagation()
    onSelect(task.id)
  }

  // Determine display text for assignee
  const getAssigneeDisplay = () => {
    if (task.claimed_by) {
      return `Working: ${task.claimed_by}`
    }
    return '⏳ Available'
  }

  // Get creator display
  const getCreatorDisplay = () => {
    if (task.created_by && task.created_by !== 'human') {
      return `Created: ${task.created_by}`
    }
    return null
  }

  return (
    <div className={`task-card ${task.status}`} onClick={() => onClick(task)}>
      <div className="task-card-header">
        <input
          type="checkbox"
          checked={selected}
          onChange={handleSelect}
          onClick={(e) => e.stopPropagation()}
          style={{ marginRight: '8px' }}
        />
        <span className={`task-badge ${task.type}`}>{task.type}</span>
        <span className={`task-status-badge ${task.status}`}>
          {task.status.replace('_', ' ')}
        </span>
      </div>
      <div className="task-title">{task.title}</div>
      <div className="task-meta">
        <div className="task-meta-left">
          {getCreatorDisplay() && (
            <span className="task-creator">{getCreatorDisplay()}</span>
          )}
          <span className="task-assignee">
            {task.claimed_by ? `👤 ${task.claimed_by}` : '⏳ Available'}
          </span>
        </div>
        <span>{task.progress || 0}%</span>
      </div>
      {task.progress > 0 && (
        <div className="task-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${task.progress}%` }}></div>
          </div>
        </div>
      )}
    </div>
  )
}

// Task Pool Component
function TaskPool({ tasks, filter, onFilterChange, onTaskClick }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selectedTasks, setSelectedTasks] = useState([])

  // Clear selection when tasks or filter changes
  useEffect(() => {
    setSelectedTasks([])
  }, [tasks, filter, typeFilter, searchTerm])

  const handleSelect = (taskId) => {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    )
  }

  const handleSelectAll = () => {
    if (selectedTasks.length === sorted.length) {
      setSelectedTasks([])
    } else {
      setSelectedTasks(sorted.map(t => t.id))
    }
  }

  const filtered = tasks.filter(t => {
    // Status filter
    if (filter !== 'all' && t.status !== filter) return false
    // Type filter
    if (typeFilter !== 'all' && t.type !== typeFilter) return false
    // Search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const matchTitle = t.title?.toLowerCase().includes(term)
      const matchDesc = t.description?.toLowerCase().includes(term)
      const matchId = t.id?.toLowerCase().includes(term)
      if (!matchTitle && !matchDesc && !matchId) return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    const order = { 'in_progress': 0, 'claimed': 1, 'in_review': 2, 'review': 3, 'open': 4, 'done': 5 }
    return (order[a.status] || 99) - (order[b.status] || 99)
  })

  return (
    <section className="task-pool">
      <div className="task-pool-header">
        <h2>Task Pool</h2>
        {selectedTasks.length > 0 && (
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {selectedTasks.length} selected
          </span>
        )}
      </div>
      <div className="search-bar" style={{ padding: '0 16px 12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search tasks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            minWidth: '150px',
            padding: '8px 12px',
            background: 'var(--bg-tertiary)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            fontSize: '13px'
          }}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            background: 'var(--bg-tertiary)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            fontSize: '13px'
          }}
        >
          <option value="all">All Types</option>
          <option value="spec">Spec</option>
          <option value="code">Code</option>
          <option value="test">Test</option>
          <option value="review">Review</option>
          <option value="debug">Debug</option>
          <option value="docs">Docs</option>
          <option value="refactor">Refactor</option>
          <option value="research">Research</option>
        </select>
      </div>
      <div className="task-filters" style={{ padding: '0 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['all', 'open', 'in_progress', 'in_review', 'review', 'done'].map(f => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => onFilterChange(f)}
            >
              {f === 'all' ? 'All' : f.replace('_', ' ')}
            </button>
          ))}
        </div>
        {sorted.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={selectedTasks.length === sorted.length && sorted.length > 0}
              onChange={handleSelectAll}
            />
            Select All
          </label>
        )}
      </div>
      <div className="task-list">
        {sorted.length === 0 ? (
          <div className="empty-state">No tasks found</div>
        ) : (
          sorted.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={onTaskClick}
              selected={selectedTasks.includes(task.id)}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>
    </section>
  )
}

// Workspace File Browser Component
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

// Activity Feed Component
function ActivityFeed({ activities }) {
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const formatAction = (item) => {
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
    }
    return actions[item.action] || item.action
  }

  return (
    <aside className="sidebar activity-panel">
      <h2>Activity</h2>
      <div className="activity-feed">
        {activities.length === 0 ? (
          <div className="empty-state">No activity yet</div>
        ) : (
          activities.map(item => (
            <div key={item.id} className="activity-item">
              <div className="activity-time">{formatTime(item.timestamp)}</div>
              <div className="activity-action">{formatAction(item)}</div>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}

// Agent Selector Component
function AgentSelector({ availableAgents, selectedAgents, onChange }) {
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const wrapperRef = React.useRef(null)

  const filtered = availableAgents.filter(agent => {
    const term = search.toLowerCase()
    return agent.id.toLowerCase().includes(term) ||
           (agent.name && agent.name.toLowerCase().includes(term))
  })

  const toggleAgent = (agentId, e) => {
    e.stopPropagation()
    if (selectedAgents.includes(agentId)) {
      onChange(selectedAgents.filter(a => a !== agentId))
    } else {
      onChange([...selectedAgents, agentId])
    }
    // Close dropdown after selection
    setShowDropdown(false)
    setSearch('')
  }

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [wrapperRef])

  return (
    <div className="agent-selector" ref={wrapperRef}>
      <div className="agent-search-wrapper">
        <input
          type="text"
          placeholder="Search and select agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onClick={(e) => e.stopPropagation()}
        />
        {showDropdown && (
          <div className="agent-dropdown">
            {filtered.length === 0 ? (
              <div className="empty-state">No agents found</div>
            ) : (
              filtered.map(agent => (
                <div
                  key={agent.id}
                  className={`agent-dropdown-item ${selectedAgents.includes(agent.id) ? 'selected' : ''}`}
                  onClick={(e) => toggleAgent(agent.id, e)}
                >
                  <span className="agent-status-dot"></span>
                  <span className="agent-id">{agent.id}</span>
                  {selectedAgents.includes(agent.id) && <span style={{ marginLeft: 'auto' }}>✓</span>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
      <div className="selected-agents">
        {selectedAgents.length === 0 ? (
          <div className="empty-state" style={{ padding: '8px', fontSize: '12px' }}>
            No agents selected (can add later)
          </div>
        ) : (
          selectedAgents.map(agentId => (
            <div key={agentId} className="selected-agent-tag">
              <span>{agentId}</span>
              <button onClick={(e) => { e.stopPropagation(); toggleAgent(agentId, e) }}>&times;</button>
            </div>
          ))
        )}
      </div>
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
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const items = e.dataTransfer.items
    if (items && items.length > 0) {
      const item = items[0]
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry?.()
        if (entry) {
          // For directories, we can get the name but not the full path in browser
          // Use a file input fallback approach
          const input = document.createElement('input')
          input.type = 'file'
          input.webkitdirectory = true
          input.onchange = (ev) => {
            const files = ev.target.files
            if (files.length === 0) {
              alert('Empty folder detected. Due to browser security restrictions, please manually enter the full path below.')
              return
            }
            // Get the first file's path and extract directory
            const file = files[0]
            // Try to get the path from webkitRelativePath
            if (file.webkitRelativePath) {
              const dirPath = file.webkitRelativePath.split('/')[0]
              // This gives us the relative path, combine with a base
              // Unfortunately browsers don't give us the full path
              // So we'll use the file name as workspace name suggestion
              setWorkspace('/Users/jerry/' + dirPath)
            }
          }
          input.click()
          return
        }
      }
    }
  }

  const handleBrowse = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.webkitdirectory = true
    input.onchange = (e) => {
      const files = e.target.files
      if (files.length === 0) {
        // Empty folder selected - show message
        alert('Empty folder detected. Due to browser security restrictions, please manually enter the full path below.')
        return
      }
      const file = files[0]
      if (file.webkitRelativePath) {
        const dirPath = file.webkitRelativePath.split('/')[0]
        // Combine with user's home directory as best effort
        // User can edit this path if incorrect
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
          <button className="modal-close" onClick={onClose}>&times;</button>
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
              style={{
                border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center',
                marginBottom: '8px',
                background: isDragging ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={handleBrowse}
            >
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📁</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                {isDragging ? 'Drop folder here' : 'Drag & drop a folder here, or click to browse'}
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
          <h3>Upload Requirement</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
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
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  if (!isOpen) return null

  const filtered = availableAgents.filter(agent => {
    const term = search.toLowerCase()
    const alreadyAdded = currentAgents.includes(agent.id)
    if (alreadyAdded) return false
    return agent.id.toLowerCase().includes(term) ||
           (agent.name && agent.name.toLowerCase().includes(term))
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal small" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Agent to Project</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Search Agents</label>
            <input
              type="text"
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setShowDropdown(true)}
            />
          </div>
          <div className="agent-dropdown" style={{ position: 'relative', maxHeight: '200px', overflow: 'auto' }}>
            {filtered.length === 0 ? (
              <div className="empty-state">No agents found</div>
            ) : (
              filtered.map(agent => (
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

// Settings Modal
function SettingsModal({ isOpen, onClose, onSave, onDelete, project }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [workspace, setWorkspace] = useState('')
  const [requirementsDir, setRequirementsDir] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (project) {
      setName(project.name || '')
      setDescription(project.description || '')
      setWorkspace(project.workspace || '')
      setRequirementsDir(project.requirements_dir || '')
      setShowDeleteConfirm(false)
    }
  }, [project])

  if (!isOpen) return null

  const handleSave = () => {
    onSave({
      name,
      description,
      workspace,
      requirements_dir: requirementsDir
    })
  }

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete(project.id)
      setShowDeleteConfirm(false)
    } else {
      setShowDeleteConfirm(true)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Project Settings</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
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
            <label>Workspace Directory</label>
            <input
              type="text"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Requirements Directory</label>
            <input
              type="text"
              value={requirementsDir}
              onChange={(e) => setRequirementsDir(e.target.value)}
            />
          </div>
          {project?.stats && (
            <div className="task-info" style={{ marginTop: '16px' }}>
              <h4 style={{ marginBottom: '8px', textTransform: 'uppercase', fontSize: '12px', color: 'var(--text-secondary)' }}>Statistics</h4>
              <div className="info-row">
                <span className="info-label">Total Tasks</span>
                <span>{project.stats.total}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Open</span>
                <span>{project.stats.open}</span>
              </div>
              <div className="info-row">
                <span className="info-label">In Progress</span>
                <span>{project.stats.in_progress}</span>
              </div>
              <div className="info-row">
                <span className="info-label">In Review</span>
                <span>{project.stats.in_review}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Review</span>
                <span>{project.stats.review}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Completed</span>
                <span>{project.stats.done}</span>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>

          {/* Delete Section */}
          <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid var(--bg-tertiary)' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '13px', fontWeight: '600', color: 'var(--danger)' }}>Danger Zone</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Deleting a project will permanently remove all tasks and data. This action cannot be undone.
            </p>
            {showDeleteConfirm ? (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--danger)' }}>Type project name to confirm:</span>
                <input
                  type="text"
                  placeholder={project?.name}
                  onChange={(e) => {
                    if (e.target.value === project?.name) {
                      handleDelete()
                    }
                  }}
                  style={{ flex: 1, padding: '8px', fontSize: '13px' }}
                />
                <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              </div>
            ) : (
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                style={{
                  background: 'var(--danger)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Delete Project
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Task Detail Modal
function TaskModal({ task, onClose, onAddComment }) {
  const [comment, setComment] = useState('')

  if (!task) return null

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const handleAddComment = () => {
    if (comment.trim()) {
      onAddComment(comment)
      setComment('')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{task.title}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="task-meta">
            <span className={`task-badge ${task.type}`}>{task.type}</span>
            <span className={`task-status-badge ${task.status}`}>
              {task.status.replace('_', ' ')}
            </span>
          </div>

          <div className="task-description">
            <h4>Description</h4>
            <p>{task.description || 'No description'}</p>
          </div>

          <div className="task-progress">
            <h4>Progress</h4>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${task.progress || 0}%` }}></div>
            </div>
            <span>{task.progress || 0}%</span>
          </div>

          <div className="task-info">
            <div className="info-row">
              <span className="info-label">Created by:</span>
              <span>{task.created_by}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Claimed by:</span>
              <span>{task.claimed_by || 'Unclaimed'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Created at:</span>
              <span>{formatTime(task.created_at)}</span>
            </div>
          </div>

          <div className="task-comments">
            <h4>Comments</h4>
            <div className="comments-list">
              {task.comments?.length === 0 ? (
                <div className="empty-state">No comments yet</div>
              ) : (
                task.comments?.map((c, i) => (
                  <div key={i} className="comment-item">
                    <div className="comment-author">{c.author}</div>
                    <div className="comment-content">{c.content}</div>
                    <div className="comment-time">{formatTime(c.timestamp)}</div>
                  </div>
                ))
              )}
            </div>
            <div className="comment-form">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment..."
              />
              <button className="btn btn-small" onClick={handleAddComment}>
                Add Comment
              </button>
            </div>
          </div>

          <div className="task-artifacts">
            <h4>Artifacts</h4>
            <div className="artifacts-list">
              {task.artifacts?.length === 0 ? (
                <div className="empty-state">No artifacts</div>
              ) : (
                task.artifacts?.map((a, i) => (
                  <div key={i} className="artifact-item">
                    <div className="artifact-path">{a.path}</div>
                    <div>{a.description}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Main App Component
function App() {
  const [projects, setProjects] = useState([])
  const [currentProject, setCurrentProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [activities, setActivities] = useState([])
  const [filter, setFilter] = useState('all')
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showAddAgentModal, setShowAddAgentModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [availableAgents, setAvailableAgents] = useState([])
  const [agentStatuses, setAgentStatuses] = useState([])
  const [workspaceFiles, setWorkspaceFiles] = useState([])
  const [showWorkspacePanel, setShowWorkspacePanel] = useState(false)

  // Load workspace files when project changes
  useEffect(() => {
    if (currentProject?.workspace) {
      loadWorkspaceFiles()
    }
  }, [currentProject?.id])

  const loadWorkspaceFiles = async () => {
    if (!currentProject?.id) return
    const data = await api.getWorkspaceFiles(currentProject.id)
    if (data) {
      setWorkspaceFiles(data.files || [])
    }
  }

  // Load projects on mount and restore last selected project
  useEffect(() => {
    const savedProjectId = localStorage.getItem('lastProjectId')

    const init = async () => {
      await loadProjects()
      loadAvailableAgents()

      // Restore last selected project from localStorage
      if (savedProjectId) {
        const data = await api.getProjects()
        const exists = (data || []).find(p => p.id === savedProjectId)
        if (exists) {
          setCurrentProject(exists)
        }
      }
    }
    init()
  }, [])

  // Save selected project to localStorage
  useEffect(() => {
    if (currentProject) {
      localStorage.setItem('lastProjectId', currentProject.id)
    }
  }, [currentProject])

  // Auto-refresh when project is selected
  useEffect(() => {
    if (currentProject) {
      loadProjectData(currentProject.id)
      const interval = setInterval(() => {
        loadProjectData(currentProject.id)
      }, 10000)
      return () => clearInterval(interval)
    }
  }, [currentProject?.id])

  const loadProjects = async () => {
    const data = await api.getProjects()
    setProjects(data || [])
  }

  const loadAvailableAgents = async () => {
    const data = await api.getAvailableAgents()
    setAvailableAgents(data || [])
  }

  const loadProjectData = async (projectId) => {
    const [project, tasksData, activityData, agentStatuses] = await Promise.all([
      api.getProject(projectId),
      api.getTasks(projectId),
      api.getActivity(projectId),
      api.getProjectAgents(projectId)
    ])
    if (project) setCurrentProject(project)
    setTasks(tasksData || [])
    setActivities(activityData || [])
    setAgentStatuses(agentStatuses || [])
  }

  const handleProjectChange = async (projectId) => {
    if (!projectId) {
      setCurrentProject(null)
      setTasks([])
      setActivities([])
      return
    }
    await loadProjectData(projectId)
  }

  const handleCreateProject = async (data) => {
    const result = await api.createProject(data)
    if (result) {
      setShowProjectModal(false)
      loadProjects()
    }
  }

  const handleUpload = async (file) => {
    if (currentProject) {
      await api.uploadRequirement(currentProject.id, file)
      setShowUploadModal(false)
      loadProjectData(currentProject.id)
    }
  }

  const handleAddAgent = async (agentId) => {
    if (currentProject) {
      await api.addAgentToProject(currentProject.id, agentId)
      loadProjectData(currentProject.id)
    }
  }

  const handleRemoveAgent = async (agentId) => {
    if (currentProject) {
      await api.removeAgentFromProject(currentProject.id, agentId)
      loadProjectData(currentProject.id)
    }
  }

  const handleUpdateProject = async (data) => {
    if (currentProject) {
      const updated = await api.updateProject(currentProject.id, data)
      if (updated) {
        setCurrentProject(updated)
        loadProjects()
        setShowSettingsModal(false)
      }
    }
  }

  const handleDeleteProject = async (projectId) => {
    await api.deleteProject(projectId)
    setCurrentProject(null)
    setTasks([])
    setActivities([])
    setShowSettingsModal(false)
    loadProjects()
  }

  const handleTaskClick = async (task) => {
    const fullTask = await api.getTask(currentProject.id, task.id)
    setSelectedTask(fullTask)
  }

  const handleAddComment = async (content) => {
    if (currentProject && selectedTask) {
      await api.addComment(currentProject.id, selectedTask.id, {
        author: 'human',
        content
      })
      const updated = await api.getTask(currentProject.id, selectedTask.id)
      setSelectedTask(updated)
    }
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

      <TaskModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onAddComment={handleAddComment}
      />

      <AddAgentModal
        isOpen={showAddAgentModal}
        onClose={() => setShowAddAgentModal(false)}
        onAdd={handleAddAgent}
        availableAgents={availableAgents}
        currentAgents={currentProject?.agents || []}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSave={handleUpdateProject}
        onDelete={handleDeleteProject}
        project={currentProject}
      />
    </div>
  )
}

export default App
