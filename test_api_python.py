#!/usr/bin/env python3
"""
Python script for testing the Video Generation API
Alternative to Postman for API testing
"""

import requests
import json
import time
import base64
from typing import Dict, Any, Optional

class APITester:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })
        
        # Test image (1x1 pixel PNG)
        self.test_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    
    def test_status(self) -> Dict[str, Any]:
        """Test the status endpoint"""
        print("🔍 Testing status endpoint...")
        
        try:
            response = self.session.get(f"{self.base_url}/status")
            response.raise_for_status()
            
            data = response.json()
            print(f"✅ Status: {data.get('status', 'unknown')}")
            print(f"📋 Service: {data.get('service', 'unknown')}")
            print(f"🕒 Response time: {response.elapsed.total_seconds():.2f}s")
            
            return {
                'success': True,
                'status_code': response.status_code,
                'data': data,
                'response_time': response.elapsed.total_seconds()
            }
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Status test failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def test_upload_image(self) -> Dict[str, Any]:
        """Test image upload endpoint"""
        print("\n📤 Testing image upload...")
        
        payload = {
            'imageData': self.test_image,
            'filename': 'test-image.png'
        }
        
        try:
            response = self.session.post(f"{self.base_url}/upload-image", json=payload)
            response.raise_for_status()
            
            data = response.json()
            print(f"✅ Upload successful")
            print(f"📁 S3 Key: {data.get('s3Key', 'N/A')}")
            print(f"🔗 URL: {data.get('imageUrl', 'N/A')}")
            print(f"🕒 Response time: {response.elapsed.total_seconds():.2f}s")
            
            return {
                'success': True,
                'status_code': response.status_code,
                'data': data,
                'response_time': response.elapsed.total_seconds()
            }
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Upload test failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def test_generate_images(self) -> Dict[str, Any]:
        """Test image generation endpoint"""
        print("\n🎨 Testing image generation...")
        
        payload = {
            'image': self.test_image,
            'prompt': 'A person walking in a park',
            'numImages': 2
        }
        
        try:
            response = self.session.post(f"{self.base_url}/generate-images", json=payload)
            response.raise_for_status()
            
            data = response.json()
            print(f"✅ Generation successful")
            print(f"🖼️ Generated: {data.get('generatedCount', 0)}/{data.get('requestedCount', 0)}")
            print(f"🕒 Response time: {response.elapsed.total_seconds():.2f}s")
            
            if data.get('errors'):
                print(f"⚠️ Errors: {data['errors']}")
            
            return {
                'success': True,
                'status_code': response.status_code,
                'data': data,
                'response_time': response.elapsed.total_seconds()
            }
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Generation test failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def test_generate_video(self) -> Dict[str, Any]:
        """Test video generation endpoint"""
        print("\n🎬 Testing video generation...")
        
        payload = {
            'image': self.test_image,
            'prompt': 'A person walking in a park',
            'duration': 5
        }
        
        try:
            response = self.session.post(f"{self.base_url}/generate-video", json=payload)
            response.raise_for_status()
            
            data = response.json()
            print(f"✅ Video generation successful")
            print(f"🎥 Video URL: {data.get('videoUrl', 'N/A')}")
            print(f"📊 Status: {data.get('status', 'N/A')}")
            print(f"🕒 Response time: {response.elapsed.total_seconds():.2f}s")
            
            return {
                'success': True,
                'status_code': response.status_code,
                'data': data,
                'response_time': response.elapsed.total_seconds()
            }
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Video generation test failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def test_authentication(self) -> Dict[str, Any]:
        """Test authentication (should fail without API key)"""
        print("\n🔒 Testing authentication...")
        
        # Test without API key
        session_no_auth = requests.Session()
        session_no_auth.headers.update({'Content-Type': 'application/json'})
        
        payload = {'imageData': self.test_image}
        
        try:
            response = session_no_auth.post(f"{self.base_url}/upload-image", json=payload)
            
            if response.status_code == 401:
                print("✅ Authentication working correctly (401 returned)")
                data = response.json()
                print(f"🔒 Error: {data.get('error', 'N/A')}")
                return {
                    'success': True,
                    'status_code': response.status_code,
                    'message': 'Authentication properly enforced'
                }
            else:
                print(f"❌ Authentication not working properly (got {response.status_code})")
                return {
                    'success': False,
                    'status_code': response.status_code,
                    'message': 'Authentication not properly enforced'
                }
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Authentication test failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def test_rate_limiting(self) -> Dict[str, Any]:
        """Test rate limiting by making multiple requests"""
        print("\n⚡ Testing rate limiting...")
        
        requests_made = 0
        successful_requests = 0
        rate_limited_requests = 0
        
        # Make multiple requests quickly
        for i in range(10):
            try:
                response = self.session.get(f"{self.base_url}/status")
                requests_made += 1
                
                if response.status_code == 200:
                    successful_requests += 1
                elif response.status_code == 429:
                    rate_limited_requests += 1
                    print(f"Rate limited on request {i+1}")
                
                # Small delay to avoid overwhelming the server
                time.sleep(0.1)
                
            except requests.exceptions.RequestException as e:
                print(f"Request {i+1} failed: {e}")
        
        print(f"📊 Rate limit test results:")
        print(f"   Total requests: {requests_made}")
        print(f"   Successful: {successful_requests}")
        print(f"   Rate limited: {rate_limited_requests}")
        
        return {
            'success': True,
            'total_requests': requests_made,
            'successful': successful_requests,
            'rate_limited': rate_limited_requests
        }
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all API tests"""
        print("🧪 Starting API Tests...")
        print("=" * 50)
        
        results = {
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'base_url': self.base_url,
            'tests': {}
        }
        
        # Run individual tests
        results['tests']['status'] = self.test_status()
        results['tests']['upload'] = self.test_upload_image()
        results['tests']['generate_images'] = self.test_generate_images()
        results['tests']['generate_video'] = self.test_generate_video()
        results['tests']['authentication'] = self.test_authentication()
        results['tests']['rate_limiting'] = self.test_rate_limiting()
        
        # Summary
        print("\n" + "=" * 50)
        print("📋 Test Summary:")
        
        successful_tests = 0
        total_tests = len(results['tests'])
        
        for test_name, result in results['tests'].items():
            status = "✅ PASS" if result.get('success', False) else "❌ FAIL"
            print(f"   {test_name.replace('_', ' ').title()}: {status}")
            if result.get('success', False):
                successful_tests += 1
        
        print(f"\n🎯 Overall: {successful_tests}/{total_tests} tests passed")
        
        return results

def main():
    """Main function to run the API tests"""
    
    # Configuration
    BASE_URL = "http://localhost:3000/api/public"
    API_KEY = "sk-test-1234567890abcdef"
    
    # Create tester instance
    tester = APITester(BASE_URL, API_KEY)
    
    # Run all tests
    results = tester.run_all_tests()
    
    # Save results to file
    with open('api_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📄 Results saved to api_test_results.json")

if __name__ == "__main__":
    main()





