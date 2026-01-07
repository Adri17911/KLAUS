# KLAUS - Local Setup Guide

## Initial Setup (First Time)

### 1. Clone the Repository
```bash
git clone https://github.com/Adri17911/KLAUS.git
cd KLAUS
```

### 2. Install Frontend Dependencies
```bash
npm install
```

### 3. Install Backend Dependencies
```bash
cd server
npm install
cd ..
```

### 4. Setup Python ML Service (Optional but Recommended)
```bash
cd ml-service
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

## Running the Application

### Option 1: All Services (Recommended)

**Terminal 1 - Frontend:**
```bash
npm run dev
```
Frontend will run on `http://localhost:5173`

**Terminal 2 - Backend:**
```bash
cd server && npm start
```
Backend will run on `http://localhost:3001`

**Terminal 3 - ML Service (Optional):**
```bash
cd ml-service && source venv/bin/activate && python ml_service.py
```
ML Service will run on `http://localhost:5000`

### Option 2: Using Start Scripts

**Frontend & Backend:**
```bash
npm run dev
# In another terminal:
cd server && npm start
```

**ML Service:**
```bash
cd ml-service && ./start.sh
```

## Updating an Existing Clone

If you already have the repository cloned:

```bash
cd KLAUS
git pull origin main
npm install
cd server && npm install && cd ..
cd ml-service && source venv/bin/activate && pip install -r requirements.txt && cd ..
```

## Quick Start (All-in-One)

For a complete fresh setup, run these commands in order:

```bash
# Clone (or skip if you already have it)
git clone https://github.com/Adri17911/KLAUS.git
cd KLAUS

# Install all dependencies
npm install
cd server && npm install && cd ..
cd ml-service && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt && cd ..

# Start all services (run in separate terminals)
npm run dev          # Terminal 1
cd server && npm start   # Terminal 2
cd ml-service && source venv/bin/activate && python ml_service.py  # Terminal 3
```

## Requirements

- **Node.js** 18+ (for frontend and backend)
- **Python** 3.8+ (for ML service)
- **npm** (comes with Node.js)
- **Git** (to clone the repository)

## Troubleshooting

- **Port conflicts**: Make sure ports 5173 (frontend), 3001 (backend), and 5000 (ML service) are available
- **Python venv issues**: Make sure `python3` is available in your PATH
- **Permission denied on start.sh**: Run `chmod +x ml-service/start.sh`

