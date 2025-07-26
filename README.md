# PEM to CSV Converter

Scripts that extract XML content from PEM files using ASN.1 parsing and convert it to CSV format. Available in both TypeScript/Deno and Python versions.

## Features

- 🔍 **Interactive file selection** - Automatically finds PEM files in the current directory
- 🔐 **ASN.1 parsing** - Uses ASN.1 libraries to parse PEM files (supports CMS, PKCS#7, certificates)
- 📝 **XML extraction** - Extracts XML content embedded in ASN.1 structures
- 📊 **CSV conversion** - Converts nested XML to flattened CSV format
- 🎯 **Multiple PEM formats** - Supports various PEM types (CMS, PKCS#7, certificates)
- 🐍 **Multiple implementations** - Available in both TypeScript (Deno) and Python

## Prerequisites

### Option 1: Python version (Recommended)
Python 3.6+ with pip:

```bash
# Most Linux distributions come with Python 3 pre-installed
python3 --version

# If not installed:
# Ubuntu/Debian: sudo apt install python3 python3-pip
# CentOS/RHEL: sudo yum install python3 python3-pip
# macOS: brew install python3
```

### Option 2: TypeScript/Deno version
You need Deno installed on your system:

```bash
# Install Deno
curl -fsSL https://deno.land/install.sh | sh

# Add to your PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$HOME/.deno/bin:$PATH"
```

## Usage

### Option 1: Python version (Recommended)

```bash
# Make the script executable (first time only)
chmod +x run_python.sh

# Run with interactive file selection
./run_python.sh

# Or specify a file directly
./run_python.sh --file your-file.pem

# Or run directly with Python
python3 pem_to_csv.py
python3 pem_to_csv.py --file your-file.pem
```

### Option 2: TypeScript/Deno version

```bash
# Make the script executable (first time only)
chmod +x run.sh

# Run with interactive file selection
./run.sh

# Or specify a file directly
./run.sh --file your-file.pem

# Or run directly with Deno
deno run --allow-read --allow-write --allow-net pem-to-csv.ts
deno run --allow-read --allow-write --allow-net pem-to-csv.ts --file your-file.pem
```

## How it works

1. **File Selection**: The script scans the current directory for `*.pem` files and presents them for selection
2. **PEM Reading**: Loads the selected PEM file content
3. **ASN.1 Parsing**: Uses node-forge to decode the PEM file and parse ASN.1 structure
4. **XML Extraction**: Searches for XML content within the ASN.1 structure
5. **XML Parsing**: Converts XML to a nested object structure
6. **Flattening**: Flattens nested XML objects into a flat key-value structure
7. **CSV Generation**: Converts the flattened data to CSV format
8. **Output**: Saves the CSV file with the same base name as the input PEM file

## Supported PEM Formats

- CMS (Cryptographic Message Syntax)
- PKCS#7 (Public Key Cryptography Standards #7)
- X.509 Certificates
- Other ASN.1-encoded PEM files containing XML

## Example Output

Input PEM file: `document.pem`
Output CSV file: `document.csv`

The CSV will contain flattened XML data with dot notation for nested elements:
```csv
rootElement.@attribute,rootElement.childElement.#text,rootElement.arrayElement[0].value
value1,some text,item1
```

## Error Handling

The script handles various error scenarios:
- File not found
- Invalid PEM format
- No XML content in PEM file
- XML parsing errors
- Permission issues

## Dependencies

### Python version
- **Python 3.6+**: Python runtime
- **asn1crypto**: ASN.1 parsing and cryptographic operations (auto-installed)
- **Standard library modules**: xml.etree.ElementTree, csv, pathlib, etc.

### TypeScript/Deno version
- **Deno**: TypeScript/JavaScript runtime
- **node-forge**: ASN.1 and cryptographic operations
- **Deno Standard Library**: File operations, path handling, argument parsing

## Troubleshooting

### "Deno not found" error
Install Deno following the prerequisites section above.

### "No PEM files found" message
Ensure you have `.pem` files in the current directory, or specify a file path using `--file`.

### "No XML content found" error
The PEM file doesn't contain embedded XML data. This script is designed for PEM files that contain XML within their ASN.1 structure.

### Permission errors
Make sure you have read permissions for the input file and write permissions for the output directory.

## License

This script is provided as-is for educational and utility purposes.