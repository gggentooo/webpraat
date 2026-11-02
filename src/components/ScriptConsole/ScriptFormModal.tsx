import React, { useState } from 'react';
import { useAtomValue } from 'jotai';
import { mountedDirectoryAtom } from '../../store';
import { useI18n } from '../../hooks/useI18n';
import type { ScriptFormInfo } from '../../types/wasm';

interface ScriptFormModalProps {
  formInfo: ScriptFormInfo;
  onSubmit: (args: Record<string, string>) => void;
  onCancel: () => void;
}

export const ScriptFormModal: React.FC<ScriptFormModalProps> = ({
  formInfo,
  onSubmit,
  onCancel,
}) => {
  const { t } = useI18n();
  const mountedDir = useAtomValue(mountedDirectoryAtom);

  // Initialize values with parameter defaults
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of formInfo.parameters) {
      if (p.type !== 'comment') {
        init[p.varName] = p.defaultValue ?? '';
      }
    }
    return init;
  });

  const handleChange = (varName: string, val: string) => {
    setValues((prev) => ({ ...prev, [varName]: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-slate-300 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2.5">
          <h3 className="font-semibold text-sm text-slate-800">
            {formInfo.title || t.script.scriptFormTitle}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5 text-xs text-slate-700">
            {formInfo.parameters.map((param, idx) => {
              const { name, varName, type, options } = param;

              if (type === 'comment') {
                return (
                  <p key={idx} className="text-slate-600 italic py-0.5 whitespace-pre-wrap">
                    {name}
                  </p>
                );
              }

              if (type === 'boolean') {
                const checked = values[varName] === '1' || values[varName] === 'true';
                return (
                  <div key={idx} className="flex items-center space-x-2 pt-1">
                    <input
                      type="checkbox"
                      id={`form-param-${varName}`}
                      checked={checked}
                      onChange={(e) => handleChange(varName, e.target.checked ? '1' : '0')}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor={`form-param-${varName}`} className="font-medium text-slate-700 select-none cursor-pointer">
                      {name}
                    </label>
                  </div>
                );
              }

              if (type === 'choice' || type === 'optionmenu') {
                return (
                  <div key={idx} className="space-y-1">
                    <label className="block font-medium text-slate-700">
                      {name}
                    </label>
                    <select
                      value={values[varName] ?? options?.[0] ?? '1'}
                      onChange={(e) => handleChange(varName, e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs shadow-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {options?.map((opt, optIdx) => (
                        <option key={optIdx} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              const isFolderOrFile = type === 'folder' || type === 'infile' || type === 'outfile';

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor={`form-param-${varName}`} className="font-medium text-slate-700">
                      {name}
                    </label>
                    {isFolderOrFile && mountedDir && (
                      <button
                        type="button"
                        onClick={() => handleChange(varName, mountedDir.path)}
                        className="text-[11px] text-blue-600 hover:text-blue-800 underline"
                      >
                        {t.script.useMountedFolder} ({mountedDir.name})
                      </button>
                    )}
                  </div>
                  <input
                    id={`form-param-${varName}`}
                    type={type === 'integer' || type === 'natural' || type === 'real' || type === 'positive' ? 'number' : 'text'}
                    step={type === 'integer' || type === 'natural' ? '1' : 'any'}
                    min={type === 'natural' || type === 'positive' ? '0' : undefined}
                    value={values[varName] ?? ''}
                    onChange={(e) => handleChange(varName, e.target.value)}
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs shadow-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50"
            >
              {t.dialogs.cancel}
            </button>
            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-blue-700"
            >
              {t.dialogs.ok}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
