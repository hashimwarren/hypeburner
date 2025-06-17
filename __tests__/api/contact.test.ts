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
      to: 'YOUR_EMAIL_ADDRESS_PLACEHOLDER',
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
    expect(sendMock).toHaveBeenCalledTimes(1)
  })
})
