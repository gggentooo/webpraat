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

#ifdef __cplusplus
}
#endif

#endif // WEBPRAAT_BRIDGE_H
