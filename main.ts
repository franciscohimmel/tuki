import { serve } from "https://deno.land/std@0.197.0/http/server.ts";
import forge from "https://esm.sh/node-forge@1.3.1";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Solo POST", { status: 405 });
  }

  const form = await req.formData();
  const file = form.get("file") as File;

  if (!file) {
    return new Response("Archivo no enviado", { status: 400 });
  }

  const pem = await file.text();

  try {
    const base64 = pem
      .replace("-----BEGIN CMS-----", "")
      .replace("-----END CMS-----", "")
      .replace(/\s/g, "");

    const der = forge.util.decode64(base64);
    const asn1 = forge.asn1.fromDer(der);
    const p7 = forge.pkcs7.messageFromAsn1(asn1);

    const content = p7.content.toString();
    const match = content.match(/<\?xml[\s\S]*?<\/tns:auditoria>/);

    if (!match) {
      return new Response("No se encontró XML", { status: 400 });
    }

    return new Response(match[0], {
      headers: { "Content-Type": "application/xml" },
    });
  } catch (e) {
    return new Response("Error al procesar el archivo", { status: 500 });
  }
});
