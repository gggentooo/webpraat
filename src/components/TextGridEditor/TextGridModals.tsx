import React, { useState, useEffect } from 'react';
import { useI18n } from '../../hooks/useI18n';
import type { TextGridData } from '../../types/praat';

export type TextGridModalType =
  | 'newInterval'
  | 'addIntervalTier'
  | 'addPointTier'
  | 'duplicateTier'
  | 'renameTier'
  | 'removeTier'
  | 'setIntervalText'
  | null;

export interface TextGridModalsProps {
  modalType: TextGridModalType;
  gridData: TextGridData | null;
  selectedTierIndex: number;
  selectedIntervalIndex: number | null;
  selection: [number, number] | null;
  onClose: () => void;
  onConfirmNewInterval: (tierIndex: number, text: string) => void;
  onConfirmAddTier: (isInterval: boolean, name: string, position: number) => void;
  onConfirmDuplicateTier: (sourceIndex: number, targetPosition: number, newName: string) => void;
  onConfirmRenameTier: (tierIndex: number, newName: string) => void;
  onConfirmRemoveTier: (tierIndex: number) => void;
  onConfirmSetIntervalText: (tierIndex: number, intervalIndex: number, text: string) => void;
}

export const TextGridModals: React.FC<TextGridModalsProps> = ({
  modalType,
  gridData,
  selectedTierIndex,
  selectedIntervalIndex,
  selection,
  onClose,
  onConfirmNewInterval,
  onConfirmAddTier,
  onConfirmDuplicateTier,
  onConfirmRenameTier,
  onConfirmRemoveTier,
  onConfirmSetIntervalText,
}) => {
  const { t } = useI18n();

  // Local form state
  const [tierNumber, setTierNumber] = useState(1);
  const [positionNumber, setPositionNumber] = useState(1);
  const [sourceTierNumber, setSourceTierNumber] = useState(1);
  const [tierName, setTierName] = useState('');
  const [textVal, setTextVal] = useState('');

  const numTiers = gridData ? gridData.tiers.length : 1;

  useEffect(() => {
    if (!modalType || !gridData) return;

    if (modalType === 'newInterval') {
      setTierNumber(selectedTierIndex + 1);
      setTextVal('');
    } else if (modalType === 'addIntervalTier' || modalType === 'addPointTier') {
      setPositionNumber(numTiers + 1);
      setTierName(modalType === 'addIntervalTier' ? 'words' : 'points');
    } else if (modalType === 'duplicateTier') {
      const src = selectedTierIndex + 1;
      setSourceTierNumber(src);
      setPositionNumber(src + 1);
      const srcTier = gridData.tiers[selectedTierIndex];
      setTierName(srcTier ? `${srcTier.name}_copy` : 'copy');
    } else if (modalType === 'renameTier') {
      setTierNumber(selectedTierIndex + 1);
      const currTier = gridData.tiers[selectedTierIndex];
      setTierName(currTier ? currTier.name : '');
    } else if (modalType === 'setIntervalText') {
      setTierNumber(selectedTierIndex + 1);
      if (
        selectedIntervalIndex !== null &&
        gridData.tiers[selectedTierIndex]?.type === 'IntervalTier'
      ) {
        const tier = gridData.tiers[selectedTierIndex];
        const intVal = (tier as any).intervals?.[selectedIntervalIndex];
        setTextVal(intVal?.text || '');
      } else {
        setTextVal('');
      }
    }
  }, [modalType, gridData, selectedTierIndex, selectedIntervalIndex, numTiers]);

  if (!modalType || !gridData) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalType === 'newInterval') {
      const targetIdx = Math.max(0, Math.min(numTiers - 1, tierNumber - 1));
      onConfirmNewInterval(targetIdx, textVal);
    } else if (modalType === 'addIntervalTier') {
      const pos = Math.max(1, Math.min(numTiers + 1, positionNumber));
      onConfirmAddTier(true, tierName.trim() || 'intervals', pos);
    } else if (modalType === 'addPointTier') {
      const pos = Math.max(1, Math.min(numTiers + 1, positionNumber));
      onConfirmAddTier(false, tierName.trim() || 'points', pos);
    } else if (modalType === 'duplicateTier') {
      const srcIdx = Math.max(0, Math.min(numTiers - 1, sourceTierNumber - 1));
      const pos = Math.max(1, Math.min(numTiers + 1, positionNumber));
      onConfirmDuplicateTier(srcIdx, pos, tierName.trim() || 'duplicate');
    } else if (modalType === 'renameTier') {
      const targetIdx = Math.max(0, Math.min(numTiers - 1, tierNumber - 1));
      onConfirmRenameTier(targetIdx, tierName.trim() || 'tier');
    } else if (modalType === 'removeTier') {
      onConfirmRemoveTier(selectedTierIndex);
    } else if (modalType === 'setIntervalText') {
      if (selectedIntervalIndex !== null) {
        onConfirmSetIntervalText(selectedTierIndex, selectedIntervalIndex, textVal);
      }
    }
    onClose();
  };

  const selStart = selection ? Math.min(selection[0], selection[1]).toFixed(4) : '0.0000';
  const selEnd = selection ? Math.max(selection[0], selection[1]).toFixed(4) : '0.0000';
  const selDur = selection ? Math.abs(selection[1] - selection[0]).toFixed(4) : '0.0000';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[420px] rounded border border-slate-300 bg-slate-100 p-4 shadow-xl text-slate-800 text-xs">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between border-b border-slate-300 pb-2">
          <h2 className="font-bold text-slate-800 text-sm">
            {modalType === 'newInterval' && t.textGridMenu.newIntervalTitle}
            {modalType === 'addIntervalTier' && t.textGridMenu.addIntervalTier}
            {modalType === 'addPointTier' && t.textGridMenu.addPointTier}
            {modalType === 'duplicateTier' && t.textGridMenu.duplicateTier}
            {modalType === 'renameTier' && t.textGridMenu.renameTier}
            {modalType === 'removeTier' && t.textGridMenu.removeTier}
            {modalType === 'setIntervalText' && t.textGridMenu.setIntervalText}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 text-base leading-none"
          >
            &times;
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {modalType === 'newInterval' && (
            <>
              <div className="rounded bg-white p-2 border border-slate-200 text-slate-600 space-y-1">
                <div>
                  <span className="font-semibold">{t.editor.selection}: </span>
                  <span className="font-mono">{selStart} s &rarr; {selEnd} s</span>
                </div>
                <div>
                  <span className="font-semibold">{t.editor.visible}: </span>
                  <span className="font-mono">{selDur} s</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-0.5">
                  {t.textGridMenu.targetTier} (1 .. {numTiers})
                </label>
                <input
                  type="number"
                  min={1}
                  max={numTiers}
                  value={tierNumber}
                  onChange={(e) => setTierNumber(parseInt(e.target.value, 10) || 1)}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-0.5">
                  {t.textGridMenu.intervalText}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={textVal}
                  onChange={(e) => setTextVal(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-serif"
                />
              </div>
            </>
          )}

          {modalType === 'addIntervalTier' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-0.5">
                  {t.textGridMenu.tierPosition} (1 .. {numTiers + 1})
                </label>
                <input
                  type="number"
                  min={1}
                  max={numTiers + 1}
                  value={positionNumber}
                  onChange={(e) => setPositionNumber(parseInt(e.target.value, 10) || 1)}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-0.5">
                  {t.textGridMenu.tierName}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={tierName}
                  onChange={(e) => setTierName(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                />
              </div>
            </>
          )}

          {modalType === 'addPointTier' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-0.5">
                  {t.textGridMenu.tierPosition} (1 .. {numTiers + 1})
                </label>
                <input
                  type="number"
                  min={1}
                  max={numTiers + 1}
                  value={positionNumber}
                  onChange={(e) => setPositionNumber(parseInt(e.target.value, 10) || 1)}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-0.5">
                  {t.textGridMenu.tierName}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={tierName}
                  onChange={(e) => setTierName(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                />
              </div>
            </>
          )}

          {modalType === 'duplicateTier' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-0.5">
                  {t.textGridMenu.sourceTier} (1 .. {numTiers})
                </label>
                <input
                  type="number"
                  min={1}
                  max={numTiers}
                  value={sourceTierNumber}
                  onChange={(e) => setSourceTierNumber(parseInt(e.target.value, 10) || 1)}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-0.5">
                  {t.textGridMenu.tierPosition} (1 .. {numTiers + 1})
                </label>
                <input
                  type="number"
                  min={1}
                  max={numTiers + 1}
                  value={positionNumber}
                  onChange={(e) => setPositionNumber(parseInt(e.target.value, 10) || 1)}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-0.5">
                  {t.textGridMenu.newTierName}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={tierName}
                  onChange={(e) => setTierName(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                />
              </div>
            </>
          )}

          {modalType === 'renameTier' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-0.5">
                  {t.textGridMenu.targetTier} (1 .. {numTiers})
                </label>
                <input
                  type="number"
                  min={1}
                  max={numTiers}
                  value={tierNumber}
                  onChange={(e) => {
                    const num = parseInt(e.target.value, 10) || 1;
                    setTierNumber(num);
                    const tObj = gridData.tiers[num - 1];
                    if (tObj) setTierName(tObj.name);
                  }}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-0.5">
                  {t.textGridMenu.newTierName}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={tierName}
                  onChange={(e) => setTierName(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                />
              </div>
            </>
          )}

          {modalType === 'removeTier' && (
            <div className="py-2">
              {numTiers <= 1 ? (
                <p className="text-red-600 font-medium">
                  {t.textGridMenu.cannotRemoveLastTier}
                </p>
              ) : (
                <p className="text-slate-700">
                  {t.textGridMenu.confirmRemoveTier.replace(
                    '{name}',
                    gridData.tiers[selectedTierIndex]?.name || `Tier ${selectedTierIndex + 1}`
                  )}
                </p>
              )}
            </div>
          )}

          {modalType === 'setIntervalText' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-0.5">
                {t.textGridMenu.intervalText}
              </label>
              <input
                type="text"
                autoFocus
                value={textVal}
                onChange={(e) => setTextVal(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-serif"
              />
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end space-x-2 border-t border-slate-300 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-200"
            >
              {t.dialogs.cancel}
            </button>
            {modalType === 'removeTier' && numTiers <= 1 ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-slate-400 bg-slate-300 px-4 py-1 text-xs font-medium text-slate-600"
              >
                {t.dialogs.ok}
              </button>
            ) : (
              <button
                type="submit"
                className="rounded border border-blue-600 bg-blue-600 px-4 py-1 text-xs font-medium text-white hover:bg-blue-700 active:bg-blue-800 shadow-xs"
              >
                {t.dialogs.ok}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
