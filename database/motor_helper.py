# encoding: utf-8
"""
--------------------------------------
@describe motor操作mongo数据库
@version: 1.0
@project: CloudControl
@file: motor_helper.py
@author: yuanlang 
@time: 2019-03-27 11:48
---------------------------------------
"""
import contextlib

from motor.motor_asyncio import AsyncIOMotorClient

from common.logger import logger
from config import conf


# try:
#     import uvloop
#
#     asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
# except ImportError:
#     pass


class MotorHelper(object):

    def __init__(self):
        """
        初始化配置，连接mongo
        """
        # /{conf.db_configs['db_name']}
        if conf.db_configs["user"]:
            self.motor_uri = f"mongodb://{conf.db_configs['user']}:{conf.db_configs['passwd']}" \
                f"@{conf.db_configs['host']}:{conf.db_configs['port']}"
        else:
            self.motor_uri = f"mongodb://{conf.db_configs['host']}:{conf.db_configs['port']}" \
                f"/{conf.db_configs['db_name']}"
        self.__connected()

    def __connected(self):
        self.conn: AsyncIOMotorClient = AsyncIOMotorClient(self.motor_uri)
        logger.debug(self.motor_uri)

    @contextlib.contextmanager
    def connected(self):
        """
        TODO：
        上下文对象，统一管理资源链接与释放
        :return:
        """
        self.__connected()
        try:
            yield self.conn
        except Exception as e:
            logger.error(e)
            if self.conn is not None:
                self.conn.close()

    async def insert_many(self, items):
        """
        TODO：测试
        :param items:
        :return:
        """
        with self.connected() as client:
            await client.atxserver.devices.insert_many(items)

    async def find(self):
        """
        TODO：测试
        :return:
        """
        data = self.conn.tangxinqun_details.find({'status': 0})
        async for item in data:
            print(item)
        return data

    async def upsert(self, condition, item):
        """
        根据udid更新devices 设备列表.upsert 表示没有即插入
        :param condition: udid
        :param item: devices
        :return: 0 or 1
        """
        # with self.connected() as client:
        return self.conn.atxserver.devices.update_many({"udid": condition}, {"$set": item}, upsert=True)

    async def update(self, condition, item):
        """
        根据udid更新devices 设备列表
        :param condition: udid
        :param item: devices
        :return: 0 or 1
        """
        # with self.connected() as client:
        return self.conn.atxserver.devices.update_one({"udid": condition}, {"$set": item}, upsert=False)

    async def find_by_udid(self, udid):
        """
        根据udid查询设备列表
        :param udid: 唯一标示符
        :return: devices设备
        """
        logger.debug("udid >>>>>> " + udid)
        cursor = self.conn.atxserver.devices.find({'udid': udid}, {"_id": 0})
        devices_list = []
        while await cursor.fetch_next:
            info = cursor.next_object()
            devices_list.append(info)
        return devices_list[0]

        # async_gen = (item async for item in curosr)
        # return async_gen

    async def find_device_list(self):
        """
        获取设备列表
        :return:
        """
        cursor = self.conn.atxserver.devices.find({"present": True}, {"_id": 0})
        devices_list = []
        while await cursor.fetch_next:
            info = cursor.next_object()
            devices_list.append(info)
        return devices_list

    async def query_device_list_by_present(self):
        """
        根据present状态判断手机是否在线
        :return: devices 集合
        """
        cursor = self.conn.atxserver.devices.find({"present": True}, {"_id": 0})
        devices_list = []
        while await cursor.fetch_next:
            info = cursor.next_object()
            devices_list.append(info)
        return devices_list

    async def query_install_file(self, group, start, end):
        """
        分页查询已下载文件
        :param group: 手机所在组
        :param start: 开始
        :param end: 结束
        :return: install_file 集合
        """
        # cursor = self.conn.atxserver.installed_file.find({"group": group}, {"_id": 0})
        cursor = self.conn.atxserver.installed_file.find({"group": group}, {"_id": 0}).skip(start).limit(end)
        devices_list = []
        while await cursor.fetch_next:
            info = cursor.next_object()
            devices_list.append(info)
        return devices_list

    async def query_all_install_file(self):
        """
        查询所以已安装文件
        :return: installed_file集合
        """
        return await self.conn.atxserver.installed_file.count_documents({})

    async def save_install_file(self, file):
        """
        插入已上传文件基本信息
        :param file:
        :return: installed_file集合
        """
        # with self.connected() as client:
        await self.conn.atxserver.installed_file.update_many({"group": file["group"], "filename": file["filename"]},
                                                             {"$set": file}, upsert=True)

    async def delect_install_file_by_id(self, group, filename):
        """
        根据id删除安装文件记录
        :param group:
        :param filename:
        :return: installed_file集合
        """
        return await self.conn.atxserver.installed_file.delete_many({"group": group, "filename": filename})

    async def delect_devices(self):
        """
        删除集合devices
        :return: devices集合
        """
        return await self.conn.atxserver.devices.delete_many({})


motor = MotorHelper()
# import asyncio
# loop=asyncio.get_event_loop()
# loop.run_until_complete(motor.find_by_udid("01ab7d250c343798-2c:54:cf:e9:e0:14-AOSP_on_HammerHead"))
