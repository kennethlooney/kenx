#!/bin/bash

# GitHub Wiki Sync Script
# This script syncs our local wiki to GitHub's wiki repository

set -e

# Configuration
GITHUB_USERNAME="yourusername"
REPO_NAME="kenx"
WIKI_REPO_URL="https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.wiki.git"
LOCAL_WIKI_DIR="packages/website/wiki"
TEMP_WIKI_DIR="temp-wiki-sync"

echo "🚀 Starting GitHub Wiki sync..."

# Clone the GitHub wiki repository
if [ -d "$TEMP_WIKI_DIR" ]; then
    echo "📁 Cleaning up existing temp directory..."
    rm -rf "$TEMP_WIKI_DIR"
fi

echo "📥 Cloning GitHub wiki repository..."
git clone "$WIKI_REPO_URL" "$TEMP_WIKI_DIR"

# Copy our wiki files to the GitHub wiki
echo "📋 Copying wiki files..."
cp -r "$LOCAL_WIKI_DIR"/* "$TEMP_WIKI_DIR"/

# Navigate to wiki directory
cd "$TEMP_WIKI_DIR"

# Rename files to match GitHub wiki conventions
echo "🔄 Converting file names for GitHub wiki..."

# Convert directory structure to GitHub wiki naming convention
find . -name "*.md" -type f | while read -r file; do
    # Convert paths like "getting-started/installation.md" to "Getting-Started-Installation.md"
    if [[ "$file" != "./Home.md" && "$file" != "./index.md" ]]; then
        new_name=$(echo "$file" | sed 's|^\./||' | sed 's|/|-|g' | sed 's|-\([a-z]\)|-\U\1|g' | sed 's|^\([a-z]\)|\U\1|')
        if [[ "$file" != "./$new_name" ]]; then
            mv "$file" "$new_name"
            echo "  Renamed: $file -> $new_name"
        fi
    fi
done

# Rename index.md to Home.md (GitHub wiki homepage)
if [ -f "index.md" ]; then
    mv "index.md" "Home.md"
    echo "  Renamed: index.md -> Home.md"
fi

# Add and commit changes
echo "📝 Committing changes to GitHub wiki..."
git add .
git config user.name "Wiki Sync Bot"
git config user.email "wiki-sync@kenx-framework.com"

if git diff --staged --quiet; then
    echo "✅ No changes to sync"
else
    git commit -m "Auto-sync wiki from main repository - $(date '+%Y-%m-%d %H:%M:%S')"
    git push origin master
    echo "✅ Wiki synced successfully!"
fi

# Clean up
cd ..
rm -rf "$TEMP_WIKI_DIR"

echo "🎉 GitHub Wiki sync completed!"
