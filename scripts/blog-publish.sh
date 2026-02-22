#!/bin/bash
# Usage: ./scripts/blog-publish.sh content/blog/my-post.md
# Validates frontmatter, generates hero image, git commits and pushes.
set -e

MD_FILE="$1"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_BLOG_DIR="$REPO_DIR/public/blog"
API_KEY="${GEMINI_API_KEY:-AIzaSyCeGB3mg04v1QDWDtNsblyvLxPg_8d0QYs}"

# DebateAI brand image style suffix
# Warm terracotta/rust palette, clean editorial illustration
IMAGE_STYLE="Clean minimalist editorial illustration. Warm muted color palette: terracotta (#b54d30), cream (#fdf8f6), warm gray (#57534e), with subtle rust and sand accents. Geometric abstract shapes, clean lines, professional blog hero image. No text, no words, no letters. Aspect ratio 2:1, centered composition."

# --- Validation ---

if [ -z "$MD_FILE" ]; then
  echo "ERROR: No markdown file specified." >&2
  echo "Usage: $0 content/blog/my-post.md" >&2
  exit 1
fi

# Resolve to absolute path if relative
if [[ "$MD_FILE" != /* ]]; then
  MD_FILE="$REPO_DIR/$MD_FILE"
fi

if [ ! -f "$MD_FILE" ]; then
  echo "ERROR: File not found: $MD_FILE" >&2
  exit 1
fi

# Extract slug from filename
SLUG=$(basename "$MD_FILE" .md)

if [ "$SLUG" = "_template" ]; then
  echo "ERROR: Cannot publish the template file." >&2
  exit 1
fi

echo "=== Blog Publish: $SLUG ==="

# --- Frontmatter Validation ---
echo "[1/5] Validating frontmatter..."

# Extract frontmatter using python (between first pair of ---)
FRONTMATTER=$(python3 -c "
import sys
content = open('$MD_FILE', 'r').read()
if not content.startswith('---'):
    print('ERROR: No frontmatter found', file=sys.stderr)
    sys.exit(1)
end = content.index('---', 3)
fm = content[3:end]
print(fm)
")

# Check required fields
REQUIRED_FIELDS=("title" "description" "date" "author" "tags" "published")
for field in "${REQUIRED_FIELDS[@]}"; do
  if ! echo "$FRONTMATTER" | grep -q "^${field}:"; then
    echo "ERROR: Missing required frontmatter field: $field" >&2
    exit 1
  fi
done

# Check published is true
if echo "$FRONTMATTER" | grep -q "published: false"; then
  echo "ERROR: Post has published: false. Set to true before publishing." >&2
  exit 1
fi

# Extract title and description for image prompt
# Use grep on the already-extracted FRONTMATTER (simple, no PyYAML needed)
TITLE=$(echo "$FRONTMATTER" | grep "^title:" | head -1 | sed 's/^title:\s*//' | sed "s/^['\"]//;s/['\"]$//")
# Description may be multi-line (>- syntax), grab the first line of it
DESC_LINE=$(echo "$FRONTMATTER" | grep "^description:" | head -1 | sed 's/^description:\s*//')
if [ "$DESC_LINE" = ">-" ] || [ "$DESC_LINE" = ">" ]; then
  # Multi-line: grab indented lines after description:
  DESCRIPTION=$(echo "$FRONTMATTER" | sed -n '/^description:/,/^[a-z]/p' | tail -n +2 | grep "^  " | sed 's/^  //' | tr '\n' ' ' | sed 's/  */ /g;s/ $//')
else
  DESCRIPTION=$(echo "$DESC_LINE" | sed "s/^['\"]//;s/['\"]$//")
fi

echo "  Title: $TITLE"
echo "  OK: All required fields present."

# --- Image Generation ---
IMAGE_PATH="$PUBLIC_BLOG_DIR/$SLUG.png"

if [ -f "$IMAGE_PATH" ]; then
  echo "[2/5] Hero image already exists, skipping generation."
else
  echo "[2/5] Generating hero image..."
  mkdir -p "$PUBLIC_BLOG_DIR"

  # Build image prompt from title + description + brand style
  IMAGE_PROMPT="Blog hero image for an article titled '$TITLE'. $DESCRIPTION. $IMAGE_STYLE"

  # Escape prompt for JSON
  JSON_PROMPT=$(python3 -c "import json,sys; print(json.dumps(sys.stdin.read().strip()))" <<< "$IMAGE_PROMPT")

  RESPONSE=$(curl -s --max-time 90 \
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=$API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"contents\": [{
        \"parts\": [{\"text\": $JSON_PROMPT}]
      }],
      \"generationConfig\": {
        \"responseModalities\": [\"image\", \"text\"]
      }
    }")

  # Extract base64 image data and decode to PNG
  echo "$RESPONSE" | python3 -c "
import json, sys, base64
data = json.load(sys.stdin)
candidates = data.get('candidates', [])
if not candidates:
    error = data.get('error', {})
    print(f'ERROR: {error.get(\"message\", \"No candidates in response\")}', file=sys.stderr)
    sys.exit(1)
for part in candidates[0].get('content', {}).get('parts', []):
    if 'inlineData' in part:
        img = base64.b64decode(part['inlineData']['data'])
        with open('$IMAGE_PATH', 'wb') as f:
            f.write(img)
        print(f'  OK: $SLUG.png ({len(img)} bytes)')
        sys.exit(0)
print('ERROR: No image data in response', file=sys.stderr)
sys.exit(1)
"
fi

# --- Image Compression ---
echo "[3/5] Compressing image..."
sips --resampleWidth 1200 "$IMAGE_PATH" >/dev/null 2>&1
echo "  OK: Resized to 1200px wide."

# --- Ensure frontmatter has image field ---
echo "[4/5] Checking image field in frontmatter..."
if ! echo "$FRONTMATTER" | grep -q "^image:"; then
  # Add image: field after published: line
  python3 -c "
import sys
content = open('$MD_FILE', 'r').read()
# Insert image field after 'published: true' line
content = content.replace('published: true\n', 'published: true\nimage: /blog/$SLUG.png\n', 1)
with open('$MD_FILE', 'w') as f:
    f.write(content)
print('  Added image: /blog/$SLUG.png')
"
else
  echo "  OK: image field already present."
fi

# --- Git ---
echo "[5/5] Committing and pushing..."
cd "$REPO_DIR"
git add "$MD_FILE" "$IMAGE_PATH"
git commit -m "content: add blog post — $TITLE"
git push origin HEAD

echo ""
echo "=== Published: $SLUG ==="
echo "  Post: content/blog/$SLUG.md"
echo "  Image: public/blog/$SLUG.png"
echo "  Coolify should auto-deploy from the push."
