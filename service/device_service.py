# encoding: utf-8
"""
--------------------------------------
@describe 各种系统自动化接口
@version: 1.0
@project: CloudControl
@file: device_service.py
@author: yuanlang 
@time: 2019-04-01 18:06
---------------------------------------
"""

from abc import ABCMeta, abstractmethod


class DeviceService(metaclass=ABCMeta):
    """
    设备接口，Android ios 树莓
    """

    @abstractmethod
    def screenshot(self):
        pass

    @abstractmethod
    def dump_hierarchy(self):
        pass

