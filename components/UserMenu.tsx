'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { User, LogOut } from 'lucide-react'

export default function UserMenu() {
  const { user, signOut } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setIsSigningOut(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <div className="text-sm text-gray-600 hidden md:block">
        <span className="font-medium">{user.email}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="flex items-center gap-2"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">
          {isSigningOut ? 'Signing out...' : 'Sign out'}
        </span>
      </Button>
    </div>
  )
} 