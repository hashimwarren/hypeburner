import '@testing-library/jest-dom'
import { TextDecoder, TextEncoder } from 'util'
import { ReadableStream, TransformStream, WritableStream } from 'stream/web'
import { MessagePort, MessageChannel } from 'worker_threads'

if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder
}

if (!global.ReadableStream) {
  global.ReadableStream = ReadableStream
}

if (!global.TransformStream) {
  global.TransformStream = TransformStream
}

if (!global.WritableStream) {
  global.WritableStream = WritableStream
}

if (!global.MessagePort) {
  global.MessagePort = MessagePort
}

if (!global.MessageChannel) {
  global.MessageChannel = MessageChannel
}

// undici needs encoder globals available before it loads
const { fetch, Headers, Request, Response } = require('undici')

if (!global.fetch) {
  global.fetch = fetch
}

if (!global.Headers) {
  global.Headers = Headers
}

if (!global.Request) {
  global.Request = Request
}

if (!global.Response) {
  global.Response = Response
}
