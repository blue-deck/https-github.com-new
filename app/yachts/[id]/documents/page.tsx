"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  FilePlus2,
  FileText,
  FolderOpen,
  LoaderCircle,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
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

const fieldLabelClassName =
  "mb-2 block text-sm font-bold text-slate-700";
const fieldClassName =
  "h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/15 sm:text-sm";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploading(false);

    await fetchDocuments();
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
    <main className="bd-app-page min-h-screen bg-[#f4f7fb] px-4 pb-20 pt-6 text-slate-900 sm:px-6 sm:pt-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <Link
          href={`/yachts/${yachtId}`}
          className="bd-focus inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-bold text-slate-600 transition hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to yacht
        </Link>

        <header className="mt-3 flex flex-col gap-5 border-b border-slate-200 pb-7 sm:mt-5 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
              <FolderOpen className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-800">
                Document Vault
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Yacht Documents
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Store certificates, licenses, manuals, insurance, contracts and
                crew files.
              </p>
            </div>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm">
            <FileText className="h-4 w-4 text-cyan-800" aria-hidden />
            {documents.length} {documents.length === 1 ? "document" : "documents"}
          </div>
        </header>

        <div className="mt-7 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-800">
                <FilePlus2 className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Upload Document
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  Add the file details and choose a document to upload.
                </p>
              </div>
            </div>

            {!accessLoaded ? (
              <div className="mt-6 flex items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                <LoaderCircle
                  className="h-5 w-5 animate-spin text-cyan-800"
                  aria-hidden
                />
                Checking document access...
              </div>
            ) : !canManageDocuments ? (
              <div className="mt-6 flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <ShieldCheck
                  className="mt-0.5 h-5 w-5 shrink-0 text-cyan-800"
                  aria-hidden
                />
                <p className="text-sm leading-6 text-slate-600">
                  Documents are read-only here. Only the registered yacht owner
                  can upload or delete files.
                </p>
              </div>
            ) : (
              <form
                className="mt-6 space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void uploadDocument();
                }}
              >
                <div>
                  <label
                    htmlFor="document-title"
                    className={fieldLabelClassName}
                  >
                    Document title
                  </label>
                  <input
                    id="document-title"
                    placeholder="Enter document title"
                    value={title}
                    onChange={(event) =>
                      setTitle(capitalizeFirstLetter(event.target.value))
                    }
                    autoCapitalize="sentences"
                    maxLength={120}
                    required
                    className={fieldClassName}
                  />
                </div>

                <div>
                  <label
                    htmlFor="document-category"
                    className={fieldLabelClassName}
                  >
                    Category
                  </label>
                  <select
                    id="document-category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className={fieldClassName}
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
                </div>

                <DateTextField
                  label={
                    <span className="flex items-center justify-between gap-3">
                      <span>Expiry date</span>
                      <span className="text-xs font-semibold text-slate-400">
                        Optional
                      </span>
                    </span>
                  }
                  value={expiryDate}
                  onChange={setExpiryDate}
                  placeholder="DD/MM/YYYY"
                  invalidText="Enter a valid expiry date in DD/MM/YYYY format."
                  labelClassName={fieldLabelClassName}
                  inputClassName={fieldClassName}
                />

                <div>
                  <span className={fieldLabelClassName}>File</span>
                  <input
                    ref={fileInputRef}
                    id="document-file"
                    type="file"
                    onChange={(event) =>
                      setFile(event.target.files?.[0] || null)
                    }
                    required
                    className="sr-only"
                  />
                  <label
                    htmlFor="document-file"
                    className="bd-focus flex min-h-20 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 transition hover:border-cyan-700 hover:bg-cyan-50/50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-cyan-800 shadow-sm ring-1 ring-slate-200">
                      <UploadCloud className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-800">
                        {file ? file.name : "Choose a file"}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {file
                          ? "Ready to upload"
                          : "PDF, image or office document"}
                      </span>
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={uploading}
                  aria-busy={uploading}
                  className="bd-focus inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-cyan-900 disabled:cursor-wait disabled:opacity-60"
                >
                  {uploading ? (
                    <LoaderCircle
                      className="h-5 w-5 animate-spin"
                      aria-hidden
                    />
                  ) : (
                    <UploadCloud className="h-5 w-5" aria-hidden />
                  )}
                  {uploading ? "Uploading..." : "Upload Document"}
                </button>
              </form>
            )}
          </section>

          <section className="min-h-[420px] rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <h2 className="text-xl font-black text-slate-950">Documents</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Uploaded yacht records and expiry dates.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
                Total: {documents.length}
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {loading ? (
                <div className="flex min-h-64 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-center">
                    <LoaderCircle
                      className="mx-auto h-7 w-7 animate-spin text-cyan-800"
                      aria-hidden
                    />
                    <p className="mt-3 text-sm font-semibold text-slate-500">
                      Loading documents...
                    </p>
                  </div>
                </div>
              ) : null}

              {!loading
                ? documents.map((document) => (
                    <article
                      key={document.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-700">
                            {getFileBadge(document.file_name)}
                          </div>

                          <div className="min-w-0">
                            <h3 className="truncate text-base font-black text-slate-950">
                              {document.title || "Untitled document"}
                            </h3>
                            <p
                              className="mt-1 truncate text-sm text-slate-500"
                              title={document.file_name || undefined}
                            >
                              {document.file_name || "File name unavailable"}
                            </p>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                                {document.category || "Uncategorized"}
                              </span>
                              {document.expiry_date ? (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                                    isExpiringSoon(document.expiry_date)
                                      ? "bg-amber-50 text-amber-800"
                                      : "bg-emerald-50 text-emerald-800"
                                  }`}
                                >
                                  <CalendarDays
                                    className="h-3.5 w-3.5"
                                    aria-hidden
                                  />
                                  {formatDateForDisplay(document.expiry_date)}
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-slate-400">
                                  No expiry date
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {document.file_url ? (
                            <a
                              href={document.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="bd-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
                            >
                              <ExternalLink
                                className="h-4 w-4"
                                aria-hidden
                              />
                              Open
                            </a>
                          ) : null}

                          {canManageDocuments ? (
                            <button
                              type="button"
                              onClick={() => deleteDocument(document)}
                              aria-label={`Delete ${document.title || "document"}`}
                              className="bd-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold text-rose-700 transition hover:bg-rose-50"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))
                : null}

              {!loading && documents.length === 0 ? (
                <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center">
                  <div>
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-200">
                      <FileText className="h-6 w-6" aria-hidden />
                    </span>
                    <h3 className="mt-4 text-base font-black text-slate-800">
                      No documents uploaded yet.
                    </h3>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                      Uploaded files will appear here with their category and
                      expiry date.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
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
