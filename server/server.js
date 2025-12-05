import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data', 'projects.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');

// Ensure data directory exists
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize data files if they don't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}
if (!fs.existsSync(USERS_FILE)) {
  // Create default admin user: admin@klaus.com / admin123
  const defaultUsers = [{
    id: '1',
    email: 'admin@klaus.com',
    passwordHash: bcrypt.hashSync('admin123', 10),
    name: 'Admin User',
    role: 'admin',
    createdAt: new Date().toISOString()
  }];
  fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
}
if (!fs.existsSync(SESSIONS_FILE)) {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify({}));
}

// Middleware
app.use(cors());
app.use(express.json());

// Simple session middleware
const getSession = (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  
  try {
    const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    return sessions[token] || null;
  } catch {
    return null;
  }
};

const requireAuth = (req, res, next) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = session;
  next();
};

const requireRole = (roles) => {
  return (req, res, next) => {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // Get user role from users file
    const user = getUserFromSession(session);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = { ...session, role: user.role };
    next();
  };
};

// Helper functions
const readProjects = () => {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading projects:', error);
    return [];
  }
};

const writeProjects = (projects) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing projects:', error);
    return false;
  }
};

const readUsers = () => {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users:', error);
    return [];
  }
};

const writeUsers = (users) => {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing users:', error);
    return false;
  }
};

const createSession = (userId) => {
  const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
  sessions[token] = { userId, createdAt: new Date().toISOString() };
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  return token;
};

const getUserFromSession = (session) => {
  if (!session) return null;
  const users = readUsers();
  const user = users.find(u => u.id === session.userId);
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  };
};

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  const users = readUsers();
  const user = users.find(u => u.email === email);
  
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = createSession(user.id);
  const userData = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  };
  
  res.json({ token, user: userData });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    delete sessions[token];
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  }
  res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const session = getSession(req);
  const user = getUserFromSession(session);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  res.json(user);
});

// User management endpoints (Admin only)
app.get('/api/users', requireRole(['admin']), (req, res) => {
  const users = readUsers();
  const usersWithoutPasswords = users.map(({ passwordHash, ...user }) => user);
  res.json(usersWithoutPasswords);
});

app.post('/api/users', requireRole(['admin']), async (req, res) => {
  const { email, password, name, role } = req.body;
  
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  if (!['admin', 'teamleader', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  
  const users = readUsers();
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'User already exists' });
  }
  
  const newUser = {
    id: Date.now().toString(),
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    name,
    role,
    createdAt: new Date().toISOString()
  };
  
  users.push(newUser);
  
  if (writeUsers(users)) {
    const { passwordHash, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } else {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/users/:id', requireRole(['admin']), async (req, res) => {
  const { email, password, name, role } = req.body;
  const users = readUsers();
  const index = users.findIndex(u => u.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  if (role && !['admin', 'teamleader', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  
  if (email) users[index].email = email;
  if (name) users[index].name = name;
  if (role) users[index].role = role;
  if (password) {
    users[index].passwordHash = bcrypt.hashSync(password, 10);
  }
  
  if (writeUsers(users)) {
    const { passwordHash, ...userWithoutPassword } = users[index];
    res.json(userWithoutPassword);
  } else {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/users/:id', requireRole(['admin']), (req, res) => {
  const users = readUsers();
  const filteredUsers = users.filter(u => u.id !== req.params.id);
  
  if (users.length === filteredUsers.length) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  if (writeUsers(filteredUsers)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Provision percentage management (Team Leader and Admin)
app.get('/api/settings/provision-percentages', requireAuth, (req, res) => {
  const settingsFile = path.join(__dirname, 'data', 'settings.json');
  let settings = {};
  
  if (fs.existsSync(settingsFile)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    } catch (error) {
      console.error('Error reading settings:', error);
    }
  }
  
  res.json({
    percentages: settings.provisionPercentages || [10, 15]
  });
});

app.post('/api/settings/provision-percentages', requireRole(['admin', 'teamleader']), (req, res) => {
  const { percentages } = req.body;
  
  if (!Array.isArray(percentages) || percentages.length === 0) {
    return res.status(400).json({ error: 'Percentages array is required' });
  }
  
  const settingsFile = path.join(__dirname, 'data', 'settings.json');
  let settings = {};
  
  if (fs.existsSync(settingsFile)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    } catch (error) {
      console.error('Error reading settings:', error);
    }
  }
  
  settings.provisionPercentages = percentages;
  
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    res.json({ success: true, percentages });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Get cost per MD setting
app.get('/api/settings/cost-per-md', requireAuth, (req, res) => {
  const settingsFile = path.join(__dirname, 'data', 'settings.json');
  let settings = {};
  
  if (fs.existsSync(settingsFile)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    } catch (error) {
      console.error('Error reading settings:', error);
    }
  }
  
  res.json({ costPerMD: settings.costPerMD || '5000' });
});

// Update cost per MD setting
app.post('/api/settings/cost-per-md', requireAuth, (req, res) => {
  const { costPerMD } = req.body;
  
  if (!costPerMD) {
    return res.status(400).json({ error: 'costPerMD is required' });
  }
  
  const settingsFile = path.join(__dirname, 'data', 'settings.json');
  let settings = {};
  
  if (fs.existsSync(settingsFile)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    } catch (error) {
      console.error('Error reading settings:', error);
    }
  }
  
  settings.costPerMD = costPerMD;
  
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    res.json({ success: true, costPerMD });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Get all projects (require auth)
app.get('/api/projects', requireAuth, (req, res) => {
  const projects = readProjects();
  res.json(projects);
});

// Get a single project by ID
app.get('/api/projects/:id', requireAuth, (req, res) => {
  const projects = readProjects();
  const project = projects.find(p => p.id === req.params.id);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  res.json(project);
});

// Create a new project
app.post('/api/projects', requireAuth, (req, res) => {
  const projects = readProjects();
  const newProject = {
    ...req.body,
    id: req.body.id || Date.now().toString(),
    createdAt: req.body.createdAt || new Date().toISOString(),
    createdBy: req.user.userId
  };
  
  projects.push(newProject);
  
  if (writeProjects(projects)) {
    res.status(201).json(newProject);
  } else {
    res.status(500).json({ error: 'Failed to save project' });
  }
});

// Update a project
app.put('/api/projects/:id', requireAuth, (req, res) => {
  const projects = readProjects();
  const index = projects.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  projects[index] = {
    ...projects[index],
    ...req.body,
    id: req.params.id, // Ensure ID doesn't change
  };
  
  if (writeProjects(projects)) {
    res.json(projects[index]);
  } else {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete a project
app.delete('/api/projects/:id', requireAuth, (req, res) => {
  const projects = readProjects();
  const filteredProjects = projects.filter(p => p.id !== req.params.id);
  
  if (projects.length === filteredProjects.length) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  if (writeProjects(filteredProjects)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`KLAUS server running on port ${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
  console.log(`Default admin: admin@klaus.com / admin123`);
});
