# KLAUS - Project Cost & Provision Calculator

A simple frontend application for calculating project costs and provisions.

## Features

- Enter project details (name, invoiced total, MDs, MD rate)
- Support for CZK and EUR currencies
- Automatic cost calculation (MDs × Cost per MD)
- Provision calculation (10% or 15%)
- All results displayed in CZK
- Save projects to Payable Commissions list
- Track payment received date and invoice due date
- Edit and manage saved projects

## Development Setup

### Frontend

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`)

### Backend

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Start the backend server:
```bash
npm start
```

The backend will run on `http://localhost:3001`

**Note:** Both frontend and backend need to be running for the app to work properly. The frontend will proxy API requests to the backend during development.

## Build

To build for production:
```bash
npm run build
```

The built files will be in the `dist` directory.

## Docker Deployment

The Docker setup includes both frontend and backend services. Data is stored on the server in the `server/data` directory (persisted via Docker volumes).

### Using Docker Compose (Recommended)

1. Build and start the containers:
```bash
docker-compose up -d
```

2. Access the application at `http://localhost:3000`

3. View logs:
```bash
docker-compose logs -f
```

4. Stop the containers:
```bash
docker-compose down
```

**Data Persistence:** Project data is stored in `server/data/` directory and will persist even if containers are stopped.

### Architecture

- **Frontend**: React app served by nginx (port 3000)
- **Backend**: Express API server (port 3001, internal)
- **ML Service**: Python Flask service for ML-based invoice extraction (port 5000, optional)
- **Data Storage**: JSON files in `server/data/` directory
- **API Proxy**: nginx proxies `/api/*` requests to the backend

### ML Service (Optional)

The ML service provides improved invoice extraction using machine learning:

1. **Start the ML service:**
```bash
cd ml-service
pip install -r requirements.txt
python ml_service.py
```

Or use the start script:
```bash
cd ml-service
./start.sh
```

2. **Train the model** (after collecting feedback):
```bash
cd ml-service
python train_model.py
```

The backend will automatically use the ML service if it's running, otherwise it falls back to regex-based extraction.

## Usage

1. Enter the project name
2. Select currency (CZK or EUR)
3. Enter the invoiced total
4. If EUR is selected, enter the exchange rate
5. Enter the number of MDs (man-days)
6. Enter the MD rate
7. Set the cost per MD (this value is saved on the server)
8. Select provision percentage (10% or 15%)
9. View the calculated cost and provision in CZK
10. Save the project to Payable Commissions
11. Add payment received date and invoice due date in the list view
12. Edit or delete projects as needed

