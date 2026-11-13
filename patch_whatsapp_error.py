from pathlib import Path

file_path = Path('src/services/whatsappService.js')
text = file_path.read_text(encoding='utf-8')
old = """        console.error('❌ خطأ في التحقق:', error);
        throw new Error(error?.message || '❌ خطأ غير معروف في checkWhatsappConnection');
    }
};
"""
new = """        console.error('❌ خطأ في التحقق:', error);
        const details = error?.details;
        const code = error?.code;
        const message = details
            ? (typeof details === 'string' ? details : JSON.stringify(details))
            : error?.message || code || '❌ خطأ غير معروف في checkWhatsappConnection';
        throw new Error(message);
    }
};
"""
if old not in text:
    raise SystemExit('NO MATCH')
file_path.write_text(text.replace(old, new), encoding='utf-8')
print('patched')
