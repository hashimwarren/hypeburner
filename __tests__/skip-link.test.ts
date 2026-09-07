import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

// Inspect the public shell without loading its providers or CMS dependencies.
const source = ts.createSourceFile(
  'layout.tsx',
  readFileSync(join(process.cwd(), 'app/(site)/layout.tsx'), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
)
type OpeningElement = ts.JsxOpeningElement | ts.JsxSelfClosingElement
const elements: OpeningElement[] = []
function visit(node: ts.Node) {
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) elements.push(node)
  ts.forEachChild(node, visit)
}
visit(source)

function attribute(element: OpeningElement, name: string) {
  const attribute = element.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText(source) === name
  )
  const value = attribute?.initializer
  if (value && ts.isStringLiteral(value)) return value.text
  if (value && ts.isJsxExpression(value)) return value.expression?.getText(source)
}

const skipLinks = elements.filter(
  (element) =>
    element.tagName.getText(source) === 'a' && attribute(element, 'href') === '#main-content'
)

test('places one named skip anchor before the header and main', () => {
  expect(skipLinks).toHaveLength(1)
  const skip = skipLinks[0]
  const parent = skip.parent
  expect(ts.isJsxElement(parent)).toBe(true)
  if (!ts.isJsxElement(parent)) throw new Error('The skip link must have text content')
  expect(
    parent.children
      .map((child) => child.getText(source))
      .join('')
      .trim()
  ).toBe('Skip to content')
  const header = elements.find((element) => element.tagName.getText(source) === 'Header')
  const main = elements.find((element) => element.tagName.getText(source) === 'main')
  expect(header).toBeDefined()
  expect(main).toBeDefined()
  expect(skip.getStart(source)).toBeLessThan(header!.getStart(source))
  expect(header!.getStart(source)).toBeLessThan(main!.getStart(source))
})

test('targets the existing unique main without adding a sequential tab stop', () => {
  const mains = elements.filter((element) => element.tagName.getText(source) === 'main')
  const targets = elements.filter((element) => attribute(element, 'id') === 'main-content')
  expect(mains).toHaveLength(1)
  expect(targets).toHaveLength(1)
  expect(targets[0] === mains[0]).toBe(true)
  expect(attribute(mains[0], 'tabIndex')).toBe('-1')
  expect(attribute(mains[0], 'className')).toBe('mb-auto')
})

test('keeps the skip link visually hidden until focus without disabling it', () => {
  expect(skipLinks).toHaveLength(1)
  const skip = skipLinks[0]
  const classes = attribute(skip, 'className')?.split(/\s+/)
  expect(classes).toEqual(expect.arrayContaining(['sr-only', 'focus:not-sr-only', 'focus:fixed']))
  expect(classes).not.toContain('hidden')
  expect(attribute(skip, 'tabIndex')).toBeUndefined()
  expect(attribute(skip, 'aria-hidden')).toBeUndefined()
})
