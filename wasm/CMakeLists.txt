# CMakeLists.txt for WebPraat WASM core
cmake_minimum_required(VERSION 3.22)
project(praatlib_wasm C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_C_STANDARD 99)
set(CMAKE_C_STANDARD_REQUIRED ON)

# Headless / No-GUI definitions for Praat core
add_compile_definitions(
    UNIX
    linux
    NO_GUI
    NO_GRAPHICS
    NO_AUDIO
    _FILE_OFFSET_BITS=64
    WORDS_BIGENDIAN=0
)

# Compiler warning suppressions
add_compile_options(
    -fwasm-exceptions
    -Wno-tautological-constant-out-of-range-compare
    -Wno-unused-variable
    -Wno-unused-parameter
    -Wno-deprecated-declarations
    -Wno-unused-function
)

# Include directories
include_directories(
    praat/melder
    praat/kar
    praat/dwsys
    praat/sys
    praat/stat
    praat/dwtools
    praat/LPC
    praat/artsynth
    praat/fon
    praat/external/clapack
    praat/external/flac
    praat/external/glpk
    praat/external/gsl
    praat/external/lame
    praat/external/mp3
    praat/external/num
    praat/external/opusfile
    praat/external/opusfile/opus
    praat/external/opusfile/opus/celt
    praat/external/opusfile/opus/silk
    praat/external/opusfile/opus/silk/float
    praat/external/portaudio
    praat/external/vorbis
    praat/external/zlib
    praat/external/blake3
    praat/external/whispercpp
    bridge
)

# 1. kar sources
set(KAR_SOURCES
    praat/kar/ipaSerifRegularPS.cpp
    praat/kar/longchar.cpp
    praat/kar/wctype_portable.cpp
)

# 2. melder sources
set(MELDER_SOURCES
    praat/melder/melder.cpp
    praat/melder/complex.cpp
    praat/melder/melder_alloc.cpp
    praat/melder/melder_str32.cpp
    praat/melder/melder_colour.cpp
    praat/melder/melder_ftoa.cpp
    praat/melder/melder_console.cpp
    praat/melder/melder_atof.cpp
    praat/melder/melder_files.cpp
    praat/melder/melder_sort.cpp
    praat/melder/MelderString.cpp
    praat/melder/melder_textencoding.cpp
    praat/melder/melder_debug.cpp
    praat/melder/MelderFile.cpp
    praat/melder/MelderCat.cpp
    praat/melder/melder_search.cpp
    praat/melder/MelderThread.cpp
    praat/melder/melder_info.cpp
    praat/melder/melder_error.cpp
    praat/melder/melder_warning.cpp
    praat/melder/melder_progress.cpp
    praat/melder/melder_casual.cpp
    praat/melder/melder_play.cpp
    praat/melder/melder_help.cpp
    praat/melder/melder_time.cpp
    praat/melder/melder_audio.cpp
    praat/melder/melder_audiofiles.cpp
    praat/melder/melder_quantity.cpp
    praat/melder/MelderReadText.cpp
    praat/melder/melder_tensorio.cpp
    praat/melder/abcio.cpp
    praat/melder/melder_sysenv.cpp
    praat/melder/melder_app.cpp
    praat/melder/melder_trust.cpp
    praat/melder/regularExp.cpp
    praat/melder/NUMmath.cpp
    praat/melder/NUMspecfunc.cpp
    praat/melder/NUMear.cpp
    praat/melder/NUMinterpol.cpp
    praat/melder/NUMmetrics.cpp
    praat/melder/NUMrandom.cpp
    praat/melder/NUMfilter.cpp
    praat/melder/NUMlinprog.cpp
    praat/melder/NUM.cpp
    praat/melder/STR.cpp
    praat/melder/VEC.cpp
    praat/melder/MAT.cpp
    praat/melder/STRVEC.cpp
)

