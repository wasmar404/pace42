import { backendGet } from '../backendApi'

export function getMyPerformance() {
  return backendGet('/api/me/performance')
}
