# encoding: utf-8
"""
--------------------------------------
@describe 各种系统自动化接口 目前只有android
@version: 1.0
@project: CloudControl
@file: device_service_impl.py
@author: yuanlang 
@time: 2019-04-01 18:07
---------------------------------------
"""
from common import uidumplib
from service.device_service import DeviceService


class AndroidDevice(DeviceService):
    """
    Androdi device
    """

    def __init__(self, device_url):
        import uiautomator2 as u2
        d = u2.connect(device_url)
        self._d = d

    def screenshot(self):
        """
        andrroid 截图与hierarchy相关
        :return:
        """
        return self._d.screenshot()

    def dump_hierarchy(self):
        """
        dump Android 界面文档树
        :return:
        """
        return uidumplib.get_android_hierarchy(self._d)

    @property
    def device(self):
        return self._d