# 3. dwsys sources
set(DWSYS_SOURCES
    praat/dwsys/ChebyshevSeries.cpp
    praat/dwsys/Collection_extensions.cpp
    praat/dwsys/Command.cpp
    praat/dwsys/DoublyLinkedList.cpp
    praat/dwsys/Eigen.cpp
    praat/dwsys/ExtendedReal.cpp
    praat/dwsys/FileInMemory.cpp
    praat/dwsys/FunctionSeries.cpp
    praat/dwsys/Graphics_extensions.cpp
    praat/dwsys/Index.cpp
    praat/dwsys/LegendreSeries.cpp
    praat/dwsys/MAT_numerics.cpp
    praat/dwsys/NMF.cpp
    praat/dwsys/NUM2.cpp
    praat/dwsys/NUMhuber.cpp
    praat/dwsys/NUMmachar.cpp
    praat/dwsys/NUMcomplex.cpp
    praat/dwsys/NUMFourier.cpp
    praat/dwsys/NUMsorting.cpp
    praat/dwsys/NUMmathlib.cpp
    praat/dwsys/NUMstring.cpp
    praat/dwsys/NUMselect.cpp
    praat/dwsys/Permutation.cpp
    praat/dwsys/PermutationInversionCounter.cpp
    praat/dwsys/Permutation_and_Index.cpp
    praat/dwsys/Polynomial.cpp
    praat/dwsys/Roots.cpp
    praat/dwsys/SlopeSelector.cpp
    praat/dwsys/Spline.cpp
    praat/dwsys/SVD.cpp
    praat/dwsys/WorkvectorPool.cpp
)

# 4. sys headless sources
set(SYS_SOURCES
    praat/sys/Thing.cpp
    praat/sys/Data.cpp
    praat/sys/Simple.cpp
    praat/sys/Collection.cpp
    praat/sys/Strings.cpp
    praat/sys/Formula.cpp
    praat/sys/Interpreter.cpp
    praat/sys/Script.cpp
    praat/sys/Notebook.cpp
    praat/sys/Preferences.cpp
    praat/sys/praat.cpp
    praat/sys/praat_actions.cpp
    praat/sys/praat_menuCommands.cpp
    praat/sys/praat_objectMenus.cpp
    praat/sys/praat_script.cpp
    praat/sys/praat_statistics.cpp
    praat/sys/praat_logo.cpp
    praat/sys/praat_library.cpp
    praat/sys/praat_picture.cpp
    praat/sys/machine.cpp
    praat/sys/site.cpp
    praat/sys/Graphics.cpp
    praat/sys/Graphics_linesAndAreas.cpp
    praat/sys/Graphics_text.cpp
    praat/sys/Graphics_colour.cpp
    praat/sys/Graphics_image.cpp
    praat/sys/Graphics_record.cpp
    praat/sys/Graphics_utils.cpp
    praat/sys/Graphics_grey.cpp
    praat/sys/Graphics_altitude.cpp
    praat/sys/GraphicsPostscript.cpp
    praat/sys/GraphicsScreen.cpp
    praat/sys/Graphics_surface.cpp
    praat/sys/Printer.cpp
    praat/sys/Picture.cpp
    praat/sys/Ui.cpp
    praat/sys/UiFile.cpp
    praat/sys/UiPause.cpp
    praat/sys/DataGui.cpp
    praat/sys/Editor.cpp
    praat/sys/DataEditor.cpp
    praat/sys/HyperPage.cpp
    praat/sys/Manual.cpp
    praat/sys/ManPage.cpp
    praat/sys/ManPages.cpp
    praat/sys/ManPages_toHtml.cpp
    praat/sys/TextEditor.cpp
    praat/sys/InfoEditor.cpp
    praat/sys/ScriptEditor.cpp
    praat/sys/NotebookEditor.cpp
    praat/sys/ButtonEditor.cpp
    praat/sys/StringsEditor.cpp
    praat/sys/DemoEditor.cpp
    praat/sys/motifEmulator.cpp
    praat/sys/Gui.cpp
    praat/sys/GuiButton.cpp
    praat/sys/GuiCheckButton.cpp
    praat/sys/GuiControl.cpp
    praat/sys/GuiDialog.cpp
    praat/sys/GuiDrawingArea.cpp
    praat/sys/GuiFileSelect.cpp
    praat/sys/GuiForm.cpp
    praat/sys/GuiLabel.cpp
    praat/sys/GuiList.cpp
    praat/sys/GuiMenu.cpp
    praat/sys/GuiMenuItem.cpp
    praat/sys/Gui_messages.cpp
    praat/sys/GuiObject.cpp
    praat/sys/GuiOptionMenu.cpp
    praat/sys/GuiProgressBar.cpp
    praat/sys/GuiRadioButton.cpp
    praat/sys/GuiScale.cpp
    praat/sys/GuiScrollBar.cpp
    praat/sys/GuiScrolledWindow.cpp
    praat/sys/GuiShell.cpp
    praat/sys/GuiText.cpp
    praat/sys/GuiThing.cpp
    praat/sys/GuiTrust.cpp
    praat/sys/GuiWindow.cpp
)

