export function seenTutorial(): boolean {
  try {
    return localStorage.getItem('knock:tutorial:seen') === '1'
  } catch {
    return false
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem('knock:tutorial:seen', '1')
  } catch {
    // Private browsing can disable storage; closing should still work.
  }
}
