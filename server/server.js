import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import bcrypt from 'bcryptjs';
import multer from 'multer';

const require = createRequire(import.meta.url);
// Use pdf-parse v1 API which works with buffers
const pdfParse = require('pdf-parse');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data', 'projects.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');
const FEEDBACK_FILE = path.join(__dirname, 'data', 'invoice-feedback.json');

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
if (!fs.existsSync(FEEDBACK_FILE)) {
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify([]));
}

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

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
    role: user.role,
    userId: user.id // Add userId for consistency
  };
};

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
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

// User management endpoints (Admin and Team Leader)
app.get('/api/users', requireRole(['admin', 'teamleader']), (req, res) => {
  const users = readUsers();
  let filteredUsers = users;
  
  // If team leader, only show their team members (users they created) and exclude admins
  if (req.user.role === 'teamleader') {
    filteredUsers = users.filter(u => 
      u.createdBy === req.user.userId && u.role !== 'admin'
    );
  }
  // Admins see all users
  
  const usersWithoutPasswords = filteredUsers.map(({ passwordHash, ...user }) => user);
  res.json(usersWithoutPasswords);
});

app.post('/api/users', requireRole(['admin', 'teamleader']), async (req, res) => {
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
  
  // Get the creator's name for the badge
  const creator = users.find(u => u.id === req.user.userId);
  const creatorName = creator ? creator.name : 'Unknown';
  
  const newUser = {
    id: Date.now().toString(),
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    name,
    role,
    createdAt: new Date().toISOString(),
    createdBy: req.user.userId, // Track who created this user
    teamLeaderName: req.user.role === 'teamleader' ? creatorName : undefined // Store team leader name for badge
  };
  
  users.push(newUser);
  
  if (writeUsers(users)) {
    const { passwordHash, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } else {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/users/:id', requireRole(['admin', 'teamleader']), async (req, res) => {
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

app.delete('/api/users/:id', requireRole(['admin', 'teamleader']), (req, res) => {
  const users = readUsers();
  const userToDelete = users.find(u => u.id === req.params.id);
  
  if (!userToDelete) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Team leaders can only delete their own team members
  if (req.user.role === 'teamleader') {
    if (userToDelete.createdBy !== req.user.userId) {
      return res.status(403).json({ error: 'You can only delete your own team members' });
    }
  }
  
  const filteredUsers = users.filter(u => u.id !== req.params.id);
  
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

// Get all projects (require auth) - filtered by role
app.get('/api/projects', requireAuth, (req, res) => {
  const projects = readProjects();
  const users = readUsers();
  let filteredProjects = projects;
  
  // Get user role from users file
  const user = getUserFromSession(getSession(req));
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  
  if (user.role === 'admin') {
    // Admins see everything
    filteredProjects = projects;
  } else if (user.role === 'teamleader') {
    // Team leaders see their own projects and their team members' projects
    const teamMemberIds = users
      .filter(u => u.createdBy === user.id)
      .map(u => u.id);
    
    filteredProjects = projects.filter(p => 
      p.createdBy === user.id || teamMemberIds.includes(p.createdBy)
    );
  } else {
    // Regular users only see their own projects
    filteredProjects = projects.filter(p => p.createdBy === user.id);
  }
  
  // Filter out archived projects by default (frontend can request archived separately)
  // This keeps the API clean - archived projects are still accessible but filtered client-side
  res.json(filteredProjects);
});

// Get a single project by ID (with permission check)
app.get('/api/projects/:id', requireAuth, (req, res) => {
  const projects = readProjects();
  const users = readUsers();
  const project = projects.find(p => p.id === req.params.id);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  // Get user role from users file
  const user = getUserFromSession(getSession(req));
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  
  // Check permissions
  if (user.role === 'admin') {
    // Admins can see everything
    res.json(project);
  } else if (user.role === 'teamleader') {
    // Team leaders can see their own projects and their team members' projects
    const teamMemberIds = users
      .filter(u => u.createdBy === user.id)
      .map(u => u.id);
    
    if (project.createdBy === user.id || teamMemberIds.includes(project.createdBy)) {
      res.json(project);
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  } else {
    // Regular users can only see their own projects
    if (project.createdBy === user.id) {
      res.json(project);
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  }
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

// Archive a project (with permission check)
app.post('/api/projects/:id/archive', requireAuth, (req, res) => {
  const projects = readProjects();
  const users = readUsers();
  const index = projects.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  const project = projects[index];
  
  // Get user role from users file
  const user = getUserFromSession(getSession(req));
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  
  // Check permissions
  if (user.role === 'admin') {
    // Admins can archive everything
  } else if (user.role === 'teamleader') {
    // Team leaders can archive their own projects and their team members' projects
    const teamMemberIds = users
      .filter(u => u.createdBy === user.id)
      .map(u => u.id);
    
    if (project.createdBy !== user.id && !teamMemberIds.includes(project.createdBy)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  } else {
    // Regular users can only archive their own projects
    if (project.createdBy !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  
  projects[index] = {
    ...projects[index],
    archived: true,
    archivedAt: new Date().toISOString()
  };
  
  if (writeProjects(projects)) {
    res.json(projects[index]);
  } else {
    res.status(500).json({ error: 'Failed to archive project' });
  }
});

// Unarchive a project (with permission check)
app.post('/api/projects/:id/unarchive', requireAuth, (req, res) => {
  const projects = readProjects();
  const users = readUsers();
  const index = projects.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  const project = projects[index];
  
  // Get user role from users file
  const user = getUserFromSession(getSession(req));
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  
  // Check permissions
  if (user.role === 'admin') {
    // Admins can unarchive everything
  } else if (user.role === 'teamleader') {
    // Team leaders can unarchive their own projects and their team members' projects
    const teamMemberIds = users
      .filter(u => u.createdBy === user.id)
      .map(u => u.id);
    
    if (project.createdBy !== user.id && !teamMemberIds.includes(project.createdBy)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  } else {
    // Regular users can only unarchive their own projects
    if (project.createdBy !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  
  projects[index] = {
    ...projects[index],
    archived: false,
    archivedAt: undefined
  };
  
  if (writeProjects(projects)) {
    res.json(projects[index]);
  } else {
    res.status(500).json({ error: 'Failed to unarchive project' });
  }
});

// Delete a project (with permission check)
app.delete('/api/projects/:id', requireAuth, (req, res) => {
  const projects = readProjects();
  const users = readUsers();
  const project = projects.find(p => p.id === req.params.id);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  // Get user role from users file
  const user = getUserFromSession(getSession(req));
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  
  // Check permissions
  if (user.role === 'admin') {
    // Admins can delete everything
  } else if (user.role === 'teamleader') {
    // Team leaders can delete their own projects and their team members' projects
    const teamMemberIds = users
      .filter(u => u.createdBy === user.id)
      .map(u => u.id);
    
    if (project.createdBy !== user.id && !teamMemberIds.includes(project.createdBy)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  } else {
    // Regular users can only delete their own projects
    if (project.createdBy !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  
  const filteredProjects = projects.filter(p => p.id !== req.params.id);
  
  if (writeProjects(filteredProjects)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Extract invoice data from PDF text
const extractInvoiceData = (text) => {
  const extracted = {
    projectName: '',
    invoicedTotal: '',  // Amount WITHOUT VAT
    currency: 'CZK',
    exchangeRate: '',
    invoiceDate: '',
    invoiceDueDate: '',
    invoiceNumber: '',
    numberOfMDs: '',  // Počet MJ
    mdRate: '',       // Cena MJ
    client: '',       // Odběratel / Client
  };

  // Normalize text: remove extra spaces and newlines
  const normalizedText = text.replace(/\s+/g, ' ').toLowerCase();

  // Extract invoice number - check Czech "číslo:" first
  const invoiceNumberPatterns = [
    /číslo\s*:?\s*([0-9]+)/i,  // Czech "číslo: 202511038"
    /invoice\s*(?:number|no|#)?\s*:?\s*([a-z0-9\-]+)/i,
    /inv\s*(?:number|no|#)?\s*:?\s*([a-z0-9\-]+)/i,
    /#\s*([a-z0-9\-]+)/i,
  ];
  for (const pattern of invoiceNumberPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      extracted.invoiceNumber = match[1].trim();
      break;
    }
  }

  // Extract project name (usually in title or description)
  // Look for common patterns like "Project:", "Description:", "Service:", etc.
  const projectNamePatterns = [
    /(?:project|description|service|item)\s*:?\s*([^\n]+)/i,
    /^([a-z\s]{10,50})(?:\s|$)/i,
  ];
  for (const pattern of projectNamePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (candidate.length > 5 && candidate.length < 100) {
        extracted.projectName = candidate;
        break;
      }
    }
  }

  // Extract total amount WITHOUT VAT - prioritize "bez DPH" or "Součet" (base amount)
  const amountPatterns = [
    // Look for "bez DPH" (without VAT) amount first
    /bez\s+dph\s*[:\s]*([0-9\s]+[.,][0-9]+)/i,  // "bez DPH: 495 000,00"
    /součet\s*[:\s]*([0-9\s]+[.,][0-9]+)/i,     // "Součet: 495 000,00" (base amount in VAT breakdown)
    /základ\s+dph\s*[:\s]*([0-9\s]+[.,][0-9]+)/i,  // "Základ DPH: 495 000,00"
    // Fallback to celkem k úhradě if no bez DPH found (includes VAT - user will need to correct)
    /celkem\s+k\s+úhradě\s*\([^)]*\)\s*([0-9\s]+[.,][0-9]+)/i,
    /celkem\s+k\s+úhradě\s*:?\s*([0-9\s,]+[.,]?[0-9]+)/i,
    /(?:celkem|celková\s+částka|suma|částka)\s*:?\s*([0-9\s,]+[.,]?[0-9]+)\s*(?:Kč|CZK|czk|EUR|eur|€)/i,
    /(?:celkem|celková\s+částka|suma|částka)\s*:?\s*([0-9\s,]+[.,]?[0-9]+)/i,
    // English patterns
    /(?:total|amount|sum|subtotal|due|invoice\s+total|grand\s+total)\s*:?\s*([0-9\s,]+[.,]?[0-9]*)\s*(?:Kč|CZK|czk|EUR|eur|€|\$|USD|usd)/i,
    /(?:total|amount|sum|subtotal|due|invoice\s+total|grand\s+total)\s*:?\s*([0-9\s,]+[.,]?[0-9]*)/i,
    // Amount with currency (flexible position)
    /([0-9\s,]+[.,]?[0-9]*)\s*(?:Kč|CZK|czk)/i,
    /([0-9\s,]+[.,]?[0-9]*)\s*(?:EUR|eur|€)/i,
  ];
  
  // Also collect all large numbers to find the most likely total amount
  const allAmounts = [];
  
  for (const pattern of amountPatterns) {
    const matches = text.matchAll(new RegExp(pattern.source, 'gi'));
    for (const match of matches) {
      if (match[1]) {
        // Normalize number format - Czech uses "598 950,00" format
        let amountStr = match[1].trim();
        // Replace spaces (thousand separators) and comma (decimal) with dot
        amountStr = amountStr.replace(/\s/g, '').replace(/,/g, '.');
        // Handle multiple dots - keep only last as decimal
        const parts = amountStr.split('.');
        if (parts.length > 2) {
          amountStr = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
        }
        const amount = parseFloat(amountStr);
        if (amount > 100 && amount < 100000000) { // Reasonable range for invoices
          allAmounts.push({
            amount: amountStr,
            value: amount,
            currency: match[2] || null,
            pattern: pattern.source
          });
          
          // Prioritize "bez DPH" or "Součet" (amount without VAT)
          const matchedText = match[0] || '';
          if (matchedText.toLowerCase().includes('bez') && matchedText.toLowerCase().includes('dph')) {
            extracted.invoicedTotal = amountStr;
            extracted.currency = 'CZK'; // Default for Czech invoices
            break;
          }
          if (matchedText.toLowerCase().includes('součet') || matchedText.toLowerCase().includes('základ')) {
            extracted.invoicedTotal = amountStr;
            extracted.currency = 'CZK';
            break;
          }
        }
      }
    }
  }
  
  // If no labeled amount found, try to find the largest reasonable number (likely the total)
  if (!extracted.invoicedTotal && allAmounts.length > 0) {
    // Sort by value descending and take the largest
    allAmounts.sort((a, b) => b.value - a.value);
    const largest = allAmounts[0];
    extracted.invoicedTotal = largest.amount;
    if (largest.currency) {
      const currencyMatch = largest.currency.toUpperCase();
      if (currencyMatch.includes('EUR') || currencyMatch.includes('€')) {
        extracted.currency = 'EUR';
      } else {
        extracted.currency = 'CZK';
      }
    }
  }

  // Extract dates - handle Czech format: "Datum vystavení : 03.12.2025"
  // Invoice date patterns
  const invoiceDatePatterns = [
    /datum\s+vystavení\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{2,4})/i,  // "Datum vystavení : 03.12.2025"
    /(?:invoice\s*date|date\s*of\s*invoice|issued)\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /datum\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  ];
  for (const pattern of invoiceDatePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      extracted.invoiceDate = match[1];
      break;
    }
  }

  // Due date patterns
  const dueDatePatterns = [
    /datum\s+splatnosti\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{2,4})/i,  // "Datum splatnosti: 02.01.2026"
    /(?:due\s*date|payment\s*due|pay\s*by|splatnost)\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  ];
  for (const pattern of dueDatePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      extracted.invoiceDueDate = match[1];
      break;
    }
  }

  // Extract number of MDs (Počet MJ) - look for "MD 18 15 000,00" format in invoice lines
  // Pattern: "MD [count] [rate] [percentage] [total]" - extract count and rate from same match
  const mdLinePattern = /MD\s+([0-9]+)\s+([0-9\s,]+[.,][0-9]+)/gi;  // "MD 18 15 000,00"
  
  const mdValues = [];
  const mdRates = [];
  let match;
  
  // Use exec in a loop to find all matches (matchAll doesn't work well with global flag)
  while ((match = mdLinePattern.exec(text)) !== null) {
    if (match[1] && match[2]) {
      // First group is MD count
      const mdCount = parseInt(match[1], 10);
      if (mdCount > 0 && mdCount < 1000) {
        mdValues.push(mdCount);
      }
      
      // Second group is MD rate
      let rateStr = match[2].trim().replace(/\s/g, '').replace(/,/g, '.');
      const rate = parseFloat(rateStr);
      if (rate > 100 && rate < 100000) {
        mdRates.push(rateStr);
      }
    }
  }
  
  // Sum up all MD values found (multiple invoice lines)
  if (mdValues.length > 0) {
    const totalMDs = mdValues.reduce((sum, val) => sum + val, 0);
    extracted.numberOfMDs = totalMDs.toString();
  }
  
  // Use the first MD rate found (they should all be the same)
  if (mdRates.length > 0) {
    extracted.mdRate = mdRates[0];
  }
  
  // Also check for explicit "Počet MJ:" label as fallback
  if (!extracted.numberOfMDs) {
    const početMatch = text.match(/počet\s+mj\s*:?\s*([0-9]+)/i);
    if (početMatch && početMatch[1]) {
      extracted.numberOfMDs = početMatch[1];
    }
  }
  
  // Also check for "Cena MJ:" label as fallback
  if (!extracted.mdRate) {
    const cenaMatch = text.match(/cena\s+mj\s*:?\s*([0-9\s,]+[.,][0-9]+)/i);
    if (cenaMatch && cenaMatch[1]) {
      let rateStr = cenaMatch[1].trim().replace(/\s/g, '').replace(/,/g, '.');
      const rate = parseFloat(rateStr);
      if (rate > 100 && rate < 100000) {
        extracted.mdRate = rateStr;
      }
    }
  }

  // Extract client (Odběratel / Buyer)
  // Pattern: "Odběratel:" followed by metadata lines, then company name with legal suffix
  // The company name is typically 2-4 lines after "Odběratel:" and contains "s.r.o." or similar
  const clientPatterns = [
    /odběratel\s*:?\s*[^\n]*\n[^\n]*\n[^\n]*\n([^\n]+(?:s\.r\.o\.|s\.r\.o|a\.s\.|spol\.|spol|Ltd\.|Inc\.|LLC|GmbH|Corp\.))/i,  // Skip 3 lines
    /odběratel\s*:?\s*[^\n]*\n[^\n]*\n([^\n]+(?:s\.r\.o\.|s\.r\.o|a\.s\.|spol\.))/i,  // Skip 2 lines
    /odběratel\s*:?\s*[^\n]*\n([^\n]+(?:s\.r\.o\.|s\.r\.o|a\.s\.|spol\.))/i,  // Skip 1 line
    /odběratel\s*:?\s*([^\n]+(?:s\.r\.o\.|s\.r\.o|a\.s\.|spol\.))/i,  // Single line
    /buyer\s*:?\s*([^\n]+(?:Ltd\.|Inc\.|LLC|GmbH|Corp\.))/i,
    /client\s*:?\s*([^\n]+)/i,
  ];
  
  for (const pattern of clientPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let clientName = match[1].trim();
      // Clean up - remove IČO info, leading non-word characters
      clientName = clientName.replace(/\s+IČO:\s*\d+/i, '').trim();
      clientName = clientName.replace(/^[^\w]*/, '').trim();
      if (clientName.length > 3 && clientName.length < 200) {
        extracted.client = clientName;
        break;
      }
    }
  }

  // If no project name found, use invoice number or a default
  if (!extracted.projectName) {
    extracted.projectName = extracted.invoiceNumber || 'Imported Invoice';
  }

  return extracted;
};

// Try to use ML service for extraction, fallback to regex if unavailable
const extractWithMLService = async (pdfBuffer) => {
  const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';
  
  try {
    // Convert buffer to base64
    const pdfBase64 = pdfBuffer.toString('base64');
    
    const response = await fetch(`${ML_SERVICE_URL}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf: pdfBase64 }),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (response.ok) {
      const result = await response.json();
      return result;
    }
  } catch (error) {
    console.log('ML service unavailable, using fallback extraction:', error.message);
  }
  
  return null;
};

// Upload and extract invoice data from PDF
app.post('/api/invoices/upload', requireAuth, upload.single('invoice'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let extractedData;
    let text = '';
    let rawText = '';
    let usedML = false;

    // Try ML service first (if available)
    const mlResult = await extractWithMLService(req.file.buffer);
    if (mlResult && mlResult.success) {
      extractedData = mlResult.extractedData;
      rawText = mlResult.rawText || '';
      text = mlResult.rawText || '';
      usedML = true;
      console.log('Used ML service for extraction');
    } else {
      // Fallback to regex-based extraction
      const pdfData = await pdfParse(req.file.buffer);
      text = pdfData.text;

      if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: 'PDF appears to be empty or contains no extractable text' });
      }

      // Extract data from PDF text using regex patterns
      extractedData = extractInvoiceData(text);
      rawText = text.substring(0, 2000);
      console.log('Used regex-based extraction (ML service unavailable)');
    }

    // Return extracted data (client will use this to populate the form)
    res.json({
      success: true,
      extractedData,
      rawText: rawText || text.substring(0, 2000),
      fullTextLength: text.length,
      extractionId: Date.now().toString(),
      usedML, // Indicate if ML was used
    });
  } catch (error) {
    console.error('Error processing invoice PDF:', error);
    res.status(500).json({ error: 'Failed to process PDF: ' + error.message });
  }
});

// Save feedback/corrections for ML learning
app.post('/api/invoices/feedback', requireAuth, express.json({ limit: '50mb' }), (req, res) => {
  try {
    const { extractionId, rawText, extractedData, correctedData } = req.body;
    
    if (!rawText || !extractedData || !correctedData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Read existing feedback
    let feedback = [];
    try {
      const data = fs.readFileSync(FEEDBACK_FILE, 'utf8');
      feedback = JSON.parse(data);
    } catch (error) {
      feedback = [];
    }

    // Create feedback entry
    const feedbackEntry = {
      id: extractionId || Date.now().toString(),
      timestamp: new Date().toISOString(),
      userId: req.user.userId,
      rawText: rawText.substring(0, 50000), // Limit text size for storage
      extractedData,
      correctedData,
      // Calculate which fields were corrected
      corrections: {
        projectName: extractedData.projectName !== correctedData.projectName,
        invoicedTotal: extractedData.invoicedTotal !== correctedData.invoicedTotal,
        currency: extractedData.currency !== correctedData.currency,
        exchangeRate: extractedData.exchangeRate !== correctedData.exchangeRate,
        invoiceNumber: extractedData.invoiceNumber !== correctedData.invoiceNumber,
        invoiceDate: extractedData.invoiceDate !== correctedData.invoiceDate,
        invoiceDueDate: extractedData.invoiceDueDate !== correctedData.invoiceDueDate,
      }
    };

    feedback.push(feedbackEntry);
    
    // Keep only last 1000 entries to prevent file from growing too large
    if (feedback.length > 1000) {
      feedback = feedback.slice(-1000);
    }

    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedback, null, 2));
    
    res.json({ success: true, message: 'Feedback saved for learning' });
  } catch (error) {
    console.error('Error saving feedback:', error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// ============================================================================
// CRM INTEGRATION - READ-ONLY POLICY
// ============================================================================
// IMPORTANT: All CRM API interactions are READ-ONLY.
// This integration ONLY reads data from the CRM API using GET requests.
// Under NO circumstances will this code write, modify, or delete anything in the CRM.
// All data modifications only happen within KLAUS (local project creation).
// ============================================================================

const CRM_CONFIG_FILE = path.join(__dirname, 'data', 'crm-config.json');

// Helper function to ensure only GET requests are made to CRM API
const makeReadOnlyCrmRequest = async (url, apiKey, options = {}) => {
  // Enforce read-only: Only allow GET method
  if (options.method && options.method !== 'GET') {
    throw new Error('READ-ONLY POLICY: Only GET requests are allowed to CRM API');
  }
  
  return fetch(url, {
    method: 'GET', // Force GET - read-only
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
    method: 'GET', // Ensure method is always GET
  });
};

const readCrmConfig = () => {
  if (!fs.existsSync(CRM_CONFIG_FILE)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(CRM_CONFIG_FILE, 'utf8'));
  } catch (error) {
    console.error('Error reading CRM config:', error);
    return null;
  }
};

const writeCrmConfig = (config) => {
  try {
    fs.writeFileSync(CRM_CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing CRM config:', error);
    return false;
  }
};

// Get CRM configuration
app.get('/api/crm/config', requireRole(['admin', 'teamleader']), (req, res) => {
  const config = readCrmConfig();
  if (!config) {
    return res.json({ configured: false });
  }
  // Don't send sensitive data like API keys in full
  res.json({
    configured: true,
    crmType: config.crmType,
    apiUrl: config.apiUrl,
    hasApiKey: !!config.apiKey,
    authMethod: config.authMethod || 'apiKey',
    hasOauthToken: !!config.oauthToken,
  });
});

// Update CRM configuration
app.post('/api/crm/config', requireRole(['admin', 'teamleader']), (req, res) => {
  const { crmType, apiUrl, apiKey, authMethod } = req.body;
  
  if (!crmType) {
    return res.status(400).json({ error: 'CRM type is required' });
  }
  
  // For API key method, require API URL
  if (authMethod !== 'oauth' && authMethod !== 'manual' && !apiUrl) {
    return res.status(400).json({ error: 'API URL is required for API key authentication' });
  }
  
  const config = {
    crmType, // e.g., 'raynet', 'pipedrive', 'hubspot', 'salesforce'
    apiUrl: apiUrl || readCrmConfig()?.apiUrl,
    apiKey: apiKey || readCrmConfig()?.apiKey, // Keep existing key if not provided
    authMethod: authMethod || 'apiKey', // 'apiKey', 'oauth', 'manual'
    oauthToken: req.body.oauthToken || readCrmConfig()?.oauthToken, // For OAuth
    updatedAt: new Date().toISOString(),
  };
  
  if (writeCrmConfig(config)) {
    res.json({ success: true, configured: true });
  } else {
    res.status(500).json({ error: 'Failed to save CRM configuration' });
  }
});

// Manual import endpoint - import deals from JSON file
app.post('/api/crm/import', requireRole(['admin', 'teamleader']), express.json({ limit: '10mb' }), (req, res) => {
  const { deals } = req.body;
  
  if (!Array.isArray(deals)) {
    return res.status(400).json({ error: 'Invalid data format. Expected array of deals.' });
  }
  
  // Filter for won deals - check stage field for "won"
  const wonDeals = deals.filter(deal => {
    const stage = (deal.stage || deal.status || deal.state || '').toString().toLowerCase();
    return stage === 'won' || stage === 'výhra' || stage === 'vyhra';
  });
  
  // Read existing projects to check for duplicates
  const projects = readProjects();
  const existingProjectNames = new Set(projects.map(p => p.projectName.toLowerCase()));
  
  // Map deals to projects
  const newProjects = [];
  const skipped = [];
  
  for (const deal of wonDeals) {
    const projectName = deal.name || deal.title || deal.subject || `CRM Deal ${deal.id || Date.now()}`;
    const normalizedName = projectName.toLowerCase();
    
    // Skip if project already exists
    if (existingProjectNames.has(normalizedName)) {
      skipped.push({ name: projectName, reason: 'Already exists' });
      continue;
    }
    
    // Map deal to project structure
    const newProject = {
      projectName,
      projectType: deal.projectType || 'regular',
      invoicedTotal: deal.value?.toString() || deal.amount?.toString() || '0',
      numberOfMDs: deal.mds?.toString() || deal.manDays?.toString() || '0',
      mdRate: deal.rate?.toString() || deal.mdRate?.toString() || '0',
      currency: (deal.currency || 'CZK').toUpperCase(),
      exchangeRate: deal.exchangeRate?.toString() || '25.0',
      costPerMD: '5000',
      provisionPercent: deal.provisionPercent || 10,
      cost: deal.cost || 0,
      provision: deal.provision || 0,
      invoicedTotalCZK: deal.valueCZK || deal.amountCZK || 0,
      customProfit: deal.customProfit,
      customCost: deal.customCost,
      status: 'pending-review',
      paymentReceivedDate: deal.paymentDate || '',
      invoiceDueDate: deal.invoiceDueDate || '',
      createdAt: new Date().toISOString(),
      createdBy: req.user.userId,
      crmDealId: deal.id?.toString(),
      crmSyncedAt: new Date().toISOString(),
    };
    
    // Calculate cost and provision if not provided
    if (newProject.projectType === 'regular') {
      const mds = parseFloat(newProject.numberOfMDs) || 0;
      const costPerMD = parseFloat(newProject.costPerMD) || 5000;
      newProject.cost = mds * costPerMD;
      
      const invoicedCZK = newProject.invoicedTotalCZK || parseFloat(newProject.invoicedTotal) || 0;
      newProject.provision = (invoicedCZK - newProject.cost) * (newProject.provisionPercent / 100);
    } else if (newProject.projectType === 'custom') {
      newProject.cost = newProject.customCost || 0;
      newProject.provision = newProject.customProfit || 0;
    }
    
    projects.push({
      ...newProject,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    });
    
    existingProjectNames.add(normalizedName);
    newProjects.push(projectName);
  }
  
  // Save all new projects
  if (newProjects.length > 0) {
    writeProjects(projects);
  }
  
  res.json({
    success: true,
    imported: newProjects.length,
    skipped: skipped.length,
    details: {
      new: newProjects,
      skipped,
    },
  });
});

// CRM Sync endpoint - READ-ONLY: fetches deals from CRM and creates projects in KLAUS
// IMPORTANT: This endpoint only reads from CRM API. It never writes/modifies anything in the CRM.
app.post('/api/crm/sync', requireRole(['admin', 'teamleader']), async (req, res) => {
  const config = readCrmConfig();
  if (!config) {
    return res.status(400).json({ error: 'CRM not configured. Please configure CRM settings first.' });
  }
  
  // Check authentication method
  if (config.authMethod === 'manual') {
    return res.status(400).json({ 
      error: 'Manual import mode. Please use the manual import feature instead of sync.' 
    });
  }
  
  if (config.authMethod === 'oauth' && !config.oauthToken) {
    return res.status(400).json({ error: 'OAuth token not available. Please re-authenticate.' });
  }
  
  if (config.authMethod !== 'oauth' && !config.apiKey) {
    return res.status(400).json({ error: 'API key not configured. Please configure CRM settings first.' });
  }
  
  try {
    // READ-ONLY: Fetch deals from CRM API (GET request only - no modifications)
    // Using makeReadOnlyCrmRequest ensures we can only make GET requests
    // Raynet API endpoint structure: /deals or /businessCase depending on CRM type
    const endpoint = config.crmType === 'raynet' ? '/businessCase' : '/deals';
    const authToken = config.authMethod === 'oauth' ? config.oauthToken : config.apiKey;
    
    const response = await makeReadOnlyCrmRequest(
      `${config.apiUrl}${endpoint}`,
      authToken
    );
    
    if (!response.ok) {
      throw new Error(`CRM API error: ${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    
    // Handle different API response structures (Raynet may wrap in 'data' property)
    const deals = Array.isArray(responseData) ? responseData : (responseData.data || responseData.items || []);
    
    // Filter for won deals - check stage field for "won" (Raynet uses stage, not tags)
    const wonDeals = deals.filter(deal => {
      const stage = (deal.stage || deal.status || deal.state || '').toString().toLowerCase();
      return stage === 'won' || stage === 'výhra' || stage === 'vyhra';
    });
    
    // Read existing projects to check for duplicates
    const projects = readProjects();
    const existingProjectNames = new Set(projects.map(p => p.projectName.toLowerCase()));
    
    // Map CRM deals to projects
    const newProjects = [];
    const skipped = [];
    
    for (const deal of wonDeals) {
      const projectName = deal.name || deal.title || `CRM Deal ${deal.id}`;
      const normalizedName = projectName.toLowerCase();
      
      // Skip if project already exists
      if (existingProjectNames.has(normalizedName)) {
        skipped.push({ name: projectName, reason: 'Already exists' });
        continue;
      }
      
      // Map CRM deal to project structure
      // Adjust these mappings based on your CRM's data structure
      const newProject = {
        projectName,
        projectType: deal.projectType || 'regular',
        invoicedTotal: deal.value?.toString() || deal.amount?.toString() || '0',
        numberOfMDs: deal.mds?.toString() || deal.manDays?.toString() || '0',
        mdRate: deal.rate?.toString() || deal.mdRate?.toString() || '0',
        currency: (deal.currency || 'CZK').toUpperCase(),
        exchangeRate: deal.exchangeRate?.toString() || '25.0',
        costPerMD: '5000', // Default, can be overridden
        provisionPercent: deal.provisionPercent || 10,
        cost: deal.cost || 0,
        provision: deal.provision || 0,
        invoicedTotalCZK: deal.valueCZK || deal.amountCZK || 0,
        customProfit: deal.customProfit,
        customCost: deal.customCost,
        status: 'pending-review', // All CRM-imported projects start as pending-review
        paymentReceivedDate: deal.paymentDate || '',
        invoiceDueDate: deal.invoiceDueDate || '',
        createdAt: new Date().toISOString(),
        createdBy: req.user.userId,
        crmDealId: deal.id, // Track which CRM deal this came from
        crmSyncedAt: new Date().toISOString(),
      };
      
      // Calculate cost and provision if not provided
      if (newProject.projectType === 'regular') {
        const mds = parseFloat(newProject.numberOfMDs) || 0;
        const costPerMD = parseFloat(newProject.costPerMD) || 5000;
        newProject.cost = mds * costPerMD;
        
        const invoicedCZK = newProject.invoicedTotalCZK || parseFloat(newProject.invoicedTotal) || 0;
        newProject.provision = (invoicedCZK - newProject.cost) * (newProject.provisionPercent / 100);
      } else if (newProject.projectType === 'custom') {
        newProject.cost = newProject.customCost || 0;
        newProject.provision = newProject.customProfit || 0;
      }
      
      projects.push({
        ...newProject,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      });
      
      existingProjectNames.add(normalizedName);
      newProjects.push(projectName);
    }
    
    // Save all new projects
    if (newProjects.length > 0) {
      writeProjects(projects);
    }
    
    res.json({
      success: true,
      imported: newProjects.length,
      skipped: skipped.length,
      details: {
        new: newProjects,
        skipped,
      },
    });
  } catch (error) {
    console.error('CRM sync error:', error);
    res.status(500).json({ 
      error: 'Failed to sync with CRM', 
      message: error.message 
    });
  }
});

// Test CRM connection - READ-ONLY: Only tests reading from CRM
app.post('/api/crm/test', requireRole(['admin', 'teamleader']), async (req, res) => {
  const config = readCrmConfig();
  if (!config || !config.apiKey) {
    return res.status(400).json({ error: 'CRM not configured' });
  }
  
  try {
    // READ-ONLY: Only GET request to test connection (no data modification)
    // Using makeReadOnlyCrmRequest ensures we can only make GET requests
    const response = await makeReadOnlyCrmRequest(
      `${config.apiUrl}/health`,
      config.apiKey
    );
    
    if (response.ok) {
      res.json({ success: true, message: 'CRM connection successful (read-only)' });
    } else {
      res.status(response.status).json({ 
        success: false, 
        message: `CRM connection failed: ${response.statusText}` 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: `Connection error: ${error.message}` 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Migration: Assign existing projects to Adrian Šrajer (one-time only)
const MIGRATION_FLAG_FILE = path.join(__dirname, 'data', '.migration_completed');

const migrateProjects = () => {
  // Check if migration has already been completed
  if (fs.existsSync(MIGRATION_FLAG_FILE)) {
    return; // Migration already completed, skip
  }
  
  try {
    const users = readUsers();
    const projects = readProjects();
    
    // Find or create Adrian Šrajer
    let adrian = users.find(u => 
      u.name.toLowerCase().includes('adrian') || 
      u.email.toLowerCase().includes('adrian')
    );
    
    if (!adrian) {
      // Create Adrian Šrajer if doesn't exist
      adrian = {
        id: '1',
        email: 'adrian@klaus.com',
        passwordHash: bcrypt.hashSync('admin123', 10),
        name: 'Adrian Šrajer',
        role: 'admin',
        createdAt: new Date().toISOString()
      };
      users.push(adrian);
      writeUsers(users);
      console.log('Created Adrian Šrajer user');
    }
    
    // Assign projects without createdBy to Adrian
    const projectsToUpdate = projects.filter(p => !p.createdBy);
    if (projectsToUpdate.length > 0) {
      projects.forEach(project => {
        if (!project.createdBy) {
          project.createdBy = adrian.id;
        }
      });
      writeProjects(projects);
      console.log(`Assigned ${projectsToUpdate.length} existing projects to ${adrian.name}`);
    }
    
    // Mark migration as completed
    fs.writeFileSync(MIGRATION_FLAG_FILE, JSON.stringify({ completed: true, date: new Date().toISOString() }));
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
  }
};

// Run migration on startup (only once)
migrateProjects();

app.listen(PORT, () => {
  console.log(`KLAUS server running on port ${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
  console.log(`Default admin: admin@klaus.com / admin123`);
});
