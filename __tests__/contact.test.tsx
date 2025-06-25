import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { screen, fireEvent } from '@testing-library/dom'
import '@testing-library/jest-dom'
import ContactPage from '../app/contact/page' // Adjusted path

describe('ContactPage', () => {
  it('renders the contact form', () => {
    render(<ContactPage />)

    // Check for labels by their text content
    expect(screen.getByLabelText('Name *')).toBeInTheDocument()
    expect(screen.getByLabelText('Email *')).toBeInTheDocument()
    expect(screen.getByLabelText('Message *')).toBeInTheDocument()

    // Check for the submit button by its role and name
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument()
  })

  it('shows error for message less than 10 characters', async () => {
    render(<ContactPage />)

    // Fill in form with valid name and email, but short message
    fireEvent.change(screen.getByLabelText('Name *'), {
      target: { value: 'John Doe' },
    })
    fireEvent.change(screen.getByLabelText('Email *'), {
      target: { value: 'john@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Message *'), {
      target: { value: 'Short' }, // Only 5 characters
    })

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))

    // Wait for and check the error message
    await waitFor(() => {
      expect(screen.getByText('Message must be at least 10 characters long')).toBeInTheDocument()
    })
  })
})
