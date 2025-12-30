'use client'

import { useState } from 'react'

interface ImapFormData {
  host: string
  port: string
  username: string
  password: string
  use_tls: boolean
}

interface FormErrors {
  host?: string
  port?: string
  username?: string
  password?: string
}

export function EmailSourceForm() {
  const [formData, setFormData] = useState<ImapFormData>({
    host: '',
    port: '993',
    username: '',
    password: '',
    use_tls: true,
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [testSuccess, setTestSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.host.trim()) {
      newErrors.host = 'IMAP host is required'
    }

    if (!formData.port.trim()) {
      newErrors.port = 'Port is required'
    } else {
      const portNum = parseInt(formData.port, 10)
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        newErrors.port = 'Port must be between 1 and 65535'
      }
    }

    if (!formData.username.trim()) {
      newErrors.username = 'Username/email is required'
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field: keyof ImapFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field
    if (typeof value === 'string') {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
    // Reset test success when form changes
    setTestSuccess(false)
    setSuccessMessage('')
    setErrorMessage('')
  }

  const handleTestConnection = async () => {
    if (!validateForm()) {
      return
    }

    setIsTesting(true)
    setErrorMessage('')
    setSuccessMessage('')
    setTestSuccess(false)

    try {
      const response = await fetch('/api/settings/test-email-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: formData.host.trim(),
          port: parseInt(formData.port, 10),
          username: formData.username.trim(),
          password: formData.password,
          use_tls: formData.use_tls,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setTestSuccess(true)
        setSuccessMessage('Connection successful! You can now save your configuration.')
      } else {
        setErrorMessage(data.error || 'Connection test failed. Please check your credentials.')
      }
    } catch {
      setErrorMessage('Network error. Please check your internet connection and try again.')
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async () => {
    if (!testSuccess) {
      setErrorMessage('Please test the connection before saving.')
      return
    }

    setIsSaving(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await fetch('/api/settings/save-email-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: formData.host.trim(),
          port: parseInt(formData.port, 10),
          username: formData.username.trim(),
          password: formData.password,
          use_tls: formData.use_tls,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccessMessage('Email configuration saved successfully!')
      } else {
        setErrorMessage(data.error || 'Failed to save configuration. Please try again.')
      }
    } catch {
      setErrorMessage('Network error. Failed to save configuration.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="host" className="block text-sm font-medium text-gray-700 mb-1">
          IMAP Host *
        </label>
        <input
          id="host"
          type="text"
          value={formData.host}
          onChange={(e) => handleInputChange('host', e.target.value)}
          placeholder="imap.gmail.com"
          className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
            errors.host
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:ring-primary'
          }`}
        />
        {errors.host && <p className="mt-1 text-xs text-red-600">{errors.host}</p>}
      </div>

      <div>
        <label htmlFor="port" className="block text-sm font-medium text-gray-700 mb-1">
          Port *
        </label>
        <input
          id="port"
          type="number"
          value={formData.port}
          onChange={(e) => handleInputChange('port', e.target.value)}
          placeholder="993"
          min="1"
          max="65535"
          className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
            errors.port
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:ring-primary'
          }`}
        />
        {errors.port && <p className="mt-1 text-xs text-red-600">{errors.port}</p>}
      </div>

      <div>
        <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
          Username/Email *
        </label>
        <input
          id="username"
          type="email"
          value={formData.username}
          onChange={(e) => handleInputChange('username', e.target.value)}
          placeholder="your.email@gmail.com"
          className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
            errors.username
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:ring-primary'
          }`}
        />
        {errors.username && <p className="mt-1 text-xs text-red-600">{errors.username}</p>}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Password *
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            placeholder="Enter your password"
            className={`w-full rounded-md border px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 ${
              errors.password
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-primary'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
      </div>

      <div className="flex items-center">
        <input
          id="use_tls"
          type="checkbox"
          checked={formData.use_tls}
          onChange={(e) => handleInputChange('use_tls', e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <label htmlFor="use_tls" className="ml-2 text-sm text-gray-700">
          Use TLS/SSL (recommended)
        </label>
      </div>

      {errorMessage && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          {successMessage}
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={isTesting || isSaving}
          className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTesting ? 'Testing...' : 'Test Connection'}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!testSuccess || isSaving || isTesting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  )
}
