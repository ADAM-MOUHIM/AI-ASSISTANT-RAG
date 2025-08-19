import { useState, useCallback } from 'react';
import { Upload, File as FileIcon, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  groupTag: string;
}

const ALL_GROUPS = [
  'invoice',
  'salary',
  'purchase_order',
  'inventory',
  'employee',
  'network',
  'infra',
  'shipping_order',
];

const API_BASE =
  (import.meta as any)?.env?.VITE_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';
const UPLOAD_URL = `${API_BASE}/api/v1/documents/upload`;

export function UploadDocs() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>(''); // ⬅️ no default
  const [errorMsg, setErrorMsg] = useState<string>(''); // ⬅️ single banner error

  // auth token
  const auth = (() => {
    try { return useAuth?.(); } catch { return undefined; }
  })();
  const token =
    (auth && (auth as any).token) ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('token') ||
    '';

  const blockIfNoGroup = () => {
    if (!selectedGroup) {
      setErrorMsg('Please select a group before uploading.');
      return true;
    }
    return false;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (blockIfNoGroup()) return;               // ⬅️ block
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, [selectedGroup]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    if (blockIfNoGroup()) { e.currentTarget.value = ''; return; } // ⬅️ block
    const selectedFiles = Array.from(e.target.files);
    handleFiles(selectedFiles);
    e.currentTarget.value = '';
  }, [selectedGroup]);

  const handleFiles = useCallback((fileList: File[]) => {
    // group is guaranteed here
    setErrorMsg(''); // clear any banner error
    const newFiles: UploadedFile[] = fileList.map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: f.name,
      size: f.size,
      status: 'uploading',
      progress: 0,
      groupTag: selectedGroup, // capture selection at time of add
    }));

    setFiles((prev) => [...prev, ...newFiles]);

    // start uploads
    newFiles.forEach((uf, idx) => {
      uploadOne(fileList[idx], uf.groupTag, uf.id);
    });
  }, [selectedGroup]);

  const uploadOne = (file: File, groupTag: string, tempId: string) => {
    if (!token) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === tempId
            ? { ...f, status: 'error', error: 'Not authenticated. Please sign in as admin.' }
            : f
        )
      );
      return;
    }

    const form = new FormData();
    form.append('file', file);
    form.append('group_tag', groupTag);

    // dev log: see exactly what is sent (remove later)
    // for (const [k, v] of form.entries()) {
    //   console.debug('[upload form]', k, v instanceof File ? v.name : v);
    // }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', UPLOAD_URL, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const pct = Math.min(100, Math.round((evt.loaded / evt.total) * 100));
      setFiles((prev) => prev.map((f) => (f.id === tempId ? { ...f, progress: pct } : f)));
    };

    xhr.onload = () => {
      const success = xhr.status >= 200 && xhr.status < 300;
      let errorMsg: string | undefined;
      if (!success) {
        try {
          const res = JSON.parse(xhr.responseText || '{}');
          errorMsg = res.detail || res.error || `Upload failed (${xhr.status})`;
        } catch {
          errorMsg = `Upload failed (${xhr.status})`;
        }
      }
      setFiles((prev) =>
        prev.map((f) =>
          f.id === tempId
            ? {
                ...f,
                progress: 100,
                status: success ? 'success' : 'error',
                error: success ? undefined : errorMsg,
              }
            : f
        )
      );
    };

    xhr.onerror = () => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === tempId
            ? { ...f, status: 'error', error: 'Network error while uploading.' }
            : f
        )
      );
    };

    xhr.send(form);
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Upload Documents</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Upload documents to enhance the RAG knowledge base
        </p>
      </div>

      {/* group picker */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-700 dark:text-gray-300">Upload to group</label>
        <select
          value={selectedGroup}
          onChange={(e) => { setSelectedGroup(e.target.value); setErrorMsg(''); }} // clear error when chosen
          className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
        >
          <option value="" disabled>— select a group —</option>
          {ALL_GROUPS.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        {!token && (
          <span className="text-xs text-red-500">
            Sign in as admin to upload (server enforces this).
          </span>
        )}
      </div>

      {/* banner error (single) */}
      {errorMsg && (
        <div className="text-sm rounded-md border border-red-300 bg-red-50 text-red-700 px-3 py-2">
          {errorMsg}
        </div>
      )}

      {/* upload area */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
          !selectedGroup
            ? 'opacity-60 cursor-not-allowed'
            : isDragOver
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
      >
        {!selectedGroup && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <span className="text-sm text-gray-500">Select a group to enable uploads</span>
          </div>
        )}

        <div className={`${!selectedGroup ? 'pointer-events-none' : ''} text-center`}>
          <Upload className={`mx-auto h-12 w-12 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
          <div className="mt-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500">
                  Click to upload
                </span>
                <span> or drag and drop</span>
              </label>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              PDF up to 10MB each
            </p>
          </div>
          <input
            id="file-upload"
            type="file"
            multiple
            accept=".pdf"               // keep in sync with backend
            onChange={handleFileInput}
            className="sr-only"
            disabled={!selectedGroup}    // ⬅️ block until chosen
          />
        </div>
      </div>

      {/* file list */}
      {files.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Uploaded Files ({files.length})
            </h3>
          </div>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {files.map((file) => (
              <li key={file.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <FileIcon className="h-5 w-5 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatFileSize(file.size)} • group: <span className="font-medium">{file.groupTag || '—'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {file.status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
                    {file.status === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
                    {file.status === 'uploading' && (
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    )}
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {file.status === 'uploading' && (
                  <div className="mt-2">
                    <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {Math.round(file.progress)}% uploaded
                    </p>
                  </div>
                )}

                {file.status === 'error' && file.error && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{file.error}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
