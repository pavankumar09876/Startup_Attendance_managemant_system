import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock jspdf and html2canvas
vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    addImage: vi.fn(),
    addPage:  vi.fn(),
    save:     vi.fn(),
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
  })),
}))

vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({
    width:         800,
    height:        600,
    toDataURL:     () => 'data:image/png;base64,abc',
  }),
}))

import { exportElementAsPdf } from '@/utils/exportPdf'

describe('exportElementAsPdf', () => {
  it('calls html2canvas and jsPDF.save', async () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    await exportElementAsPdf(el, 'test.pdf')
    const { default: jsPDF } = await import('jspdf')
    const instance = vi.mocked(jsPDF).mock.results[0].value
    expect(instance.addImage).toHaveBeenCalled()
    expect(instance.save).toHaveBeenCalledWith('test.pdf')
    document.body.removeChild(el)
  })
})
