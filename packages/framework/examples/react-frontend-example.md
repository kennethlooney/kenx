# React Frontend Example for Kenx API

This is a complete React example showing how to build a frontend that connects to a Kenx API backend running on a separate server.

## Project Structure

```
my-react-kenx-app/
├── package.json
├── src/
│   ├── App.js
│   ├── index.js
│   ├── api/
│   │   └── kenxClient.js
│   ├── components/
│   │   ├── Login.js
│   │   ├── Posts.js
│   │   └── CreatePost.js
│   └── hooks/
│       └── useAuth.js
└── public/
    └── index.html
```

## Setup

```bash
npx create-react-app my-kenx-frontend
cd my-kenx-frontend
npm install
```

## 1. Kenx Client (src/api/kenxClient.js)

```javascript
class KenxClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('kenx_token');
  }
  
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        headers
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }
  
  setToken(token) {
    this.token = token;
    localStorage.setItem('kenx_token', token);
  }
  
  clearToken() {
    this.token = null;
    localStorage.removeItem('kenx_token');
  }
  
  isAuthenticated() {
    return !!this.token;
  }
  
  // Auth methods
  async login(credentials) {
    const response = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    
    if (response.success && response.data.token) {
      this.setToken(response.data.token);
    }
    
    return response;
  }
  
  async register(userData) {
    const response = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    
    if (response.success && response.data.token) {
      this.setToken(response.data.token);
    }
    
    return response;
  }
  
  async getProfile() {
    return this.request('/api/auth/profile');
  }
  
  logout() {
    this.clearToken();
  }
  
  // Posts methods
  async getPosts(page = 1, limit = 10) {
    return this.request(`/api/posts?page=${page}&limit=${limit}`);
  }
  
  async createPost(postData) {
    return this.request('/api/posts', {
      method: 'POST',
      body: JSON.stringify(postData)
    });
  }
  
  async getPost(id) {
    return this.request(`/api/posts/${id}`);
  }
}

// Export singleton instance
const kenxClient = new KenxClient(
  process.env.REACT_APP_API_URL || 'http://localhost:4000'
);

export default kenxClient;
```

## 2. Auth Hook (src/hooks/useAuth.js)

```javascript
import { useState, useEffect, createContext, useContext } from 'react';
import kenxClient from '../api/kenxClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Check if user is already logged in
    if (kenxClient.isAuthenticated()) {
      kenxClient.getProfile()
        .then(response => {
          if (response.success) {
            setUser(response.data);
          } else {
            kenxClient.clearToken();
          }
        })
        .catch(() => {
          kenxClient.clearToken();
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);
  
  const login = async (credentials) => {
    try {
      const response = await kenxClient.login(credentials);
      if (response.success) {
        setUser(response.data.user);
        return { success: true };
      }
      return { success: false, message: response.message };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };
  
  const register = async (userData) => {
    try {
      const response = await kenxClient.register(userData);
      if (response.success) {
        setUser(response.data.user);
        return { success: true };
      }
      return { success: false, message: response.message };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };
  
  const logout = () => {
    kenxClient.logout();
    setUser(null);
  };
  
  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

## 3. Login Component (src/components/Login.js)

```javascript
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, register } = useAuth();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const result = isLogin 
        ? await login({ username: formData.username, password: formData.password })
        : await register(formData);
      
      if (!result.success) {
        setError(result.message);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };
  
  return (
    <div className="auth-container">
      <form onSubmit={handleSubmit} className="auth-form">
        <h2>{isLogin ? 'Login' : 'Register'}</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="form-group">
          <label>Username/Email:</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
          />
        </div>
        
        {!isLogin && (
          <div className="form-group">
            <label>Email:</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
        )}
        
        <div className="form-group">
          <label>Password:</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : (isLogin ? 'Login' : 'Register')}
        </button>
        
        <p>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            type="button" 
            onClick={() => setIsLogin(!isLogin)}
            className="link-button"
          >
            {isLogin ? 'Register' : 'Login'}
          </button>
        </p>
      </form>
    </div>
  );
}

export default Login;
```

## 4. Posts Component (src/components/Posts.js)

```javascript
import { useState, useEffect } from 'react';
import kenxClient from '../api/kenxClient';

