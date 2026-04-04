import { backendGet } from '../backendApi'

export function getHomeFeed(take = 20) {
  return backendGet(`/api/home/feed?take=${encodeURIComponent(String(take))}`)
}

export function getRecommendedUsers(take = 6) {
  return backendGet(`/api/home/recommended-users?take=${encodeURIComponent(String(take))}`)
}
