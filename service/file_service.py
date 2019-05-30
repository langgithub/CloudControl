# encoding: utf-8
"""
--------------------------------------
@describe 安装文件表信息接口 对应集合install_file
@version: 1.0
@project: CloudControl
@file: file_service.py
@author: yuanlang 
@time: 2019-04-03 10:15
---------------------------------------
"""
from abc import ABCMeta, abstractmethod


class FileService(metaclass=ABCMeta):

    @abstractmethod
    async def query_install_file(self, group, page, pre_page, sort):
        pass

    @abstractmethod
    async def save_install_file(self, file):
        pass
