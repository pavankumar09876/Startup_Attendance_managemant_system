/**
 * Client-side PDF export using html2canvas + jsPDF.
 * Usage: exportElementAsPdf(document.getElementById('payslip'), 'payslip-jan-2025.pdf')
 */
export const exportElementAsPdf = async (
  element: HTMLElement,
  filename = 'document.pdf',
): Promise<void> => {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const canvas = await html2canvas(element, {
    scale:       2,          // 2× for retina quality
    useCORS:     true,
    logging:     false,
    backgroundColor: '#ffffff',
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf     = new jsPDF({
    orientation: 'portrait',
    unit:        'mm',
    format:      'a4',
  })

  const pageW  = pdf.internal.pageSize.getWidth()
  const pageH  = pdf.internal.pageSize.getHeight()
  const imgW   = pageW - 20   // 10mm margins
  const imgH   = (canvas.height / canvas.width) * imgW
  const x      = 10
  const y      = 10

  // If content is taller than one page, split across pages
  let heightLeft = imgH
  let position   = y

  pdf.addImage(imgData, 'PNG', x, position, imgW, imgH)
  heightLeft -= pageH - y

  while (heightLeft > 0) {
    position = heightLeft - imgH
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', x, position, imgW, imgH)
    heightLeft -= pageH
  }

  pdf.save(filename)
}

/** Convenience: export a React ref */
export const exportRefAsPdf = async (
  ref: React.RefObject<HTMLElement>,
  filename?: string,
) => {
  if (!ref.current) return
  await exportElementAsPdf(ref.current, filename)
}
