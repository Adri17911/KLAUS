#!/usr/bin/env python3
"""
Train ML model using collected feedback data
This can be run periodically to improve extraction accuracy
"""

import json
import os
import re
from typing import List, Dict, Any
from collections import defaultdict

FEEDBACK_FILE = os.path.join(os.path.dirname(__file__), '..', 'server', 'data', 'invoice-feedback.json')

def load_feedback() -> List[Dict[str, Any]]:
    """Load feedback data from JSON file"""
    if not os.path.exists(FEEDBACK_FILE):
        return []
    
    try:
        with open(FEEDBACK_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading feedback: {e}")
        return []

def analyze_corrections(feedback: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze feedback to learn patterns"""
    patterns = {
        'projectName': defaultdict(int),
        'invoicedTotal': defaultdict(int),
        'currency': defaultdict(int),
        'invoiceNumber': defaultdict(int),
    }
    
    corrections_count = {
        'projectName': 0,
        'invoicedTotal': 0,
        'currency': 0,
        'invoiceNumber': 0,
    }
    
    for entry in feedback:
        corrections = entry.get('corrections', {})
        raw_text = entry.get('rawText', '').lower()
        corrected = entry.get('correctedData', {})
        extracted = entry.get('extractedData', {})
        
        # Learn patterns for project name
        if corrections.get('projectName'):
            corrections_count['projectName'] += 1
            # Find context around corrected project name
            project_name = corrected.get('projectName', '').lower()
            if project_name in raw_text:
                # Extract context (words before/after)
                idx = raw_text.find(project_name)
                context = raw_text[max(0, idx-50):min(len(raw_text), idx+len(project_name)+50)]
                # Look for common prefixes
                for prefix in ['project', 'description', 'service', 'item', 'předmět', 'název', 'účel']:
                    if prefix in context:
                        patterns['projectName'][prefix] += 1
        
        # Learn patterns for invoice total
        if corrections.get('invoicedTotal'):
            corrections_count['invoicedTotal'] += 1
            total = corrected.get('invoicedTotal', '')
            if total:
                # Find context around the amount
                total_str = str(total).replace('.', r'\.').replace(',', r',')
                pattern = rf'({total_str})'
                matches = list(re.finditer(pattern, raw_text))
                for match in matches:
                    context = raw_text[max(0, match.start()-30):min(len(raw_text), match.end()+30)]
                    for keyword in ['celkem', 'total', 'amount', 'suma', 'částka', 'k úhradě']:
                        if keyword in context:
                            patterns['invoicedTotal'][keyword] += 1
        
        # Learn currency patterns
        if corrections.get('currency'):
            corrections_count['currency'] += 1
            currency = corrected.get('currency', '')
            patterns['currency'][currency] += 1
    
    return {
        'patterns': dict(patterns),
        'corrections_count': corrections_count,
        'total_feedback': len(feedback)
    }

def improve_patterns(analysis: Dict[str, Any]) -> Dict[str, List[str]]:
    """Generate improved regex patterns based on feedback"""
    improved = {
        'projectName': [],
        'invoicedTotal': [],
    }
    
    # Improve project name patterns based on learned prefixes
    project_prefixes = analysis['patterns'].get('projectName', {})
    if project_prefixes:
        sorted_prefixes = sorted(project_prefixes.items(), key=lambda x: x[1], reverse=True)
        for prefix, count in sorted_prefixes[:5]:  # Top 5
            improved['projectName'].append(f'{prefix}\\s*:?\\s*([^\\n]{{5,100}})')
    
    # Improve total amount patterns
    total_keywords = analysis['patterns'].get('invoicedTotal', {})
    if total_keywords:
        sorted_keywords = sorted(total_keywords.items(), key=lambda x: x[1], reverse=True)
        for keyword, count in sorted_keywords[:5]:  # Top 5
            improved['invoicedTotal'].append(f'{keyword}\\s*:?\\s*([0-9\\s,]+[.,]?[0-9]*)')
    
    return improved

def main():
    """Main training function"""
    print("Loading feedback data...")
    feedback = load_feedback()
    
    if not feedback:
        print("No feedback data found. Process some invoices and make corrections to start learning.")
        return
    
    print(f"Loaded {len(feedback)} feedback entries")
    
    print("Analyzing corrections...")
    analysis = analyze_corrections(feedback)
    
    print("\n=== Correction Statistics ===")
    for field, count in analysis['corrections_count'].items():
        if count > 0:
            print(f"{field}: {count} corrections")
    
    print("\n=== Learned Patterns ===")
    improved = improve_patterns(analysis)
    
    for field, patterns in improved.items():
        if patterns:
            print(f"\n{field} patterns:")
            for pattern in patterns:
                print(f"  - {pattern}")
    
    # Save improved patterns (could be used to update extraction logic)
    output_file = os.path.join(os.path.dirname(__file__), 'learned_patterns.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'patterns': improved,
            'statistics': analysis,
            'last_trained': str(os.path.getmtime(FEEDBACK_FILE)) if os.path.exists(FEEDBACK_FILE) else None
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\nLearned patterns saved to {output_file}")
    print("\nTraining complete! Use these patterns to improve extraction.")

if __name__ == '__main__':
    main()


