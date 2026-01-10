'use client'

import { useState, useEffect } from 'react'

export function ApiTab() {
  const [hasApiKey, setHasApiKey] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadApiKeyStatus()
  }, [])

  const loadApiKeyStatus = async () => {
    try {
      const response = await fetch('/api/settings/api-key')
      const data = await response.json()

      if (response.ok && data.success) {
        setHasApiKey(data.hasApiKey)
      }
    } catch (error) {
      console.error('Error loading API key status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateKey = async () => {
    if (hasApiKey) {
      const confirmed = window.confirm(
        'This will invalidate your existing API key. Any applications using the old key will stop working. Continue?'
      )
      if (!confirmed) return
    }

    setIsGenerating(true)
    setNewApiKey(null)

    try {
      const response = await fetch('/api/settings/api-key', {
        method: 'POST',
      })
      const data = await response.json()

      if (response.ok && data.success) {
        setNewApiKey(data.apiKey)
        setHasApiKey(true)
      } else {
        alert(`Failed to generate API key: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error generating API key:', error)
      alert('Network error. Failed to generate API key.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRevokeKey = async () => {
    const confirmed = window.confirm(
      'This will revoke your API key. Any applications using it will stop working. Continue?'
    )
    if (!confirmed) return

    setIsRevoking(true)

    try {
      const response = await fetch('/api/settings/api-key', {
        method: 'DELETE',
      })
      const data = await response.json()

      if (response.ok && data.success) {
        setHasApiKey(false)
        setNewApiKey(null)
      } else {
        alert(`Failed to revoke API key: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error revoking API key:', error)
      alert('Network error. Failed to revoke API key.')
    } finally {
      setIsRevoking(false)
    }
  }

  const handleCopyKey = async () => {
    if (!newApiKey) return

    try {
      await navigator.clipboard.writeText(newApiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = newApiKey
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCopyEndpoint = async () => {
    const endpoint = `${window.location.origin}/api/external/nuggets`
    try {
      await navigator.clipboard.writeText(endpoint)
      alert('Endpoint URL copied to clipboard')
    } catch {
      prompt('Copy this endpoint URL:', endpoint)
    }
  }

  const handleDismissKey = () => {
    const confirmed = window.confirm(
      'Have you copied the API key? It will not be shown again after you dismiss this.'
    )
    if (confirmed) {
      setNewApiKey(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="font-display font-black text-lg">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* API Key Card */}
      <div className="border-2 border-black bg-white">
        <div className="p-6 border-b-2 border-black">
          <h2 className="font-display font-black text-2xl mb-2">API ACCESS</h2>
          <p className="text-sm text-gray-600">
            Access your nuggets from external applications using the REST API
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Status */}
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                hasApiKey ? 'bg-green-500' : 'bg-gray-300'
              }`}
            />
            <span className="font-medium">
              {hasApiKey ? 'API key configured' : 'No API key configured'}
            </span>
          </div>

          {/* New Key Display */}
          {newApiKey && (
            <div className="p-4 bg-yellow-50 border-2 border-yellow-400">
              <p className="font-bold text-yellow-800 mb-2">
                Your new API key (shown only once):
              </p>
              <div className="flex gap-2">
                <code className="flex-1 p-3 bg-white border-2 border-black font-mono text-sm break-all">
                  {newApiKey}
                </code>
                <button
                  onClick={handleCopyKey}
                  className="px-4 py-2 bg-white border-2 border-black font-display font-black text-sm hover:bg-black hover:text-white transition-colors"
                >
                  {copied ? 'COPIED!' : 'COPY'}
                </button>
              </div>
              <p className="text-xs text-yellow-700 mt-2">
                Save this key securely. You will not be able to see it again.
              </p>
              <button
                onClick={handleDismissKey}
                className="mt-3 text-sm text-yellow-800 underline hover:no-underline"
              >
                I&apos;ve copied the key, dismiss this
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleGenerateKey}
              disabled={isGenerating}
              className="px-6 py-2.5 bg-[hsl(var(--electric-blue))] text-white font-display font-black text-sm border-2 border-black shadow-brutal-sm hover:shadow-brutal hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-brutal-sm disabled:hover:translate-x-0 disabled:hover:translate-y-0"
            >
              {isGenerating
                ? 'GENERATING...'
                : hasApiKey
                ? 'REGENERATE KEY'
                : 'GENERATE API KEY'}
            </button>

            {hasApiKey && (
              <button
                onClick={handleRevokeKey}
                disabled={isRevoking}
                className="px-6 py-2.5 bg-white text-red-600 font-display font-black text-sm border-2 border-red-600 hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRevoking ? 'REVOKING...' : 'REVOKE KEY'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Endpoint Info Card */}
      <div className="border-2 border-black bg-white">
        <div className="p-6 border-b-2 border-black">
          <h2 className="font-display font-black text-xl mb-2">API ENDPOINT</h2>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold mb-2">Endpoint URL:</label>
            <div className="flex gap-2">
              <code className="flex-1 p-3 bg-gray-100 border-2 border-black font-mono text-sm">
                /api/external/nuggets
              </code>
              <button
                onClick={handleCopyEndpoint}
                className="px-4 py-2 bg-white border-2 border-black font-display font-black text-sm hover:bg-black hover:text-white transition-colors"
              >
                COPY
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Authentication:</label>
            <code className="block p-3 bg-gray-100 border-2 border-black font-mono text-sm">
              Authorization: Bearer {'<your-api-key>'}
            </code>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Query Parameters:</label>
            <div className="p-3 bg-gray-100 border-2 border-black text-sm space-y-1">
              <p><code className="font-mono">status</code> - Filter by status: unread, saved, archived</p>
              <p><code className="font-mono">topic</code> - Filter by topic name</p>
              <p><code className="font-mono">min_relevancy</code> - Minimum relevancy score (0-100)</p>
              <p><code className="font-mono">since</code> - ISO datetime to filter from</p>
              <p><code className="font-mono">tags</code> - Comma-separated topic tags</p>
              <p><code className="font-mono">limit</code> - Max results (default: 100, max: 500)</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Example:</label>
            <code className="block p-3 bg-gray-100 border-2 border-black font-mono text-xs overflow-x-auto whitespace-pre">
{`curl "${typeof window !== 'undefined' ? window.location.origin : ''}/api/external/nuggets?status=saved&topic=AI%20Development" \\
  -H "Authorization: Bearer sd_live_xxx..."`}
            </code>
          </div>

          <div className="pt-2 border-t border-gray-200">
            <a
              href="/api-docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-black font-display font-black text-sm hover:bg-black hover:text-white transition-colors"
            >
              VIEW FULL API DOCS
              <span aria-hidden="true">&#8599;</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
