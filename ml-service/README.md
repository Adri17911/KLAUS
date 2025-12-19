# Invoice Extraction ML Service

This is a Python microservice that uses machine learning to extract invoice data from PDFs. It learns from user corrections to improve over time.

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Start the service:
```bash
python ml_service.py
```

The service runs on `http://localhost:5000` by default.

## Features

- Uses `pdfplumber` for better PDF text extraction
- Uses `spaCy` or `scikit-learn` for ML-based field extraction
- Learns from feedback stored in `server/data/invoice-feedback.json`
- Retrains model periodically using collected feedback

## API Endpoints

- `POST /extract` - Extract invoice data from PDF (base64 encoded)
- `POST /retrain` - Retrain the model using feedback data

## Integration

The Node.js backend can optionally call this service for better extraction. If the service is not available, it falls back to the regex-based extraction.


