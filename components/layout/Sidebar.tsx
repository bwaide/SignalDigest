'use client'

const TOPICS = [
  'AI Development',
  'AI Tools & Applications',
  'Business Strategy',
  'Consulting & Services',
  'Productivity & Automation',
  'Marketing & Sales',
  'Operations & Finance',
  'Tech Industry',
  'Self-Development',
]

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-white p-4">
      <div className="space-y-4">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Topics</h2>
          <div className="space-y-1">
            <button className="w-full rounded-md bg-accent px-3 py-2 text-left text-sm font-medium">
              All Topics (0)
            </button>
            {TOPICS.map((topic) => (
              <button
                key={topic}
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
              >
                {topic} (0)
              </button>
            ))}
          </div>
        </div>
        <div className="border-t pt-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="rounded" defaultChecked />
            Unread only
          </label>
        </div>
        <div>
          <input
            type="search"
            placeholder="Search..."
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>
    </aside>
  )
}
