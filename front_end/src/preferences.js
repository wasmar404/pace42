export function applyTheme(_theme) {
  try {
    delete document.documentElement.dataset.theme
  } catch {
  }
}
