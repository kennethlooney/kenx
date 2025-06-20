# GitHub Wiki Integration Guide

This guide explains how to integrate our local wiki with GitHub's wiki system, providing multiple synchronization options.

## 🎯 Integration Options

### Option 1: Automated Sync (Recommended)
- **GitHub Actions workflow** automatically syncs wiki on every push
- **Zero maintenance** once set up
- **Real-time sync** when wiki files change

### Option 2: Manual Sync
- **On-demand synchronization** using npm scripts
- **Full control** over when to sync
- **Good for testing** and development

### Option 3: Hybrid Approach
- **Automatic sync** for main branches
- **Manual sync** for development and testing

## 🚀 Setup Instructions

### 1. Enable GitHub Wiki
1. Go to your repository on GitHub
2. Click **Settings** tab
3. Scroll down to **Features** section
4. Check ✅ **Wikis**

### 2. Initialize GitHub Wiki
1. Go to **Wiki** tab in your repository
2. Click **Create the first page**
3. Create a simple homepage (this will be replaced by our sync)
4. Save the page

### 3. Configure Repository Settings

Add these environment variables to your repository settings:

```bash
# Optional: Custom configuration
GITHUB_USERNAME=yourusername
REPO_NAME=kenx
LOCAL_WIKI_DIR=packages/website/wiki
```

### 4. Set Up Automatic Sync

The GitHub Actions workflow is already configured and will:
- ✅ Trigger on pushes to main/master branch
- ✅ Only sync when wiki files change
- ✅ Convert file structure to GitHub wiki format
- ✅ Create navigation sidebar
- ✅ Generate sync summary

## 📁 File Structure Conversion

Our local wiki structure:
```
packages/website/wiki/
├── index.md                    → Home.md
├── getting-started/
│   ├── installation.md         → Getting-Started-Installation.md
│   └── first-app.md           → Getting-Started-First-App.md
├── api/
│   ├── routing.md             → Api-Routing.md
│   └── database.md            → Api-Database.md
└── examples/
    └── fullstack-app.md       → Examples-Fullstack-App.md
```

GitHub wiki naming convention:
- Flat file structure (no subdirectories)
- PascalCase naming with hyphens
- `index.md` becomes `Home.md`

## 🛠️ Manual Sync Commands

```bash
# Node.js script (cross-platform)
npm run wiki:sync

# Bash script (Linux/macOS/WSL)
npm run wiki:sync:manual

# With custom configuration
GITHUB_USERNAME=myusername REPO_NAME=myrepo npm run wiki:sync
```

## 🔧 Customization

### Custom Sync Configuration

Create a `.wiki-sync.json` file:

```json
{
  "githubUsername": "yourusername",
  "repoName": "kenx",
  "localWikiDir": "packages/website/wiki",
  "excludeFiles": ["draft-*.md", "private-*.md"],
  "includeSubdirs": true,
  "autoCreateSidebar": true
}
```

### Custom Sidebar

The sync automatically creates a `_Sidebar.md` file for navigation. You can customize it by editing the GitHub Actions workflow or creating a template file.

## 📝 Wiki Workflow

### 1. Development Workflow
```bash
# 1. Edit wiki files locally
vi packages/website/wiki/api/routing.md

# 2. Test locally
npm run start:website
# Visit http://localhost:3000/wiki

# 3. Commit changes
git add packages/website/wiki/
git commit -m "docs: update routing documentation"

# 4. Push to trigger auto-sync
git push origin main
```

### 2. Collaboration Workflow

**For Maintainers:**
- Edit wiki files in the main repository
- Changes auto-sync to GitHub wiki
- Use pull requests for major changes

**For Contributors:**
- Can edit either local files OR GitHub wiki
- Local changes take precedence (will overwrite GitHub wiki)
- Suggest creating issues for wiki improvements

## 🔗 GitHub Wiki Features

Once synced, your GitHub wiki provides:

- **Rich Navigation** - Automatic sidebar with links
- **Search Functionality** - GitHub's built-in wiki search
- **Edit Links** - Easy editing directly on GitHub
- **Version History** - Full git history of changes
- **Cross-References** - Links between wiki pages
- **Integration** - Links from issues, PRs, and code

## 📊 Sync Monitoring

### GitHub Actions Dashboard
- View sync status in **Actions** tab
- See detailed logs and any errors
- Monitor sync frequency and success rate

### Sync Summary
Each sync generates a summary with:
- List of updated files
- Links to wiki pages
- Commit information
- Timestamp

## 🔍 Troubleshooting

### Common Issues

**1. Permission Denied**
```bash
# Solution: Check repository permissions
# Ensure GitHub Actions has write access to wiki
```

**2. Merge Conflicts**
```bash
# Solution: Manual resolution
git clone https://github.com/username/repo.wiki.git
# Resolve conflicts manually
```

**3. Missing Files**
```bash
# Solution: Check file paths and naming
# Ensure files are in the correct directory
```

### Debug Mode

Enable debug logging:
```bash
DEBUG=true npm run wiki:sync
```

## 🚀 Advanced Features

### Conditional Sync
Sync only specific sections:
```bash
# Sync only API documentation
SYNC_PATTERN="api/*" npm run wiki:sync
```

### Branch-Specific Sync
Different wikis for different branches:
```yaml
# In GitHub Actions
if: github.ref == 'refs/heads/develop'
run: |
  # Sync to development wiki
```

### Webhook Integration
Set up webhooks for real-time sync:
```javascript
// Express webhook endpoint
app.post('/webhook/wiki-sync', (req, res) => {
  // Trigger sync on external changes
});
```

## 📈 Benefits

✅ **Centralized Documentation** - Single source of truth  
✅ **GitHub Integration** - Native GitHub features  
✅ **Automatic Updates** - No manual maintenance  
✅ **Version Control** - Full history tracking  
✅ **Collaboration** - Easy editing for contributors  
✅ **Search & Discovery** - GitHub's search capabilities  
✅ **Professional Appearance** - Clean, organized documentation  

## 🎯 Next Steps

1. **Set up the sync** using the provided scripts
2. **Test the workflow** with a small change
3. **Customize the sidebar** and navigation
4. **Train your team** on the new workflow
5. **Monitor and optimize** sync performance

Your documentation will now be available in two places:
- **Local Development**: `http://localhost:3000/wiki`
- **GitHub Wiki**: `https://github.com/username/repo/wiki`

Both stay perfectly in sync! 🎉
