// Centralized fetchers for repo-managed lesson data.
// Always builds URLs from import.meta.env.BASE_URL so the app works both
// at the dev server root and at the GitHub Pages subpath.

function dataUrl(rel) {
  // BASE_URL ends with a trailing slash (e.g. '/italyshadowing/').
  return `${import.meta.env.BASE_URL}data/${rel}`
}

export async function fetchIndex() {
  const res = await fetch(dataUrl('index.json'))
  if (!res.ok) {
    throw new Error(`Failed to load index.json: ${res.status}`)
  }
  return res.json()
}

export async function fetchLesson(filename, { signal } = {}) {
  const res = await fetch(dataUrl(`${filename}.json`), { signal })
  if (!res.ok) {
    throw new Error(`Failed to load lesson ${filename}: ${res.status}`)
  }
  return res.json()
}
