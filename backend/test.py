# debug_streaming.py - Run this to test your backend streaming
import asyncio
import aiohttp
import json

async def test_streaming_endpoint():
    """Test if your backend streaming is working"""
    
    # Replace with your actual values
    BASE_URL = "http://localhost:8000"  # Your backend URL
    SESSION_ID = 1  # Replace with a real session ID
    TOKEN = "your_access_token_here"  # Replace with real token
    
    url = f"{BASE_URL}/api/chat/sessions/{SESSION_ID}/messages"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TOKEN}"
    }
    
    # Test streaming request
    payload = {
        "content": "Tell me about artificial intelligence",
        "stream": True
    }
    
    print("🧪 Testing streaming endpoint...")
    print(f"URL: {url}")
    print(f"Payload: {payload}")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers) as response:
                print(f"📡 Response Status: {response.status}")
                print(f"📋 Response Headers: {dict(response.headers)}")
                
                # Check if it's streaming
                content_type = response.headers.get('content-type', '')
                if 'text/event-stream' in content_type:
                    print("✅ Streaming response detected!")
                    
                    chunk_count = 0
                    async for line in response.content:
                        line_str = line.decode('utf-8').strip()
                        if line_str:
                            chunk_count += 1
                            print(f"📦 Chunk {chunk_count}: {line_str}")
                            
                            # Stop after 10 chunks to avoid spam
                            if chunk_count >= 10:
                                print("... (stopping after 10 chunks)")
                                break
                else:
                    print("❌ Not a streaming response!")
                    text = await response.text()
                    print(f"📄 Full response: {text}")
                    
    except Exception as e:
        print(f"❌ Error testing streaming: {e}")
        import traceback
        traceback.print_exc()

async def test_regular_endpoint():
    """Test regular (non-streaming) endpoint for comparison"""
    
    BASE_URL = "http://localhost:8000"
    SESSION_ID = 1
    TOKEN = "your_access_token_here"
    
    url = f"{BASE_URL}/api/chat/sessions/{SESSION_ID}/messages"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TOKEN}"
    }
    
    # Test regular request
    payload = {
        "content": "Tell me about artificial intelligence",
        "stream": False  # or omit this field
    }
    
    print("\n🧪 Testing regular endpoint...")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers) as response:
                print(f"📡 Response Status: {response.status}")
                print(f"📋 Content-Type: {response.headers.get('content-type')}")
                
                if response.status == 200:
                    data = await response.json()
                    print("✅ Regular response received!")
                    print(f"📄 Response: {json.dumps(data, indent=2)}")
                else:
                    text = await response.text()
                    print(f"❌ Error response: {text}")
                    
    except Exception as e:
        print(f"❌ Error testing regular endpoint: {e}")

if __name__ == "__main__":
    print("🔧 Backend Streaming Debugger")
    print("=" * 50)
    
    # Update these values before running:
    print("⚠️  BEFORE RUNNING:")
    print("1. Update BASE_URL to your backend URL")
    print("2. Update SESSION_ID to a real session")
    print("3. Update TOKEN with a valid access token")
    print("4. Make sure your backend is running")
    print()
    
    asyncio.run(test_streaming_endpoint())
    asyncio.run(test_regular_endpoint())