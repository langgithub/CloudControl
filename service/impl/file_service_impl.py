# encoding: utf-8
"""
--------------------------------------
@describe 安装文件表信息接口 对应集合install_file
@version: 1.0
@project: CloudControl
@file: file_service_impl.py
@author: yuanlang 
@time: 2019-04-03 10:18
---------------------------------------
"""
from service.file_service import FileService


class FileServiceImpl(FileService):

    def __init__(self):
        from database.motor_helper import motor
        self.motor = motor

    async def save_install_file(self, file):
        """
        save_install_file info
        :param file:
        :return:
        """
        await self.motor.save_install_file(file)

    async def query_install_file(self, group, start, end, sort):
        """
        query_install_file
        :param group: 分组
        :param start: 开始下标
        :param end: 结束下标
        :param sort: 排序方式
        :return:
        """
        return await self.motor.query_install_file(group, start, end)

    async def query_all_install_file(self):
        """
        query_all_install_file
        :return: 所有已安装文件列表
        """
        return await self.motor.query_all_install_file()

    async def delect_install_file_by_id(self, group, filename):
        """
        delect_install_file_by_id
        :param group: 组
        :param filename:文件名称
        :return:
        """
        return await self.motor.delect_install_file_by_id(group, filename)


file_service = FileServiceImpl()
