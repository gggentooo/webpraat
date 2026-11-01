import React, { useState, useEffect } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  modalAtom,
  objectsAtom,
  selectedIdsAtom,
  infoOutputAtom,
  isProcessingAtom,
  statusMessageAtom,
  activeTabAtom,
  pictureCommandsAtom,
  pictureViewportAtom,
  picturePenAtom,
} from '../../store';
import { useI18n } from '../../hooks/useI18n';
import { getPraatWorker, createPureTone } from '../../utils/audio';
import type { PictureCommand } from '../../types/praat';

export const ModalDialog: React.FC = () => {
  const [modal, setModal] = useAtom(modalAtom);
  const [objects, setObjects] = useAtom(objectsAtom);
  const [, setSelectedIds] = useAtom(selectedIdsAtom);
  const [, setInfoOutput] = useAtom(infoOutputAtom);
  const [, setIsProcessing] = useAtom(isProcessingAtom);
  const setStatusMessage = useSetAtom(statusMessageAtom);
  const setActiveTab = useSetAtom(activeTabAtom);
  const setPictureCommands = useSetAtom(pictureCommandsAtom);
  const pictureViewport = useAtomValue(pictureViewportAtom);
  const picturePen = useAtomValue(picturePenAtom);
  const { t } = useI18n();

  const [fields, setFields] = useState<Record<string, any>>({});

  const getDefaults = (type: string, targetName?: string, initialValues?: Record<string, any>) => {
    switch (type) {
      case 'rename':
        return { newName: targetName || '' };
      case 'copy':
        return { nameOfNewObject: targetName ? `${targetName}_copy` : '' };
      case 'pureTone':
        return {
          name: 'tone440',
          frequency: 440.0,
          duration: 1.0,
          sampleRate: 44100,
          amplitude: 0.5,
        };
      case 'soundToPitch':
        return { timeStep: 0.0, pitchFloor: 75.0, pitchCeiling: 600.0 };
      case 'soundToFormantBurg':
        return {
          timeStep: 0.0,
          maxNumFormants: 5.0,
          formantCeiling: 5500.0,
          windowLength: 0.025,
          preEmphasisFrom: 50.0,
        };
      case 'soundToSpectrogram':
        return { windowLength: 0.005, maxFrequency: 5000.0, timeStep: 0.002, windowShape: 0 };
      case 'soundToIntensity':
        return { pitchFloor: 100.0, timeStep: 0.0, subtractMean: true };
      case 'soundToTextGrid':
        return { tierNames: 'sentence', pointTiers: '' };
      case 'soundToPowerCepstrogram':
        return { pitchFloor: 60.0, timeStep: 0.002, maxFrequency: 5000.0, preEmphasisFrom: 50.0 };
      case 'powerCepstrogramGetCpps':
        return {
          subtractTrend: true,
          timeAveragingWindow: 0.02,
          quefrencyAveragingWindow: 0.0005,
          pitchFloor: 60.0,
          pitchCeiling: 330.0,
        };
      case 'powerCepstrogramToCpp':
        return { pitchFloor: 60.0, pitchCeiling: 330.0 };
      case 'cppGetMean':
        return { fromTime: 0.0, toTime: 0.0 };
      case 'soundToLpcBurg':
        return {
          predictionOrder: 16,
          windowLength: 0.025,
          timeStep: 0.005,
          preEmphasisFrom: 50.0,
        };
      case 'soundToMfcc':
        return {
          numCoefficients: 12,
          windowLength: 0.015,
          timeStep: 0.005,
          f1Mel: 100.0,
          dfMel: 100.0,
          fmaxMel: 0.0,
        };
      case 'createKlattGridFromVowel':
        return {
          name: 'a',
          duration: 0.4,
          f0Start: 125.0,
          f1: 800.0,
          b1: 50.0,
          f2: 1200.0,
          b2: 50.0,
          f3: 2300.0,
          b3: 100.0,
          f4: 2800.0,
        };
      case 'soundToKlattGrid':
        return {
          timeStep: 0.005,
          maxNumFormants: 5,
          formantCeiling: 5500.0,
          windowLength: 0.025,
          pitchFloor: 75.0,
          pitchCeiling: 600.0,
        };
      case 'createSpeaker':
        return { name: 'speaker', kindOfSpeaker: 'female', numVocalCordMasses: 2 };
      case 'createArtword':
        return { name: 'hallo', duration: 0.5, defaultVoiced: true };
      case 'artwordSpeakerToSound':
        return {
          sampleRate: 22050,
          oversamplingFactor: 25,
          speakerId: initialValues?.speakerId,
        };
      case 'drawObject':
        return {
          fromTime: 0.0,
          toTime: 0.0,
          minValue: 0.0,
          maxValue: 0.0,
          dynamicRangeDb: 50.0,
          garnish: picturePen.garnish,
          speckle: Boolean(initialValues?.speckle),
        };
      case 'soundGetMean':
        return { fromTime: 0.0, toTime: 0.0, channel: 0 };
      case 'pitchGetMean':
        return { fromTime: 0.0, toTime: 0.0 };
      case 'pitchGetValueAtTime':
        return { time: 0.5 };
      default:
        return {};
    }
  };

  useEffect(() => {
    if (!modal || modal.type === 'soundRecorder') {
      setFields({});
      return;
    }
    const targetObj = objects.find((o) => o.id === modal.objectId);
    setFields(getDefaults(modal.type, targetObj?.name, modal.initialValues));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, objects]);

  if (!modal || modal.type === 'soundRecorder') return null;

  const handleFieldChange = (key: string, value: any) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleStandards = () => {
    const targetObj = objects.find((o) => o.id === modal.objectId);
    setFields(getDefaults(modal.type, targetObj?.name, modal.initialValues));
  };

  const registerNewObject = async (newId: number, statusText?: string) => {
    const worker = getPraatWorker();
    const className = await worker.getObjectClass(newId);
    const name = await worker.getObjectName(newId);
    if (className === 'Sound') {
      const info = await worker.getSoundInfo(newId);
      setObjects((prev) => [
        ...prev,
        {
          id: info.id,
          className: 'Sound',
          name: info.name,
          duration: info.duration,
          sampleRate: info.sampleRate,
          numChannels: info.numChannels,
          numSamples: info.numSamples,
          createdAt: Date.now(),
        },
      ]);
    } else {
      setObjects((prev) => [
        ...prev,
        {
          id: newId,
          className,
          name,
          createdAt: Date.now(),
        },
      ]);
    }
    setSelectedIds([newId]);
    if (statusText) {
      setStatusMessage(statusText);
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
            await worker.renameObject(objId, cleanName);
            setObjects((prev) =>
              prev.map((o) => (o.id === objId ? { ...o, name: cleanName } : o))
            );
          }
          break;
        }

        case 'copy': {
          if (objId && fields.nameOfNewObject?.trim()) {
            const cleanCopyName = fields.nameOfNewObject.trim().replace(/\s+/g, '_');
            const bin = await worker.exportObjectBinary(objId);
            const imported = await worker.importObjectBinary(bin, cleanCopyName);
            setObjects((prev) => [
              ...prev,
              {
                id: imported.id,
                className: imported.className,
                name: imported.name,
                duration: imported.duration,
                sampleRate: imported.sampleRate,
                numChannels: imported.numChannels,
                numSamples: imported.numSamples,
                createdAt: Date.now(),
              },
            ]);
            setSelectedIds([imported.id]);
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
          setObjects((prev) => [
            ...prev,
            {
              id: info.id,
              className: 'Sound',
              name: info.name,
              duration: info.duration,
              sampleRate: info.sampleRate,
              numChannels: info.numChannels,
              numSamples: info.numSamples,
              createdAt: Date.now(),
            },
          ]);
          setSelectedIds([info.id]);
          setStatusMessage(t.status.soundCreated);
          break;
        }

        case 'soundToPitch': {
          if (objId) {
            const pitchId = await worker.soundToPitch(objId, {
              timeStep: Number(fields.timeStep) || 0.0,
              pitchFloor: Number(fields.pitchFloor) || 75.0,
              pitchCeiling: Number(fields.pitchCeiling) || 600.0,
            });
            await registerNewObject(pitchId, t.status.pitchCalculated);
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
            await registerNewObject(formantId, t.status.formantCalculated);
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
            await registerNewObject(spectroId, t.status.spectrogramCalculated);
          }
          break;
        }

        case 'soundToIntensity': {
          if (objId) {
            const intensityId = await worker.soundToIntensity(objId, {
              pitchFloor: Number(fields.pitchFloor) || 100.0,
              timeStep: Number(fields.timeStep) || 0.0,
              subtractMean: Boolean(fields.subtractMean),
            });
            await registerNewObject(intensityId, t.status.intensityCalculated);
          }
          break;
        }

        case 'soundToTextGrid': {
          if (objId) {
            const soundObj = objects.find((o) => o.id === objId);
            const gridId = await worker.soundToTextGrid(
              objId,
              fields.tierNames || 'sentence',
              fields.pointTiers || ''
            );
            const name = await worker.getObjectName(gridId);
            const className = await worker.getObjectClass(gridId);
            setObjects((prev) => [
              ...prev,
              {
                id: gridId,
                className,
                name: name || (soundObj ? soundObj.name : 'grid'),
                duration: soundObj?.duration,
                createdAt: Date.now(),
              },
            ]);
            setSelectedIds([gridId]);
            setStatusMessage(t.status.textGridCreated);
          }
          break;
        }

        case 'soundToPowerCepstrogram': {
          if (objId) {
            const cepstroId = await worker.soundToPowerCepstrogram(objId, {
              pitchFloor: Number(fields.pitchFloor) || 60.0,
              timeStep: Number(fields.timeStep) || 0.002,
              maxFreq: Number(fields.maxFrequency) || 5000.0,
              preEmphasis: Number(fields.preEmphasisFrom) ?? 50.0,
            });
            await registerNewObject(cepstroId, t.status.cepstrogramCalculated);
          }
          break;
        }

        case 'powerCepstrogramGetCpps': {
          if (objId) {
            const cpps = await worker.powerCepstrogramGetCpps(objId, {
              subtractTrend: Boolean(fields.subtractTrend),
              timeAveragingWindow: Number(fields.timeAveragingWindow) || 0.02,
              quefrencyAveragingWindow: Number(fields.quefrencyAveragingWindow) || 0.0005,
              pitchFloor: Number(fields.pitchFloor) || 60.0,
              pitchCeiling: Number(fields.pitchCeiling) || 330.0,
            });
            setInfoOutput((prev) => `${prev}${cpps.toFixed(4)} dB\n`);
          }
          break;
        }

        case 'powerCepstrogramToCpp': {
          if (objId) {
            const cppId = await worker.powerCepstrogramToCpp(
              objId,
              Number(fields.pitchFloor) || 60.0,
              Number(fields.pitchCeiling) || 330.0
            );
            await registerNewObject(cppId, t.status.cppCalculated);
          }
          break;
        }

        case 'cppGetMean': {
          if (objId) {
            const meanCpp = await worker.cppGetMean(
              objId,
              Number(fields.fromTime) || 0.0,
              Number(fields.toTime) || 0.0
            );
            setInfoOutput((prev) => `${prev}${meanCpp.toFixed(4)} dB\n`);
          }
          break;
        }

        case 'soundToLpcBurg': {
          if (objId) {
            const lpcId = await worker.soundToLpcBurg(objId, {
              predictionOrder: Number(fields.predictionOrder) || 16,
              windowLength: Number(fields.windowLength) || 0.025,
              timeStep: Number(fields.timeStep) || 0.005,
              preEmphasis: Number(fields.preEmphasisFrom) ?? 50.0,
            });
            await registerNewObject(lpcId, t.status.lpcCalculated);
          }
          break;
        }

        case 'soundToMfcc': {
          if (objId) {
            const mfccId = await worker.soundToMfcc(objId, {
              numCoefficients: Number(fields.numCoefficients) || 12,
              windowLength: Number(fields.windowLength) || 0.015,
              timeStep: Number(fields.timeStep) || 0.005,
              f1Mel: Number(fields.f1Mel) || 100.0,
              dfMel: Number(fields.dfMel) || 100.0,
              fmaxMel: Number(fields.fmaxMel) || 0.0,
            });
            await registerNewObject(mfccId, t.status.mfccCalculated);
          }
          break;
        }

        case 'createKlattGridFromVowel': {
          const kgId = await worker.createKlattGridFromVowel({
            name: fields.name?.trim() || 'a',
            duration: Number(fields.duration) || 0.4,
            f0Start: Number(fields.f0Start) || 125.0,
            f1: Number(fields.f1) || 800.0,
            b1: Number(fields.b1) || 50.0,
            f2: Number(fields.f2) || 1200.0,
            b2: Number(fields.b2) || 50.0,
            f3: Number(fields.f3) || 2300.0,
            b3: Number(fields.b3) || 100.0,
            f4: Number(fields.f4) || 2800.0,
          });
          await registerNewObject(kgId, t.status.klattGridCreated);
          break;
        }

        case 'soundToKlattGrid': {
          if (objId) {
            const kgId = await worker.soundToKlattGrid(objId, {
              timeStep: Number(fields.timeStep) || 0.005,
              nFormants: Number(fields.maxNumFormants) || 5,
              maxFormant: Number(fields.formantCeiling) || 5500.0,
              windowLength: Number(fields.windowLength) || 0.025,
              pitchFloor: Number(fields.pitchFloor) || 75.0,
              pitchCeiling: Number(fields.pitchCeiling) || 600.0,
            });
            await registerNewObject(kgId, t.status.klattGridCreated);
          }
          break;
        }

        case 'createSpeaker': {
          const spkId = await worker.createSpeaker(
            fields.name?.trim() || 'speaker',
            fields.kindOfSpeaker || 'female',
            Number(fields.numVocalCordMasses) || 2
          );
          await registerNewObject(spkId, t.status.speakerCreated);
          break;
        }

        case 'createArtword': {
          const artId = await worker.createArtword(
            fields.name?.trim() || 'hallo',
            Number(fields.duration) || 0.5,
            Boolean(fields.defaultVoiced)
          );
          await registerNewObject(artId, t.status.artwordCreated);
          break;
        }

        case 'artwordSpeakerToSound': {
          const spkId = Number(fields.speakerId);
          if (objId && spkId > 0) {
            const soundId = await worker.artwordSpeakerToSound(
              objId,
              spkId,
              Number(fields.sampleRate) || 22050,
              Number(fields.oversamplingFactor) || 25
            );
            await registerNewObject(soundId, t.status.articulatorySoundSynthesized);
          }
          break;
        }

        case 'drawObject': {
          if (objId) {
            const target = objects.find((o) => o.id === objId);
            if (target) {
              const reqTmin = Number(fields.fromTime) || 0;
              const reqTmax = Number(fields.toTime) || 0;
              const minVal = Number(fields.minValue) || 0;
              const maxVal = Number(fields.maxValue) || 0;
              const garnish = Boolean(fields.garnish);
              const cmdPen = { ...picturePen, garnish };
              const vp = { ...pictureViewport };
              let picCmd: PictureCommand | null = null;

              if (target.className === 'Sound') {
                const info = await worker.getSoundInfo(objId);
                const samples = await worker.getSoundChannelSamples(objId, 1);
                const tmin = reqTmin > 0 ? reqTmin : 0;
                const tmax = reqTmax > tmin ? Math.min(info.duration, reqTmax) : info.duration;
                const sIdx = Math.max(0, Math.floor(tmin * info.sampleRate));
                const eIdx = Math.min(samples.length, Math.ceil(tmax * info.sampleRate));
                picCmd = {
                  id: `draw_snd_${objId}_${Date.now()}`,
                  kind: 'waveform',
                  viewport: vp,
                  pen: cmdPen,
                  title: target.name,
                  tmin,
                  tmax,
                  minAmp: minVal,
                  maxAmp: maxVal,
                  samples: samples.slice(sIdx, eIdx),
                  sampleRate: info.sampleRate,
                };
              } else if (target.className === 'Spectrogram') {
                const spec = await worker.getSpectrogramData(objId);
                picCmd = {
                  id: `draw_spec_${objId}_${Date.now()}`,
                  kind: 'spectrogram',
                  viewport: vp,
                  pen: cmdPen,
                  title: target.name,
                  tmin: reqTmin > 0 ? reqTmin : spec.xmin,
                  tmax: reqTmax > 0 ? reqTmax : spec.xmax,
                  maxFreq: maxVal > 0 ? maxVal : spec.ymax,
                  dynamicRange: Number(fields.dynamicRangeDb) || 50,
                  preemphasis: 6.0,
                  colorMap: 'greyscale',
                  nx: spec.nx,
                  ny: spec.ny,
                  y1: spec.y1,
                  dy: spec.dy,
                  z: spec.z,
                };
              } else if (target.className === 'Pitch') {
                const pitch = await worker.getPitchTrack(objId);
                picCmd = {
                  id: `draw_pitch_${objId}_${Date.now()}`,
                  kind: 'pitch',
                  viewport: vp,
                  pen: {
                    ...cmdPen,
                    colour: cmdPen.colour === 'Black' ? 'Blue' : cmdPen.colour,
                  },
                  title: target.name,
                  tmin: reqTmin > 0 ? reqTmin : pitch.xmin,
                  tmax: reqTmax > 0 ? reqTmax : pitch.xmax,
                  fmin: minVal > 0 ? minVal : 75,
                  fmax: maxVal > 0 ? maxVal : pitch.ceiling || 500,
                  x1: pitch.x1,
                  dx: pitch.dx,
                  frequencies: pitch.frequencies,
                };
              } else if (target.className === 'Formant') {
                const fmt = await worker.getFormantTrack(objId);
                const isSpeckle = Boolean(fields.speckle);
                picCmd = {
                  id: `draw_fmt_${objId}_${Date.now()}`,
                  kind: 'formants',
                  viewport: vp,
                  pen: {
                    ...cmdPen,
                    colour: cmdPen.colour === 'Black' ? 'Red' : cmdPen.colour,
                  },
                  title: target.name,
                  tmin: reqTmin > 0 ? reqTmin : fmt.xmin,
                  tmax: reqTmax > 0 ? reqTmax : fmt.xmax,
                  maxFreq: maxVal > 0 ? maxVal : 5500,
                  x1: fmt.x1,
                  dx: fmt.dx,
                  maxnFormants: fmt.maxnFormants,
                  frequencies: fmt.frequencies,
                  speckle: isSpeckle,
                };
              } else if (target.className === 'Intensity') {
                const inten = await worker.getIntensityTrack(objId);
                picCmd = {
                  id: `draw_int_${objId}_${Date.now()}`,
                  kind: 'intensity',
                  viewport: vp,
                  pen: {
                    ...cmdPen,
                    colour: cmdPen.colour === 'Black' ? 'Green' : cmdPen.colour,
                  },
                  title: target.name,
                  tmin: reqTmin > 0 ? reqTmin : inten.xmin,
                  tmax: reqTmax > 0 ? reqTmax : inten.xmax,
                  minDb: minVal,
                  maxDb: maxVal,
                  x1: inten.x1,
                  dx: inten.dx,
                  values: inten.values,
                };
              } else if (target.className === 'CPP') {
                const cpp = await worker.getCppTrack(objId);
                picCmd = {
                  id: `draw_cpp_${objId}_${Date.now()}`,
                  kind: 'cpp',
                  viewport: vp,
                  pen: cmdPen,
                  title: target.name,
                  tmin: reqTmin > 0 ? reqTmin : cpp.xmin,
                  tmax: reqTmax > 0 ? reqTmax : cpp.xmax,
                  minDb: minVal,
                  maxDb: maxVal,
                  x1: cpp.x1,
                  dx: cpp.dx,
                  values: cpp.values,
                };
              } else if (target.className === 'TextGrid') {
                const tg = await worker.getTextGridData(objId);
                picCmd = {
                  id: `draw_tg_${objId}_${Date.now()}`,
                  kind: 'textgrid',
                  viewport: vp,
                  pen: cmdPen,
                  title: target.name,
                  tmin: reqTmin > 0 ? reqTmin : tg.xmin,
                  tmax: reqTmax > 0 ? reqTmax : tg.xmax,
                  data: tg,
                };
              }

              if (picCmd) {
                setPictureCommands((prev) => [...prev, picCmd]);
                setActiveTab('picture');
                setStatusMessage(t.status.drawnToPicture);
              }
            }
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
            setInfoOutput((prev) => `${prev}${mean.toFixed(6)} Pascal\n`);
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
            setInfoOutput((prev) => `${prev}${meanF0.toFixed(2)} Hertz\n`);
          }
          break;
        }

        case 'pitchGetValueAtTime': {
          if (objId) {
            const val = await worker.pitchGetValueAtTime(objId, Number(fields.time) || 0.0);
            setInfoOutput((prev) => `${prev}${val.toFixed(2)} Hertz (at ${fields.time} seconds)\n`);
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
      case 'soundToIntensity':
        return t.dialogs.soundToIntensityTitle;
      case 'soundToTextGrid':
        return t.dialogs.soundToTextGridTitle;
      case 'soundToPowerCepstrogram':
        return t.dialogs.soundToPowerCepstrogramTitle;
      case 'powerCepstrogramGetCpps':
        return t.dialogs.powerCepstrogramGetCppsTitle;
      case 'powerCepstrogramToCpp':
        return t.dialogs.powerCepstrogramToCppTitle;
      case 'cppGetMean':
        return t.dialogs.cppGetMeanTitle;
      case 'soundToLpcBurg':
        return t.dialogs.soundToLpcBurgTitle;
      case 'soundToMfcc':
        return t.dialogs.soundToMfccTitle;
      case 'createKlattGridFromVowel':
        return t.dialogs.createKlattGridFromVowelTitle;
      case 'soundToKlattGrid':
        return t.dialogs.soundToKlattGridTitle;
      case 'createSpeaker':
        return t.dialogs.createSpeakerTitle;
      case 'createArtword':
        return t.dialogs.createArtwordTitle;
      case 'artwordSpeakerToSound':
        return t.dialogs.artwordSpeakerToSoundTitle;
      case 'drawObject':
        return t.dialogs.drawObjectTitle;
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
            <h2 className="text-base font-bold text-slate-900">WebPraat v1.0.0</h2>
            <p className="text-xs text-slate-600">
              Web port of Praat: doing phonetics by computer on the web.
            </p>
            <div className="rounded bg-white p-3 text-xs text-slate-700 space-y-1.5 border border-slate-200">
              <div>
                <strong>Core:</strong> C++17 Praat library compiled to WebAssembly (fon, LPC,
                dwtools, artsynth, stat)
              </div>
              <div>
                <strong>Frontend:</strong> React 19, TypeScript, Jotai, Tailwind CSS, AudioWorklet,
                OPFS
              </div>
              <div>
                <strong>Concurrency:</strong> Web Worker with Comlink RPC
              </div>
              <div>
                <strong>Authors:</strong> Port of Paul Boersma &amp; David Weenink&apos;s Praat
                system
              </div>
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

            {modal.type === 'soundToIntensity' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.pitchFloor}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.pitchFloor ?? 100.0}
                      onChange={(e) => handleFieldChange('pitchFloor', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
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
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-700 pt-1">
                  <input
                    type="checkbox"
                    checked={Boolean(fields.subtractMean)}
                    onChange={(e) => handleFieldChange('subtractMean', e.target.checked)}
                  />
                  <span>{t.dialogs.subtractMean}</span>
                </label>
              </div>
            )}

            {modal.type === 'soundToTextGrid' && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.tierNames}
                  </label>
                  <input
                    type="text"
                    value={fields.tierNames ?? 'sentence'}
                    onChange={(e) => handleFieldChange('tierNames', e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    placeholder="e.g. sentence words phonemes"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.pointTiers}
                  </label>
                  <input
                    type="text"
                    value={fields.pointTiers ?? ''}
                    onChange={(e) => handleFieldChange('pointTiers', e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    placeholder="e.g. events landmarks"
                  />
                </div>
              </div>
            )}

            {modal.type === 'soundToPowerCepstrogram' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.pitchFloor}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={fields.pitchFloor ?? 60.0}
                    onChange={(e) => handleFieldChange('pitchFloor', e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  />
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
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.preEmphasisFrom}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={fields.preEmphasisFrom ?? 50.0}
                    onChange={(e) => handleFieldChange('preEmphasisFrom', e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
              </div>
            )}

            {modal.type === 'powerCepstrogramGetCpps' && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(fields.subtractTrend)}
                    onChange={(e) => handleFieldChange('subtractTrend', e.target.checked)}
                  />
                  <span>{t.dialogs.subtractTrendBeforeSmoothing}</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.timeAveragingWindow}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.timeAveragingWindow ?? 0.02}
                      onChange={(e) => handleFieldChange('timeAveragingWindow', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.quefrencyAveragingWindow}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.quefrencyAveragingWindow ?? 0.0005}
                      onChange={(e) =>
                        handleFieldChange('quefrencyAveragingWindow', e.target.value)
                      }
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.pitchFloor}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.pitchFloor ?? 60.0}
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
                      value={fields.pitchCeiling ?? 330.0}
                      onChange={(e) => handleFieldChange('pitchCeiling', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {modal.type === 'powerCepstrogramToCpp' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.pitchFloor}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={fields.pitchFloor ?? 60.0}
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
                    value={fields.pitchCeiling ?? 330.0}
                    onChange={(e) => handleFieldChange('pitchCeiling', e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
              </div>
            )}

            {modal.type === 'soundToLpcBurg' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.predictionOrder}
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={fields.predictionOrder ?? 16}
                    onChange={(e) => handleFieldChange('predictionOrder', e.target.value)}
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
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.timeStep}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={fields.timeStep ?? 0.005}
                    onChange={(e) => handleFieldChange('timeStep', e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.preEmphasisFrom}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={fields.preEmphasisFrom ?? 50.0}
                    onChange={(e) => handleFieldChange('preEmphasisFrom', e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
              </div>
            )}

            {modal.type === 'soundToMfcc' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.numCoefficients}
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={fields.numCoefficients ?? 12}
                    onChange={(e) => handleFieldChange('numCoefficients', e.target.value)}
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
                    value={fields.windowLength ?? 0.015}
                    onChange={(e) => handleFieldChange('windowLength', e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.timeStep}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={fields.timeStep ?? 0.005}
                    onChange={(e) => handleFieldChange('timeStep', e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.f1Mel}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={fields.f1Mel ?? 100.0}
                    onChange={(e) => handleFieldChange('f1Mel', e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.dfMel}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={fields.dfMel ?? 100.0}
                    onChange={(e) => handleFieldChange('dfMel', e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.fmaxMel}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={fields.fmaxMel ?? 0.0}
                    onChange={(e) => handleFieldChange('fmaxMel', e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
              </div>
            )}

            {modal.type === 'createKlattGridFromVowel' && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.name}
                    </label>
                    <input
                      type="text"
                      value={fields.name ?? 'a'}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
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
                      value={fields.duration ?? 0.4}
                      onChange={(e) => handleFieldChange('duration', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.f0Start}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.f0Start ?? 125.0}
                      onChange={(e) => handleFieldChange('f0Start', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.f1Hz}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.f1 ?? 800.0}
                      onChange={(e) => handleFieldChange('f1', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.b1Hz}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.b1 ?? 50.0}
                      onChange={(e) => handleFieldChange('b1', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.f2Hz}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.f2 ?? 1200.0}
                      onChange={(e) => handleFieldChange('f2', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.b2Hz}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.b2 ?? 50.0}
                      onChange={(e) => handleFieldChange('b2', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.f3Hz}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.f3 ?? 2300.0}
                      onChange={(e) => handleFieldChange('f3', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.b3Hz}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.b3 ?? 100.0}
                      onChange={(e) => handleFieldChange('b3', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {modal.type === 'soundToKlattGrid' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.timeStep}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={fields.timeStep ?? 0.005}
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
                    value={fields.maxNumFormants ?? 5}
                    onChange={(e) => handleFieldChange('maxNumFormants', e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
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
              </div>
            )}

            {modal.type === 'createSpeaker' && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.name}
                  </label>
                  <input
                    type="text"
                    value={fields.name ?? 'speaker'}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.kindOfSpeaker}
                    </label>
                    <select
                      value={fields.kindOfSpeaker ?? 'female'}
                      onChange={(e) => handleFieldChange('kindOfSpeaker', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    >
                      <option value="female">{t.dialogs.speakerFemale}</option>
                      <option value="male">{t.dialogs.speakerMale}</option>
                      <option value="child">{t.dialogs.speakerChild}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.numVocalCordMasses}
                    </label>
                    <select
                      value={fields.numVocalCordMasses ?? 2}
                      onChange={(e) =>
                        handleFieldChange('numVocalCordMasses', Number(e.target.value))
                      }
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={10}>10</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {modal.type === 'createArtword' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.name}
                    </label>
                    <input
                      type="text"
                      value={fields.name ?? 'hallo'}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.totalTime}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.duration ?? 0.5}
                      onChange={(e) => handleFieldChange('duration', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-700 pt-1">
                  <input
                    type="checkbox"
                    checked={Boolean(fields.defaultVoiced)}
                    onChange={(e) => handleFieldChange('defaultVoiced', e.target.checked)}
                  />
                  <span>{t.dialogs.defaultVoicedGesture}</span>
                </label>
              </div>
            )}

            {modal.type === 'artwordSpeakerToSound' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.toneSampleRate}
                  </label>
                  <input
                    type="number"
                    value={fields.sampleRate ?? 22050}
                    onChange={(e) => handleFieldChange('sampleRate', e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    {t.dialogs.oversamplingFactor}
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={fields.oversamplingFactor ?? 25}
                    onChange={(e) => handleFieldChange('oversamplingFactor', e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
              </div>
            )}

            {modal.type === 'drawObject' && (
              <div className="space-y-2">
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
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.minValue}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.minValue ?? 0.0}
                      onChange={(e) => handleFieldChange('minValue', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-0.5">
                      {t.dialogs.maxValue}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fields.maxValue ?? 0.0}
                      onChange={(e) => handleFieldChange('maxValue', e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-700 pt-1">
                  <input
                    type="checkbox"
                    checked={Boolean(fields.garnish)}
                    onChange={(e) => handleFieldChange('garnish', e.target.checked)}
                  />
                  <span>{t.dialogs.garnish}</span>
                </label>
              </div>
            )}

            {(modal.type === 'soundGetMean' ||
              modal.type === 'pitchGetMean' ||
              modal.type === 'cppGetMean') && (
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
