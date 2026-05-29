import { describe, expect, it } from 'vitest'
import {
  isFullEmailDocument,
  isHtmlDocumentShell,
  repairTbodyMergeTagPlacement,
  renderWithContext,
  renderWithSampleData,
  requiresEmailTemplateSourceEditing,
  wrapWithEmailLayout,
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

describe('repairTbodyMergeTagPlacement', () => {
  it('keeps generated table rows inside the table body', () => {
    const repaired = repairTbodyMergeTagPlacement(
      '<table>{{line_items_html}}<thead><tr><th>QTY</th></tr></thead><tbody></tbody></table>',
    )

    expect(repaired).toBe(
      '<table><thead><tr><th>QTY</th></tr></thead><tbody>{{line_items_html}}</tbody></table>',
    )
  })

  it('repairs a placeholder that was serialized before the table', () => {
    const repaired = repairTbodyMergeTagPlacement(
      '{{line_items_html}}<table><thead><tr><th>QTY</th></tr></thead><tbody></tbody></table>',
    )

    expect(repaired).toBe(
      '<table><thead><tr><th>QTY</th></tr></thead><tbody>{{line_items_html}}</tbody></table>',
    )
  })

  it('repairs a placeholder before a header row when the table has no thead', () => {
    const repaired = repairTbodyMergeTagPlacement(
      '{{line_items_html}}<table><tbody><tr><th>QTY</th></tr></tbody></table>',
    )

    expect(repaired).toBe(
      '<table><tbody><tr><th>QTY</th></tr>{{line_items_html}}</tbody></table>',
    )
  })

  it('repairs a placeholder that was serialized after an empty table body', () => {
    const repaired = repairTbodyMergeTagPlacement(
      '<table><thead><tr><th>QTY</th></tr></thead><tbody></tbody>{{line_items_html}}</table>',
    )

    expect(repaired).toBe(
      '<table><thead><tr><th>QTY</th></tr></thead><tbody>{{line_items_html}}</tbody></table>',
    )
  })
})

describe('isFullEmailDocument', () => {
  it('still treats meta + 100% presentation table fragments as full for render wrapping', () => {
    const legacy =
      '<meta charset="utf-8"><table role="presentation" width="100%" style="width:100%"><tr><td>x</td></tr></table>'
    expect(isFullEmailDocument(legacy)).toBe(true)
  })
})

describe('wrapWithEmailLayout', () => {
  it('renders a footer with property name, address, and unsubscribe link', () => {
    const propertyName = 'Pine Ridge Campground'
    const propertyAddress = '123 Camp Road, Lakeview, TX 75001'
    const unsubscribeUrl = 'https://example.com/unsubscribe/token'

    const html = wrapWithEmailLayout(
      '<p>Reservation details</p>',
      { width: '600', bgColor: '#ffffff', centered: true },
      { propertyName, propertyAddress, unsubscribeUrl },
    )

    expect(html).toContain(
      `${propertyName} &middot; ${propertyAddress} &middot; <a href="${unsubscribeUrl}" target="_blank" style="color:#888888;">Unsubscribe</a>`,
    )
  })
})

describe('renderWithContext', () => {
  it('derives the email footer property address from event context', () => {
    const propertyName = 'Pine Ridge Campground'
    const address = '123 Camp Road'
    const city = 'Lakeview'
    const state = 'TX'
    const zipCode = '75001'

    const result = renderWithContext(
      'Welcome to {{property.name}}',
      '<p>Hello {{guest.first_name}}</p>',
      {
        guest: { first_name: 'Riley', last_name: 'Guest' },
        property: {
          name: propertyName,
          address,
          city,
          state,
          zip_code: zipCode,
        },
      },
      { propertyName },
    )

    expect(result.html).toContain(
      `${propertyName} &middot; ${address}, ${city}, ${state}, ${zipCode} &middot; <a href="{{unsubscribe_url}}" target="_blank" style="color:#888888;">Unsubscribe</a>`,
    )
  })

  it('adds the email footer to complete HTML document templates', () => {
    const propertyName = 'Pine Ridge Campground'
    const propertyAddress = '123 Camp Road, Lakeview, TX 75001'

    const result = renderWithContext(
      'Document template',
      '<!DOCTYPE html><html><body><p>Body content</p></body></html>',
      {
        property: {
          name: propertyName,
          address: propertyAddress,
        },
      },
      { propertyName },
    )

    expect(result.html).toContain(
      `${propertyName} &middot; ${propertyAddress} &middot; <a href="{{unsubscribe_url}}" target="_blank" style="color:#888888;">Unsubscribe</a></div></body>`,
    )
  })
})

describe('renderWithSampleData', () => {
  it('renders the sample property footer in email template previews', () => {
    const result = renderWithSampleData('Preview', '<p>Sample body</p>')

    expect(result.html).toContain(
      'Pine Ridge Campground &middot; 123 Camp Road, Lakeview, TX 75001 &middot; <a href="{{unsubscribe_url}}" target="_blank" style="color:#888888;">Unsubscribe</a>',
    )
  })
})