# 5. external dependencies
include(gsl_sources.cmake)

file(GLOB NUM_SOURCES praat/external/num/*.c)
file(GLOB CLAPACK_SOURCES praat/external/clapack/*.cpp)
file(GLOB GLPK_SOURCES praat/external/glpk/*.c)
list(FILTER GLPK_SOURCES EXCLUDE REGEX "amd_dump\\.c$")
file(GLOB FLAC_SOURCES praat/external/flac/*.c)
file(GLOB VORBIS_SOURCES praat/external/vorbis/*.cpp)
file(GLOB MP3_C_SOURCES praat/external/mp3/*.c)
list(FILTER MP3_C_SOURCES EXCLUDE REGEX "test\\.c$")
set(MP3_SOURCES ${MP3_C_SOURCES} praat/external/mp3/mp3.cpp)
file(GLOB ZLIB_SOURCES praat/external/zlib/*.c)
file(GLOB BLAKE3_SOURCES praat/external/blake3/*.c)
file(GLOB LAME_SOURCES praat/external/lame/*.c)

set(OPUSFILE_SOURCES
    praat/external/opusfile/opusfile.cpp
    praat/external/opusfile/opusfile_info.cpp
    praat/external/opusfile/opusfile_internal.cpp
    praat/external/opusfile/opusfile_stream.cpp
    praat/external/opusfile/opus/analysis.c
    praat/external/opusfile/opus/mlp.c
    praat/external/opusfile/opus/opus.c
    praat/external/opusfile/opus/opus_decoder.c
    praat/external/opusfile/opus/opus_multistream.c
    praat/external/opusfile/opus/mapping_matrix.c
    praat/external/opusfile/opus/mlp_data.c
    praat/external/opusfile/opus/opus_multistream_decoder.c
    praat/external/opusfile/opus/opus_projection_decoder.c
    praat/external/opusfile/opus/repacketizer.c
    praat/external/opusfile/opus/celt/bands.c
    praat/external/opusfile/opus/celt/celt.c
    praat/external/opusfile/opus/celt/celt_encoder.c
    praat/external/opusfile/opus/celt/celt_decoder.c
    praat/external/opusfile/opus/celt/cwrs.c
    praat/external/opusfile/opus/celt/entcode.c
    praat/external/opusfile/opus/celt/entdec.c
    praat/external/opusfile/opus/celt/entenc.c
    praat/external/opusfile/opus/celt/kiss_fft.c
    praat/external/opusfile/opus/celt/laplace.c
    praat/external/opusfile/opus/celt/mathops.c
    praat/external/opusfile/opus/celt/mdct.c
    praat/external/opusfile/opus/celt/modes.c
    praat/external/opusfile/opus/celt/pitch.c
    praat/external/opusfile/opus/celt/celt_lpc.c
    praat/external/opusfile/opus/celt/quant_bands.c
    praat/external/opusfile/opus/celt/rate.c
    praat/external/opusfile/opus/celt/vq.c
    praat/external/opusfile/opus/silk/CNG.c
    praat/external/opusfile/opus/silk/code_signs.c
    praat/external/opusfile/opus/silk/init_decoder.c
    praat/external/opusfile/opus/silk/decode_core.c
    praat/external/opusfile/opus/silk/decode_frame.c
    praat/external/opusfile/opus/silk/decode_parameters.c
    praat/external/opusfile/opus/silk/decode_indices.c
    praat/external/opusfile/opus/silk/decode_pulses.c
    praat/external/opusfile/opus/silk/decoder_set_fs.c
    praat/external/opusfile/opus/silk/dec_API.c
    praat/external/opusfile/opus/silk/enc_API.c
    praat/external/opusfile/opus/silk/encode_indices.c
    praat/external/opusfile/opus/silk/encode_pulses.c
    praat/external/opusfile/opus/silk/gain_quant.c
    praat/external/opusfile/opus/silk/interpolate.c
    praat/external/opusfile/opus/silk/LP_variable_cutoff.c
    praat/external/opusfile/opus/silk/NLSF_decode.c
    praat/external/opusfile/opus/silk/NSQ.c
    praat/external/opusfile/opus/silk/NSQ_del_dec.c
    praat/external/opusfile/opus/silk/PLC.c
    praat/external/opusfile/opus/silk/shell_coder.c
    praat/external/opusfile/opus/silk/tables_gain.c
    praat/external/opusfile/opus/silk/tables_LTP.c
    praat/external/opusfile/opus/silk/tables_NLSF_CB_NB_MB.c
    praat/external/opusfile/opus/silk/tables_NLSF_CB_WB.c
    praat/external/opusfile/opus/silk/tables_other.c
    praat/external/opusfile/opus/silk/tables_pitch_lag.c
    praat/external/opusfile/opus/silk/tables_pulses_per_block.c
    praat/external/opusfile/opus/silk/VAD.c
    praat/external/opusfile/opus/silk/control_audio_bandwidth.c
    praat/external/opusfile/opus/silk/quant_LTP_gains.c
    praat/external/opusfile/opus/silk/VQ_WMat_EC.c
    praat/external/opusfile/opus/silk/HP_variable_cutoff.c
    praat/external/opusfile/opus/silk/NLSF_encode.c
    praat/external/opusfile/opus/silk/NLSF_VQ.c
    praat/external/opusfile/opus/silk/NLSF_unpack.c
    praat/external/opusfile/opus/silk/NLSF_del_dec_quant.c
    praat/external/opusfile/opus/silk/process_NLSFs.c
    praat/external/opusfile/opus/silk/stereo_LR_to_MS.c
    praat/external/opusfile/opus/silk/stereo_MS_to_LR.c
    praat/external/opusfile/opus/silk/check_control_input.c
    praat/external/opusfile/opus/silk/control_SNR.c
    praat/external/opusfile/opus/silk/init_encoder.c
    praat/external/opusfile/opus/silk/control_codec.c
    praat/external/opusfile/opus/silk/A2NLSF.c
    praat/external/opusfile/opus/silk/ana_filt_bank_1.c
    praat/external/opusfile/opus/silk/biquad_alt.c
    praat/external/opusfile/opus/silk/bwexpander_32.c
    praat/external/opusfile/opus/silk/bwexpander.c
    praat/external/opusfile/opus/silk/debug.c
    praat/external/opusfile/opus/silk/decode_pitch.c
    praat/external/opusfile/opus/silk/inner_prod_aligned.c
    praat/external/opusfile/opus/silk/lin2log.c
    praat/external/opusfile/opus/silk/log2lin.c
    praat/external/opusfile/opus/silk/LPC_analysis_filter.c
    praat/external/opusfile/opus/silk/LPC_inv_pred_gain.c
    praat/external/opusfile/opus/silk/table_LSF_cos.c
    praat/external/opusfile/opus/silk/NLSF2A.c
    praat/external/opusfile/opus/silk/NLSF_stabilize.c
    praat/external/opusfile/opus/silk/NLSF_VQ_weights_laroia.c
    praat/external/opusfile/opus/silk/pitch_est_tables.c
    praat/external/opusfile/opus/silk/resampler.c
    praat/external/opusfile/opus/silk/resampler_down2_3.c
    praat/external/opusfile/opus/silk/resampler_down2.c
    praat/external/opusfile/opus/silk/resampler_private_AR2.c
    praat/external/opusfile/opus/silk/resampler_private_down_FIR.c
    praat/external/opusfile/opus/silk/resampler_private_IIR_FIR.c
    praat/external/opusfile/opus/silk/resampler_private_up2_HQ.c
    praat/external/opusfile/opus/silk/resampler_rom.c
    praat/external/opusfile/opus/silk/sigm_Q15.c
    praat/external/opusfile/opus/silk/sort.c
    praat/external/opusfile/opus/silk/sum_sqr_shift.c
    praat/external/opusfile/opus/silk/stereo_decode_pred.c
    praat/external/opusfile/opus/silk/stereo_encode_pred.c
    praat/external/opusfile/opus/silk/stereo_find_predictor.c
    praat/external/opusfile/opus/silk/stereo_quant_pred.c
    praat/external/opusfile/opus/silk/LPC_fit.c
    praat/external/opusfile/opus/silk/float/apply_sine_window_FLP.c
    praat/external/opusfile/opus/silk/float/autocorrelation_FLP.c
    praat/external/opusfile/opus/silk/float/burg_modified_FLP.c
    praat/external/opusfile/opus/silk/float/bwexpander_FLP.c
    praat/external/opusfile/opus/silk/float/corrMatrix_FLP.c
    praat/external/opusfile/opus/silk/float/encode_frame_FLP.c
    praat/external/opusfile/opus/silk/float/energy_FLP.c
    praat/external/opusfile/opus/silk/float/find_LPC_FLP.c
    praat/external/opusfile/opus/silk/float/find_LTP_FLP.c
    praat/external/opusfile/opus/silk/float/find_pitch_lags_FLP.c
    praat/external/opusfile/opus/silk/float/find_pred_coefs_FLP.c
    praat/external/opusfile/opus/silk/float/inner_product_FLP.c
    praat/external/opusfile/opus/silk/float/k2a_FLP.c
    praat/external/opusfile/opus/silk/float/LPC_analysis_filter_FLP.c
    praat/external/opusfile/opus/silk/float/LPC_inv_pred_gain_FLP.c
    praat/external/opusfile/opus/silk/float/LTP_analysis_filter_FLP.c
    praat/external/opusfile/opus/silk/float/LTP_scale_ctrl_FLP.c
    praat/external/opusfile/opus/silk/float/noise_shape_analysis_FLP.c
    praat/external/opusfile/opus/silk/float/pitch_analysis_core_FLP.c
    praat/external/opusfile/opus/silk/float/process_gains_FLP.c
    praat/external/opusfile/opus/silk/float/regularize_correlations_FLP.c
    praat/external/opusfile/opus/silk/float/residual_energy_FLP.c
    praat/external/opusfile/opus/silk/float/scale_copy_vector_FLP.c
    praat/external/opusfile/opus/silk/float/scale_vector_FLP.c
    praat/external/opusfile/opus/silk/float/schur_FLP.c
    praat/external/opusfile/opus/silk/float/sort_FLP.c
    praat/external/opusfile/opus/silk/float/warped_autocorrelation_FLP.c
    praat/external/opusfile/opus/silk/float/wrappers_FLP.c
)

set(EXTERNAL_SOURCES
    ${NUM_SOURCES}
    ${CLAPACK_SOURCES}
    ${GSL_SOURCES}
    ${GLPK_SOURCES}
    ${FLAC_SOURCES}
    ${VORBIS_SOURCES}
    ${MP3_SOURCES}
    ${LAME_SOURCES}
    ${OPUSFILE_SOURCES}
    ${ZLIB_SOURCES}
    ${BLAKE3_SOURCES}
)

# 6. fon core phonetic objects & DSP algorithms
set(FON_SOURCES
    praat/fon/Transition.cpp
    praat/fon/Distributions_and_Transition.cpp
    praat/fon/Function.cpp
    praat/fon/Sampled.cpp
    praat/fon/SampledXY.cpp
    praat/fon/Matrix.cpp
    praat/fon/Vector.cpp
    praat/fon/Polygon.cpp
    praat/fon/PointProcess.cpp
    praat/fon/Matrix_and_PointProcess.cpp
    praat/fon/Matrix_and_Polygon.cpp
    praat/fon/AnyTier.cpp
    praat/fon/RealTier.cpp
    praat/fon/Sound.cpp
    praat/fon/LongSound.cpp
    praat/fon/SoundSet.cpp
    praat/fon/Sound_files.cpp
    praat/fon/Sound_audio.cpp
    praat/fon/PointProcess_and_Sound.cpp
    praat/fon/Sound_PointProcess.cpp
    praat/fon/ParamCurve.cpp
    praat/fon/Pitch.cpp
    praat/fon/Harmonicity.cpp
    praat/fon/Intensity.cpp
    praat/fon/Matrix_and_Pitch.cpp
    praat/fon/Sound_to_Pitch.cpp
    praat/fon/Sound_to_Intensity.cpp
    praat/fon/Sound_to_Harmonicity.cpp
    praat/fon/Sound_to_Harmonicity_GNE.cpp
    praat/fon/Sound_to_PointProcess.cpp
    praat/fon/Pitch_to_PointProcess.cpp
    praat/fon/Pitch_to_Sound.cpp
    praat/fon/Pitch_Intensity.cpp
    praat/fon/PitchTier.cpp
    praat/fon/Pitch_to_PitchTier.cpp
    praat/fon/PitchTier_to_PointProcess.cpp
    praat/fon/PitchTier_to_Sound.cpp
    praat/fon/Manipulation.cpp
    praat/fon/Pitch_AnyTier_to_PitchTier.cpp
    praat/fon/IntensityTier.cpp
    praat/fon/DurationTier.cpp
    praat/fon/AmplitudeTier.cpp
    praat/fon/Spectrum.cpp
    praat/fon/Ltas.cpp
    praat/fon/Spectrogram.cpp
    praat/fon/SpectrumTier.cpp
    praat/fon/Ltas_to_SpectrumTier.cpp
    praat/fon/Formant.cpp
    praat/fon/Image.cpp
    praat/fon/Sound_to_Formant.cpp
    praat/fon/Sound_and_Spectrogram.cpp
    praat/fon/Sound_and_Spectrum.cpp
    praat/fon/Spectrum_and_Spectrogram.cpp
    praat/fon/Spectrum_to_Formant.cpp
    praat/fon/FormantTier.cpp
    praat/fon/TextGrid.cpp
    praat/fon/TextGrid_files.cpp
    praat/fon/TextGrid_Sound.cpp
    praat/fon/Label.cpp
    praat/fon/FormantGrid.cpp
    praat/fon/Excitation.cpp
    praat/fon/Cochleagram.cpp
    praat/fon/Cochleagram_and_Excitation.cpp
    praat/fon/Excitation_to_Formant.cpp
    praat/fon/Sound_to_Cochleagram.cpp
    praat/fon/Spectrum_to_Excitation.cpp
    praat/fon/VocalTract.cpp
    praat/fon/VocalTract_to_Spectrum.cpp
    praat/fon/Sound_enhance.cpp
    praat/fon/VoiceAnalysis.cpp
    praat/fon/H1minusH2Tier.cpp
    praat/fon/WordList.cpp
    praat/fon/SpellingChecker.cpp
    praat/fon/FujisakiPitch.cpp
    praat/fon/ExperimentMFC.cpp
    praat/fon/Photo.cpp
    praat/fon/Movie.cpp
    praat/fon/Corpus.cpp
)

# 7. stat headless sources
set(STAT_SOURCES
    praat/stat/Table.cpp
    praat/stat/TableOfReal.cpp
    praat/stat/Distributions.cpp
    praat/stat/Distributions_and_Strings.cpp
    praat/stat/PairDistribution.cpp
    praat/stat/Regression.cpp
    praat/stat/LogisticRegression.cpp
)

# 8. LPC sources (Linear Predictive Coding, Cepstrum, PowerCepstrogram, CPP)
set(LPC_SOURCES
    praat/LPC/Cepstrum.cpp
    praat/LPC/Cepstrumc.cpp
    praat/LPC/Cepstrum_and_Spectrum.cpp
    praat/LPC/Cepstrogram.cpp
    praat/LPC/CPP.cpp
    praat/LPC/PowerCepstrum.cpp
    praat/LPC/PowerCepstrogram.cpp
    praat/LPC/Sound_to_PowerCepstrogram.cpp
    praat/LPC/Sound_to_CPP.cpp
    praat/LPC/Sound_and_Cepstrum.cpp
    praat/LPC/LPC.cpp
    praat/LPC/Sound_and_LPC.cpp
    praat/LPC/LPC_and_Formant.cpp
    praat/LPC/LPC_and_Polynomial.cpp
    praat/LPC/LPC_and_Cepstrumc.cpp
    praat/LPC/LPC_and_LFCC.cpp
    praat/LPC/LPC_to_Spectrum.cpp
    praat/LPC/LPC_to_Spectrogram.cpp
    praat/LPC/LPC_and_Tube.cpp
    praat/LPC/Tube.cpp
    praat/LPC/Roots_and_Formant.cpp
    praat/LPC/LineSpectralFrequencies.cpp
    praat/LPC/LPC_and_LineSpectralFrequencies.cpp
    praat/LPC/VocalTractTier.cpp
    praat/LPC/Formant_extensions.cpp
)

# 9. dwtools sources (KlattGrid, MFCC, LFCC, FilterBank, CC, Resonator, SoundFrames, extensions)
set(DWTOOLS_SOURCES
    praat/dwtools/AffineTransform.cpp
    praat/dwtools/Categories.cpp
    praat/dwtools/Categories_and_Strings.cpp
    praat/dwtools/CC.cpp
    praat/dwtools/CCs_to_DTW.cpp
    praat/dwtools/ClassificationTable.cpp
    praat/dwtools/Confusion.cpp
    praat/dwtools/Configuration.cpp
    praat/dwtools/Configuration_AffineTransform.cpp
    praat/dwtools/Configuration_and_Procrustes.cpp
    praat/dwtools/ContingencyTable.cpp
    praat/dwtools/Correlation.cpp
    praat/dwtools/Covariance.cpp
    praat/dwtools/DataModeler.cpp
    praat/dwtools/Discriminant.cpp
    praat/dwtools/Distance.cpp
    praat/dwtools/DTW.cpp
    praat/dwtools/Eigen_and_Matrix.cpp
    praat/dwtools/Eigen_and_Procrustes.cpp
    praat/dwtools/Eigen_and_SSCP.cpp
    praat/dwtools/Eigen_and_TableOfReal.cpp
    praat/dwtools/Excitations.cpp
    praat/dwtools/FilterBank.cpp
    praat/dwtools/FormantGrid_extensions.cpp
    praat/dwtools/Intensity_extensions.cpp
    praat/dwtools/KlattGrid.cpp
    praat/dwtools/KlattTable.cpp
    praat/dwtools/LFCC.cpp
    praat/dwtools/Ltas_extensions.cpp
    praat/dwtools/Matrix_Categories.cpp
    praat/dwtools/Matrix_extensions.cpp
    praat/dwtools/MFCC.cpp
    praat/dwtools/Minimizers.cpp
    praat/dwtools/PatternList.cpp
    praat/dwtools/PCA.cpp
    praat/dwtools/Pitch_extensions.cpp
    praat/dwtools/Polygon_extensions.cpp
    praat/dwtools/Polynomial_to_Spectrum.cpp
    praat/dwtools/Procrustes.cpp
    praat/dwtools/Proximity.cpp
    praat/dwtools/Proximity_and_Distance.cpp
    praat/dwtools/Resonator.cpp
    praat/dwtools/Roots_to_Spectrum.cpp
    praat/dwtools/SoundFrames.cpp
    praat/dwtools/Sound_and_Spectrogram_extensions.cpp
    praat/dwtools/Sound_and_Spectrum_dft.cpp
    praat/dwtools/Sound_and_TextGrid_extensions.cpp
    praat/dwtools/Sound_extensions.cpp
    praat/dwtools/Sound_to_MFCC.cpp
    praat/dwtools/Sounds_to_DTW.cpp
    praat/dwtools/Spectrogram_extensions.cpp
    praat/dwtools/Spectrum_extensions.cpp
    praat/dwtools/SSCP.cpp
    praat/dwtools/Strings_extensions.cpp
    praat/dwtools/Table_extensions.cpp
    praat/dwtools/TableOfReal_and_Permutation.cpp
    praat/dwtools/TableOfReal_and_SVD.cpp
    praat/dwtools/TableOfReal_extensions.cpp
    praat/dwtools/TextGrid_and_DurationTier.cpp
    praat/dwtools/TextGrid_and_PitchTier.cpp
    praat/dwtools/TextGrid_extensions.cpp
    praat/dwtools/Vector_extensions.cpp
)

# 10. artsynth sources (Articulatory synthesis: Speaker, Artword, Articulation)
set(ARTSYNTH_SOURCES
    praat/artsynth/Speaker.cpp
    praat/artsynth/Articulation.cpp
    praat/artsynth/Artword.cpp
    praat/artsynth/Art_Speaker.cpp
    praat/artsynth/Art_Speaker_to_VocalTract.cpp
    praat/artsynth/Artword_Speaker.cpp
    praat/artsynth/Artword_Speaker_Sound.cpp
    praat/artsynth/Artword_Speaker_to_Sound.cpp
    praat/artsynth/Artword_to_Art.cpp
    praat/artsynth/Delta.cpp
    praat/artsynth/Speaker_to_Delta.cpp
    praat/artsynth/Art_Speaker_Delta.cpp
)

# 11. Bridge sources
set(BRIDGE_SOURCES
    bridge/praat_bridge.cpp
    bridge/portaudio_stub.c
    bridge/whisper_stub.cpp
)

# Combine all sources into static library
add_library(praat_core STATIC
    ${KAR_SOURCES}
    ${MELDER_SOURCES}
    ${DWSYS_SOURCES}
    ${SYS_SOURCES}
    ${EXTERNAL_SOURCES}
    ${FON_SOURCES}
    ${STAT_SOURCES}
    ${LPC_SOURCES}
    ${DWTOOLS_SOURCES}
    ${ARTSYNTH_SOURCES}
    ${BRIDGE_SOURCES}
)

# WASM executable target: praatlib.js
add_executable(praatlib
    bridge/praat_bridge.cpp
)

target_link_libraries(praatlib PRIVATE praat_core)

set_target_properties(praatlib PROPERTIES
    OUTPUT_NAME "praatlib"
    SUFFIX ".js"
)

# Emscripten linker flags
set(EMSCRIPTEN_LINK_FLAGS
    "-fwasm-exceptions"
    "-s WASM=1"
    "-s ALLOW_MEMORY_GROWTH=1"
    "-s INITIAL_MEMORY=134217728"
    "-s MAXIMUM_MEMORY=1073741824"
    "-s STACK_SIZE=5242880"
    "-s AUTO_NATIVE_LIBRARIES=0"
    "-s ENVIRONMENT=web,worker,node"
    "-s MODULARIZE=1"
    "-s EXPORT_ES6=1"
    "-s EXPORT_NAME=createPraatModule"
    "-s NO_EXIT_RUNTIME=1"
    "-s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','getValue','setValue','UTF8ToString','stringToUTF8','HEAP8','HEAP16','HEAP32','HEAPU8','HEAPU16','HEAPU32','HEAPF32','HEAPF64','FS']"
    "-s EXPORTED_FUNCTIONS=['_malloc','_free','_praat_bridge_init','_praat_bridge_create_sound','_praat_bridge_sound_read_from_memory','_praat_bridge_destroy_object','_praat_bridge_get_object_count','_praat_bridge_get_object_name','_praat_bridge_get_object_class','_praat_bridge_rename_object','_praat_bridge_object_save_to_binary_file','_praat_bridge_object_read_from_file','_praat_bridge_sound_get_duration','_praat_bridge_sound_get_sample_rate','_praat_bridge_sound_get_num_samples','_praat_bridge_sound_get_num_channels','_praat_bridge_sound_get_channel_samples','_praat_bridge_sound_save_as_wav_file','_praat_bridge_sound_to_pitch','_praat_bridge_sound_to_formant','_praat_bridge_sound_to_spectrogram','_praat_bridge_sound_to_intensity','_praat_bridge_spectrogram_get_info','_praat_bridge_spectrogram_get_matrix','_praat_bridge_pitch_get_info','_praat_bridge_pitch_get_frames','_praat_bridge_formant_get_info','_praat_bridge_formant_get_frames','_praat_bridge_intensity_get_info','_praat_bridge_intensity_get_frames','_praat_bridge_pitch_get_mean','_praat_bridge_pitch_get_value_at_time','_praat_bridge_create_textgrid','_praat_bridge_sound_to_textgrid','_praat_bridge_textgrid_to_json','_praat_bridge_textgrid_save_to_file','_praat_bridge_textgrid_read_from_file','_praat_bridge_textgrid_replace_from_file','_praat_bridge_textgrid_insert_boundary','_praat_bridge_textgrid_remove_boundary_at_time','_praat_bridge_textgrid_set_interval_text','_praat_bridge_textgrid_insert_point','_praat_bridge_textgrid_set_point_text','_praat_bridge_execute_script','_praat_bridge_get_info_output','_praat_bridge_clear_info_output','_praat_bridge_get_objects_json','_praat_bridge_select_object','_praat_bridge_sound_to_power_cepstrogram','_praat_bridge_power_cepstrogram_get_cpps','_praat_bridge_power_cepstrogram_to_cpp','_praat_bridge_sound_to_cpp','_praat_bridge_cpp_get_mean','_praat_bridge_cpp_get_info','_praat_bridge_cpp_get_frames','_praat_bridge_create_klattgrid_from_vowel','_praat_bridge_sound_to_klattgrid','_praat_bridge_klattgrid_to_sound','_praat_bridge_sound_to_lpc_burg','_praat_bridge_lpc_to_formant','_praat_bridge_sound_to_mfcc','_praat_bridge_mfcc_get_info','_praat_bridge_create_speaker','_praat_bridge_create_artword','_praat_bridge_artword_set_target','_praat_bridge_artword_get_target','_praat_bridge_artword_speaker_to_sound']"
)

string(JOIN " " EMSCRIPTEN_LINK_FLAGS_STR ${EMSCRIPTEN_LINK_FLAGS})

set_target_properties(praatlib PROPERTIES
    LINK_FLAGS "${EMSCRIPTEN_LINK_FLAGS_STR}"
)
