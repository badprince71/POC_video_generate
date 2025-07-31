"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DiagnosticResult {
  timestamp: string
  userId: string
  s3Config: {
    region: string
    bucket: string
    hasCredentials: boolean
    accessKeyIdPrefix: string
  }
  tests: Array<{
    test: string
    success: boolean
    error?: string
    [key: string]: any
  }>
  environment: {
    NODE_ENV: string
    AWS_REGION: string
    AWS_S3_BUCKET: string
    hasAwsAccessKey: boolean
    hasAwsSecretKey: boolean
  }
}

export default function DebugS3Page() {
  const [result, setResult] = useState<DiagnosticResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [testKey, setTestKey] = useState('')

  const runDiagnostics = async () => {
    setLoading(true)
    try {
      const url = new URL('/api/debug_s3', window.location.origin)
      url.searchParams.set('userId', 'user')
      if (testKey) {
        url.searchParams.set('testKey', testKey)
      }

      const response = await fetch(url)
      const data = await response.json()
      
      if (data.success) {
        setResult(data.diagnostics)
      } else {
        setResult({
          timestamp: new Date().toISOString(),
          userId: 'user',
          s3Config: { region: '', bucket: '', hasCredentials: false, accessKeyIdPrefix: '' },
          tests: [{
            test: 'API Call',
            success: false,
            error: data.error
          }],
          environment: {
            NODE_ENV: '',
            AWS_REGION: '',
            AWS_S3_BUCKET: '',
            hasAwsAccessKey: false,
            hasAwsSecretKey: false
          }
        })
      }
    } catch (error) {
      console.error('Diagnostics failed:', error)
      setResult({
        timestamp: new Date().toISOString(),
        userId: 'user',
        s3Config: { region: '', bucket: '', hasCredentials: false, accessKeyIdPrefix: '' },
        tests: [{
          test: 'API Call',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }],
        environment: {
          NODE_ENV: '',
          AWS_REGION: '',
          AWS_S3_BUCKET: '',
          hasAwsAccessKey: false,
          hasAwsSecretKey: false
        }
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">S3 Diagnostics</h1>
          <p className="text-gray-600">Debug S3 connectivity and image loading issues</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Run Diagnostics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Test specific S3 key (optional):
              </label>
              <input
                type="text"
                value={testKey}
                onChange={(e) => setTestKey(e.target.value)}
                placeholder="e.g., reference-frames/user/frame_1_12345.png"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button 
              onClick={runDiagnostics} 
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Running Diagnostics...' : 'Run S3 Diagnostics'}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>S3 Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>Region:</strong> {result.s3Config.region}</div>
                  <div><strong>Bucket:</strong> {result.s3Config.bucket}</div>
                  <div><strong>Has Credentials:</strong> 
                    <span className={result.s3Config.hasCredentials ? 'text-green-600' : 'text-red-600'}>
                      {result.s3Config.hasCredentials ? ' ✓ Yes' : ' ✗ No'}
                    </span>
                  </div>
                  <div><strong>Access Key:</strong> {result.s3Config.accessKeyIdPrefix}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Environment Variables</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>NODE_ENV:</strong> {result.environment.NODE_ENV}</div>
                  <div><strong>AWS_REGION:</strong> {result.environment.AWS_REGION}</div>
                  <div><strong>AWS_S3_BUCKET:</strong> {result.environment.AWS_S3_BUCKET}</div>
                  <div><strong>Has AWS Access Key:</strong> 
                    <span className={result.environment.hasAwsAccessKey ? 'text-green-600' : 'text-red-600'}>
                      {result.environment.hasAwsAccessKey ? ' ✓ Yes' : ' ✗ No'}
                    </span>
                  </div>
                  <div><strong>Has AWS Secret Key:</strong> 
                    <span className={result.environment.hasAwsSecretKey ? 'text-green-600' : 'text-red-600'}>
                      {result.environment.hasAwsSecretKey ? ' ✓ Yes' : ' ✗ No'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Test Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.tests.map((test, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{test.test}</h4>
                        <span className={`px-2 py-1 rounded text-sm ${
                          test.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {test.success ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                      
                      {test.error && (
                        <div className="text-red-600 text-sm mb-2">
                          <strong>Error:</strong> {test.error}
                        </div>
                      )}
                      
                      {test.objectCount !== undefined && (
                        <div className="text-sm">
                          <strong>Objects found:</strong> {test.objectCount}
                        </div>
                      )}
                      
                      {test.objects && test.objects.length > 0 && (
                        <div className="text-sm mt-2">
                          <strong>Sample objects:</strong>
                          <ul className="ml-4 mt-1">
                            {test.objects.map((obj: any, objIndex: number) => (
                              <li key={objIndex} className="text-xs text-gray-600">
                                {obj.key} ({obj.size} bytes)
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {test.url && (
                        <div className="text-sm mt-2">
                          <strong>Generated URL:</strong> 
                          <div className="text-xs text-gray-600 break-all mt-1">
                            {test.url}
                          </div>
                        </div>
                      )}
                      
                      {test.contentType && (
                        <div className="text-sm mt-2">
                          <strong>Content Type:</strong> {test.contentType} | 
                          <strong> Size:</strong> {test.contentLength} bytes
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}