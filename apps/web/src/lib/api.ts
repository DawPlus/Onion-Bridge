export type OnionState =
  | 'idle'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'error'

export type ProjectStatus = {
  state: OnionState
  workspace: string | null
  profile: string | null
  tunnelProfile: string | null
  pid: number | null
  error: string | null
  recentLogs: string[]
}

export type StatusResponse = {
  projects: ProjectStatus[]
  activeCount: number
}

export type DevStatus = {
  state: OnionState
  workspace: string | null
  pid: number | null
  command: string | null
  url: string | null
  error: string | null
  recentLogs: string[]
}

export type Project = {
  path: string
  name: string
  profile: string | null
  source: string
  root?: string | null
  tunnelId?: string | null
  state: OnionState
  pid: number | null
  error: string | null
  tunnelProfile: string | null
  recentLogs: string[]
  active: boolean
  managed?: boolean
  favorite?: boolean
  hidden?: boolean
  dev: DevStatus
}

export type WorkspaceRoot = {
  path: string
  name: string
}

export type SettingsResponse = {
  projects: string[]
  projectEntries: Array<{ path: string; profileName: string | null }>
  defaultProfile: string
  controlPort: number
  tunnelBin: string
  tunnelId: string
  apiKeyPresent: boolean
  apiKeyMasked: string
  tokenPresent: boolean
  tokenMasked: string
}

export type SaveSettingsInput = {
  projects?: Array<string | { path: string; profileName?: string | null }>
  defaultProfile?: string
  controlPort?: number
  tunnelBin?: string
  tunnelId?: string
  apiKey?: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      typeof body.error === 'string' ? body.error : `Request failed (${res.status})`,
    )
  }
  return body as T
}

export const api = {
  status: () => request<StatusResponse>('/api/status'),
  projects: () =>
    request<{ projects: Project[]; roots: WorkspaceRoot[] }>('/api/projects'),
  addProject: (path: string) =>
    request<{ project: Project; projects: Project[]; roots: WorkspaceRoot[] }>(
      '/api/projects',
      {
        method: 'POST',
        body: JSON.stringify({ path }),
      },
    ),
  removeProject: (path: string) =>
    request<{ projects: Project[]; roots: WorkspaceRoot[]; removedRoot: string }>(
      '/api/projects/remove',
      {
        method: 'POST',
        body: JSON.stringify({ path }),
      },
    ),
  setProjectFlags: (
    path: string,
    flags: { favorite?: boolean; hidden?: boolean },
  ) =>
    request<{ projects: Project[]; roots: WorkspaceRoot[] }>(
      '/api/projects/flags',
      {
        method: 'POST',
        body: JSON.stringify({ path, ...flags }),
      },
    ),
  browseFolder: async () => {
    const res = await fetch('/api/browse-folder', { method: 'POST' })
    const body = await res.json().catch(() => ({}))
    if (res.status === 501) {
      return {
        unsupported: true as const,
        error:
          typeof body.error === 'string'
            ? body.error
            : 'Native folder picker unavailable.',
      }
    }
    if (!res.ok) {
      throw new Error(
        typeof body.error === 'string' ? body.error : `Request failed (${res.status})`,
      )
    }
    return body as { cancelled: boolean; path: string | null }
  },
  start: (workspace: string) =>
    request<ProjectStatus>('/api/start', {
      method: 'POST',
      body: JSON.stringify({ workspace }),
    }),
  stop: (workspace: string) =>
    request<ProjectStatus>('/api/stop', {
      method: 'POST',
      body: JSON.stringify({ workspace }),
    }),
  startDev: (workspace: string) =>
    request<DevStatus>('/api/dev/start', {
      method: 'POST',
      body: JSON.stringify({ workspace }),
    }),
  stopDev: (workspace: string) =>
    request<DevStatus>('/api/dev/stop', {
      method: 'POST',
      body: JSON.stringify({ workspace }),
    }),
  settings: () => request<SettingsResponse>('/api/settings'),
  saveSettings: (settings: SaveSettingsInput) =>
    request<SettingsResponse>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
}
