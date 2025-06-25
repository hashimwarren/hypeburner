import { NextRequest } from 'next/server';
import { POST } from '../../app/api/contact/route';

// Mock Resend
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ id: 'mock-email-id' })
    }
  }))
}));

// Mock environment variables
process.env.RESEND_API_KEY = 'test-api-key';

describe('/api/contact', () => {
  let mockRequest: Partial<NextRequest>;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn(); // Mock console.error
  });

  const createMockRequest = (body: any) => ({
    json: jest.fn().mockResolvedValue(body),
  } as Partial<NextRequest>);

  describe('POST /api/contact', () => {
    it('should send email successfully with valid data', async () => {
      const validBody = {
        name: 'John Doe',
        email: 'john@example.com',
        type: 'General Inquiry',
        message: 'This is a test message'
      };

      mockRequest = createMockRequest(validBody);
      const response = await POST(mockRequest as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ status: 'ok' });
    });

    it('should return 400 when name is missing', async () => {
      const invalidBody = {
        email: 'john@example.com',
        type: 'General Inquiry',
        message: 'This is a test message'
      };

      mockRequest = createMockRequest(invalidBody);
      const response = await POST(mockRequest as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'All fields are required' });
    });

    it('should return 400 when email is missing', async () => {
      const invalidBody = {
        name: 'John Doe',
        type: 'General Inquiry',
        message: 'This is a test message'
      };

      mockRequest = createMockRequest(invalidBody);
      const response = await POST(mockRequest as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'All fields are required' });
    });

    it('should return 400 when type is missing', async () => {
      const invalidBody = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'This is a test message'
      };

      mockRequest = createMockRequest(invalidBody);
      const response = await POST(mockRequest as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'All fields are required' });
    });

    it('should return 400 when message is missing', async () => {
      const invalidBody = {
        name: 'John Doe',
        email: 'john@example.com',
        type: 'General Inquiry'
      };

      mockRequest = createMockRequest(invalidBody);
      const response = await POST(mockRequest as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'All fields are required' });
    });

    it('should return 400 when fields are empty strings', async () => {
      const invalidBody = {
        name: '',
        email: 'john@example.com',
        type: 'General Inquiry',
        message: 'This is a test message'
      };

      mockRequest = createMockRequest(invalidBody);
      const response = await POST(mockRequest as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'All fields are required' });
    });

    it('should handle Resend API errors gracefully', async () => {
      // Mock Resend to throw an error
      const { Resend } = require('resend');
      const mockResend = new Resend();
      mockResend.emails.send.mockRejectedValueOnce(new Error('API Error'));

      const validBody = {
        name: 'John Doe',
        email: 'john@example.com',
        type: 'General Inquiry',
        message: 'This is a test message'
      };

      mockRequest = createMockRequest(validBody);
      const response = await POST(mockRequest as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Failed to send message. Please try again later.' });
      expect(console.error).toHaveBeenCalledWith('Error sending contact email:', expect.any(Error));
    });

    it('should handle malformed JSON gracefully', async () => {
      mockRequest = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as Partial<NextRequest>;

      const response = await POST(mockRequest as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Failed to send message. Please try again later.' });
      expect(console.error).toHaveBeenCalledWith('Error sending contact email:', expect.any(Error));
    });

    it('should properly format email content', async () => {
      const { Resend } = require('resend');
      const mockResend = new Resend();
      const sendSpy = mockResend.emails.send;

      const validBody = {
        name: 'John Doe',
        email: 'john@example.com',
        type: 'Press Inquiry',
        message: 'Line 1\nLine 2\nLine 3'
      };

      mockRequest = createMockRequest(validBody);
      await POST(mockRequest as NextRequest);

      expect(sendSpy).toHaveBeenCalledWith({
        from: 'John Doe <noreply@yourdomain.com>',
        to: ['newsroom@yourdomain.com'],
        subject: 'New Press Inquiry inquiry from John Doe',
        html: expect.stringContaining('<br>'),
        text: expect.stringContaining('Line 1\nLine 2\nLine 3'),
        replyTo: 'john@example.com'
      });
    });
  });
});