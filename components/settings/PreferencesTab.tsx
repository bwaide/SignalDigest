'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const DEFAULT_TOPICS = [
  'AI & Machine Learning',
  'Social Media & Culture',
  'Business & Finance',
  'Tech Products & Innovation',
  'Climate & Energy',
  'Health & Science',
  'Policy & Regulation',
  'Startups & Funding'
]

export function PreferencesTab() {
  const [interestsDescription, setInterestsDescription] = useState('')
  const [relevancyThreshold, setRelevancyThreshold] = useState(60)
  const [topics, setTopics] = useState<string[]>(DEFAULT_TOPICS)
  const [newTopic, setNewTopic] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('No user found')
        return
      }

      const { data, error } = await supabase
        .from('user_settings')
        .select('interests_description, relevancy_threshold, taxonomy_topics')
        .eq('user_id', user.id)
        .single()

      if (error) {
        console.error('Error loading preferences:', error)
        return
      }

      if (data) {
        setInterestsDescription(data.interests_description || '')
        setRelevancyThreshold(data.relevancy_threshold || 60)
        setTopics(data.taxonomy_topics || DEFAULT_TOPICS)
      }
    } catch (error) {
      console.error('Error loading preferences:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('No user found')
        return
      }

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          interests_description: interestsDescription,
          relevancy_threshold: relevancyThreshold,
          taxonomy_topics: topics,
        })

      if (error) {
        console.error('Error saving preferences:', error)
        alert(`Failed to save preferences: ${error.message}`)
      } else {
        // Success feedback could be added here
      }
    } catch (error) {
      console.error('Error saving preferences:', error)
      alert('Network error. Failed to save preferences.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddTopic = () => {
    if (newTopic.trim() && !topics.includes(newTopic.trim())) {
      setTopics([...topics, newTopic.trim()])
      setNewTopic('')
    }
  }

  const handleRemoveTopic = (topic: string) => {
    setTopics(topics.filter(t => t !== topic))
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
    <div className="max-w-3xl space-y-6">
      {/* Interests Description */}
      <div className="border-2 border-black bg-white">
        <div className="p-6 border-b-2 border-black">
          <h2 className="font-display font-black text-xl mb-2">YOUR INTERESTS</h2>
          <p className="text-sm text-gray-600">
            Describe your interests to help the AI determine relevancy of extracted nuggets
          </p>
        </div>
        <div className="p-6">
          <textarea
            value={interestsDescription}
            onChange={(e) => setInterestsDescription(e.target.value)}
            placeholder="e.g., I'm interested in AI development, startup strategies, and productivity tools..."
            rows={4}
            className="w-full px-4 py-3 border-2 border-black bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--electric-blue))] resize-none"
          />
        </div>
      </div>

      {/* Relevancy Threshold */}
      <div className="border-2 border-black bg-white">
        <div className="p-6 border-b-2 border-black">
          <h2 className="font-display font-black text-xl mb-2">RELEVANCY FILTER</h2>
          <p className="text-sm text-gray-600">
            Only show nuggets with a relevancy score above this threshold
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="100"
              value={relevancyThreshold}
              onChange={(e) => setRelevancyThreshold(Number(e.target.value))}
              className="flex-1 accent-[hsl(var(--electric-blue))]"
            />
            <div className="w-16 text-center">
              <span className="font-display font-black text-2xl">{relevancyThreshold}</span>
            </div>
          </div>
          <p className="text-xs text-gray-600">
            Higher values show only the most relevant nuggets. Lower values show more content.
          </p>
        </div>
      </div>

      {/* Topic Taxonomy */}
      <div className="border-2 border-black bg-white">
        <div className="p-6 border-b-2 border-black">
          <h2 className="font-display font-black text-xl mb-2">TOPIC CATEGORIES</h2>
          <p className="text-sm text-gray-600">
            Define topic categories for organizing your nuggets
          </p>
        </div>
        <div className="p-6 space-y-4">
          {/* Topic List */}
          <div className="flex flex-wrap gap-2">
            {topics.map((topic) => (
              <div
                key={topic}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border-2 border-black"
              >
                <span className="text-sm">{topic}</span>
                <button
                  onClick={() => handleRemoveTopic(topic)}
                  className="text-gray-500 hover:text-red-500 transition-colors"
                  aria-label={`Remove ${topic}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Add Topic */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTopic()}
              placeholder="Add new topic..."
              className="flex-1 px-4 py-2 border-2 border-black bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--electric-blue))]"
            />
            <button
              onClick={handleAddTopic}
              className="px-4 py-2 bg-white border-2 border-black hover:bg-black hover:text-white font-display font-black text-sm transition-colors"
            >
              ADD
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2.5 bg-[hsl(var(--electric-blue))] text-white font-display font-black text-sm border-2 border-black shadow-brutal-sm hover:shadow-brutal hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-brutal-sm disabled:hover:translate-x-0 disabled:hover:translate-y-0"
        >
          {isSaving ? 'SAVING...' : 'SAVE PREFERENCES'}
        </button>
      </div>
    </div>
  )
}
