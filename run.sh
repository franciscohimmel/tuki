#!/bin/bash

# PEM to CSV Converter Runner
# This script runs the Deno TypeScript converter

echo "🚀 Starting PEM to CSV Converter..."

# Check if Deno is installed
if ! command -v deno &> /dev/null; then
    echo "❌ Deno is not installed. Please install Deno first:"
    echo "   curl -fsSL https://deno.land/install.sh | sh"
    exit 1
fi

# Run the converter with proper permissions
deno run --allow-read --allow-write --allow-net pem-to-csv.ts "$@"