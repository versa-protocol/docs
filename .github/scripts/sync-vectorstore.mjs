#!/usr/bin/env node
/**
 * Syncs the docs/ directory in this repo into the OpenAI Vector Store used
 * by the ChatKit Ask AI widget on docs.versa.org.
 *
 * Triggered by the sync-vectorstore.yml GitHub Actions workflow on every
 * push to main that touches docs/*.
 *
 * Required secret: OPENAI_API_KEY
 */

import { readFile, readdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(__dirname, "..", "..", "docs");
const VECTOR_STORE_NAME = "versa-docs";
const DOCS_BASE_URL = "https://docs.versa.org";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not set.");
  process.exit(1);
}

async function openaiRequest(path, options = {}) {
  const res = await fetch(`https://api.openai.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Beta": "assistants=v2",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function findOrCreateVectorStore() {
  const { data } = await openaiRequest("/vector_stores");
  const existing = data.find((vs) => vs.name === VECTOR_STORE_NAME);
  if (existing) {
    console.log(`  Found existing vector store: ${existing.id}`);
    return existing.id;
  }
  const created = await openaiRequest("/vector_stores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: VECTOR_STORE_NAME }),
  });
  console.log(`  Created new vector store: ${created.id}`);
  console.log(`\n  ➜ Add this to your environment:\n`);
  console.log(`    CHATKIT_VECTOR_STORE_ID="${created.id}"\n`);
  return created.id;
}

async function deleteExistingFiles(vectorStoreId) {
  const { data } = await openaiRequest(
    `/vector_stores/${vectorStoreId}/files`
  );
  if (data.length === 0) return;
  console.log(`  Removing ${data.length} existing file(s)…`);
  await Promise.all(
    data.map((f) =>
      openaiRequest(`/vector_stores/${vectorStoreId}/files/${f.id}`, {
        method: "DELETE",
      })
    )
  );
}

async function uploadFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain" });
  const form = new FormData();
  form.append("file", blob, filename.replace(/\.mdx$/, ".md"));
  form.append("purpose", "assistants");

  const res = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `File upload failed for ${filename} (${res.status}): ${text}`
    );
  }
  const { id } = await res.json();
  return id;
}

async function addFilesToVectorStore(vectorStoreId, fileIds) {
  await openaiRequest(`/vector_stores/${vectorStoreId}/file_batches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_ids: fileIds }),
  });
}

async function main() {
  console.log("\nSyncing docs to OpenAI Vector Store…");

  const vectorStoreId = await findOrCreateVectorStore();

  const files = (await readdir(DOCS_DIR)).filter((f) => f.endsWith(".mdx"));
  if (files.length === 0) {
    console.error("  No .mdx files found in docs/");
    process.exit(1);
  }

  await deleteExistingFiles(vectorStoreId);

  console.log(`  Uploading ${files.length} file(s)…`);
  const fileIds = await Promise.all(
    files.map(async (filename) => {
      const raw = await readFile(join(DOCS_DIR, filename), "utf-8");
      const slug = filename.replace(/\.mdx$/, "");
      const url = `${DOCS_BASE_URL}/${slug}`;
      const content =
        `---\n` +
        `canonical_url: ${url}\n` +
        `---\n\n` +
        `> The canonical URL for this page is ${url}\n` +
        `> When referencing this page in an answer, ALWAYS cite it using the full absolute URL above. ` +
        `Never use relative paths like "/${slug}" and never reference the raw source filename.\n\n` +
        raw;
      const id = await uploadFile(filename, content);
      console.log(`  ✓ ${filename} → ${url}`);
      return id;
    })
  );

  await addFilesToVectorStore(vectorStoreId, fileIds);

  console.log(
    `\n✓ Vector store "${VECTOR_STORE_NAME}" (${vectorStoreId}) synced with ${fileIds.length} files.\n`
  );
}

main().catch((err) => {
  console.error("Vector store sync failed:", err.message);
  process.exit(1);
});
