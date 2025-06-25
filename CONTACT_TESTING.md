# Contact Form Testing Guide

This guide covers all the tests available for the contact form functionality.

## Test Types Available

### 1. Unit Tests (`__tests__/api/contact.test.ts`)
Tests the API route in isolation with mocked dependencies.

**Run with:**
```bash
npm test __tests__/api/contact.test.ts
# or
yarn test __tests__/api/contact.test.ts
```

**Tests cover:**
- ✅ Valid form submissions
- ❌ Missing required fields validation
- ❌ Empty field validation
- 🛡️ Error handling (API failures, malformed JSON)
- 📧 Email content formatting
- 🔧 Resend API integration

### 2. Integration Tests (`__tests__/api/contact.integration.test.ts`)
Tests the complete request flow including various input scenarios.

**Run with:**
```bash
npm test __tests__/api/contact.integration.test.ts
# or
yarn test __tests__/api/contact.integration.test.ts
```

**Tests cover:**
- 🌐 Complete request/response flow
- 🔤 Special characters handling
- 📝 Long message handling
- 🛡️ HTML content sanitization

### 3. End-to-End Tests (`__tests__/e2e/contact-form.spec.ts`)
Tests the complete user interaction flow using Playwright.

**Prerequisites:**
```bash
npm install -D @playwright/test
# or
yarn add -D @playwright/test

# Install browsers
npx playwright install
```

**Run with:**
```bash
npx playwright test __tests__/e2e/contact-form.spec.ts
```

**Tests cover:**
- 👤 User form interaction
- ✅ Success message display
- ❌ Error message display
- 🔍 Form validation (client-side)
- 📧 Email format validation
- 🔄 Form reset after submission
- ⏳ Loading states
- 🌐 Network error handling

### 4. Manual API Testing (`scripts/test-contact-api.js`)
Automated manual testing script that hits the API directly.

**Prerequisites:**
Start your development server:
```bash
npm run dev
# or
yarn dev
```

**Run with:**
```bash
node scripts/test-contact-api.js
```

**Tests cover:**
- ✅ Valid submissions
- ❌ Missing field scenarios
- 🔤 Special character handling
- 📝 Long message testing
- 📊 Response format validation

### 5. Load Testing (`scripts/load-test-contact.js`)
Tests API performance under concurrent load.

**Prerequisites:**
Start your development server:
```bash
npm run dev
# or
yarn dev
```

**Run with:**
```bash
node scripts/load-test-contact.js
```

**Tests cover:**
- 🚀 Concurrent request handling (10 concurrent, 100 total)
- ⏱️ Response time statistics
- 📈 Success rate under load
- 📊 Performance assessment

## Environment Setup

### Required Environment Variables
```bash
# .env.local
RESEND_API_KEY=your_resend_api_key_here
```

### Update API Configuration
In `app/api/contact/route.ts`, update these placeholders:
```typescript
from: `${name} <noreply@yourdomain.com>`, // Replace with your verified domain
to: ["newsroom@yourdomain.com"], // Replace with your actual email
```

## Running All Tests

### Quick Test Suite
```bash
# Unit tests
npm test __tests__/api/contact

# Integration tests  
npm test __tests__/api/contact.integration

# Manual API test (requires running server)
node scripts/test-contact-api.js
```

### Complete Test Suite
```bash
# 1. Unit & Integration tests
npm test

# 2. Start development server
npm run dev

# 3. In another terminal - Manual API tests
node scripts/test-contact-api.js

# 4. Load testing
node scripts/load-test-contact.js

# 5. E2E tests (requires Playwright setup)
npx playwright test __tests__/e2e/contact-form.spec.ts
```

## Test Results Interpretation

### Unit/Integration Tests
- ✅ All tests should pass
- Look for any console errors or warnings
- Coverage should be high for critical paths

### Manual API Testing
- ✅ Success rate should be 100%
- All status codes should match expectations
- Response format should be consistent

### Load Testing
- ✅ Success rate should be ≥95%
- ✅ Average response time should be <500ms
- ⚠️ Monitor for any errors under load

### E2E Testing
- ✅ All user interactions should work smoothly
- ✅ Form validation should work correctly
- ✅ Success/error states should display properly

## Troubleshooting

### Common Issues

1. **Resend API Errors**
   - Check RESEND_API_KEY is set correctly
   - Verify domain is verified in Resend dashboard
   - Ensure from/to email addresses are valid

2. **Test Failures**
   - Ensure development server is running for manual/load tests
   - Check Jest configuration for unit tests
   - Verify Playwright setup for E2E tests

3. **Network Issues**
   - Check firewall settings
   - Verify localhost:3000 is accessible
   - Ensure no proxy interference

### Performance Issues
- If load tests show poor performance:
  - Check server resources
  - Monitor network latency
  - Consider rate limiting implementation
  - Review Resend API rate limits

## Best Practices

1. **Before Deployment**
   - Run all test suites
   - Test with production-like environment variables
   - Verify email delivery in staging environment

2. **Continuous Integration**
   - Include unit and integration tests in CI pipeline
   - Consider adding manual API tests to deployment verification
   - Set up monitoring for production API performance

3. **Monitoring**
   - Track API response times in production
   - Monitor email delivery success rates
   - Set up alerts for high error rates