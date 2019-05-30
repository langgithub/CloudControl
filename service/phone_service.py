# encoding: utf-8
"""
--------------------------------------
@describe 手机状态服务接口 对应表device
@version: 1.0
@project: CloudControl
@file: phone_service.py
@author: yuanlang 
@time: 2019-03-27 10:20
---------------------------------------
"""
from abc import ABCMeta, abstractmethod


class PhoneService(metaclass=ABCMeta):
    """
    手机状态更新接口
    """

    @abstractmethod
    async def on_connected(self, identifier, host):
        """
        手机连接
        :return:
        """
        pass

    @abstractmethod
    async def re_connected(self, identifier, host):
        """
        手机重新连接
        :return:
        """
        pass

    @abstractmethod
    async def offline_connected(self, identifier):
        """
        手机掉线
        :return:
        """
        pass
