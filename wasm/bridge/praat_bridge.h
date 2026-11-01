#ifndef WEBPRAAT_BRIDGE_H
#define WEBPRAAT_BRIDGE_H

#ifdef __cplusplus
extern "C" {
#endif

// Lifecycle & Objects
int         praat_bridge_init(void);
int         praat_bridge_create_sound(const double* samples, int n, int channels, double fs, const char* name);
int         praat_bridge_sound_read_from_memory(const unsigned char* buffer, int length, const char* name);
void        praat_bridge_destroy_object(int id);
int         praat_bridge_get_object_count(void);
const char* praat_bridge_get_object_name(int id);
const char* praat_bridge_get_object_class(int id);
int         praat_bridge_rename_object(int id, const char* new_name);
int         praat_bridge_object_save_to_binary_file(int id, const char* path);
int         praat_bridge_object_read_from_file(const char* path, const char* name);

// Sound getters & samples
double      praat_bridge_sound_get_duration(int sound_id);
double      praat_bridge_sound_get_sample_rate(int sound_id);
int         praat_bridge_sound_get_num_samples(int sound_id);
int         praat_bridge_sound_get_num_channels(int sound_id);
int         praat_bridge_sound_get_channel_samples(int sound_id, int channel, double* dest, int max_samples);
int         praat_bridge_sound_save_as_wav_file(int sound_id, const char* path);

// Basic phonetic analysis
int         praat_bridge_sound_to_pitch(int sound_id, double time_step, double pitch_floor, double pitch_ceiling);
int         praat_bridge_sound_to_formant(int sound_id, double time_step, int n_formants, double max_formant, double window_length);
int         praat_bridge_sound_to_spectrogram(int sound_id, double window_length, double max_freq, double time_step, double window_shape);
int         praat_bridge_sound_to_intensity(int sound_id, double pitch_floor, double time_step, int subtract_mean);

// Detailed contour / matrix extraction
int         praat_bridge_spectrogram_get_info(int spectro_id, double* out_info);
int         praat_bridge_spectrogram_get_matrix(int spectro_id, double* out_data);
int         praat_bridge_pitch_get_info(int pitch_id, double* out_info);
int         praat_bridge_pitch_get_frames(int pitch_id, double* out_frequencies);
int         praat_bridge_formant_get_info(int formant_id, double* out_info);
int         praat_bridge_formant_get_frames(int formant_id, double* out_frequencies);
int         praat_bridge_intensity_get_info(int intensity_id, double* out_info);
int         praat_bridge_intensity_get_frames(int intensity_id, double* out_values);

// Queries & Data access
double      praat_bridge_pitch_get_mean(int pitch_id, double tmin, double tmax);
double      praat_bridge_pitch_get_value_at_time(int pitch_id, double time);

// TextGrid annotation & I/O
int         praat_bridge_create_textgrid(double tmin, double tmax, const char* tier_names, const char* point_tiers, const char* name);
int         praat_bridge_sound_to_textgrid(int sound_id, const char* tier_names, const char* point_tiers);
const char* praat_bridge_textgrid_to_json(int textgrid_id);
int         praat_bridge_textgrid_save_to_file(int textgrid_id, const char* path);
int         praat_bridge_textgrid_read_from_file(const char* path, const char* name);
int         praat_bridge_textgrid_insert_boundary(int textgrid_id, int tier_number, double time);
int         praat_bridge_textgrid_remove_boundary_at_time(int textgrid_id, int tier_number, double time);
int         praat_bridge_textgrid_set_interval_text(int textgrid_id, int tier_number, int interval_number, const char* text);
int         praat_bridge_textgrid_insert_point(int textgrid_id, int tier_number, double time, const char* mark);
int         praat_bridge_textgrid_set_point_text(int textgrid_id, int tier_number, int point_number, const char* text);

// Scripting & Console output
const char* praat_bridge_execute_script(const char* script_text);
const char* praat_bridge_get_info_output(void);
void        praat_bridge_clear_info_output(void);
const char* praat_bridge_get_objects_json(void);
int         praat_bridge_select_object(int id);

// Phase 7 Advanced DSP: Cepstral Peak Prominence (LPC / dwtools)
int         praat_bridge_sound_to_power_cepstrogram(int sound_id, double pitch_floor, double time_step, double max_freq, double pre_emphasis);
double      praat_bridge_power_cepstrogram_get_cpps(int cepstrogram_id, int subtract_trend, double time_avg_window, double quefrency_avg_window, double pitch_floor, double pitch_ceiling);
int         praat_bridge_power_cepstrogram_to_cpp(int cepstrogram_id, double pitch_floor, double pitch_ceiling);
int         praat_bridge_sound_to_cpp(int sound_id, double pitch_floor, double pitch_ceiling, double time_step);
double      praat_bridge_cpp_get_mean(int cpp_id, double tmin, double tmax);
int         praat_bridge_cpp_get_info(int cpp_id, double* out_info);
int         praat_bridge_cpp_get_frames(int cpp_id, double* out_values);

// Phase 7 Advanced DSP: KlattGrid Speech Synthesis (dwtools)
int         praat_bridge_create_klattgrid_from_vowel(const char* name, double duration, double f0_start, double f1, double b1, double f2, double b2, double f3, double b3, double f4);
int         praat_bridge_sound_to_klattgrid(int sound_id, double time_step, int n_formants, double max_formant, double window_length, double pitch_floor, double pitch_ceiling);
int         praat_bridge_klattgrid_to_sound(int klattgrid_id);

// Phase 7 Advanced DSP: LPC & MFCC (LPC / dwtools)
int         praat_bridge_sound_to_lpc_burg(int sound_id, int prediction_order, double window_length, double time_step, double pre_emphasis);
int         praat_bridge_lpc_to_formant(int lpc_id);
int         praat_bridge_sound_to_mfcc(int sound_id, int num_coefficients, double window_length, double time_step, double f1_mel, double fmax_mel, double df_mel);
int         praat_bridge_mfcc_get_info(int mfcc_id, double* out_info);

// Phase 7 Advanced DSP: Articulatory Synthesis (artsynth)
int         praat_bridge_create_speaker(const char* name, const char* kind_of_speaker, int num_vocal_cord_masses);
int         praat_bridge_create_artword(const char* name, double duration, int default_voiced);
int         praat_bridge_artword_set_target(int artword_id, int muscle, double time, double value);
double      praat_bridge_artword_get_target(int artword_id, int muscle, double time);
int         praat_bridge_artword_speaker_to_sound(int artword_id, int speaker_id, double sample_rate, int oversampling);

#ifdef __cplusplus
}
#endif

#endif // WEBPRAAT_BRIDGE_H
