import { createMocks } from 'node-mocks-http';
import { POST } from '../../app/api/contact/route';

// Mock Resend for integration tests
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ 
        id: 'mock-email-id',
        from: 'test@example.com',
        to: ['newsroom@yourdomain.com']
      })
    }
  }))
}));

describe('Contact API Integration Tests', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-resend-key';
    jest.clearAllMocks();
  });

  it('should handle the complete request flow', async () => {
    const requestBody = {
      name: 'Integration Test User',
      email: 'integration@test.com',
      type: 'Integration Test',
      message: 'This is an integration test message with\nmultiple lines\nto test formatting.'
    };

    const mockRequest = {
      json: async () => requestBody,
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      }
    } as any;

    const response = await POST(mockRequest);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData).toEqual({ status: 'ok' });

    // Verify email was sent with correct parameters
    const { Resend } = require('resend');
    const mockResend = new Resend();
    const emailSendMock = mockResend.emails.send;

    expect(emailSendMock).toHaveBeenCalledTimes(1);
    expect(emailSendMock).toHaveBeenCalledWith({
      from: 'Integration Test User <noreply@yourdomain.com>',
      to: ['newsroom@yourdomain.com'],
      subject: 'New Integration Test inquiry from Integration Test User',
      html: expect.stringContaining('Integration Test User'),
      text: expect.stringContaining('Integration Test User'),
      replyTo: 'integration@test.com'
    });
  });

  it('should handle various input types correctly', async () => {
    const testCases = [
      {
        name: 'Special Characters Test',
        email: 'special@test.com',
        type: 'Bug Report',
        message: 'Special chars: áéíóú ñ ¿¡ @#$%^&*()'
      },
      {
        name: 'Long Message Test',
        email: 'long@test.com',
        type: 'Feature Request',
        message: 'A'.repeat(1000) // Very long message
      },
      {
        name: 'HTML Content Test',
        email: 'html@test.com',
        type: 'Security',
        message: '<script>alert("test")</script><p>HTML content</p>'
      }
    ];

    for (const testCase of testCases) {
      const mockRequest = {
        json: async () => testCase,
      } as any;

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ status: 'ok' });
    }
  });
});