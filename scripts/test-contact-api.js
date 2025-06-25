#!/usr/bin/env node

/**
 * Manual Testing Script for Contact API
 * Run with: node scripts/test-contact-api.js
 */

const https = require('https')

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

const testCases = [
  {
    name: 'Valid Submission',
    data: {
      name: 'Manual Test User',
      email: 'manual@test.com',
      type: 'General Inquiry',
      message: 'This is a manual test submission.',
    },
    expectedStatus: 200,
  },
  {
    name: 'Missing Name',
    data: {
      email: 'manual@test.com',
      type: 'General Inquiry',
      message: 'This is a manual test submission.',
    },
    expectedStatus: 400,
  },
  {
    name: 'Missing Email',
    data: {
      name: 'Manual Test User',
      type: 'General Inquiry',
      message: 'This is a manual test submission.',
    },
    expectedStatus: 400,
  },
  {
    name: 'Missing Type',
    data: {
      name: 'Manual Test User',
      email: 'manual@test.com',
      message: 'This is a manual test submission.',
    },
    expectedStatus: 400,
  },
  {
    name: 'Missing Message',
    data: {
      name: 'Manual Test User',
      email: 'manual@test.com',
      type: 'General Inquiry',
    },
    expectedStatus: 400,
  },
  {
    name: 'Empty Fields',
    data: {
      name: '',
      email: 'manual@test.com',
      type: 'General Inquiry',
      message: 'This is a manual test submission.',
    },
    expectedStatus: 400,
  },
  {
    name: 'Special Characters',
    data: {
      name: 'José María García-López',
      email: 'jose.maria@example.com',
      type: 'Press Inquiry',
      message: 'Special chars: áéíóú ñ ¿¡ @#$%^&*()\nLine break test',
    },
    expectedStatus: 200,
  },
  {
    name: 'Long Message',
    data: {
      name: 'Long Message User',
      email: 'long@test.com',
      type: 'Feature Request',
      message: 'A'.repeat(5000),
    },
    expectedStatus: 200,
  },
]

async function makeRequest(testCase) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(testCase.data)

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/contact',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }

    const req = https.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: JSON.parse(data),
        })
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.write(postData)
    req.end()
  })
}

async function runTests() {
  console.log('🧪 Starting Manual Contact API Tests\n')
  console.log(`Testing against: ${BASE_URL}/api/contact\n`)

  let passed = 0
  let failed = 0

  for (const testCase of testCases) {
    try {
      console.log(`📋 Testing: ${testCase.name}`)

      const response = await makeRequest(testCase)

      if (response.status === testCase.expectedStatus) {
        console.log(`✅ PASS - Status: ${response.status}`)
        console.log(`   Response: ${JSON.stringify(response.data)}`)
        passed++
      } else {
        console.log(`❌ FAIL - Expected: ${testCase.expectedStatus}, Got: ${response.status}`)
        console.log(`   Response: ${JSON.stringify(response.data)}`)
        failed++
      }
    } catch (error) {
      console.log(`❌ ERROR - ${error.message}`)
      failed++
    }

    console.log('') // Empty line for readability
  }

  console.log('📊 Test Summary:')
  console.log(`   ✅ Passed: ${passed}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log(`   📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`)

  if (failed > 0) {
    process.exit(1)
  }
}

// Check if server is running
const serverCheck = https.request(
  {
    hostname: 'localhost',
    port: 3000,
    path: '/',
    method: 'GET',
  },
  (res) => {
    if (res.statusCode === 200 || res.statusCode === 404) {
      runTests()
    }
  }
)

serverCheck.on('error', (error) => {
  console.log('❌ Server not running. Please start your Next.js development server first:')
  console.log('   npm run dev')
  console.log('   # or')
  console.log('   yarn dev')
  process.exit(1)
})

serverCheck.end()
