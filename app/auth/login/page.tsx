import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--electric-blue))]/10 to-[hsl(var(--hot-pink))]/10">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  )
}
