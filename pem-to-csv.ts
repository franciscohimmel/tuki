#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net

import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";
import { exists } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { dirname, join, basename } from "https://deno.land/std@0.208.0/path/mod.ts";
import forge from "https://esm.sh/node-forge@1.3.1";

interface XMLNode {
  [key: string]: string | XMLNode | XMLNode[];
}

// Simple XML parser for converting to flat structure
function parseXMLToObject(xmlString: string): XMLNode {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");
  
  function nodeToObject(node: Element): XMLNode {
    const obj: XMLNode = {};
    
    // Add attributes
    for (const attr of Array.from(node.attributes)) {
      obj[`@${attr.name}`] = attr.value;
    }
    
    // Add child nodes
    const children = Array.from(node.children);
    if (children.length === 0) {
      // Leaf node with text content
      const textContent = node.textContent?.trim();
      if (textContent) {
        obj["#text"] = textContent;
      }
    } else {
      for (const child of children) {
        const childName = child.tagName;
        const childObj = nodeToObject(child);
        
        if (obj[childName]) {
          // Multiple elements with same name - convert to array
          if (!Array.isArray(obj[childName])) {
            obj[childName] = [obj[childName] as XMLNode];
          }
          (obj[childName] as XMLNode[]).push(childObj);
        } else {
          obj[childName] = childObj;
        }
      }
    }
    
    return obj;
  }
  
  const rootElement = doc.documentElement;
  if (!rootElement) {
    throw new Error("Invalid XML: No root element found");
  }
  
  return { [rootElement.tagName]: nodeToObject(rootElement) };
}

// Flatten nested object to create CSV rows
function flattenObject(obj: any, prefix = ""): Record<string, string> {
  const flattened: Record<string, string> = {};
  
  for (const key in obj) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === "object" && item !== null) {
          Object.assign(flattened, flattenObject(item, `${newKey}[${index}]`));
        } else {
          flattened[`${newKey}[${index}]`] = String(item);
        }
      });
    } else if (typeof value === "object" && value !== null) {
      Object.assign(flattened, flattenObject(value, newKey));
    } else {
      flattened[newKey] = String(value);
    }
  }
  
  return flattened;
}

// Convert object to CSV format
function objectToCSV(data: Record<string, string>[]): string {
  if (data.length === 0) return "";
  
  const headers = Array.from(new Set(data.flatMap(row => Object.keys(row))));
  const csvRows = [headers.join(",")];
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header] || "";
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(","));
  }
  
  return csvRows.join("\n");
}

// Extract XML from PEM file using ASN.1
function extractXMLFromPEM(pemContent: string): string {
  try {
    // Handle different PEM formats
    let base64Content = pemContent;
    const pemHeaders = [
      "-----BEGIN CMS-----",
      "-----END CMS-----",
      "-----BEGIN PKCS7-----",
      "-----END PKCS7-----",
      "-----BEGIN CERTIFICATE-----",
      "-----END CERTIFICATE-----"
    ];
    
    // Remove PEM headers/footers
    for (const header of pemHeaders) {
      base64Content = base64Content.replace(header, "");
    }
    base64Content = base64Content.replace(/\s/g, "");

    const der = forge.util.decode64(base64Content);
    const asn1 = forge.asn1.fromDer(der);
    
    // Try to parse as PKCS#7/CMS first
    try {
      const p7 = forge.pkcs7.messageFromAsn1(asn1);
      const content = p7.content.toString();
      
      // Look for XML content
      const xmlMatch = content.match(/<\?xml[\s\S]*?<\/[^>]+>/i);
      if (xmlMatch) {
        return xmlMatch[0];
      }
    } catch (e) {
      console.warn("Failed to parse as PKCS#7, trying direct ASN.1 parsing");
    }
    
    // If PKCS#7 parsing fails, try to find XML in ASN.1 structure
    function searchASN1ForXML(obj: any): string | null {
      if (typeof obj === "string") {
        const xmlMatch = obj.match(/<\?xml[\s\S]*?<\/[^>]+>/i);
        if (xmlMatch) return xmlMatch[0];
      }
      
      if (obj && typeof obj === "object") {
        if (obj.value) {
          const result = searchASN1ForXML(obj.value);
          if (result) return result;
        }
        
        if (Array.isArray(obj)) {
          for (const item of obj) {
            const result = searchASN1ForXML(item);
            if (result) return result;
          }
        }
      }
      
      return null;
    }
    
    const xmlContent = searchASN1ForXML(asn1);
    if (xmlContent) {
      return xmlContent;
    }
    
    throw new Error("No XML content found in PEM file");
  } catch (error) {
    throw new Error(`Failed to extract XML from PEM: ${error.message}`);
  }
}

