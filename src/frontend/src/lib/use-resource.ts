import { useEffect, useState } from 'react'
import { apiRequest } from './api'

export function useResource<T>(path: string | null, authenticated = true) {
  const [version, setVersion] = useState(0)
  const key = `${path}:${authenticated}:${version}`
  const [state, setState] = useState<{
    key: string
    data: T | null
    error: string
  }>({ key: '', data: null, error: '' })
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    void apiRequest<T>(path, { authenticated, signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data, error: '' })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            key,
            data: null,
            error:
              error instanceof Error ? error.message : 'Không thể tải dữ liệu.',
          })
      })
    return () => controller.abort()
  }, [path, authenticated, key])
  return {
    data: state.key === key ? state.data : null,
    error: state.key === key ? state.error : '',
    loading: Boolean(path) && state.key !== key,
    reload: () => setVersion((value) => value + 1),
  }
}
