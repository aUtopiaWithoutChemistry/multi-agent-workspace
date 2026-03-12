const API_BASE = ''; // Empty for Vite proxy

export const api = {
  async request(endpoint, options = {}) {
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
  },

  // Projects
  getProjects: () => api.request('/api/projects'),
  getProject: (id) => api.request(`/api/projects/${id}`),
  updateProject: (id, data) => api.request(`/api/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
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
  addAgentToProject: (projectId, agentId) => api.request(`/api/projects/${projectId}/agents/${agentId}`, {
    method: 'POST'
  }),
  removeAgentFromProject: (projectId, agentId) => api.request(`/api/projects/${projectId}/agents/${agentId}`, {
    method: 'DELETE'
  }),

  // Requirements
  uploadRequirement: async (projectId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`/api/projects/${projectId}/requirements`, {
        method: 'POST',
        body: formData
      });
      return await response.json();
    } catch (error) {
      console.error('Upload Error:', error);
      return null;
    }
  },

  // Activity
  getActivity: (projectId) => api.request(`/api/projects/${projectId}/activity`),
};

export default api;
