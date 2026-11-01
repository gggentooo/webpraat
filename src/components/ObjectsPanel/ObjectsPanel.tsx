import React, { useState } from 'react';
import { useAtom } from 'jotai';
import {
  objectsAtom,
  selectedIdsAtom,
  modalAtom,
  infoOutputAtom,
  activeTabAtom,
  editorSoundIdAtom,
  editorTextGridIdAtom,
  statusMessageAtom,
} from '../../store';
import { useI18n } from '../../hooks/useI18n';
import { getPraatWorker, loadAudioFile, playSound, stopPlayback } from '../../utils/audio';
import type { PraatId, PraatObject } from '../../types/praat';

export const ObjectsPanel: React.FC = () => {
  const { t } = useI18n();
  const [objects, setObjects] = useAtom(objectsAtom);
  const [selectedIds, setSelectedIds] = useAtom(selectedIdsAtom);
  const [, setModal] = useAtom(modalAtom);
  const [, setInfoOutput] = useAtom(infoOutputAtom);
  const [, setActiveTab] = useAtom(activeTabAtom);
  const [, setEditorSoundId] = useAtom(editorSoundIdAtom);
  const [, setEditorTextGridId] = useAtom(editorTextGridIdAtom);
  const [, setStatusMessage] = useAtom(statusMessageAtom);

  const [isDragOver, setIsDragOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Derived selection properties
  const selectedObjects = objects.filter((o) => selectedIds.includes(o.id));
  const singleSelected = selectedObjects.length === 1 ? selectedObjects[0] : null;
  const isSoundSelected = singleSelected?.className === 'Sound';
  const isPitchSelected = singleSelected?.className === 'Pitch';
  const isFormantSelected = singleSelected?.className === 'Formant';
  const isSpectrogramSelected = singleSelected?.className === 'Spectrogram';
  const isTextGridSelected = singleSelected?.className === 'TextGrid';
  const soundInPair = selectedObjects.length === 2 ? selectedObjects.find((o) => o.className === 'Sound') : null;
  const textGridInPair = selectedObjects.length === 2 ? selectedObjects.find((o) => o.className === 'TextGrid') : null;
  const isSoundAndTextGridSelected = Boolean(soundInPair && textGridInPair);

  // Selection handlers
  const handleItemClick = (e: React.MouseEvent, id: PraatId, index: number) => {
    if (e.metaKey || e.ctrlKey) {
      // Toggle selection
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    } else if (e.shiftKey && selectedIds.length > 0) {
      // Range selection
      const lastSelectedId = selectedIds[selectedIds.length - 1];
      const lastIndex = objects.findIndex((o) => o.id === lastSelectedId);
      const start = Math.min(lastIndex, index);
      const end = Math.max(lastIndex, index);
      const rangeIds = objects.slice(start, end + 1).map((o) => o.id);
      setSelectedIds(Array.from(new Set([...selectedIds, ...rangeIds])));
    } else {
      // Single selection
      setSelectedIds([id]);
    }
  };

  const handleDoubleClick = (obj: PraatObject) => {
    if (obj.className === 'Sound') {
      setEditorSoundId(obj.id);
      setActiveTab('soundEditor');
    } else if (obj.className === 'TextGrid') {
      setEditorTextGridId(obj.id);
      setActiveTab('textGridEditor');
    }
  };

  // Drag and drop audio files onto panel
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const worker = getPraatWorker();
    setStatusMessage(t.status.loading);

    try {
      for (let i = 0; i < files.length; ++i) {
        const file = files[i];
        const fileName = file.name;
        if (fileName.toLowerCase().endsWith('.textgrid')) {
          const content = await file.text();
          const baseName = fileName.replace(/\.textgrid$/i, '');
          const tgId = await worker.readTextGridFromText(content, baseName);
          const name = await worker.getObjectName(tgId);
          const className = await worker.getObjectClass(tgId);
          const newObj: PraatObject = {
            id: tgId,
            className,
            name: name || baseName,
            createdAt: Date.now(),
          };
          setObjects((prev) => [...prev, newObj]);
          setSelectedIds([tgId]);
          setStatusMessage(t.status.textGridLoaded);
        } else {
          const info = await loadAudioFile(worker, file);
          const newObj: PraatObject = {
            id: info.id,
            className: info.className,
            name: info.name,
            duration: info.duration,
            sampleRate: info.sampleRate,
            numChannels: info.numChannels,
            numSamples: info.numSamples,
            createdAt: Date.now(),
          };
          setObjects((prev) => [...prev, newObj]);
          setSelectedIds([info.id]);
          setStatusMessage(t.status.soundLoaded);
        }
      }
    } catch (err: any) {
      alert(`Error loading file: ${err?.message || err}`);
    } finally {
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  // Fixed Bottom Button Handlers
  const handleRemove = async () => {
    if (selectedIds.length === 0) return;
    const worker = getPraatWorker();
    for (const id of selectedIds) {
      try {
        await worker.destroyObject(id);
      } catch {}
    }
    setObjects((prev) => prev.filter((o) => !selectedIds.includes(o.id)));
    setSelectedIds([]);
    setStatusMessage(t.status.objectRemoved);
    setTimeout(() => setStatusMessage(''), 2000);
  };

  const handleInfo = async () => {
    if (!singleSelected) return;
    const worker = getPraatWorker();
    try {
      let infoText = '';
      if (singleSelected.className === 'Sound') {
        const info = await worker.getSoundInfo(singleSelected.id);
        infoText = [
          `Object id: ${info.id}`,
          `Object type: Sound`,
          `Object name: ${info.name}`,
          `Date: ${new Date().toLocaleString()}`,
          `Time domain:`,
          `   Start time: 0.0 seconds`,
          `   End time: ${info.duration.toFixed(6)} seconds`,
          `   Total duration: ${info.duration.toFixed(6)} seconds`,
          `Time sampling:`,
          `   Number of samples: ${info.numSamples}`,
          `   Sampling period: ${(1.0 / info.sampleRate).toFixed(9)} seconds`,
          `   Sampling frequency: ${info.sampleRate} Hz`,
          `   Number of channels: ${info.numChannels}`,
          '',
        ].join('\n');
      } else {
        const name = await worker.getObjectName(singleSelected.id);
        const className = await worker.getObjectClass(singleSelected.id);
        infoText = [
          `Object id: ${singleSelected.id}`,
          `Object type: ${className}`,
          `Object name: ${name}`,
          `Date: ${new Date().toLocaleString()}`,
          '',
        ].join('\n');
      }
      setInfoOutput((prev) => prev + infoText);
    } catch (err: any) {
      alert(`Error fetching info: ${err?.message || err}`);
    }
  };

  const handleInspect = () => {
    if (!singleSelected) return;
    const output = `--- Inspecting ${singleSelected.className} '${singleSelected.name}' (ID: ${singleSelected.id}) ---\n`;
    setInfoOutput((prev) => prev + output);
  };

  // Dynamic Sound Queries
  const handleSoundQuery = async (queryType: string) => {
    if (!singleSelected || singleSelected.className !== 'Sound') return;
    const worker = getPraatWorker();
    try {
      const info = await worker.getSoundInfo(singleSelected.id);
      let resText = '';
      switch (queryType) {
        case 'channels':
          resText = `${info.numChannels} ${
            info.numChannels === 1 ? t.units.channelMono : t.units.channelStereo
          }\n`;
          break;
        case 'samples':
          resText = `${info.numSamples} ${t.units.samples}\n`;
          break;
        case 'sampleRate':
          resText = `${info.sampleRate} ${t.units.hz}\n`;
          break;
        case 'samplePeriod':
          resText = `${(1.0 / info.sampleRate).toFixed(9)} ${t.units.seconds}\n`;
          break;
        case 'duration':
          resText = `${info.duration.toFixed(6)} ${t.units.seconds}\n`;
          break;
      }
      setInfoOutput((prev) => prev + resText);
    } catch (err: any) {
      alert(`Query failed: ${err?.message || err}`);
    }
  };

  // Play Sound handler
  const handlePlay = async () => {
    if (!singleSelected || singleSelected.className !== 'Sound') return;
    try {
      setIsPlaying(true);
      const worker = getPraatWorker();
      await playSound(worker, singleSelected.id);
    } catch (err: any) {
      alert(`Playback failed: ${err?.message || err}`);
    } finally {
      setIsPlaying(false);
    }
  };

  return (
    <div className="flex h-full w-full divide-x divide-slate-300 bg-white text-xs select-none">
      {/* Left Column: Objects List & Fixed Buttons */}
      <div
        className={`flex flex-col flex-1 h-full min-w-0 ${
          isDragOver ? 'bg-blue-50/50' : 'bg-white'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Header */}
        <div className="flex h-7 items-center justify-between border-b border-slate-200 bg-slate-100 px-3 font-semibold text-slate-700">
          <span>{t.app.objectsListHeader}</span>
          <span className="text-[11px] font-normal text-slate-500">
            {objects.length}
          </span>
        </div>

        {/* Scrollable Objects List */}
        <div className="flex-1 overflow-y-auto p-1 font-mono text-[11px]">
          {objects.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center text-slate-400">
              <p className="text-xs">{t.status.dragDropPrompt}</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {objects.map((obj, index) => {
                const isSelected = selectedIds.includes(obj.id);
                return (
                  <div
                    key={obj.id}
                    onClick={(e) => handleItemClick(e, obj.id, index)}
                    onDoubleClick={() => handleDoubleClick(obj)}
                    className={`flex items-center px-2 py-1 rounded cursor-pointer truncate ${
                      isSelected
                        ? 'bg-blue-600 text-white font-medium'
                        : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <span className="w-6 text-right text-slate-400 mr-2 shrink-0">
                      {index + 1}.
                    </span>
                    <span className={`font-semibold mr-1.5 ${isSelected ? 'text-white' : 'text-blue-700'}`}>
                      {obj.className}
                    </span>
                    <span className="truncate">{obj.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Fixed Buttons matching Praat Layout */}
        <div className="border-t border-slate-300 bg-slate-100 p-2">
          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
            <button
              type="button"
              disabled={!singleSelected}
              onClick={() => setModal({ type: 'rename', objectId: singleSelected?.id })}
              className={`rounded border px-2 py-1 text-center font-medium shadow-xs ${
                singleSelected
                  ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-200'
                  : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
              }`}
            >
              {t.fixedButtons.rename}
            </button>
            <button
              type="button"
              disabled={!singleSelected}
              onClick={() => setModal({ type: 'copy', objectId: singleSelected?.id })}
              className={`rounded border px-2 py-1 text-center font-medium shadow-xs ${
                singleSelected
                  ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-200'
                  : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
              }`}
            >
              {t.fixedButtons.copy}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              disabled={!singleSelected}
              onClick={handleInspect}
              className={`rounded border px-1.5 py-1 text-center font-medium shadow-xs ${
                singleSelected
                  ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-200'
                  : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
              }`}
            >
              {t.fixedButtons.inspect}
            </button>
            <button
              type="button"
              disabled={!singleSelected}
              onClick={handleInfo}
              className={`rounded border px-1.5 py-1 text-center font-medium shadow-xs ${
                singleSelected
                  ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-200'
                  : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
              }`}
            >
              {t.fixedButtons.info}
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleRemove}
              className={`rounded border px-1.5 py-1 text-center font-medium shadow-xs ${
                selectedIds.length > 0
                  ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200'
                  : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
              }`}
            >
              {t.fixedButtons.remove}
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Dynamic Action Buttons based on selection */}
      <div className="flex flex-col w-52 shrink-0 h-full bg-slate-50 border-l border-slate-300">
        <div className="flex h-7 items-center border-b border-slate-200 bg-slate-100 px-3 font-semibold text-slate-600">
          <span>Actions</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {!singleSelected && (
            <div className="flex h-32 items-center justify-center p-2 text-center text-slate-400 text-xs">
              {selectedObjects.length > 1
                ? `${selectedObjects.length} objects selected`
                : t.status.noSelection}
            </div>
          )}

          {/* Sound Specific Actions */}
          {isSoundSelected && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setEditorSoundId(singleSelected.id);
                  setActiveTab('soundEditor');
                }}
                className="w-full rounded border border-blue-500 bg-blue-50 px-2.5 py-1.5 text-left font-semibold text-blue-800 hover:bg-blue-100 active:bg-blue-200 shadow-xs"
              >
                {t.actions.viewAndEdit}
              </button>

              <button
                type="button"
                onClick={isPlaying ? stopPlayback : handlePlay}
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-left font-medium text-slate-800 hover:bg-slate-100 active:bg-slate-200 shadow-xs"
              >
                {isPlaying ? t.actions.stop : t.actions.play}
              </button>

              <div className="my-1 border-t border-slate-200" />

              {/* Analysis Actions */}
              <button
                type="button"
                onClick={() =>
                  setModal({ type: 'soundToPitch', objectId: singleSelected.id })
                }
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-left font-medium text-slate-800 hover:bg-slate-100 active:bg-slate-200 shadow-xs"
              >
                {t.actions.soundToPitch}
              </button>

              <button
                type="button"
                onClick={() =>
                  setModal({ type: 'soundToFormantBurg', objectId: singleSelected.id })
                }
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-left font-medium text-slate-800 hover:bg-slate-100 active:bg-slate-200 shadow-xs"
              >
                {t.actions.soundToFormantBurg}
              </button>

              <button
                type="button"
                onClick={() =>
                  setModal({ type: 'soundToSpectrogram', objectId: singleSelected.id })
                }
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-left font-medium text-slate-800 hover:bg-slate-100 active:bg-slate-200 shadow-xs"
              >
                {t.actions.soundToSpectrogram}
              </button>

              <button
                type="button"
                onClick={() =>
                  setModal({ type: 'soundToTextGrid', objectId: singleSelected.id })
                }
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-left font-medium text-slate-800 hover:bg-slate-100 active:bg-slate-200 shadow-xs"
              >
                {t.actions.soundToTextGrid}
              </button>

              <div className="my-1 border-t border-slate-200" />

              {/* Sound Queries */}
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-1">
                {t.actions.query}
              </div>

              <button
                type="button"
                onClick={() => handleSoundQuery('channels')}
                className="w-full rounded px-2 py-0.5 text-left text-slate-700 hover:bg-slate-200 text-[11px]"
              >
                {t.actions.getNumChannels}
              </button>
              <button
                type="button"
                onClick={() => handleSoundQuery('samples')}
                className="w-full rounded px-2 py-0.5 text-left text-slate-700 hover:bg-slate-200 text-[11px]"
              >
                {t.actions.getNumSamples}
              </button>
              <button
                type="button"
                onClick={() => handleSoundQuery('sampleRate')}
                className="w-full rounded px-2 py-0.5 text-left text-slate-700 hover:bg-slate-200 text-[11px]"
              >
                {t.actions.getSampleRate}
              </button>
              <button
                type="button"
                onClick={() => handleSoundQuery('duration')}
                className="w-full rounded px-2 py-0.5 text-left text-slate-700 hover:bg-slate-200 text-[11px]"
              >
                {t.actions.getDuration}
              </button>
              <button
                type="button"
                onClick={() =>
                  setModal({ type: 'soundGetMean', objectId: singleSelected.id })
                }
                className="w-full rounded px-2 py-0.5 text-left text-slate-700 hover:bg-slate-200 text-[11px]"
              >
                {t.actions.getMean}
              </button>
            </div>
          )}

          {/* Pitch Specific Actions */}
          {isPitchSelected && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  alert('Pitch contour editor will be enabled in Phase 4.');
                }}
                className="w-full rounded border border-blue-500 bg-blue-50 px-2.5 py-1.5 text-left font-semibold text-blue-800 hover:bg-blue-100 active:bg-blue-200 shadow-xs"
              >
                {t.actions.viewAndEdit}
              </button>

              <div className="my-1 border-t border-slate-200" />

              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-1">
                {t.actions.query}
              </div>

              <button
                type="button"
                onClick={() =>
                  setModal({ type: 'pitchGetMean', objectId: singleSelected.id })
                }
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-left font-medium text-slate-800 hover:bg-slate-100 active:bg-slate-200 shadow-xs"
              >
                {t.actions.pitchGetMean}
              </button>

              <button
                type="button"
                onClick={() =>
                  setModal({ type: 'pitchGetValueAtTime', objectId: singleSelected.id })
                }
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-left font-medium text-slate-800 hover:bg-slate-100 active:bg-slate-200 shadow-xs"
              >
                {t.actions.pitchGetValueAtTime}
              </button>
            </div>
          )}

          {/* Formant Specific Actions */}
          {isFormantSelected && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  alert('Formant editor will be enabled in Phase 4.');
                }}
                className="w-full rounded border border-blue-500 bg-blue-50 px-2.5 py-1.5 text-left font-semibold text-blue-800 hover:bg-blue-100 active:bg-blue-200 shadow-xs"
              >
                {t.actions.viewAndEdit}
              </button>
            </div>
          )}

          {/* Spectrogram Specific Actions */}
          {isSpectrogramSelected && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  alert('Spectrogram editor will be enabled in Phase 4.');
                }}
                className="w-full rounded border border-blue-500 bg-blue-50 px-2.5 py-1.5 text-left font-semibold text-blue-800 hover:bg-blue-100 active:bg-blue-200 shadow-xs"
              >
                {t.actions.viewAndEdit}
              </button>
            </div>
          )}

          {/* TextGrid Specific Actions */}
          {isTextGridSelected && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setEditorTextGridId(singleSelected.id);
                  setActiveTab('textGridEditor');
                }}
                className="w-full rounded border border-blue-500 bg-blue-50 px-2.5 py-1.5 text-left font-semibold text-blue-800 hover:bg-blue-100 active:bg-blue-200 shadow-xs"
              >
                {t.actions.viewAndEdit}
              </button>
            </div>
          )}

          {/* Sound + TextGrid Combined Actions */}
          {isSoundAndTextGridSelected && soundInPair && textGridInPair && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setEditorSoundId(soundInPair.id);
                  setEditorTextGridId(textGridInPair.id);
                  setActiveTab('textGridEditor');
                }}
                className="w-full rounded border border-blue-600 bg-blue-600 px-2.5 py-1.5 text-left font-semibold text-white hover:bg-blue-700 active:bg-blue-800 shadow-xs"
              >
                {t.actions.viewAndEdit}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
