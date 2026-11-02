import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../../hooks/useI18n';

export interface TextGridMenuBarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onClose?: () => void;
  onOpenNewIntervalModal: () => void;
  onRemoveInterval: () => void;
  onOpenSetIntervalTextModal: () => void;
  onClearIntervalText: () => void;
  onAddBoundaryAtCursor: () => void;
  onAddBoundaryOnAllTiers: () => void;
  onRemoveBoundaryAtCursor: () => void;
  onMoveBoundaryToCursor: () => void;
  onOpenAddIntervalTierModal: () => void;
  onOpenAddPointTierModal: () => void;
  onOpenDuplicateTierModal: () => void;
  onOpenRenameTierModal: () => void;
  onOpenRemoveTierModal: () => void;
  onQuery: (queryType: string) => void;
  onSelectAction: (actionType: 'start' | 'end' | 'prev' | 'next') => void;
}

export const TextGridMenuBar: React.FC<TextGridMenuBarProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExport,
  onClose,
  onOpenNewIntervalModal,
  onRemoveInterval,
  onOpenSetIntervalTextModal,
  onClearIntervalText,
  onAddBoundaryAtCursor,
  onAddBoundaryOnAllTiers,
  onRemoveBoundaryAtCursor,
  onMoveBoundaryToCursor,
  onOpenAddIntervalTierModal,
  onOpenAddPointTierModal,
  onOpenDuplicateTierModal,
  onOpenRenameTierModal,
  onOpenRemoveTierModal,
  onQuery,
  onSelectAction,
}) => {
  const { t } = useI18n();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = (name: string) => {
    setActiveMenu((prev) => (prev === name ? null : name));
  };

  const handleMenuHover = (name: string) => {
    if (activeMenu !== null) {
      setActiveMenu(name);
    }
  };

  const handleAction = (action: () => void) => {
    action();
    setActiveMenu(null);
  };

  return (
    <div
      ref={menuBarRef}
      className="flex h-6 shrink-0 items-center border-b border-slate-300 bg-slate-100 px-2 text-[11px] font-sans text-slate-700 relative z-40 select-none"
    >
      {/* File Menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => toggleMenu('file')}
          onMouseEnter={() => handleMenuHover('file')}
          className={`px-2 py-0.5 rounded hover:bg-slate-200 ${
            activeMenu === 'file' ? 'bg-slate-300 font-semibold' : ''
          }`}
        >
          {t.textGridMenu.file}
        </button>
        {activeMenu === 'file' && (
          <div className="absolute left-0 top-full mt-0.5 w-52 rounded border border-slate-300 bg-white py-1 shadow-lg z-50">
            <button
              type="button"
              onClick={() => handleAction(onExport)}
              className="flex w-full items-center justify-between px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              <span>{t.textGridMenu.exportTextGrid}</span>
              <span className="text-[10px] text-slate-400 font-mono">Ctrl+S</span>
            </button>
            {onClose && (
              <>
                <div className="my-1 border-t border-slate-200" />
                <button
                  type="button"
                  onClick={() => handleAction(onClose)}
                  className="w-full px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  {t.textGridMenu.closeEditor}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Edit Menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => toggleMenu('edit')}
          onMouseEnter={() => handleMenuHover('edit')}
          className={`px-2 py-0.5 rounded hover:bg-slate-200 ${
            activeMenu === 'edit' ? 'bg-slate-300 font-semibold' : ''
          }`}
        >
          {t.textGridMenu.edit}
        </button>
        {activeMenu === 'edit' && (
          <div className="absolute left-0 top-full mt-0.5 w-48 rounded border border-slate-300 bg-white py-1 shadow-lg z-50">
            <button
              type="button"
              disabled={!canUndo}
              onClick={() => handleAction(onUndo)}
              className={`flex w-full items-center justify-between px-3 py-1 text-left text-[11px] ${
                canUndo
                  ? 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                  : 'text-slate-300 cursor-not-allowed'
              }`}
            >
              <span>{t.textGridMenu.undo}</span>
              <span className="text-[10px] text-slate-400 font-mono">Ctrl+Z</span>
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={() => handleAction(onRedo)}
              className={`flex w-full items-center justify-between px-3 py-1 text-left text-[11px] ${
                canRedo
                  ? 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                  : 'text-slate-300 cursor-not-allowed'
              }`}
            >
              <span>{t.textGridMenu.redo}</span>
              <span className="text-[10px] text-slate-400 font-mono">Ctrl+Y</span>
            </button>
          </div>
        )}
      </div>

      {/* Query Menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => toggleMenu('query')}
          onMouseEnter={() => handleMenuHover('query')}
          className={`px-2 py-0.5 rounded hover:bg-slate-200 ${
            activeMenu === 'query' ? 'bg-slate-300 font-semibold' : ''
          }`}
        >
          {t.textGridMenu.query}
        </button>
        {activeMenu === 'query' && (
          <div className="absolute left-0 top-full mt-0.5 w-56 rounded border border-slate-300 bg-white py-1 shadow-lg z-50">
            <button
              type="button"
              onClick={() => handleAction(() => onQuery('cursorTime'))}
              className="w-full px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              {t.textGridMenu.getTimeOfCursor}
            </button>
            <button
              type="button"
              onClick={() => handleAction(() => onQuery('selectionStart'))}
              className="w-full px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              {t.textGridMenu.getSelectionStart}
            </button>
            <button
              type="button"
              onClick={() => handleAction(() => onQuery('selectionEnd'))}
              className="w-full px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              {t.textGridMenu.getSelectionEnd}
            </button>
            <button
              type="button"
              onClick={() => handleAction(() => onQuery('selectionLength'))}
              className="w-full px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              {t.textGridMenu.getSelectionLength}
            </button>
            <div className="my-1 border-t border-slate-200" />
            <button
              type="button"
              onClick={() => handleAction(() => onQuery('intervalLabel'))}
              className="w-full px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              {t.textGridMenu.getIntervalLabel}
            </button>
            <button
              type="button"
              onClick={() => handleAction(() => onQuery('numberOfTiers'))}
              className="w-full px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              {t.textGridMenu.getNumberOfTiers}
            </button>
            <button
              type="button"
              onClick={() => handleAction(() => onQuery('numberOfIntervals'))}
              className="w-full px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              {t.textGridMenu.getNumberOfIntervals}
            </button>
          </div>
        )}
      </div>

      {/* Select Menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => toggleMenu('select')}
          onMouseEnter={() => handleMenuHover('select')}
          className={`px-2 py-0.5 rounded hover:bg-slate-200 ${
            activeMenu === 'select' ? 'bg-slate-300 font-semibold' : ''
          }`}
        >
          {t.textGridMenu.select}
        </button>
        {activeMenu === 'select' && (
          <div className="absolute left-0 top-full mt-0.5 w-56 rounded border border-slate-300 bg-white py-1 shadow-lg z-50">
            <button
              type="button"
              onClick={() => handleAction(() => onSelectAction('start'))}
              className="w-full px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              {t.textGridMenu.moveToStart}
            </button>
            <button
              type="button"
              onClick={() => handleAction(() => onSelectAction('end'))}
              className="w-full px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              {t.textGridMenu.moveToEnd}
            </button>
            <div className="my-1 border-t border-slate-200" />
            <button
              type="button"
              onClick={() => handleAction(() => onSelectAction('prev'))}
              className="flex w-full items-center justify-between px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              <span>{t.textGridMenu.selectPreviousInterval}</span>
              <span className="text-[10px] text-slate-400 font-mono">Alt+←</span>
            </button>
            <button
              type="button"
              onClick={() => handleAction(() => onSelectAction('next'))}
              className="flex w-full items-center justify-between px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              <span>{t.textGridMenu.selectNextInterval}</span>
              <span className="text-[10px] text-slate-400 font-mono">Alt+→</span>
            </button>
          </div>
        )}
      </div>

      {/* Interval Menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => toggleMenu('interval')}
          onMouseEnter={() => handleMenuHover('interval')}
          className={`px-2 py-0.5 rounded hover:bg-slate-200 ${
            activeMenu === 'interval' ? 'bg-slate-300 font-semibold' : ''
          }`}
        >
          {t.textGridMenu.interval}
        </button>
        {activeMenu === 'interval' && (
          <div className="absolute left-0 top-full mt-0.5 w-56 rounded border border-slate-300 bg-white py-1 shadow-lg z-50">
            <button
              type="button"
              onClick={() => handleAction(onOpenNewIntervalModal)}
              className="flex w-full items-center justify-between px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              <span>{t.textGridMenu.newIntervalOnTier}</span>
              <span className="text-[10px] text-slate-400 font-mono">Ctrl+I</span>
            </button>
            <button
              type="button"
              onClick={() => handleAction(onRemoveInterval)}
              className="w-full px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              {t.textGridMenu.removeInterval}
            </button>
            <div className="my-1 border-t border-slate-200" />
            <button
              type="button"
              onClick={() => handleAction(onOpenSetIntervalTextModal)}
              className="w-full px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              {t.textGridMenu.setIntervalText}
            </button>
            <button
              type="button"
              onClick={() => handleAction(onClearIntervalText)}
              className="w-full px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              {t.textGridMenu.clearText}
            </button>
          </div>
        )}
      </div>

      {/* Boundary Menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => toggleMenu('boundary')}
          onMouseEnter={() => handleMenuHover('boundary')}
          className={`px-2 py-0.5 rounded hover:bg-slate-200 ${
            activeMenu === 'boundary' ? 'bg-slate-300 font-semibold' : ''
          }`}
        >
          {t.textGridMenu.boundary}
        </button>
        {activeMenu === 'boundary' && (
          <div className="absolute left-0 top-full mt-0.5 w-60 rounded border border-slate-300 bg-white py-1 shadow-lg z-50">
            <button
              type="button"
              onClick={() => handleAction(onAddBoundaryAtCursor)}
              className="flex w-full items-center justify-between px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              <span>{t.textGridMenu.addBoundaryAtCursor}</span>
              <span className="text-[10px] text-slate-400 font-mono">Enter</span>
            </button>
            <button
              type="button"
              onClick={() => handleAction(onAddBoundaryOnAllTiers)}
              className="flex w-full items-center justify-between px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              <span>{t.textGridMenu.addBoundaryOnAllTiers}</span>
              <span className="text-[10px] text-slate-400 font-mono">Ctrl+Enter</span>
            </button>
            <div className="my-1 border-t border-slate-200" />
            <button
              type="button"
              onClick={() => handleAction(onRemoveBoundaryAtCursor)}
              className="flex w-full items-center justify-between px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              <span>{t.textGridMenu.removeBoundaryAtCursor}</span>
              <span className="text-[10px] text-slate-400 font-mono">Alt+⌫</span>
            </button>
            <button
              type="button"
              onClick={() => handleAction(onMoveBoundaryToCursor)}
              className="w-full px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              {t.textGridMenu.moveBoundaryToCursor}
            </button>
          </div>
        )}
      </div>

      {/* Tier Menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => toggleMenu('tier')}
          onMouseEnter={() => handleMenuHover('tier')}
          className={`px-2 py-0.5 rounded hover:bg-slate-200 ${
            activeMenu === 'tier' ? 'bg-slate-300 font-semibold' : ''
          }`}
        >
          {t.textGridMenu.tier}
        </button>
        {activeMenu === 'tier' && (
          <div className="absolute left-0 top-full mt-0.5 w-52 rounded border border-slate-300 bg-white py-1 shadow-lg z-50">
            <button
              type="button"
              onClick={() => handleAction(onOpenAddIntervalTierModal)}
              className="w-full px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              {t.textGridMenu.addIntervalTier}
            </button>
            <button
              type="button"
              onClick={() => handleAction(onOpenAddPointTierModal)}
              className="w-full px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              {t.textGridMenu.addPointTier}
            </button>
            <div className="my-1 border-t border-slate-200" />
            <button
              type="button"
              onClick={() => handleAction(onOpenDuplicateTierModal)}
              className="w-full px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              {t.textGridMenu.duplicateTier}
            </button>
            <button
              type="button"
              onClick={() => handleAction(onOpenRenameTierModal)}
              className="w-full px-3 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              {t.textGridMenu.renameTier}
            </button>
            <div className="my-1 border-t border-slate-200" />
            <button
              type="button"
              onClick={() => handleAction(onOpenRemoveTierModal)}
              className="w-full px-3 py-1 text-left text-[11px] text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              {t.textGridMenu.removeTier}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
