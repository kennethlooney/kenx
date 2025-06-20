const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * GitHub Wiki Synchronization Script (Node.js version)
 * Syncs local wiki markdown files to GitHub's wiki repository
 */

class GitHubWikiSync {
  constructor(config) {
    this.config = {
      githubUsername: config.githubUsername || 'yourusername',
      repoName: config.repoName || 'kenx',
      localWikiDir: config.localWikiDir || 'packages/website/wiki',
      tempDir: config.tempDir || 'temp-wiki-sync',
      ...config
    };
    
    this.wikiRepoUrl = `https://github.com/${this.config.githubUsername}/${this.config.repoName}.wiki.git`;
  }

  log(message, type = 'info') {
    const icons = { info: '📋', success: '✅', error: '❌', warning: '⚠️' };
    console.log(`${icons[type]} ${message}`);
  }

  async syncWiki() {
    try {
      this.log('Starting GitHub Wiki sync...', 'info');
      
      await this.cloneWikiRepo();
      await this.copyWikiFiles();
      await this.convertFileNames();
      await this.commitAndPush();
      await this.cleanup();
      
      this.log('GitHub Wiki sync completed!', 'success');
    } catch (error) {
      this.log(`Sync failed: ${error.message}`, 'error');
      await this.cleanup();
      process.exit(1);
    }
  }

  async cloneWikiRepo() {
    this.log('Cloning GitHub wiki repository...');
    
    // Clean up existing temp directory
    if (fs.existsSync(this.config.tempDir)) {
      fs.rmSync(this.config.tempDir, { recursive: true, force: true });
    }
    
    execSync(`git clone ${this.wikiRepoUrl} ${this.config.tempDir}`, { stdio: 'inherit' });
  }

  async copyWikiFiles() {
    this.log('Copying wiki files...');
    
    const copyRecursive = (src, dest) => {
      if (!fs.existsSync(src)) return;
      
      const stats = fs.statSync(src);
      if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }
        
        fs.readdirSync(src).forEach(file => {
          copyRecursive(path.join(src, file), path.join(dest, file));
        });
      } else if (path.extname(src) === '.md') {
        fs.copyFileSync(src, dest);
      }
    };
    
    copyRecursive(this.config.localWikiDir, this.config.tempDir);
  }

  async convertFileNames() {
    this.log('Converting file names for GitHub wiki...');
    
    const convertFileName = (filePath) => {
      // Convert paths like "getting-started/installation.md" to "Getting-Started-Installation.md"
      return filePath
        .replace(/\//g, '-')
        .replace(/-([a-z])/g, (match, letter) => `-${letter.toUpperCase()}`)
        .replace(/^([a-z])/, (match, letter) => letter.toUpperCase());
    };
    
    const processDirectory = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          processDirectory(fullPath);
          // Remove empty directories
          if (fs.readdirSync(fullPath).length === 0) {
            fs.rmSync(fullPath, { recursive: true });
          }
        } else if (entry.name.endsWith('.md')) {
          const relativePath = path.relative(this.config.tempDir, fullPath);
          
          if (relativePath === 'index.md') {
            // Rename index.md to Home.md (GitHub wiki homepage)
            const newPath = path.join(dir, 'Home.md');
            fs.renameSync(fullPath, newPath);
            this.log(`  Renamed: ${relativePath} -> Home.md`);
          } else if (relativePath.includes('/')) {
            // Convert nested files to flat structure
            const newName = convertFileName(relativePath);
            const newPath = path.join(this.config.tempDir, newName);
            fs.renameSync(fullPath, newPath);
            this.log(`  Renamed: ${relativePath} -> ${newName}`);
          }
        }
      }
    };
    
    processDirectory(this.config.tempDir);
  }

  async commitAndPush() {
    this.log('Committing changes to GitHub wiki...');
    
    const originalCwd = process.cwd();
    process.chdir(this.config.tempDir);
    
    try {
      execSync('git add .', { stdio: 'inherit' });
      execSync('git config user.name "Wiki Sync Bot"', { stdio: 'inherit' });
      execSync('git config user.email "wiki-sync@kenx-framework.com"', { stdio: 'inherit' });
      
      // Check if there are changes to commit
      try {
        execSync('git diff --staged --quiet');
        this.log('No changes to sync', 'info');
      } catch {
        const commitMessage = `Auto-sync wiki from main repository - ${new Date().toISOString()}`;
        execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
        execSync('git push origin master', { stdio: 'inherit' });
        this.log('Wiki synced successfully!', 'success');
      }
    } finally {
      process.chdir(originalCwd);
    }
  }

  async cleanup() {
    if (fs.existsSync(this.config.tempDir)) {
      fs.rmSync(this.config.tempDir, { recursive: true, force: true });
    }
  }
}

// CLI usage
if (require.main === module) {
  const config = {
    githubUsername: process.env.GITHUB_USERNAME || 'yourusername',
    repoName: process.env.REPO_NAME || 'kenx',
    localWikiDir: process.env.LOCAL_WIKI_DIR || 'packages/website/wiki'
  };
  
  const sync = new GitHubWikiSync(config);
  sync.syncWiki();
}

module.exports = GitHubWikiSync;
