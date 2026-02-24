import re
import os

def remove_js_comments(text):
    pattern = r'("(?:\\.|[^"])*"|\'(?:\\.|[^\'])*\'|`(?:\\.|[^`])*`)|(/\*[\s\S]*?\*/)|(?<![:"\'/])//.*'
    def replacer(match):
        if match.group(1): return match.group(1)
        return ""
    return re.sub(pattern, replacer, text)

def remove_css_comments(text):
    pattern = r'("(?:\\.|[^"])*"|\'(?:\\.|[^\'])*\'|url\([^)]*\))|(/\*[\s\S]*?\*/)'
    def replacer(match):
        if match.group(1): return match.group(1)
        return ""
    return re.sub(pattern, replacer, text)

def remove_comments(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.html':
        content = re.sub(r'<!--[\s\S]*?-->', '', content)
        content = re.sub(r'(<script\b[^>]*>)([\s\S]*?)(</script>)', lambda m: m.group(1) + remove_js_comments(m.group(2)) + m.group(3), content)
        content = re.sub(r'(<style\b[^>]*>)([\s\S]*?)(</style>)', lambda m: m.group(1) + remove_css_comments(m.group(2)) + m.group(3), content)
    elif ext == '.js':
        content = remove_js_comments(content)
    elif ext == '.css':
        content = remove_css_comments(content)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

files = [
    'AI/chat.html', 'AI/debug_test.html', 'AI/editor.html', 'AI/manage.html',
    'AI/privacy.html', 'AI/research.html', 'AI/thing.css', 'AI/tos.html',
    'AI/updatenotes.js', 'AI/version.html', 'Themes/Themes.html', 'Themes/view.js',
    'index.html', 'okemoai.html', 'src/Tiltcards.js', 'src/bleh.js', 'src/blur.js',
    'src/carfacts.js', 'src/confetti.js', 'src/input.css', 'src/openanimation.js',
    'src/output.css', 'src/sticky.js', 'src/styles.css', 'tailwind.config.js', 'whitename.html'
]

base_dir = '/Users/ar12c/Desktop/ar12c.github.io-1'
for f in files:
    full_path = os.path.join(base_dir, f)
    if os.path.exists(full_path):
        remove_comments(full_path)
