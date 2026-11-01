import React, { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { modalAtom, objectsAtom, selectedIdsAtom, infoOutputAtom, isProcessingAtom } from '../../store';
import { useI18n } from '../../hooks/useI18n';
import { getPraatWorker, createPureTone } from '../../utils/audio';

export const ModalDialog: React.FC = () => {
  const [modal, setModal] = useAtom(modalAtom);
  const [objects, setObjects] = useAtom(objectsAtom);
  const [, setSelectedIds] = useAtom(selectedIdsAtom);
  const [, setInfoOutput] = useAtom(infoOutputAtom);
  const [, setIsProcessing] = useAtom(isProcessingAtom);
  const { t } = useI18n();

  // Form field states
  const [fields, setFields] = useState<Record<string, any>>({});

  // Reset fields when modal opens
  useEffect(() => {
    if (!modal) {
      setFields({});
      return;
    }

    const targetObj = objects.find((o) => o.id === modal.objectId);

    switch (modal.type) {
      case 'rename':
        setFields({ newName: targetObj?.name || '' });
        break;
      case 'copy':
        setFields({ nameOfNewObject: targetObj ? `${targetObj.name}_copy` : '' });
        break;
      case 'pureTone':
        setFields({
          name: 'tone440',
          frequency: 440.0,
          duration: 1.0,
          sampleRate: 44100,
          amplitude: 0.5,
        });
        break;
      case 'soundToPitch':
        setFields({
          timeStep: 0.0,
          pitchFloor: 75.0,
          pitchCeiling: 600.0,
        });
        break;
      case 'soundToFormantBurg':
        setFields({
          timeStep: 0.0,
          maxNumFormants: 5.0,
          formantCeiling: 5500.0,
          windowLength: 0.025,
          preEmphasisFrom: 50.0,
        });
        break;
      case 'soundToSpectrogram':
        setFields({
          windowLength: 0.005,
          maxFrequency: 5000.0,
          timeStep: 0.002,
          windowShape: 0,
        });
        break;
      case 'soundGetMean':
        setFields({
          fromTime: 0.0,
          toTime: 0.0,
          channel: 0,
        });
        break;
      case 'pitchGetMean':
        setFields({
          fromTime: 0.0,
          toTime: 0.0,
        });
        break;
      case 'pitchGetValueAtTime':
        setFields({
          time: 0.5,
        });
        break;
      default:
        setFields({});
    }
  }, [modal, objects]);

  if (!modal) return null;

  const handleFieldChange = (key: string, value: any) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleStandards = () => {
    // Reset to defaults
    switch (modal.type) {
      case 'pureTone':
        setFields({
          name: 'tone440',
          frequency: 440.0,
          duration: 1.0,
          sampleRate: 44100,
          amplitude: 0.5,
        });
        break;
      case 'soundToPitch':
        setFields({ timeStep: 0.0, pitchFloor: 75.0, pitchCeiling: 600.0 });
        break;
      case 'soundToFormantBurg':
        setFields({
          timeStep: 0.0,
          maxNumFormants: 5.0,
          formantCeiling: 5500.0,
          windowLength: 0.025,
          preEmphasisFrom: 50.0,
        });
        break;
      case 'soundToSpectrogram':
        setFields({ windowLength: 0.005, maxFrequency: 5000.0, timeStep: 0.002, windowShape: 0 });
        break;
      case 'soundGetMean':
      case 'pitchGetMean':
        setFields({ fromTime: 0.0, toTime: 0.0 });
        break;
      case 'pitchGetValueAtTime':
        setFields({ time: 0.5 });
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const worker = getPraatWorker();
    setIsProcessing(true);

    try {
      const objId = modal.objectId;

      switch (modal.type) {
        case 'rename': {
          if (objId && fields.newName?.trim()) {
            const cleanName = fields.newName.trim().replace(/\s+/g, '_');
            setObjects((prev) =>
              prev.map((o) => (o.id === objId ? { ...o, name: cleanName } : o))
            );
          }
          break;
        }

        case 'copy': {
          if (objId && fields.nameOfNewObject?.trim()) {
            const sourceObj = objects.find((o) => o.id === objId);
            if (sourceObj && sourceObj.className === 'Sound') {
              const info = await worker.getSoundInfo(objId);
              // Extract all channel samples and copy
              const channels = info.numChannels;
              const n = info.numSamples;
              const flatSamples = new Float64Array(channels * n);
              for (let ch = 1; ch <= channels; ++ch) {
                const chData = await worker.getSoundChannelSamples(objId, ch);
                flatSamples.set(chData, (ch - 1) * n);
              }
              const newId = await worker.createSound(
                flatSamples,
                n,
                channels,
                info.sampleRate,
                fields.nameOfNewObject.trim()
              );
              const newObj = {
                id: newId,
                className: 'Sound',
                name: fields.nameOfNewObject.trim(),
                duration: info.duration,
                sampleRate: info.sampleRate,
                numChannels: info.numChannels,
                numSamples: info.numSamples,
                createdAt: Date.now(),
              };
              setObjects((prev) => [...prev, newObj]);
              setSelectedIds([newId]);
            }
          }
          break;
        }

        case 'pureTone': {
          const info = await createPureTone(
            worker,
            Number(fields.frequency) || 440,
            Number(fields.duration) || 1.0,
            Number(fields.sampleRate) || 44100,
            Number(fields.amplitude) || 0.5,
            fields.name?.trim() || 'tone'
          );
          const newObj = {
            id: info.id,
            className: 'Sound',
            name: info.name,
            duration: info.duration,
            sampleRate: info.sampleRate,
            numChannels: info.numChannels,
            numSamples: info.numSamples,
            createdAt: Date.now(),
          };
          setObjects((prev) => [...prev, newObj]);
          setSelectedIds([info.id]);
          break;
        }

        case 'soundToPitch': {
          if (objId) {
            const pitchId = await worker.soundToPitch(objId, {
              timeStep: Number(fields.timeStep) || 0.0,
              pitchFloor: Number(fields.pitchFloor) || 75.0,
              pitchCeiling: Number(fields.pitchCeiling) || 600.0,
            });
            const name = await worker.getObjectName(pitchId);
            const className = await worker.getObjectClass(pitchId);
            const newObj = {
              id: pitchId,
              className,
              name,
              createdAt: Date.now(),
            };
            setObjects((prev) => [...prev, newObj]);
            setSelectedIds([pitchId]);
          }
          break;
        }

        case 'soundToFormantBurg': {
          if (objId) {
            const formantId = await worker.soundToFormant(objId, {
              timeStep: Number(fields.timeStep) || 0.0,
              nFormants: Number(fields.maxNumFormants) || 5,
              maxFormant: Number(fields.formantCeiling) || 5500.0,
              windowLength: Number(fields.windowLength) || 0.025,
            });
            const name = await worker.getObjectName(formantId);
            const className = await worker.getObjectClass(formantId);
            const newObj = {
              id: formantId,
              className,
              name,
              createdAt: Date.now(),
            };
            setObjects((prev) => [...prev, newObj]);
            setSelectedIds([formantId]);
          }
          break;
        }

        case 'soundToSpectrogram': {
          if (objId) {
            const spectroId = await worker.soundToSpectrogram(objId, {
              windowLength: Number(fields.windowLength) || 0.005,
              maxFreq: Number(fields.maxFrequency) || 5000.0,
              timeStep: Number(fields.timeStep) || 0.002,
              windowShape: Number(fields.windowShape) || 0,
            });
            const name = await worker.getObjectName(spectroId);
            const className = await worker.getObjectClass(spectroId);
            const newObj = {
              id: spectroId,
              className,
              name,
              createdAt: Date.now(),
            };
            setObjects((prev) => [...prev, newObj]);
            setSelectedIds([spectroId]);
          }
          break;
        }

        case 'soundGetMean': {
          if (objId) {
            const channel = Number(fields.channel) > 0 ? Number(fields.channel) : 1;
            const samples = await worker.getSoundChannelSamples(objId, channel);
            let sum = 0;
            for (let i = 0; i < samples.length; ++i) sum += samples[i];
            const mean = samples.length > 0 ? sum / samples.length : 0;
            const output = `${mean.toFixed(6)} Pascal\n`;
            setInfoOutput((prev) => prev + output);
          }
          break;
        }

        case 'pitchGetMean': {
          if (objId) {
            const meanF0 = await worker.pitchGetMean(
              objId,
              Number(fields.fromTime) || 0.0,
              Number(fields.toTime) || 0.0
            );
            const output = `${meanF0.toFixed(2)} Hertz\n`;
            setInfoOutput((prev) => prev + output);
          }
          break;
        }

        case 'pitchGetValueAtTime': {
          if (objId) {
            const val = await worker.pitchGetValueAtTime(objId, Number(fields.time) || 0.0);
            const output = `${val.toFixed(2)} Hertz (at ${fields.time} seconds)\n`;
            setInfoOutput((prev) => prev + output);
          }
          break;
        }
      }
    } catch (err: any) {
      alert(`Error: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
      setModal(null);
    }
  };

  const getTitle = () => {
    switch (modal.type) {
      case 'rename':
        return t.dialogs.renameTitle;
      case 'copy':
        return t.dialogs.copyTitle;
      case 'pureTone':
        return t.dialogs.pureToneTitle;
      case 'soundToPitch':
        return t.dialogs.soundToPitchTitle;
      case 'soundToFormantBurg':
        return t.dialogs.soundToFormantTitle;
      case 'soundToSpectrogram':
        return t.dialogs.soundToSpectrogramTitle;
      case 'soundGetMean':
        return t.dialogs.soundGetMeanTitle;
      case 'pitchGetMean':
        return t.dialogs.pitchGetMeanTitle;
      case 'pitchGetValueAtTime':
        return t.dialogs.pitchGetValueAtTimeTitle;
      case 'about':
        return t.commands.aboutWebPraat;
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-sm border border-slate-400 bg-slate-100 shadow-2xl text-slate-800 text-sm">
        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-slate-300 bg-slate-200 px-3 py-1.5 font-medium select-none">
          <span>{getTitle()}</span>
          <button
            type="button"
            onClick={() => setModal(null)}
            className="text-slate-500 hover:text-slate-800 hover:bg-slate-300 rounded px-1.5 py-0.5 text-xs font-bold"
          >
            ✕
          </button>
        </div>

        {modal.type === 'about' ? (
          <div className="p-4 space-y-3">
            <h2 className="text-base font-bold text-slate-900">WebPraat v0.1.0</h2>
            <p className="text-xs text-slate-600">
              Web port of Praat: doing phonetics by computer on the web.
            </p>
            <div className="rounded bg-white p-3 text-xs text-slate-700 space-y-1.5 border border-slate-200">
              <div><strong>Core:</strong> C++17 Praat library compiled to WebAssembly (Emscripten)</div>
              <div><strong>Frontend:</strong> React 19, TypeScript, Jotai, Tailwind CSS</div>
              <div><strong>Concurrency:</strong> Web Worker with Comlink RPC</div>
              <div><strong>Authors:</strong> Port of Paul Boersma &amp; David Weenink's Praat system</div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-1 border border-slate-400 bg-white hover:bg-slate-50 rounded text-xs font-medium shadow-xs"
              >
                {t.dialogs.close}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            {/* Form Fields depending on modal.type */}
            {modal.type === 'rename' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t.dialogs.newName}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={fields.newName || ''}
                  onChange={(e) => handleFieldChange('newName', e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}

            {modal.type === 'copy' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t.dialogs.nameOfNewObject}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={fields.nameOfNewObject || ''}
                  onChange={(e) => handleFieldChange('nameOfNewObject', e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}

            {modal.type === 'pureTone' && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.name}
                  </label>
                  <input
                    type="text"
                    value={fields.name || ''}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.toneFrequency}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.frequency ?? 440}
                      onChange={(e) => handleFieldChange('frequency', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.toneDuration}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.duration ?? 1.0}
                      onChange={(e) => handleFieldChange('duration', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.toneSampleRate}
                    </label>
                    <input
                      type="number"
                      value={fields.sampleRate ?? 44100}
                      onChange={(e) => handleFieldChange('sampleRate', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.toneAmplitude}
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={fields.amplitude ?? 0.5}
                      onChange={(e) => handleFieldChange('amplitude', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {modal.type === 'soundToPitch' && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.timeStep}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={fields.timeStep ?? 0.0}
                    onChange={(e) => handleFieldChange('timeStep', e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  />
                  <span className="text-[10px] text-slate-500">{t.dialogs.timeStepAuto}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.pitchFloor}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.pitchFloor ?? 75.0}
                      onChange={(e) => handleFieldChange('pitchFloor', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.pitchCeiling}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.pitchCeiling ?? 600.0}
                      onChange={(e) => handleFieldChange('pitchCeiling', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {modal.type === 'soundToFormantBurg' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.timeStep}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.timeStep ?? 0.0}
                      onChange={(e) => handleFieldChange('timeStep', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.maxNumFormants}
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={fields.maxNumFormants ?? 5.0}
                      onChange={(e) => handleFieldChange('maxNumFormants', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.formantCeiling}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.formantCeiling ?? 5500.0}
                      onChange={(e) => handleFieldChange('formantCeiling', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.windowLength}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.windowLength ?? 0.025}
                      onChange={(e) => handleFieldChange('windowLength', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {modal.type === 'soundToSpectrogram' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.windowLength}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.windowLength ?? 0.005}
                      onChange={(e) => handleFieldChange('windowLength', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.maxFrequency}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.maxFrequency ?? 5000.0}
                      onChange={(e) => handleFieldChange('maxFrequency', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.timeStep}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={fields.timeStep ?? 0.002}
                    onChange={(e) => handleFieldChange('timeStep', e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
              </div>
            )}

            {(modal.type === 'soundGetMean' || modal.type === 'pitchGetMean') && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.fromTime}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={fields.fromTime ?? 0.0}
                    onChange={(e) => handleFieldChange('fromTime', e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.toTime}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={fields.toTime ?? 0.0}
                    onChange={(e) => handleFieldChange('toTime', e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  />
                  <span className="text-[10px] text-slate-500">{t.dialogs.toTimeAll}</span>
                </div>
              </div>
            )}

            {modal.type === 'pitchGetValueAtTime' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-0.5">
                  {t.dialogs.time}
                </label>
                <input
                  type="number"
                  step="any"
                  value={fields.time ?? 0.5}
                  onChange={(e) => handleFieldChange('time', e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                />
              </div>
            )}

            {/* Bottom Actions matching Praat standards */}
            <div className="flex items-center justify-between border-t border-slate-300 pt-3">
              <button
                type="button"
                onClick={handleStandards}
                className="rounded border border-slate-300 bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300 active:bg-slate-400"
              >
                {t.dialogs.standards}
              </button>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-200"
                >
                  {t.dialogs.cancel}
                </button>
                <button
                  type="submit"
                  className="rounded border border-blue-600 bg-blue-600 px-4 py-1 text-xs font-medium text-white hover:bg-blue-700 active:bg-blue-800 shadow-xs"
                >
                  {t.dialogs.ok}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
