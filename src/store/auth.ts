const AUTH_KEY = 'test_system_auth'

export function isAuthenticated(): boolean {
  return (
    sessionStorage.getItem(AUTH_KEY) === 'true' ||
    localStorage.getItem(AUTH_KEY) === 'true'
  )
}

export function login(id: string, password: string, remember: boolean): boolean {
  const appId = import.meta.env.VITE_APP_ID ?? 'dev'
  const appPassword = import.meta.env.VITE_APP_PASSWORD ?? 'roqkf2@'
  if (id === appId && password === appPassword) {
    if (remember) {
      localStorage.setItem(AUTH_KEY, 'true')
    } else {
      sessionStorage.setItem(AUTH_KEY, 'true')
    }
    return true
  }
  return false
}

export function logout(): void {
  sessionStorage.removeItem(AUTH_KEY)
  localStorage.removeItem(AUTH_KEY)
}
