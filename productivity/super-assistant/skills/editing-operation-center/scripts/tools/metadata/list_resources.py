"""List names accepted by animation, transition, mask, font, and effect tools."""

from core.settings import IS_CAPCUT_ENV
import pyJianYingDraft as draft


def _names(enum_type) -> list[dict]:
    return [{"name": name} for name in enum_type.__members__]


def _profile_enum(capcut_enum, jianying_enum):
    return capcut_enum if IS_CAPCUT_ENV else jianying_enum


def get_intro_animation_types() -> list[dict]:
    """List supported video/image entrance animation names."""
    return _names(_profile_enum(draft.CapCut_Intro_type, draft.Intro_type))


def get_outro_animation_types() -> list[dict]:
    """List supported video/image exit animation names."""
    return _names(_profile_enum(draft.CapCut_Outro_type, draft.Outro_type))


def get_combo_animation_types() -> list[dict]:
    """List supported video/image combo animation names."""
    return _names(
        _profile_enum(draft.CapCut_Group_animation_type, draft.Group_animation_type)
    )


def get_transition_types() -> list[dict]:
    """List supported transition names."""
    return _names(_profile_enum(draft.CapCut_Transition_type, draft.Transition_type))


def get_mask_types() -> list[dict]:
    """List supported mask names."""
    return _names(_profile_enum(draft.CapCut_Mask_type, draft.Mask_type))


def get_font_types() -> list[dict]:
    """List supported font names."""
    return _names(draft.Font_type)


def get_text_intro_types() -> list[dict]:
    """List supported text entrance animation names."""
    return _names(_profile_enum(draft.CapCut_Text_intro, draft.Text_intro))


def get_text_outro_types() -> list[dict]:
    """List supported text exit animation names."""
    return _names(_profile_enum(draft.CapCut_Text_outro, draft.Text_outro))


def get_text_loop_anim_types() -> list[dict]:
    """List supported text loop animation names."""
    return _names(_profile_enum(draft.CapCut_Text_loop_anim, draft.Text_loop_anim))


def get_video_scene_effect_types() -> list[dict]:
    """List supported scene effect names."""
    return _names(
        _profile_enum(
            draft.CapCut_Video_scene_effect_type,
            draft.Video_scene_effect_type,
        )
    )


def get_video_character_effect_types() -> list[dict]:
    """List supported character effect names."""
    return _names(
        _profile_enum(
            draft.CapCut_Video_character_effect_type,
            draft.Video_character_effect_type,
        )
    )


def _effect_items(enum_type, category: str) -> list[dict]:
    result = []
    for name, member in enum_type.__members__.items():
        params = [
            {
                "name": param.name,
                "default_value": param.default_value * 100,
                "min_value": param.min_value * 100,
                "max_value": param.max_value * 100,
            }
            for param in member.value.params
        ]
        result.append({"name": name, "type": category, "params": params})
    return result


def get_audio_effect_types() -> list[dict]:
    """List supported audio effects and their parameter ranges."""
    if IS_CAPCUT_ENV:
        groups = (
            (draft.CapCut_Voice_filters_effect_type, "Voice_filters"),
            (draft.CapCut_Voice_characters_effect_type, "Voice_characters"),
            (draft.CapCut_Speech_to_song_effect_type, "Speech_to_song"),
        )
    else:
        groups = (
            (draft.Tone_effect_type, "Tone"),
            (draft.Audio_scene_effect_type, "Audio_scene"),
            (draft.Speech_to_song_type, "Speech_to_song"),
        )
    return [
        item
        for enum_type, category in groups
        for item in _effect_items(enum_type, category)
    ]
