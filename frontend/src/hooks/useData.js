// src/hooks/useData.js
import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'

export function useTasks(filters = {}) {
  const [tasks, setTasks]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
      const { data } = await api.get('/tasks', { params })
      setTasks(data.tasks)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [JSON.stringify(filters)])

  useEffect(() => { fetchTasks() }, [fetchTasks])
  return { tasks, loading, error, refetch: fetchTasks, setTasks }
}

export function useColumns() {
  const [columns, setColumns] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchCols = useCallback(async () => {
    setLoading(true)
    try { const { data } = await api.get('/columns'); setColumns(data.columns) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchCols() }, [fetchCols])
  return { columns, loading, refetch: fetchCols, setColumns }
}

export function useMembers() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try { const { data } = await api.get('/members'); setMembers(data.members) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchMembers() }, [fetchMembers])
  return { members, loading, refetch: fetchMembers }
}
