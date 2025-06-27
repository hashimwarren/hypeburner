# Plan: Live Content & Livestream Feature

This document outlines the step-by-step plan to implement the new live content feature. This plan leverages the existing blog routing and content structure.

---

## Phase 1: Configuration & Content

### ✅ 0. Initialize `next-video`

- **Task**: Install and initialize the `next-video` package.
- **Status**: Complete. The `npx next-video init` command has been run.

### ☐ 1. Update Contentlayer `Blog` Schema

- **Task**: Modify the existing `Blog` document type in `contentlayer.config.ts` to support video content for live events.
- **Fields to Add**: Add `videoSrc: { type: 'string', required: false }` to the `fields` object for the `Blog` type. The `layout` field should already be available as an optional string.
- **Difficulty**: Easy
- **Testing**: Run `pnpm dev`. The build should succeed. Contentlayer should not throw errors about unrecognized fields when it processes a post with `videoSrc`.

### ☐ 2. Create Sample Live Content

- **Task**: Create a sample live event post within the existing blog structure. This will allow it to be handled by the `/blog/[...slug]` route.
- **Location**: `data/blog/live/sample-event.mdx`.
- **Front Matter**: The file must contain valid front matter for the `Blog` schema, but with two key additions: `layout: 'LiveLayout'` to specify the custom layout, and `videoSrc` pointing to the video file.
- **Example Front Matter**:
  ```md
  ---
  title: 'Sample Livestream'
  date: '2025-06-26'
  tags: ['live', 'event']
  summary: 'This is a sample live event using the LiveLayout.'
  layout: 'LiveLayout'
  videoSrc: 'get-started.mp4'
  ---
  ```
- **Difficulty**: Easy
- **Testing**: Restart the dev server. The new post should be available at `/blog/live/sample-event`. It will likely render with the default layout for now, which is expected.

---

## Phase 2: Frontend Layout & Component Integration

### ☐ 3. Build the `LiveLayout` Component

- **Task**: Create a new layout component at `layouts/LiveLayout.tsx`.
- **Logic**: This component will receive the post data and render the specific design for livestreams, including the title, video player, and question form.
- **Difficulty**: Medium
- **Testing**: This component will be validated when integrated via the dynamic layout selection.

### ☐ 4. Implement Dynamic Layout Selection

- **Task**: Update the main blog page at `app/blog/[...slug]/page.tsx` to dynamically select the correct layout.
- **Logic**: The page already receives the post data. It likely has a component that selects a layout based on `post.layout`. Add a case for `'LiveLayout'` to import and render your new `layouts/LiveLayout.tsx` component.
- **Difficulty**: Medium
- **Testing**: Navigate to `/blog/live/sample-event`. The page should render using your new `LiveLayout.tsx` component, showing the customized design while other blog posts continue with the default layout.

### ☐ 5. Integrate Video Player in `LiveLayout`

- **Task**: Use the `next-video` component to display the video within the new layout.
- **Logic**: In `LiveLayout.tsx`, import the `<Video>` component from `next-video`. The `src` for the video will come from the `videoSrc` field passed in the post data.
- **Example**:

  ```tsx
  import Video from 'next-video'
  import { CoreContent } from 'pliny/utils/contentlayer'
  import { Blog } from 'contentlayer/generated'

  export default function LiveLayout({ content }: { content: CoreContent<Blog> }) {
    const { videoSrc, title } = content
    return (
      <div className="p-4">
        <h1 className="mb-4 text-3xl font-bold">{title}</h1>
        {videoSrc && <Video src={videoSrc} />}
        {/* Additional live event components go here */}
      </div>
    )
  }
  ```

- **Difficulty**: Easy
- **Testing**: The video player should appear on the `/blog/live/sample-event` page and be ready to play the `get-started.mp4` video.

---

## Phase 3: User Interaction

### ☐ 6. Create the "Send Question" API Route

- **Task**: Create a new API route handler at `app/api/live/question/route.ts`.
- **Logic**: The route will accept `POST` requests containing a JSON body with a `question` field. For now, it will log the received question to the server console and return a `200 OK` success response.
- **Difficulty**: Medium
- **Testing**: Use `curl` or a similar tool to send a `POST` request to `/api/live/question`. The server terminal should log the question, and the client should receive a success response.

### ☐ 7. Create the "Send Question" Form Component

- **Task**: Create a new client component `components/LiveQuestionForm.tsx` marked with `"use client"`.
- **Logic**: The component will contain a form with a text input and a "Send question" button. Use `useState` to manage the input’s value and an `onSubmit` handler to `POST` the data to `/api/live/question` using native `fetch`.
- **Difficulty**: Medium
- **Testing**: Add the component to `LiveLayout.tsx`. Type a question into the form and submit. Confirm that the server logs the question and that the input field clears after submission.

---

## Phase 4: Final Touches

### ☐ 8. Apply Styling

- **Task**: Use Tailwind CSS utility classes to style the `LiveLayout.tsx` and `LiveQuestionForm.tsx` components to match the visual design from the wireframe.
- **Difficulty**: Easy
- **Testing**: Visually inspect the `/blog/live/sample-event` page. The layout, typography, and spacing should meet the design specifications, and the design should be responsive.

### ☐ 9. Documentation and Cleanup

- **Task**: Add JSDoc comments to new components and functions. Remove any temporary code, debug logs, or test artifacts.
- **Difficulty**: Easy
- **Testing**: Perform a code review to ensure all new code is clean, documented, and production-ready.

---

## Phase 5: Unit Testing with Jest

### ☐ 10. Set Up Jest for Unit Tests

- **Task**: Configure Jest to run unit tests with TypeScript and React. Ensure that the configuration supports Tailwind CSS and Test Environment is set for a Next.js project.
- **Difficulty**: Easy
- **Testing**: Run `pnpm run test` and verify the Jest suite starts without errors.

### ☐ 11. Unit Tests for `LiveLayout` Component

- **Task**: Write unit tests for the `LiveLayout` component in `__tests__/LiveLayout.spec.tsx`.
- **Test Cases**:
  - Renders the title from the post content.
  - When `videoSrc` is provided, the `<Video>` component is correctly rendered.
  - Child/live event components render as expected.
- **Difficulty**: Medium
- **Testing**: Run Jest tests and ensure all assertions pass.

### ☐ 12. Unit Tests for `LiveQuestionForm` Component

- **Task**: Write unit tests for the `LiveQuestionForm` component in `__tests__/LiveQuestionForm.spec.tsx`.
- **Test Cases**:
  - The form renders an input element and a submit button.
  - Simulates user input and ensures the onSubmit handler calls the `/api/live/question` endpoint.
  - The input field is cleared after a successful submission.
- **Difficulty**: Medium
- **Testing**: Run Jest tests and verify that the component behaves as expected.

### ☐ 13. Unit Tests for the "Send Question" API Route

- **Task**: Write unit tests for the API route at `app/api/live/question/route.ts` in `__tests__/api/live/question.spec.ts`.
- **Test Cases**:
  - Returns a 200 status code for valid POST requests.
  - Validates that the question is processed (e.g., logged or returned) correctly.
  - Handles malformed requests gracefully.
- **Difficulty**: Medium
- **Testing**: Run Jest tests and ensure that all API route behavior matches expectations.
