"""Export the local VectCut runtime configuration."""

from .local import *

__all__ = [
    "IS_CAPCUT_ENV",
    "DRAFT_PROFILE",
    "IS_UPLOAD_DRAFT",
]

# 提供一个获取平台信息的辅助函数
def get_platform_info():
    """
    获取平台信息，用于script_file.py中的dumps方法，cap_cut需要返回platform信息
    
    Returns:
        dict: 平台信息字典
    """
    if not IS_CAPCUT_ENV:
        return None
        
    return {
        "app_id": 359289,
        "app_source": "cc",
        "app_version": "6.5.0",
        "device_id": "c4ca4238a0b923820dcc509a6f75849b",
        "hard_disk_id": "307563e0192a94465c0e927fbc482942",
        "mac_address": "c3371f2d4fb02791c067ce44d8fb4ed5",
        "os": "mac",
        "os_version": "15.5"
    }