function Posts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  useEffect(() => {
    loadPosts();
  }, [currentPage]);
  
  const loadPosts = async () => {
    try {
      setLoading(true);
      const response = await kenxClient.getPosts(currentPage, 5);
      
      if (response.success) {
        setPosts(response.data);
        setTotalPages(response.pagination.totalPages);
      } else {
        setError('Failed to load posts');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return <div className="loading">Loading posts...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  
  return (
    <div className="posts-container">
      <h2>Posts</h2>
      
      <div className="posts-grid">
        {posts.map(post => (
          <div key={post.id} className="post-card">
            <h3>{post.title}</h3>
            <p>{post.content}</p>
            <div className="post-meta">
              <small>Created: {new Date(post.createdAt).toLocaleDateString()}</small>
              {post.tags.length > 0 && (
                <div className="post-tags">
                  {post.tags.map(tag => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default Posts;
```

## 5. Create Post Component (src/components/CreatePost.js)

```javascript
import { useState } from 'react';
import kenxClient from '../api/kenxClient';

function CreatePost({ onPostCreated }) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: '',
    published: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const postData = {
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      };
      
      const response = await kenxClient.createPost(postData);
      
      if (response.success) {
        setFormData({ title: '', content: '', tags: '', published: true });
        onPostCreated && onPostCreated(response.data);
        alert('Post created successfully!');
      } else {
        setError(response.message);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };
  
  return (
    <div className="create-post-container">
      <h2>Create New Post</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleSubmit} className="create-post-form">
        <div className="form-group">
          <label>Title:</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Content:</label>
          <textarea
            name="content"
            value={formData.content}
            onChange={handleChange}
            rows="6"
            required
          />
        </div>
        
        <div className="form-group">
          <label>Tags (comma-separated):</label>
          <input
            type="text"
            name="tags"
            value={formData.tags}
            onChange={handleChange}
            placeholder="react, api, frontend"
          />
        </div>
        
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              name="published"
              checked={formData.published}
              onChange={handleChange}
            />
            Published
          </label>
        </div>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Post'}
        </button>
      </form>
    </div>
  );
}

export default CreatePost;
```

## 6. Main App Component (src/App.js)

```javascript
import { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Login from './components/Login';
import Posts from './components/Posts';
import CreatePost from './components/CreatePost';
import './App.css';

function AppContent() {
  const { user, logout, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('posts');
  
  if (loading) {
    return <div className="loading">Loading...</div>;
  }
  
  if (!user) {
    return <Login />;
  }
  
  return (
    <div className="app">
      <header className="app-header">
        <h1>My Kenx React App</h1>
        <nav>
          <button 
            onClick={() => setActiveTab('posts')}
            className={activeTab === 'posts' ? 'active' : ''}
          >
            Posts
          </button>
          <button 
            onClick={() => setActiveTab('create')}
            className={activeTab === 'create' ? 'active' : ''}
          >
            Create Post
          </button>
          <span className="user-info">
            Welcome, {user.username}!
            <button onClick={logout} className="logout-btn">Logout</button>
          </span>
        </nav>
      </header>
      
      <main className="app-main">
        {activeTab === 'posts' && <Posts />}
        {activeTab === 'create' && <CreatePost onPostCreated={() => setActiveTab('posts')} />}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
```

## 7. Styles (src/App.css)

```css
.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

.app-header {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.app-header h1 {
  margin: 0 0 15px 0;
  color: #333;
}

.app-header nav {
  display: flex;
  align-items: center;
  gap: 15px;
}

.app-header nav button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

.app-header nav button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.user-info {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}

.logout-btn {
  padding: 6px 12px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.auth-container {
  max-width: 400px;
  margin: 0 auto;
  padding: 40px 20px;
}

.auth-form {
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 600;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #007bff;
}

.posts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.post-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.post-card h3 {
  margin: 0 0 10px 0;
  color: #333;
}

.post-card p {
  color: #666;
  line-height: 1.6;
  margin-bottom: 15px;
}

.post-meta {
  font-size: 12px;
  color: #999;
}

.post-tags {
  margin-top: 5px;
}

.tag {
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 3px;
  margin-right: 5px;
  font-size: 11px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  margin-top: 20px;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

.error {
  background: #f8d7da;
  color: #721c24;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 15px;
}

.link-button {
  background: none;
  border: none;
  color: #007bff;
  cursor: pointer;
  text-decoration: underline;
}
```

## 8. Environment Variables (.env)

```bash
REACT_APP_API_URL=http://localhost:4000
```

For production:
```bash
REACT_APP_API_URL=https://your-kenx-api-server.com
```

## 9. Package.json Dependencies

```json
{
  "name": "my-kenx-frontend",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "deploy": "npm run build && # deploy to Netlify/Vercel"
  }
}
```

## Deployment

### Frontend (React App)
```bash
# Build for production
npm run build

# Deploy to Netlify
npm install -g netlify-cli
netlify deploy --prod --dir=build

# Deploy to Vercel
npm install -g vercel
vercel --prod
```

### Backend (Kenx API)
```bash
# The Kenx API server runs separately
# Deploy to Railway, Render, or VPS
```

## Benefits

✅ **Separation of Concerns**: Frontend and backend are completely independent  
✅ **Scalability**: Each can be scaled and deployed separately  
✅ **Technology Flexibility**: Change frontend framework without affecting backend  
✅ **Cost Efficiency**: Frontend on free static hosting, backend on paid compute  
✅ **Performance**: Frontend served from CDN globally  
✅ **Team Independence**: Frontend and backend teams can work separately

This example demonstrates how Kenx enables modern, decoupled web application architecture! 🚀
