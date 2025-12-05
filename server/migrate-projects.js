import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, 'data', 'projects.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// Read users to find Adrian Šrajer
const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
const adrian = users.find(u => 
  u.name.toLowerCase().includes('adrian') || 
  u.email.toLowerCase().includes('adrian')
);

if (!adrian) {
  console.log('Adrian Šrajer not found. Creating user...');
  // Create Adrian Šrajer user if doesn't exist
  const newUser = {
    id: '1',
    email: 'adrian@klaus.com',
    passwordHash: require('bcryptjs').hashSync('admin123', 10),
    name: 'Adrian Šrajer',
    role: 'admin',
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  console.log('Created Adrian Šrajer user');
}

const adrianId = adrian ? adrian.id : '1';

// Read projects
const projects = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

// Assign all existing projects to Adrian Šrajer
let updated = 0;
const updatedProjects = projects.map(project => {
  if (!project.createdBy) {
    updated++;
    return {
      ...project,
      createdBy: adrianId
    };
  }
  return project;
});

// Write back
fs.writeFileSync(DATA_FILE, JSON.stringify(updatedProjects, null, 2));

console.log(`Assigned ${updated} projects to Adrian Šrajer (ID: ${adrianId})`);
console.log('Migration complete!');

