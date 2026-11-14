/**
 * Browser Patch for CSS Parsing and SVG getComputedStyle issues.
 *
 * 1. Resolves `letter-spacing: undefined` and `font-size: undefined` errors:
 *    - In Firefox and some engines, `window.getComputedStyle(svgTextElement).letterSpacing`
 *      returns `undefined`. Libraries like Recharts cache this value and pass
 *      `{ fontSize: undefined, letterSpacing: undefined }` to measurement spans.
 *    - Setting `undefined` on `CSSStyleDeclaration` coerces to string `'undefined'`,
 *      causing browsers to drop the declaration and flood the console with parser errors.
 * 
 * 2. Provides safe fallbacks for SVG computed styles and sanitizes CSS property assignments.
 */

if (typeof window !== 'undefined') {
  // A. Patch getComputedStyle for SVG text / Recharts ticks
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = function (elt, pseudoElt) {
    const style = originalGetComputedStyle.call(window, elt, pseudoElt);
    if (!style) return style;

    const ls = style.letterSpacing;
    const fs = style.fontSize;
    if (ls === undefined || ls === 'undefined' || fs === undefined || fs === 'undefined') {
      return new Proxy(style, {
        get(target, prop) {
          if (prop === 'letterSpacing') {
            const val = target.letterSpacing;
            return (val === undefined || val === 'undefined') ? 'normal' : val;
          }
          if (prop === 'fontSize') {
            const val = target.fontSize;
            return (val === undefined || val === 'undefined') ? '12px' : val;
          }
          const val = target[prop];
          return typeof val === 'function' ? val.bind(target) : val;
        }
      });
    }

    return style;
  };

  // B. Patch CSSStyleDeclaration.prototype.setProperty to drop 'undefined' values safely
  if (typeof CSSStyleDeclaration !== 'undefined' && CSSStyleDeclaration.prototype) {
    const proto = CSSStyleDeclaration.prototype;
    const originalSetProperty = proto.setProperty;

    proto.setProperty = function (property, value, priority) {
      if (value === undefined || value === 'undefined') {
        return;
      }
      return originalSetProperty.call(this, property, value, priority);
    };

    // Also guard direct property setters for fontSize and letterSpacing
    ['fontSize', 'letterSpacing'].forEach((prop) => {
      try {
        const desc = Object.getOwnPropertyDescriptor(proto, prop);
        if (desc && desc.set) {
          const originalSet = desc.set;
          Object.defineProperty(proto, prop, {
            ...desc,
            set(val) {
              if (val === undefined || val === 'undefined') {
                return;
              }
              originalSet.call(this, val);
            }
          });
        }
      } catch {
        // Ignore descriptor configuration errors if browser restricts it
      }
    });
  }
}
