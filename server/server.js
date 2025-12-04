import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data', 'projects.json');

// Ensure data directory exists
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to read projects
const readProjects = () => {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading projects:', error);
    return [];
  }
};

// Helper function to write projects
const writeProjects = (projects) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing projects:', error);
    return false;
  }
};

// Get cost per MD setting
app.get('/api/settings/cost-per-md', (req, res) => {
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
app.post('/api/settings/cost-per-md', (req, res) => {
  const { costPerMD } = req.body;
  
  if (!costPerMD) {
    return res.status(400).json({ error: 'costPerMD is required' });
  }
  
  const settingsFile = path.join(__dirname, 'data', 'settings.json');
  const settings = { costPerMD };
  
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    res.json({ success: true, costPerMD });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Get all projects
app.get('/api/projects', (req, res) => {
  const projects = readProjects();
  res.json(projects);
});

// Get a single project by ID
app.get('/api/projects/:id', (req, res) => {
  const projects = readProjects();
  const project = projects.find(p => p.id === req.params.id);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  res.json(project);
});

// Create a new project
app.post('/api/projects', (req, res) => {
  const projects = readProjects();
  const newProject = {
    ...req.body,
    id: req.body.id || Date.now().toString(),
    createdAt: req.body.createdAt || new Date().toISOString(),
  };
  
  projects.push(newProject);
  
  if (writeProjects(projects)) {
    res.status(201).json(newProject);
  } else {
    res.status(500).json({ error: 'Failed to save project' });
  }
});

// Update a project
app.put('/api/projects/:id', (req, res) => {
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
app.delete('/api/projects/:id', (req, res) => {
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
});

