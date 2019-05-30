# encoding: utf-8
"""
--------------------------------------
@describe 手机服务接口 对应表device
@version: 1.0
@project: CloudControl
@file: phone_service_impl.py
@author: yuanlang 
@time: 2019-03-27 10:25
---------------------------------------
"""
import requests
import time
import json
from common.logger import logger
from service.phone_service import PhoneService


class PhoneServiceImpl(PhoneService):

    def __init__(self):
        from database.motor_helper import motor
        self.motor = motor

    async def on_connected(self, identifier, host):
        logger.debug(identifier + " on_connected")
        save = {}
        try:
            response = requests.get(f"http://{host}:7912/info", timeout=3)
            save.update(json.loads(response.text))
        except Exception as e:
            logger.error(e)
        current_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time()))
        item = {"update_time": current_time, "ip": host, "present": True, "udid": identifier,
                "port": 7912, "using": False, "is_server": False}
        save.update(item)
        await self.motor.upsert(identifier, save)

    async def re_connected(self, identifier, host):
        logger.debug(identifier + " re_connected")
        save = {}
        try:
            response = requests.get(f"http://{host}:7912/info", timeout=3)
            save.update(json.loads(response.text))
        except Exception as e:
            logger.error(e)
        current_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time()))
        item = {"update_time": current_time, "ip": host, "present": True, "udid": identifier,
                "port": 7912, "using": False}
        save.update(item)
        await self.motor.upsert(identifier, save)

    async def offline_connected(self, identifier):
        logger.debug(identifier + " offline_connected")
        current_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time()))
        item = {"update_time": current_time, "present": False}
        await self.motor.update(identifier, item)

    async def update_filed(self, identifier, item: dict):
        """更新字段"""
        await self.motor.upsert(identifier, item)

    async def query_info_by_udid(self, udid):
        """
        query_info_by_udid
        :param udid: 手机唯一标示
        :return:
        """
        return await self.motor.find_by_udid(udid)

    async def query_device_list(self):
        """
        query_device_list
        :return:
        """
        return await self.motor.find_device_list()

    async def query_device_list_by_present(self):
        """
        query_device_list_by_present
        :return:
        """
        return await self.motor.query_device_list_by_present()

    async def delect_devices(self):
        """
        初始化数据库 删除device表
        :return:
        """
        return await self.motor.delect_devices()


phone_service = PhoneServiceImpl()

"""
{


    "createdAt": Thu Mar 28 2019 09:27:14 GMT+08:00 ,
    "present": true , //device是否上线
    "ready": false , //数据是否完整
    "using": true , //是否在使用
}
"""

"""
{
  "udid": "01ab7d250c343798-2c:54:cf:e9:e0:14-AOSP_on_HammerHead",
  "version": "4.4.4",
  "serial": "01ab7d250c343798",
  "brand": "Android",
  "model": "AOSP on HammerHead",
  "hwaddr": "2c:54:cf:e9:e0:14",
  "port": 7912,
  "sdk": 19,
  "agentVersion": "0.5.4",
  "display": {
    "width": 1080,
    "height": 1920
  },
  "battery": {
    "acPowered": false,
    "usbPowered": false,
    "wirelessPowered": false,
    "status": 3,
    "health": 2,
    "present": true,
    "level": 75,
    "scale": 100,
    "voltage": 3872,
    "temperature": 286,
    "technology": "Li-ion"
  },
  "memory": {
    "total": 1899548,
    "around": "2 GB"
  },
  "cpu": {
    "cores": 4,
    "hardware": "Qualcomm MSM 8974 HAMMERHEAD (Flattened Device Tree)"
  },
  "owner": null,
  "presenceChangedAt": "0001-01-01T00:00:00Z",
  "usingBeganAt": "0001-01-01T00:00:00Z",
  "product": null,
  "provider": null,
  "serverUrl": "http://172.17.2.233:8000"
}
"""
