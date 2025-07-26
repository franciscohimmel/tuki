#!/usr/bin/env python3
"""
PEM to CSV Converter
Extracts XML content from PEM files using ASN.1 parsing and converts to CSV.
"""

import os
import sys
import argparse
import base64
import re
import csv
from typing import Dict, List, Any, Optional
import xml.etree.ElementTree as ET
from pathlib import Path

try:
    from asn1crypto import cms, core
except ImportError:
    print("❌ asn1crypto library not found. Installing...")
    os.system("pip install asn1crypto")
    from asn1crypto import cms, core


def find_pem_files(directory: str = ".") -> List[str]:
    """Find all PEM files in the specified directory."""
    pem_files = []
    for file in os.listdir(directory):
        if file.endswith(".pem"):
            pem_files.append(file)
    return sorted(pem_files)


def select_pem_file(file_path: Optional[str] = None) -> str:
    """Interactive file selection or use provided file path."""
    if file_path:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        return file_path
    
    print("🔍 Looking for PEM files in current directory...")
    pem_files = find_pem_files()
    
    if not pem_files:
        print("❌ No PEM files found in current directory")
        print("Usage: python pem_to_csv.py --file <path-to-pem-file>")
        sys.exit(1)
    
    print("\n📁 Available PEM files:")
    for i, file in enumerate(pem_files, 1):
        print(f"  {i}. {file}")
    
    while True:
        try:
            choice = input("\n📝 Enter the number of the file you want to process (or press Enter for file 1): ").strip()
            if not choice:
                choice = "1"
            
            selection = int(choice) - 1
            if 0 <= selection < len(pem_files):
                return pem_files[selection]
            else:
                print("❌ Invalid selection. Please try again.")
        except ValueError:
            print("❌ Please enter a valid number.")


def extract_xml_from_pem(pem_content: str) -> str:
    """Extract XML content from PEM file using ASN.1 parsing."""
    try:
        # Remove PEM headers and decode base64
        lines = pem_content.strip().split('\n')
        base64_content = ""
        inside_pem = False
        
        for line in lines:
            line = line.strip()
            if line.startswith("-----BEGIN"):
                inside_pem = True
                continue
            elif line.startswith("-----END"):
                inside_pem = False
                break
            elif inside_pem:
                base64_content += line
        
        if not base64_content:
            raise ValueError("No base64 content found in PEM file")
        
        # Decode base64 to DER
        der_data = base64.b64decode(base64_content)
        
        # Try to parse as CMS/PKCS#7
        try:
            cms_obj = cms.ContentInfo.load(der_data)
            
            # Extract content
            if cms_obj['content_type'].dotted == '1.2.840.113549.1.7.1':  # data
                content = cms_obj['content'].contents
                content_str = content.decode('utf-8', errors='ignore')
            elif cms_obj['content_type'].dotted == '1.2.840.113549.1.7.2':  # signedData
                signed_data = cms_obj['content']
                if 'encap_content_info' in signed_data and signed_data['encap_content_info']['content']:
                    content = signed_data['encap_content_info']['content'].contents
                    content_str = content.decode('utf-8', errors='ignore')
                else:
                    content_str = str(signed_data)
            else:
                content_str = str(cms_obj)
                
        except Exception as e:
            print(f"⚠️  CMS parsing failed: {e}")
            # Fallback: try to find XML directly in the DER data
            content_str = der_data.decode('utf-8', errors='ignore')
        
        # Search for XML content
        xml_pattern = r'<\?xml.*?</[^>]+>'
        xml_match = re.search(xml_pattern, content_str, re.DOTALL | re.IGNORECASE)
        
        if xml_match:
            return xml_match.group(0)
        
        # Alternative search patterns
        xml_patterns = [
            r'<[^>]+>.*?</[^>]+>',  # Any XML-like content
            r'<\w+[^>]*>.*?</\w+>',  # Standard XML elements
        ]
        
        for pattern in xml_patterns:
            xml_match = re.search(pattern, content_str, re.DOTALL)
            if xml_match:
                xml_content = xml_match.group(0)
                # Check if it looks like valid XML
                if '<' in xml_content and '>' in xml_content:
                    return xml_content
        
        raise ValueError("No XML content found in PEM file")
        
    except Exception as e:
        raise RuntimeError(f"Failed to extract XML from PEM: {str(e)}")


