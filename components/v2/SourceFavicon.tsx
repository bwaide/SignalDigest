'use client'

import { useState, useEffect, useRef } from 'react'
import { getFaviconFromCache, setFaviconCache, extractDomain } from '@/lib/favicon-cache'

interface SourceFaviconProps {
  url: string | null
  source: string
  topic: string
}

type LoadingState = 'idle' | 'loading' | 'success' | 'error'

// Topic colors matching FilterRail
const TOPIC_COLORS: Record<string, string> = {
  'AI & Machine Learning': 'bg-[hsl(var(--electric-blue))]',
  'Social Media & Culture': 'bg-[hsl(var(--cyber-pink))]',
  'Tech Products & Innovation': 'bg-[hsl(var(--neon-green))]',
  'Business & Finance': 'bg-[hsl(var(--warning-orange))]',
  'Startups & Funding': 'bg-[hsl(var(--warning-orange))]',
  'Climate & Energy': 'bg-[hsl(var(--neon-green))]',
  'Health & Science': 'bg-[hsl(var(--electric-blue))]',
  'Policy & Regulation': 'bg-black',
}

function getTopicColor(topic: string): string {
  return TOPIC_COLORS[topic] || 'bg-black'
}

function getSourceInitial(source: string): string {
  return source.charAt(0).toUpperCase()
}

async function fetchFavicon(domain: string): Promise<string | null> {
  // Just return the Google Favicon API URL directly
  // The browser will handle loading it, and we'll catch errors in the img onError
  // This avoids CORS issues from trying to fetch() the favicon
  const googleUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`

  console.log('Fetching favicon for domain:', domain, '→', googleUrl)

  return googleUrl
}

export function SourceFavicon({ url, source, topic }: SourceFaviconProps) {
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null)
  const [loadingState, setLoadingState] = useState<LoadingState>('idle')
  const containerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    console.log('SourceFavicon useEffect:', { source, url })
    const domain = extractDomain(url)
    console.log('Extracted domain:', domain, 'from URL:', url)

    if (!domain) {
      console.log('No domain extracted, showing fallback for', source)
      // Queue state update to avoid synchronous setState in effect
      Promise.resolve().then(() => setLoadingState('error'))
      return
    }

    // Check cache first
    const cachedUrl = getFaviconFromCache(domain)
    console.log('Cache check for', domain, ':', cachedUrl)
    if (cachedUrl) {
      console.log('Using cached result for', domain, ':', cachedUrl)
      // Queue state update to avoid synchronous setState in effect
      Promise.resolve().then(() => {
        if (cachedUrl === 'fallback:initial') {
          setLoadingState('error')
        } else {
          setFaviconUrl(cachedUrl)
          setLoadingState('success')
        }
      })
      return
    }

    // Set up Intersection Observer for lazy loading
    const loadFavicon = async () => {
      setLoadingState('loading')

      const url = await fetchFavicon(domain)

      if (url) {
        setFaviconUrl(url)
        setFaviconCache(domain, url)
        setLoadingState('success')
      } else {
        setFaviconCache(domain, 'fallback:initial')
        setLoadingState('error')
      }
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          console.log('Intersection observed for', source, ':', {
            isIntersecting: entry.isIntersecting,
            loadingState,
            domain
          })
          if (entry.isIntersecting && loadingState === 'idle') {
            console.log('Loading favicon for', source, domain)
            loadFavicon()
            observerRef.current?.disconnect()
          }
        })
      },
      {
        rootMargin: '100px',
        threshold: 0.1
      }
    )

    if (containerRef.current) {
      observerRef.current.observe(containerRef.current)
      console.log('Observer attached for', source, domain)
    }

    return () => {
      observerRef.current?.disconnect()
    }
  }, [url, loadingState])

  const topicColor = getTopicColor(topic)
  const sourceInitial = getSourceInitial(source)

  return (
    <div
      ref={containerRef}
      className={`
        absolute -top-3 -left-3 w-12 h-12
        bg-white border-3 border-black
        flex items-center justify-center
        transition-all duration-300
        group-hover:shadow-brutal
        z-15
      `}
    >
      {loadingState === 'idle' || loadingState === 'loading' ? (
        // Skeleton loader
        <div className="w-8 h-8 bg-gray-200 animate-pulse" />
      ) : loadingState === 'success' && faviconUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={faviconUrl}
          alt={`${source} favicon`}
          className="w-8 h-8 object-contain animate-fade-in"
          onError={() => {
            // If image fails to load, show fallback
            setLoadingState('error')
          }}
        />
      ) : (
        // Fallback to source initial
        <div
          className={`
            w-full h-full flex items-center justify-center
            ${topicColor} text-white
            font-display font-black text-lg
          `}
        >
          {sourceInitial}
        </div>
      )}
    </div>
  )
}
