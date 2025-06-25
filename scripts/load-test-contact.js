#!/usr/bin/env node

/**
 * Load Testing Script for Contact API
 * Run with: node scripts/load-test-contact.js
 */

const https = require('https')
const { performance } = require('perf_hooks')

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
const CONCURRENT_REQUESTS = 10
const TOTAL_REQUESTS = 100
const DELAY_BETWEEN_BATCHES = 100 // ms

const testData = {
  name: 'Load Test User',
  email: 'loadtest@example.com',
  type: 'Load Test',
  message: 'This is a load test message to check API performance under concurrent load.',
}

async function makeRequest(requestId) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now()
    const postData = JSON.stringify({
      ...testData,
      message: `${testData.message} Request ID: ${requestId}`,
    })

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
        const endTime = performance.now()
        resolve({
          requestId,
          status: res.statusCode,
          responseTime: endTime - startTime,
          data: JSON.parse(data),
        })
      })
    })

    req.on('error', (error) => {
      const endTime = performance.now()
      reject({
        requestId,
        error: error.message,
        responseTime: endTime - startTime,
      })
    })

    req.write(postData)
    req.end()
  })
}

async function runLoadTest() {
  console.log('🚀 Starting Load Test for Contact API\n')
  console.log(`Target: ${BASE_URL}/api/contact`)
  console.log(`Concurrent Requests: ${CONCURRENT_REQUESTS}`)
  console.log(`Total Requests: ${TOTAL_REQUESTS}`)
  console.log(`Delay Between Batches: ${DELAY_BETWEEN_BATCHES}ms\n`)

  const results = []
  const errors = []
  let completed = 0

  const startTime = performance.now()

  // Process requests in batches
  for (let batch = 0; batch < Math.ceil(TOTAL_REQUESTS / CONCURRENT_REQUESTS); batch++) {
    const batchStart = batch * CONCURRENT_REQUESTS
    const batchEnd = Math.min(batchStart + CONCURRENT_REQUESTS, TOTAL_REQUESTS)
    const batchRequests = []

    console.log(
      `📦 Processing batch ${batch + 1}/${Math.ceil(TOTAL_REQUESTS / CONCURRENT_REQUESTS)} (requests ${batchStart + 1}-${batchEnd})`
    )

    // Create batch of concurrent requests
    for (let i = batchStart; i < batchEnd; i++) {
      batchRequests.push(
        makeRequest(i + 1)
          .then((result) => {
            results.push(result)
            completed++
            process.stdout.write(`\r   Completed: ${completed}/${TOTAL_REQUESTS}`)
            return result
          })
          .catch((error) => {
            errors.push(error)
            completed++
            process.stdout.write(`\r   Completed: ${completed}/${TOTAL_REQUESTS}`)
            return error
          })
      )
    }

    // Wait for batch to complete
    await Promise.all(batchRequests)
    console.log('') // New line after progress

    // Delay between batches
    if (batch < Math.ceil(TOTAL_REQUESTS / CONCURRENT_REQUESTS) - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
    }
  }

  const endTime = performance.now()
  const totalTime = endTime - startTime

  // Calculate statistics
  const successfulRequests = results.filter((r) => r.status === 200)
  const failedRequests = results.filter((r) => r.status !== 200)
  const responseTimes = results.map((r) => r.responseTime)

  const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
  const minResponseTime = Math.min(...responseTimes)
  const maxResponseTime = Math.max(...responseTimes)
  const p95ResponseTime = responseTimes.sort((a, b) => a - b)[
    Math.floor(responseTimes.length * 0.95)
  ]

  // Print results
  console.log('\n📊 Load Test Results:')
  console.log('=====================================')
  console.log(`Total Requests: ${TOTAL_REQUESTS}`)
  console.log(`Successful Requests: ${successfulRequests.length}`)
  console.log(`Failed Requests: ${failedRequests.length}`)
  console.log(`Error Requests: ${errors.length}`)
  console.log(`Success Rate: ${((successfulRequests.length / TOTAL_REQUESTS) * 100).toFixed(1)}%`)
  console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`)
  console.log(`Requests/second: ${(TOTAL_REQUESTS / (totalTime / 1000)).toFixed(2)}`)
  console.log('\n⏱️  Response Time Statistics:')
  console.log(`Average: ${avgResponseTime.toFixed(2)}ms`)
  console.log(`Min: ${minResponseTime.toFixed(2)}ms`)
  console.log(`Max: ${maxResponseTime.toFixed(2)}ms`)
  console.log(`95th Percentile: ${p95ResponseTime.toFixed(2)}ms`)

  if (failedRequests.length > 0) {
    console.log('\n❌ Failed Requests:')
    failedRequests.forEach((req) => {
      console.log(`   Request ${req.requestId}: Status ${req.status} - ${JSON.stringify(req.data)}`)
    })
  }

  if (errors.length > 0) {
    console.log('\n💥 Error Requests:')
    errors.forEach((err) => {
      console.log(`   Request ${err.requestId}: ${err.error}`)
    })
  }

  // Performance assessment
  console.log('\n🎯 Performance Assessment:')
  if (avgResponseTime < 100) {
    console.log('   ✅ Excellent - Average response time < 100ms')
  } else if (avgResponseTime < 500) {
    console.log('   ✅ Good - Average response time < 500ms')
  } else if (avgResponseTime < 1000) {
    console.log('   ⚠️  Acceptable - Average response time < 1s')
  } else {
    console.log('   ❌ Poor - Average response time > 1s')
  }

  if (successfulRequests.length / TOTAL_REQUESTS >= 0.99) {
    console.log('   ✅ Excellent - Success rate >= 99%')
  } else if (successfulRequests.length / TOTAL_REQUESTS >= 0.95) {
    console.log('   ✅ Good - Success rate >= 95%')
  } else {
    console.log('   ❌ Poor - Success rate < 95%')
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
      runLoadTest()
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
