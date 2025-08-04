"use client"

import { useState } from 'react';
import { supabase } from '@/lib/supabase-config';

export default function TestAuthPage() {
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('TestPassword123!');
  const [result, setResult] = useState('');

  const testSignUp = async () => {
    try {
      setResult('Testing signup...');
      
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { username: 'testuser' }
        }
      });

      if (error) {
        setResult(`Error: ${error.message}`);
        console.error('Supabase error:', error);
      } else {
        setResult(`Success: ${JSON.stringify(data, null, 2)}`);
        console.log('Supabase success:', data);
      }
    } catch (error: any) {
      setResult(`Exception: ${error.message}`);
      console.error('Exception:', error);
    }
  };

  const testSignIn = async () => {
    try {
      setResult('Testing signin...');
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (error) {
        setResult(`Error: ${error.message}`);
        console.error('Supabase error:', error);
      } else {
        setResult(`Success: ${JSON.stringify(data, null, 2)}`);
        console.log('Supabase success:', data);
      }
    } catch (error: any) {
      setResult(`Exception: ${error.message}`);
      console.error('Exception:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Supabase Auth Test</h1>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div className="space-x-2">
            <button
              onClick={testSignUp}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Test Sign Up
            </button>
            <button
              onClick={testSignIn}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Test Sign In
            </button>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Result:</label>
            <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto max-h-64">
              {result}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
} 