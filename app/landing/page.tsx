'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Video, Wand2, Sparkles } from 'lucide-react'
import Link from 'next/link'

export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/')
      }
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="text-lg">Loading...</span>
        </div>
      </div>
    )
  }

  if (user) {
    return null // Will redirect to main app
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              AI Video Generator
            </h1>
            <div className="flex items-center gap-4">
              <Link href="/signin">
                <Button variant="outline">Sign In</Button>
              </Link>
              <Link href="/signup">
                <Button>Sign Up</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-gray-900">
              Create Amazing Videos with
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent"> AI</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Transform your ideas into stunning videos using advanced AI technology. 
              Upload a photo, describe your vision, and watch as AI generates beautiful frames and videos.
            </p>
          </div>

          <div className="flex justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="text-lg px-8 py-3">
                <Sparkles className="h-5 w-5 mr-2" />
                Get Started Free
              </Button>
            </Link>
            <Link href="/signin">
              <Button variant="outline" size="lg" className="text-lg px-8 py-3">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Wand2 className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle>AI-Powered Generation</CardTitle>
              <CardDescription>
                Advanced AI algorithms create stunning frames and videos from your descriptions
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Video className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle>Professional Quality</CardTitle>
              <CardDescription>
                Generate high-quality videos with customizable styles and moods
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>Easy to Use</CardTitle>
              <CardDescription>
                Simple interface makes video creation accessible to everyone
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* How it works */}
        <div className="mt-20">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-lg font-semibold mb-2">Upload Photo</h3>
              <p className="text-gray-600">Upload your reference photo to get started</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-lg font-semibold mb-2">Describe Vision</h3>
              <p className="text-gray-600">Tell us what kind of video you want to create</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-lg font-semibold mb-2">AI Generates</h3>
              <p className="text-gray-600">Our AI creates frames and videos based on your input</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                4
              </div>
              <h3 className="text-lg font-semibold mb-2">Download & Share</h3>
              <p className="text-gray-600">Download your finished video and share it with the world</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 text-center">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Ready to Create Your First Video?</CardTitle>
              <CardDescription>
                Join thousands of creators who are already using AI to bring their ideas to life
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/signup">
                <Button size="lg" className="w-full">
                  <Sparkles className="h-5 w-5 mr-2" />
                  Start Creating Now
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 