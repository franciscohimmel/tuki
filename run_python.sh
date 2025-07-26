#!/bin/bash

# PEM to CSV Converter (Python version)
# This script runs the Python-based converter

echo "🚀 Starting PEM to CSV Converter (Python version)..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

# Check if pip is available
if ! command -v pip &> /dev/null && ! command -v pip3 &> /dev/null; then
    echo "❌ pip is not installed. Please install pip first."
    exit 1
fi

# Install required dependencies if not already installed
echo "📦 Checking dependencies..."
python3 -c "import asn1crypto" 2>/dev/null || {
    echo "📦 Installing asn1crypto..."
    pip3 install asn1crypto
}

# Run the converter
echo "🔧 Running PEM to CSV converter..."
python3 pem_to_csv.py "$@"