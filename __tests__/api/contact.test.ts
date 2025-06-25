import { POST } from '@/app/api/contact/route' // Adjusted path
import { NextResponse } from 'next/server'

// Mock Resend
const sendMock = jest.fn()
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: sendMock,
    },
  })),
}))

// Mock environment variables
const originalEnv = process.env
beforeAll(() => {
  process.env = {
    ...originalEnv,
    RESEND_API_KEY: 'mock-api-key',
    CONTACT_FORM_RECIPIENT: 'test@example.com',
  }
})

afterAll(() => {
  process.env = originalEnv
})

describe('Contact API (/api/contact)', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('handles successful form submission', async () => {
    sendMock.mockResolvedValueOnce({ data: { id: 'mock_id' }, error: null })

    const mockRequest = {
      json: async () => ({
        name: 'Test User',
        email: 'test@example.com',
        message: 'Hello',
      }),
    } as Request

    const response = await POST(mockRequest)
    const responseBody = await response.json()

    expect(response.status).toBe(200)
    expect(responseBody.message).toBe('Email sent successfully!')
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith({
      from: 'Contact Form <onboarding@resend.dev>',
      to: 'test@example.com',
      subject: 'New Contact Form Submission',
      html:
        expect.stringContaining('Test User') &&
        expect.stringContaining('test@example.com') &&
        expect.stringContaining('Hello'),
    })
  })

  it('handles validation error for empty fields', async () => {
    const mockRequest = {
      json: async () => ({
        name: '',
        email: '',
        message: '',
      }),
    } as Request

    const response = await POST(mockRequest)
    const responseBody = await response.json()

    expect(response.status).toBe(400)
    expect(responseBody.error).toBe('Missing required fields.')
    expect(responseBody.code).toBe('ERR_MISSING_FIELDS')
    expect(responseBody.message).toBe('Name, email, and message are all required fields.')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('handles validation error for invalid email', async () => {
    const mockRequest = {
      json: async () => ({
        name: 'Test User',
        email: 'invalid-email',
        message: 'Hello',
      }),
    } as Request

    const response = await POST(mockRequest)
    const responseBody = await response.json()

    expect(response.status).toBe(400)
    expect(responseBody.error).toBe('Invalid email format.')
    expect(responseBody.code).toBe('ERR_INVALID_EMAIL')
    expect(responseBody.message).toBe('Please provide a valid email address.')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('handles error during email sending', async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'Failed to send', name: 'Error', statusCode: 500 },
    })

    const mockRequest = {
      json: async () => ({
        name: 'Test User',
        email: 'test@example.com',
        message: 'Hello again',
      }),
    } as Request

    const response = await POST(mockRequest)
    const responseBody = await response.json()

    expect(response.status).toBe(500)
    expect(responseBody.error).toBe('Failed to send email.')
    expect(responseBody.code).toBe('ERR_EMAIL_SEND')
    expect(responseBody.message).toBe(
      'Unable to send your message at this time. Please try again later or contact us directly.'
    )
    expect(responseBody.details).toBe('Failed to send')
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('handles general request processing errors', async () => {
    const mockRequest = {
      json: async () => {
        throw new Error('JSON parsing error')
      },
    } as Request

    const response = await POST(mockRequest)
    const responseBody = await response.json()

    expect(response.status).toBe(500)
    expect(responseBody.error).toBe('Failed to process request.')
    expect(responseBody.code).toBe('ERR_REQUEST_PROCESSING')
    expect(responseBody.message).toBe(
      'An error occurred while processing your request. Please try again.'
    )
    expect(responseBody.details).toBe('JSON parsing error')
    expect(sendMock).not.toHaveBeenCalled()
  })
})
