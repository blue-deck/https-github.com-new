"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  DateTextField,
  formatDateForDisplay,
} from "../../../components/DateTextField";
import {
  parsePrivateStorageReference,
  resolvePrivateStorageUrls,
  type PrivateStorageReference,
} from "../../../lib/privateStorageUrls";
import { createSafeStoragePath } from "../../../lib/storage";
import { supabase } from "../../../lib/supabase";
import { resolveSupabaseUrl } from "../../../lib/supabaseConfig";

const configuredSupabaseUrl = resolveSupabaseUrl(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

type YachtDocument = {
  id: string;
  title: string | null;
  category: string | null;
  file_url: string | null;
  storage_reference: string | null;
  file_name: string | null;
  expiry_date: string | null;
  created_at: string;
};

export default function DocumentsPage() {
  const pathname = usePathname();
  const yachtId = pathname.split("/")[2];

  const [documents, setDocuments] = useState<YachtDocument[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Crew");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [canManageDocuments, setCanManageDocuments] = useState(false);

  async function fetchDocumentAccess() {
    if (!yachtId) return;

    const [
      {
        data: { user },
      },
      { data: yacht },
    ] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("yachts")
        .select("owner_id")
        .eq("id", yachtId)
        .maybeSingle(),
    ]);

    setCanManageDocuments(Boolean(user && yacht?.owner_id === user.id));
    setAccessLoaded(true);
  }

  async function fetchDocuments() {
    if (!yachtId) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("yacht_documents")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const rows = data || [];
    const signedUrls = await resolvePrivateStorageUrls(
      supabase,
      rows.map(
        (document): PrivateStorageReference => ({
          value: document.file_url,
          defaultBucket: "documents",
          allowedBuckets: ["documents", "yacht-documents"],
          expectedPathOwner: yachtId,
        }),
      ),
      configuredSupabaseUrl,
    );

    setDocuments(
      rows.map((document, index) => ({
        ...document,
        storage_reference: document.file_url,
        file_url: signedUrls[index] || null,
      })),
    );
    setLoading(false);
  }

  async function uploadDocument() {
    if (!canManageDocuments) {
      alert("Only the registered yacht owner can upload documents.");
      return;
    }

    if (!title.trim()) {
      alert("Document title is required");
      return;
    }

    if (!file) {
      alert("Please select a file");
      return;
    }

    setUploading(true);

    const filePath = createSafeStoragePath(yachtId, file, "document");
    const storage = supabase.storage.from("documents");
    const { error: uploadError } = await storage.upload(filePath, file, {
      upsert: false,
    });

    if (uploadError) {
      setUploading(false);
      alert(uploadError.message);
      return;
    }

    const { error: insertError } = await supabase
      .from("yacht_documents")
      .insert([
        {
          yacht_id: yachtId,
          title: title.trim(),
          category,
          expiry_date: expiryDate || null,
          file_url: filePath,
          file_name: file.name,
        },
      ]);

    if (insertError) {
      await storage.remove([filePath]);
      setUploading(false);
      alert(insertError.message);
      return;
    }

    setTitle("");
    setCategory("Crew");
    setExpiryDate("");
    setFile(null);
    setUploading(false);

    fetchDocuments();
  }

  async function deleteDocument(document: YachtDocument) {
    if (!canManageDocuments) {
      alert("Only the registered yacht owner can delete documents.");
      return;
    }

    const confirmDelete = confirm("Delete this document?");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("yacht_documents")
      .delete()
      .eq("id", document.id)
      .eq("yacht_id", yachtId);

    if (error) {
      alert(error.message);
      return;
    }

    const storedObject = parsePrivateStorageReference(
      {
        value: document.storage_reference,
        defaultBucket: "documents",
        allowedBuckets: ["documents", "yacht-documents"],
        expectedPathOwner: yachtId,
      },
      configuredSupabaseUrl,
    );
    const cleanupError = storedObject
      ? (
          await supabase.storage
            .from(storedObject.bucket)
            .remove([storedObject.path])
        ).error
      : null;

    await fetchDocuments();

    if (cleanupError) {
      alert(
        "The document record was deleted, but its stored file could not be cleaned up.",
      );
    }
  }

  function getFileBadge(fileName: string | null) {
    if (!fileName) return "FILE";

    const lower = fileName.toLowerCase();

    if (lower.endsWith(".pdf")) return "PDF";
    if (
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".webp")
    ) {
      return "IMG";
    }

    if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "DOC";
    if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) return "XLS";

    return "FILE";
  }

  function isExpiringSoon(expiryDateValue: string | null) {
    if (!expiryDateValue) return false;

    const today = new Date();
    const expiry = new Date(expiryDateValue);
    const differenceMs = expiry.getTime() - today.getTime();
    const daysLeft = differenceMs / (1000 * 60 * 60 * 24);

    return daysLeft <= 30;
  }

  useEffect(() => {
    if (yachtId) {
      fetchDocuments();
      fetchDocumentAccess();
    }
  }, [yachtId]);

  return (
    <main className="bd-app-page min-h-screen bg-[#081120] p-10 text-white">
      <div className="mx-auto max-w-7xl">
        <a href={`/yachts/${yachtId}`} className="text-blue-300">
          ← Back to yacht
        </a>

        <div className="bd-page-hero mt-6 rounded-3xl bg-white/5 p-8">
          <p className="text-gray-400">BlueDeck Documents</p>

          <h1 className="mt-3 text-5xl font-bold">Yacht Documents</h1>

          <p className="mt-4 text-gray-400">
            Store certificates, licenses, manuals, insurance, contracts and crew
            files.
          </p>
        </div>

        <div className="mt-8 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div className="bd-app-card rounded-3xl bg-white/5 p-8">
            <h2 className="text-3xl font-bold">Upload Document</h2>

            {!accessLoaded ? (
              <p className="mt-8 text-gray-400">Checking document access...</p>
            ) : !canManageDocuments ? (
              <p className="mt-8 text-gray-400">
                Documents are read-only here. Only the registered yacht owner
                can upload or delete files.
              </p>
            ) : (
              <form
                className="mt-8 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void uploadDocument();
                }}
              >
                <input
                  placeholder="Document title"
                  value={title}
                  onChange={(event) =>
                    setTitle(capitalizeFirstLetter(event.target.value))
                  }
                  autoCapitalize="sentences"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-4 outline-none"
                />

                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-4 outline-none"
                >
                  <option value="Crew">Crew</option>
                  <option value="License">License</option>
                  <option value="Technical">Technical</option>
                  <option value="Insurance">Insurance</option>
                  <option value="Manual">Manual</option>
                  <option value="Contract">Contract</option>
                  <option value="Yacht Papers">Yacht Papers</option>
                  <option value="Invoice">Invoice</option>
                  <option value="Other">Other</option>
                </select>

                <DateTextField
                  label="Expiry date"
                  value={expiryDate}
                  onChange={setExpiryDate}
                  placeholder="DD/MM/YYYY"
                  invalidText="Enter a valid expiry date in DD/MM/YYYY format."
                  labelClassName="mb-2 block text-sm font-semibold text-gray-300"
                  inputClassName="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-base text-white outline-none transition placeholder:text-gray-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                />

                <input
                  type="file"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  required
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-4"
                />

                {file && (
                  <p className="text-sm text-gray-400">
                    Selected file: {file.name}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full rounded-2xl bg-blue-400 px-5 py-4 font-semibold text-black disabled:opacity-50"
                >
                  {uploading ? "Uploading..." : "Upload Document"}
                </button>
              </form>
            )}
          </div>

          <div className="bd-app-card rounded-3xl bg-white/5 p-8">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold">Documents</h2>

              <p className="text-sm text-gray-400">
                Total: {documents.length}
              </p>
            </div>

            <div className="mt-6 space-y-4">
              {loading && (
                <div className="bd-app-card rounded-2xl border border-white/10 bg-black/20 p-6 text-gray-400">
                  Loading documents...
                </div>
              )}

              {!loading &&
                documents.map((document) => (
                  <div
                    key={document.id}
                    className="bd-app-card rounded-2xl border border-white/10 bg-black/20 p-5"
                  >
                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="rounded-2xl bg-blue-500/20 px-4 py-3 text-sm font-bold text-blue-300">
                          {getFileBadge(document.file_name)}
                        </div>

                        <div>
                          <h3 className="text-2xl font-semibold">
                            {document.title || "Untitled document"}
                          </h3>

                          <p className="mt-2 text-gray-400">
                            {document.category || "Uncategorized"}
                          </p>

                          <p className="mt-1 text-sm text-gray-500">
                            {document.file_name}
                          </p>

                          {document.expiry_date ? (
                            <p
                              className={`mt-1 text-sm ${
                                isExpiringSoon(document.expiry_date)
                                  ? "text-orange-300"
                                  : "text-gray-400"
                              }`}
                            >
                              Expiry:{" "}
                              {formatDateForDisplay(document.expiry_date)}
                            </p>
                          ) : (
                            <p className="mt-1 text-sm text-gray-500">
                              No expiry date
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        {document.file_url && (
                          <a
                            href={document.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl bg-blue-400 px-4 py-2 font-semibold text-black"
                          >
                            Open
                          </a>
                        )}

                        {canManageDocuments && (
                          <button
                            onClick={() => deleteDocument(document)}
                            className="rounded-xl border border-red-500/30 px-4 py-2 font-semibold text-red-300"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

              {!loading && documents.length === 0 && (
                <div className="bd-app-card rounded-2xl border border-white/10 bg-black/20 p-6 text-gray-400">
                  No documents uploaded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function capitalizeFirstLetter(value: string) {
  const firstLetterIndex = value.search(/\p{L}/u);
  if (firstLetterIndex < 0) return value;

  return (
    value.slice(0, firstLetterIndex) +
    value[firstLetterIndex].toLocaleUpperCase() +
    value.slice(firstLetterIndex + 1)
  );
}
