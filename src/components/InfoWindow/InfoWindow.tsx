import React, { useRef, useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { infoOutputAtom } from '../../store';
import { useI18n } from '../../hooks/useI18n';

export const InfoWindow: React.FC = () => {
  const { t } = useI18n();
  const [infoOutput, setInfoOutput] = useAtom(infoOutputAtom);
  const [copied, setCopied] = useState(false);
  const textEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (textEndRef.current) {
      textEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [infoOutput]);

  const handleClear = () => {
    setInfoOutput('');
  };

  const handleCopy = async () => {
    if (!infoOutput) return;
    try {
      await navigator.clipboard.writeText(infoOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API fails
      const textarea = document.createElement('textarea');
      textarea.value = infoOutput;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-white text-xs select-text">
      {/* Window Header */}
      <div className="flex h-7 items-center justify-between border-b border-slate-300 bg-slate-100 px-3 select-none">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-700">{t.app.infoTitle}</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!infoOutput}
            className={`rounded border px-2 py-0.5 text-[11px] font-medium shadow-xs transition-colors ${
              infoOutput
                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-200'
                : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
            }`}
          >
            {copied ? t.info.copied : t.info.copy}
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={!infoOutput}
            className={`rounded border px-2 py-0.5 text-[11px] font-medium shadow-xs transition-colors ${
              infoOutput
                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-200'
                : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
            }`}
          >
            {t.info.clear}
          </button>
        </div>
      </div>

      {/* Output Console Area */}
      <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed text-slate-800 whitespace-pre-wrap select-text bg-white">
        {infoOutput ? (
          <>
            {infoOutput}
            <div ref={textEndRef} />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400 italic select-none">
            {t.info.empty}
          </div>
        )}
      </div>
    </div>
  );
};
