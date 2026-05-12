import { describe, expect, it } from 'vitest'
import {
  isFullEmailDocument,
  isHtmlDocumentShell,
  requiresEmailTemplateSourceEditing,
} from './template-renderer'

describe('isHtmlDocumentShell', () => {
  it('returns true when HTML starts with DOCTYPE', () => {
    expect(isHtmlDocumentShell('<!DOCTYPE html><html><body></body></html>')).toBe(true)
  })

  it('returns true when HTML starts with html element', () => {
    expect(isHtmlDocumentShell('<html><body></body></html>')).toBe(true)
  })

  it('returns false for table-only email fragment', () => {
    const fragment =
      '<table role="presentation" width="100%"><tr><td><table role="presentation" width="640"></table></td></tr></table>'
    expect(isHtmlDocumentShell(fragment)).toBe(false)
  })
})

describe('requiresEmailTemplateSourceEditing', () => {
  it('returns true for document shell', () => {
    expect(requiresEmailTemplateSourceEditing('<!DOCTYPE html><html><body>x</body></html>')).toBe(
      true,
    )
  })

  it('returns true when tbody begins with a merge tag', () => {
    expect(
      requiresEmailTemplateSourceEditing(
        '<table><thead><tr><th>A</th></tr></thead><tbody>{{line_items_html}}</tbody></table>',
      ),
    ).toBe(true)
  })

  it('returns false for table fragment without shell or tbody merge pattern', () => {
    const fragment =
      '<table role="presentation" width="100%"><tr><td><table width="640"><tbody><tr><td>ok</td></tr></tbody></table></td></tr></table>'
    expect(requiresEmailTemplateSourceEditing(fragment)).toBe(false)
  })

  it('returns false when merge tag is inside a tr within tbody', () => {
    expect(
      requiresEmailTemplateSourceEditing(
        '<table><tbody><tr><td>{{line_items_html}}</td></tr></tbody></table>',
      ),
    ).toBe(false)
  })
})

describe('isFullEmailDocument', () => {
  it('still treats meta + 100% presentation table fragments as full for render wrapping', () => {
    const legacy =
      '<meta charset="utf-8"><table role="presentation" width="100%" style="width:100%"><tr><td>x</td></tr></table>'
    expect(isFullEmailDocument(legacy)).toBe(true)
  })
})
