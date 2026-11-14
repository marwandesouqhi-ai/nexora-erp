from pathlib import Path
p = Path('src/services/whatsappService.js')
text = p.read_text('utf-8')
needle = "throw new Error(error?.message || '❌ خطأ غير معروف في checkWhatsappConnection');"
idx = text.find(needle)
print('index', idx)
print(repr(text[idx-100:idx+100]))
