'use client'
import { useState, useEffect } from 'react'
import '@excalidraw/excalidraw/index.css'

if (typeof window !== 'undefined') {
  window.EXCALIDRAW_ASSET_PATH = "https://unpkg.com/@excalidraw/excalidraw/dist/"
  
  if (!window._workerPatched) {
    window._workerPatched = true;
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url, options) {
        const urlStr = url instanceof URL ? url.href : String(url);
        if (urlStr.includes('excalidraw') && urlStr.includes('file://')) {
          super(URL.createObjectURL(new Blob([''], { type: 'application/javascript' })), options);
        } else {
          super(url, options);
        }
      }
    };

    const originalConsoleError = console.error;
    console.error = (...args) => {
      const msg = args.map(a => (a instanceof Error ? a.message : (typeof a === 'string' ? a : ''))).join(' ');
      if (msg.includes('Active worker did not respond')) {
        return;
      }
      originalConsoleError.apply(console, args);
    };
  }
}

export default function SvgRenderer({ canvasJson }) {
  const [svgMarkup, setSvgMarkup] = useState(null)

  useEffect(() => {
    if (canvasJson) {
      import('@excalidraw/excalidraw').then(mod => {
        const elements = typeof canvasJson === 'string' ? JSON.parse(canvasJson) : canvasJson;
        const activeElements = elements.filter(el => !el.isDeleted);
        if (activeElements && activeElements.length > 0) {
          try {
            mod.exportToSvg({
              elements: activeElements,
              appState: {
                exportBackground: true,
                viewBackgroundColor: '#ffffff',
                exportWithDarkMode: false,
                exportScale: 1
              },
              files: null
            }).then(svg => {
              svg.removeAttribute('width')
              svg.removeAttribute('height')
              svg.style.width = '100%'
              svg.style.height = '100%'
              setSvgMarkup(svg.outerHTML)
            }).catch(err => {
              console.error("Error generating SVG:", err)
              setSvgMarkup('<svg></svg>')
            })
          } catch (err) {
            console.error("Synchronous error generating SVG:", err)
            setSvgMarkup('<svg></svg>')
          }
        } else {
          setSvgMarkup('<svg></svg>')
        }
      }).catch(err => {
        console.error("Error importing excalidraw:", err)
        setSvgMarkup('<svg></svg>')
      })
    } else {
      setSvgMarkup('<svg></svg>')
    }
  }, [canvasJson])

  if (svgMarkup) {
    if (svgMarkup === '<svg></svg>') {
      return <div style={{ color: '#a0a0a0' }}>No canvas data found</div>
    }
    return <div dangerouslySetInnerHTML={{ __html: svgMarkup }} style={{ width: '100%', height: '100%', padding: '20px', boxSizing: 'border-box' }} />
  }

  return <div style={{ color: '#a0a0a0' }}>Rendering Diagram...</div>
}
