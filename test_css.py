import re

def remove_css_comments(text):
    # Simpler regex for testing
    # Find all /* ... */ and remove them, except if in strings
    pattern = r'("(?:\\.|[^"])*"|\'(?:\\.|[^\'])*\'|url\([^)]*\))|(/\*[\s\S]*?\*/)'
    def replacer(match):
        print(f"Match: {match.group(0)[:20]}...")
        if match.group(1):
            print("  Type: String")
            return match.group(1)
        print("  Type: Comment")
        return ""
    return re.sub(pattern, replacer, text)

with open('src/styles.css', 'r') as f:
    c = f.read()

new_c = remove_css_comments(c)

with open('src/styles.css', 'w') as f:
    f.write(new_c)
