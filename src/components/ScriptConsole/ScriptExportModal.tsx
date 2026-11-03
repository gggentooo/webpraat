import React from 'react';
import type { ModifiedVfsFile } from '../../types/wasm';
import { useI18n } from '../../hooks/useI18n';
import { downloadBlob } from '../../utils/audio';
import { createZipArchive } from '../../utils/zip';

interface ScriptExportModalProps {
  files: ModifiedVfsFile[];
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ScriptExportModal: React.FC<ScriptExportModalProps> = ({ files, onClose }) => {
  const { t } = useI18n();

  const handleDownloadSingle = (file: ModifiedVfsFile) => {
    const blob = new Blob([file.data as BlobPart], { type: 'application/octet-stream' });
    const fileName = file.path.split('/').pop() || 'output';
    downloadBlob(blob, fileName);
  };

  const handleDownloadZip = () => {
    const zipBytes = createZipArchive(
      files.map((f) => ({
        name: f.path,
        data: f.data,
      }))
    );
    const blob = new Blob([zipBytes as BlobPart], { type: 'application/zip' });
    downloadBlob(blob, 'praat_outputs.zip');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs select-none">
      <div className="flex w-full max-w-lg flex-col rounded-lg border border-slate-300 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
          <div className="flex items-center space-x-2">
            <span className="text-base font-semibold">{t.script.scriptExportTitle}</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
              {files.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-white/80 hover:bg-white/20 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-600">
            {t.script.scriptExportPrompt}
          </p>

          <div className="max-h-60 overflow-y-auto rounded border border-slate-200 bg-slate-50 divide-y divide-slate-200">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-3 py-2 text-xs hover:bg-white transition-colors"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        file.isNew
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {file.isNew ? t.script.newBadge : t.script.modifiedBadge}
                    </span>
                    <span className="font-mono text-slate-800 truncate" title={file.path}>
                      {file.path}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    {formatBytes(file.size)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadSingle(file)}
                  className="shrink-0 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-blue-600 active:bg-slate-100"
                >
                  {t.script.downloadFile}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 rounded-b-lg">
          <button
            type="button"
            onClick={handleDownloadZip}
            className="inline-flex items-center space-x-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 active:bg-blue-800"
          >
            <span>📦</span>
            <span>{t.script.downloadZip}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 active:bg-slate-200"
          >
            {t.script.close}
          </button>
        </div>
      </div>
    </div>
  );
};