// Interactive file selection
async function selectPEMFile(): Promise<string> {
  const args = parse(Deno.args);
  
  if (args.file) {
    return args.file;
  }
  
  console.log("🔍 Looking for PEM files in current directory...");
  
  const pemFiles: string[] = [];
  for await (const entry of Deno.readDir(".")) {
    if (entry.isFile && entry.name.endsWith(".pem")) {
      pemFiles.push(entry.name);
    }
  }
  
  if (pemFiles.length === 0) {
    console.log("❌ No PEM files found in current directory");
    console.log("Usage: deno run --allow-read --allow-write pem-to-csv.ts --file <path-to-pem-file>");
    Deno.exit(1);
  }
  
  console.log("\n📁 Available PEM files:");
  pemFiles.forEach((file, index) => {
    console.log(`  ${index + 1}. ${file}`);
  });
  
  console.log("\n📝 Enter the number of the file you want to process (or press Enter for file 1):");
  
  const input = prompt("Selection: ") || "1";
  const selection = parseInt(input) - 1;
  
  if (selection < 0 || selection >= pemFiles.length) {
    console.log("❌ Invalid selection");
    Deno.exit(1);
  }
  
  return pemFiles[selection];
}

// Main function
async function main() {
  try {
    console.log("🚀 PEM to CSV Converter");
    console.log("========================\n");
    
    const pemFilePath = await selectPEMFile();
    
    console.log(`\n📖 Reading PEM file: ${pemFilePath}`);
    
    if (!await exists(pemFilePath)) {
      throw new Error(`File not found: ${pemFilePath}`);
    }
    
    const pemContent = await Deno.readTextFile(pemFilePath);
    console.log("✅ PEM file loaded successfully");
    
    console.log("🔍 Extracting XML content using ASN.1 parsing...");
    const xmlContent = extractXMLFromPEM(pemContent);
    console.log("✅ XML content extracted successfully");
    
    console.log("🔄 Parsing XML to object structure...");
    const xmlObject = parseXMLToObject(xmlContent);
    console.log("✅ XML parsed successfully");
    
    console.log("📊 Converting to CSV format...");
    const flattened = flattenObject(xmlObject);
    const csvData = objectToCSV([flattened]);
    console.log("✅ CSV conversion completed");
    
    // Generate output filename
    const baseName = basename(pemFilePath, ".pem");
    const outputPath = `${baseName}.csv`;
    
    console.log(`💾 Saving CSV to: ${outputPath}`);
    await Deno.writeTextFile(outputPath, csvData);
    
    console.log("\n🎉 Conversion completed successfully!");
    console.log(`📁 Input:  ${pemFilePath}`);
    console.log(`📁 Output: ${outputPath}`);
    
    // Show preview of CSV content
    const lines = csvData.split("\n");
    console.log("\n📋 CSV Preview (first 5 lines):");
    console.log("=" .repeat(50));
    lines.slice(0, 5).forEach(line => console.log(line));
    if (lines.length > 5) {
      console.log(`... and ${lines.length - 5} more lines`);
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    Deno.exit(1);
  }
}

// Run the script
if (import.meta.main) {
  await main();
}