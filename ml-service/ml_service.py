#!/usr/bin/env python3
"""
Invoice Extraction ML Service
Learns from user corrections to improve extraction accuracy
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pdfplumber
import base64
import json
import os
import io
from datetime import datetime
from typing import Dict, Any
import re

app = Flask(__name__)
CORS(app)

# Path to feedback file (relative to ml-service directory)
FEEDBACK_FILE = os.path.join(os.path.dirname(__file__), '..', 'server', 'data', 'invoice-feedback.json')

def extract_with_patterns(text: str) -> Dict[str, Any]:
    """Extract invoice data using improved patterns"""
    extracted = {
        'projectName': '',
        'invoicedTotal': '',  # Amount WITHOUT VAT
        'currency': 'CZK',
        'exchangeRate': '',
        'invoiceDate': '',
        'invoiceDueDate': '',
        'invoiceNumber': '',
        'numberOfMDs': '',  # Počet MJ
        'mdRate': '',       # Cena MJ
        'client': '',       # Odběratel / Client
    }
    
    text_lower = text.lower()
    
    # Extract invoice number - check for Czech "číslo:" first, then other patterns
    invoice_num_patterns = [
        r'číslo\s*:?\s*([0-9]+)',  # Czech "číslo: 202511038"
        r'invoice\s*(?:number|no|#)?\s*:?\s*([a-z0-9\-]+)',
        r'inv\s*(?:number|no|#)?\s*:?\s*([a-z0-9\-]+)',
        r'#\s*([a-z0-9\-]+)',
    ]
    for pattern in invoice_num_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            extracted['invoiceNumber'] = match.group(1).strip()
            break
    
    # Extract project name
    project_patterns = [
        r'(?:project|description|service|item|předmět|název)\s*:?\s*([^\n]{5,100})',
        r'účel\s*:?\s*([^\n]{5,100})',
    ]
    for pattern in project_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            candidate = match.group(1).strip()
            if 5 < len(candidate) < 100:
                extracted['projectName'] = candidate
                break
    
    # Extract total amount WITHOUT VAT - look for "bez DPH" or "Součet" (base amount)
    # Priority: 1) bez DPH amount, 2) Součet (base), 3) Celkem k úhradě (but this includes VAT)
    amount_patterns = [
        # Look for "bez DPH" (without VAT) amount first
        r'bez\s+dph\s*[:\s]*([0-9\s]+[.,][0-9]+)',  # "bez DPH: 495 000,00"
        r'součet\s*[:\s]*([0-9\s]+[.,][0-9]+)',     # "Součet: 495 000,00" (base amount in VAT breakdown)
        r'základ\s+dph\s*[:\s]*([0-9\s]+[.,][0-9]+)',  # "Základ DPH: 495 000,00"
        # Fallback to celkem k úhradě if no bez DPH found (user will need to correct)
        r'celkem\s+k\s+úhradě\s*\([^)]*\)\s*([0-9\s]+[.,][0-9]+)',  # "Celkem k úhradě (CZK) 598 950,00"
        r'celkem\s+k\s+úhradě\s*:?\s*([0-9\s,]+[.,]?[0-9]+)',
        r'(?:celkem|celková\s+částka|suma|částka)\s*:?\s*([0-9\s,]+[.,]?[0-9]+)\s*(?:kč|czk)',
        r'(?:total|amount|sum|subtotal|due|invoice\s+total)\s*:?\s*([0-9\s,]+[.,]?[0-9]+)\s*(?:kč|czk|eur|€)',
    ]
    
    all_amounts = []
    for pattern in amount_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            # Handle Czech format: "598 950,00" -> "598950.00"
            amount_str = match.group(1).strip()
            # Replace spaces (thousand separators) and comma (decimal) with dot
            amount_str = amount_str.replace(' ', '').replace(',', '.')
            # Handle multiple dots (thousand separators vs decimal)
            parts = amount_str.split('.')
            if len(parts) > 2:
                # Keep only last dot as decimal, remove others
                amount_str = ''.join(parts[:-1]) + '.' + parts[-1]
            
            try:
                amount = float(amount_str)
                if 100 < amount < 100000000:  # Reasonable invoice range
                    all_amounts.append({
                        'amount': amount_str,
                        'value': amount,
                        'currency': 'EUR' if 'eur' in match.group(0).lower() or '€' in match.group(0) else 'CZK',
                        'matched_text': match.group(0)
                    })
                    # Prioritize "bez DPH" or "Součet" (amount without VAT)
                    if 'bez' in match.group(0).lower() and 'dph' in match.group(0).lower():
                        extracted['invoicedTotal'] = amount_str
                        extracted['currency'] = 'EUR' if 'eur' in match.group(0).lower() else 'CZK'
                        break
                    if 'součet' in match.group(0).lower() or 'základ' in match.group(0).lower():
                        extracted['invoicedTotal'] = amount_str
                        extracted['currency'] = 'EUR' if 'eur' in match.group(0).lower() else 'CZK'
                        break
            except ValueError:
                continue
    
    # If no labeled amount, use largest
    if not extracted['invoicedTotal'] and all_amounts:
        all_amounts.sort(key=lambda x: x['value'], reverse=True)
        largest = all_amounts[0]
        extracted['invoicedTotal'] = largest['amount']
        extracted['currency'] = largest['currency']
    
    # Extract dates - handle Czech format: "Datum vystavení : 03.12.2025"
    # Invoice date patterns
    invoice_date_patterns = [
        r'datum\s+vystavení\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{2,4})',  # "Datum vystavení : 03.12.2025"
        r'(?:invoice\s*date|date\s*of\s*invoice|issued)\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})',
        r'datum\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})',
    ]
    for pattern in invoice_date_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            extracted['invoiceDate'] = match.group(1)
            break
    
    # Due date patterns
    due_date_patterns = [
        r'datum\s+splatnosti\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{2,4})',  # "Datum splatnosti: 02.01.2026"
        r'(?:due\s*date|payment\s*due|pay\s*by|splatnost)\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})',
    ]
    for pattern in due_date_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            extracted['invoiceDueDate'] = match.group(1)
            break
    
    # Extract number of MDs (Počet MJ) - look for "MD 18 15 000,00" format in invoice lines
    # Pattern: "MD 18 15 000,00 21% 270 000,00" - MD is followed by number of MDs, then rate
    # The format is: "MD [count] [rate] [percentage] [total]"
    md_line_pattern = r'MD\s+([0-9]+)\s+([0-9\s,]+[.,][0-9]+)'  # "MD 18 15 000,00"
    
    md_values = []
    md_rates = []
    matches = re.finditer(md_line_pattern, text, re.IGNORECASE)
    for match in matches:
        try:
            # First group is MD count
            md_count = int(match.group(1))
            if 0 < md_count < 1000:  # Reasonable range
                md_values.append(md_count)
            
            # Second group is MD rate
            rate_str = match.group(2).strip().replace(' ', '').replace(',', '.')
            rate = float(rate_str)
            if 100 < rate < 100000:  # Reasonable MD rate range
                md_rates.append(rate_str)
        except (ValueError, IndexError):
            continue
    
    # Sum up all MD values found (multiple invoice lines)
    if md_values:
        total_mds = sum(md_values)
        extracted['numberOfMDs'] = str(total_mds)
    
    # Use the first MD rate found (they should all be the same)
    if md_rates:
        extracted['mdRate'] = md_rates[0]
    
    # Also check for explicit "Počet MJ:" label as fallback
    if not extracted['numberOfMDs']:
        počet_match = re.search(r'počet\s+mj\s*:?\s*([0-9]+)', text, re.IGNORECASE)
        if počet_match:
            extracted['numberOfMDs'] = počet_match.group(1)
    
    # Also check for "Cena MJ:" label as fallback
    if not extracted['mdRate']:
        cena_match = re.search(r'cena\s+mj\s*:?\s*([0-9\s,]+[.,][0-9]+)', text, re.IGNORECASE)
        if cena_match:
            rate_str = cena_match.group(1).strip().replace(' ', '').replace(',', '.')
            try:
                rate = float(rate_str)
                if 100 < rate < 100000:
                    extracted['mdRate'] = rate_str
            except ValueError:
                pass
    
    # Extract client (Odběratel / Buyer)
    # Pattern: "Odběratel:" followed by lines, then company name with legal suffix
    # The company name is typically on a line after "Odběratel:" and contains "s.r.o." or similar
    client_patterns = [
        r'odběratel\s*:?\s*[^\n]*\n[^\n]*\n[^\n]*\n([^\n]+(?:s\.r\.o\.|s\.r\.o|a\.s\.|spol\.|spol|Ltd\.|Inc\.|LLC|GmbH|Corp\.))',  # Multi-line: skip 3 lines after Odběratel
        r'odběratel\s*:?\s*[^\n]*\n[^\n]*\n([^\n]+(?:s\.r\.o\.|s\.r\.o|a\.s\.|spol\.))',  # Multi-line: skip 2 lines
        r'odběratel\s*:?\s*[^\n]*\n([^\n]+(?:s\.r\.o\.|s\.r\.o|a\.s\.|spol\.))',  # Multi-line: skip 1 line
        r'odběratel\s*:?\s*([^\n]+(?:s\.r\.o\.|s\.r\.o|a\.s\.|spol\.))',  # Single line
        r'buyer\s*:?\s*([^\n]+(?:Ltd\.|Inc\.|LLC|GmbH|Corp\.))',  # English format
        r'client\s*:?\s*([^\n]+)',  # Generic client label
    ]
    
    for pattern in client_patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            client_name = match.group(1).strip()
            # Clean up the client name (remove IČO info, extra whitespace)
            client_name = re.sub(r'\s+IČO:\s*\d+', '', client_name).strip()
            client_name = re.sub(r'^\s*[^\w]*', '', client_name).strip()  # Remove leading non-word chars
            if len(client_name) > 3 and len(client_name) < 200:
                extracted['client'] = client_name
                break
    
    # Default project name if not found
    if not extracted['projectName']:
        extracted['projectName'] = extracted['invoiceNumber'] or 'Imported Invoice'
    
    return extracted


@app.route('/extract', methods=['POST'])
def extract_invoice():
    """Extract invoice data from PDF"""
    try:
        data = request.json
        pdf_base64 = data.get('pdf')
        
        if not pdf_base64:
            return jsonify({'error': 'No PDF data provided'}), 400
        
        # Decode base64 PDF
        pdf_bytes = base64.b64decode(pdf_base64)
        
        # Extract text using pdfplumber
        text = ""
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        
        if not text.strip():
            return jsonify({'error': 'No text extracted from PDF'}), 400
        
        # Extract data using patterns (can be enhanced with ML)
        extracted = extract_with_patterns(text)
        
        return jsonify({
            'success': True,
            'extractedData': extracted,
            'rawText': text[:2000],  # First 2000 chars for preview
            'fullTextLength': len(text)
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'service': 'invoice-ml-extraction'})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