def xml_to_dict(element: ET.Element, parent_key: str = "") -> Dict[str, Any]:
    """Convert XML element to dictionary with flattened structure."""
    result = {}
    
    # Add attributes
    for attr_name, attr_value in element.attrib.items():
        key = f"{parent_key}.@{attr_name}" if parent_key else f"@{attr_name}"
        result[key] = attr_value
    
    # Add text content
    if element.text and element.text.strip():
        text_key = f"{parent_key}.#text" if parent_key else "#text"
        result[text_key] = element.text.strip()
    
    # Group children by tag name
    children_by_tag = {}
    for child in element:
        tag = child.tag
        if tag not in children_by_tag:
            children_by_tag[tag] = []
        children_by_tag[tag].append(child)
    
    # Process children
    for tag, children in children_by_tag.items():
        if len(children) == 1:
            # Single child
            child_key = f"{parent_key}.{tag}" if parent_key else tag
            child_dict = xml_to_dict(children[0], child_key)
            result.update(child_dict)
        else:
            # Multiple children with same tag
            for i, child in enumerate(children):
                child_key = f"{parent_key}.{tag}[{i}]" if parent_key else f"{tag}[{i}]"
                child_dict = xml_to_dict(child, child_key)
                result.update(child_dict)
    
    return result


def dict_to_csv(data: Dict[str, Any], output_file: str) -> None:
    """Convert dictionary to CSV file."""
    if not data:
        raise ValueError("No data to convert to CSV")
    
    # Write CSV
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        
        # Write header
        headers = list(data.keys())
        writer.writerow(headers)
        
        # Write data row
        values = [str(data.get(header, "")) for header in headers]
        writer.writerow(values)


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Convert PEM files with XML content to CSV")
    parser.add_argument("--file", "-f", help="Path to PEM file to process")
    args = parser.parse_args()
    
    try:
        print("🚀 PEM to CSV Converter")
        print("========================\n")
        
        # Select PEM file
        pem_file_path = select_pem_file(args.file)
        print(f"\n📖 Reading PEM file: {pem_file_path}")
        
        # Read PEM file
        with open(pem_file_path, 'r', encoding='utf-8') as f:
            pem_content = f.read()
        print("✅ PEM file loaded successfully")
        
        # Extract XML
        print("🔍 Extracting XML content using ASN.1 parsing...")
        xml_content = extract_xml_from_pem(pem_content)
        print("✅ XML content extracted successfully")
        
        # Parse XML
        print("🔄 Parsing XML to dictionary structure...")
        try:
            root = ET.fromstring(xml_content)
            xml_dict = xml_to_dict(root)
        except ET.ParseError as e:
            print(f"⚠️  XML parsing error: {e}")
            # Try to clean up the XML
            xml_content = re.sub(r'[^\x20-\x7E\n\r\t]', '', xml_content)  # Remove non-printable chars
            root = ET.fromstring(xml_content)
            xml_dict = xml_to_dict(root)
        
        print("✅ XML parsed successfully")
        
        # Convert to CSV
        print("📊 Converting to CSV format...")
        output_file = Path(pem_file_path).stem + ".csv"
        dict_to_csv(xml_dict, output_file)
        print("✅ CSV conversion completed")
        
        print(f"\n🎉 Conversion completed successfully!")
        print(f"📁 Input:  {pem_file_path}")
        print(f"📁 Output: {output_file}")
        
        # Show preview
        print(f"\n📋 CSV Preview:")
        print("=" * 50)
        with open(output_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            for i, line in enumerate(lines[:5]):  # Show first 5 lines
                print(f"{i+1}: {line.strip()}")
            if len(lines) > 5:
                print(f"... and {len(lines) - 5} more lines")
        
    except KeyboardInterrupt:
        print("\n❌ Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()