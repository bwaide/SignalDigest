'use client'

interface Nugget {
  tags: string[]
  is_read: boolean
}

interface SidebarProps {
  nuggets: Nugget[]
  selectedTopic: string | null
  onTopicChange: (topic: string | null) => void
  unreadOnly: boolean
  onUnreadOnlyChange: (checked: boolean) => void
  searchQuery: string
  onSearchChange: (query: string) => void
}

export function Sidebar({
  nuggets,
  selectedTopic,
  onTopicChange,
  unreadOnly,
  onUnreadOnlyChange,
  searchQuery,
  onSearchChange,
}: SidebarProps) {
  // Calculate tag counts
  const tagCounts = nuggets.reduce((acc, nugget) => {
    nugget.tags.forEach((tag) => {
      acc[tag] = (acc[tag] || 0) + 1
    })
    return acc
  }, {} as Record<string, number>)

  // Sort tags by count (descending)
  const sortedTags = Object.entries(tagCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([tag]) => tag)

  const totalCount = nuggets.length

  return (
    <aside className="w-64 border-r bg-white p-4">
      <div className="space-y-4">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Topics</h2>
          <div className="space-y-1">
            <button
              onClick={() => onTopicChange(null)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium ${
                selectedTopic === null ? 'bg-accent' : 'hover:bg-accent'
              }`}
            >
              All Topics ({totalCount})
            </button>
            {sortedTags.map((tag) => (
              <button
                key={tag}
                onClick={() => onTopicChange(tag)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                  selectedTopic === tag
                    ? 'bg-accent font-medium'
                    : 'hover:bg-accent'
                }`}
              >
                {tag} ({tagCounts[tag]})
              </button>
            ))}
          </div>
        </div>
        <div className="border-t pt-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="rounded"
              checked={unreadOnly}
              onChange={(e) => onUnreadOnlyChange(e.target.checked)}
            />
            Unread only
          </label>
        </div>
        <div>
          <input
            type="search"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>
    </aside>
  )
}
