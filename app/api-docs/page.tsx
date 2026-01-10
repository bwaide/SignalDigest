'use client'

import { useEffect, useRef } from 'react'

export default function ApiDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Dynamically load Scalar
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference'
    script.async = true
    document.head.appendChild(script)

    return () => {
      document.head.removeChild(script)
    }
  }, [])

  return (
    <>
      <style>{`
        body {
          margin: 0;
          padding: 0;
        }
      `}</style>
      <div ref={containerRef}>
        <script
          id="api-reference"
          data-url="/api/external/openapi.json"
          data-configuration={JSON.stringify({
            theme: 'default',
            layout: 'modern',
            darkMode: false,
            hiddenClients: ['c', 'clojure', 'csharp', 'http', 'java', 'kotlin', 'objc', 'ocaml', 'php', 'powershell', 'r', 'ruby', 'swift'],
            defaultHttpClient: {
              targetKey: 'shell',
              clientKey: 'curl',
            },
          })}
        />
      </div>
    </>
  )
}
