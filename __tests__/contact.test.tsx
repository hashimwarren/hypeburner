import React from 'react'
import { render, screen } from '@testing-library/react'
import ContactPage from '../app/contact/page' // Adjusted path

describe('ContactPage', () => {
  it('renders the contact form', () => {
    render(<ContactPage />)

    // Check for labels by their text content
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Message')).toBeInTheDocument()

    // Check for the submit button by its role and name
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
  })
})
