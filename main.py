# encoding: utf-8
"""
--------------------------------------
@describe asyncio http server 配置
@version: 1.0
@project: CloudControl
@file: main.py.py
@author: yuanlang 
@time: 2019-03-15 14:00
---------------------------------------
"""
import asyncio
import jinja2
import aiohttp_jinja2
from aiohttp import web
from resources.routes_control import setup_routes
from middlewares import setup_middlewares
from service.impl.phone_service_impl import phone_service
from config import conf
from common.logger import logger


def setup_templates(app):
    aiohttp_jinja2.setup(app, loader=jinja2.FileSystemLoader('./resources/templates'))


def setup_static_routes(app):
    app.router.add_static('/static/',
                          path='./resources/static',
                          name='static')


def init_db(_loop):
    """
    删除表atxserver.devices
    :return:
    """
    task = _loop.create_task(phone_service.delect_devices())
    asyncio.gather(task)


async def init(_loop):
    """
    初始化
    :param _loop:
    :return:
    """
    app = web.Application(loop=_loop)
    # 初始化数据库
    init_db(_loop)
    # 配置路由
    setup_routes(_loop, app)
    # 配置页面跳转中间件
    setup_middlewares(app)
    # 配置静态资源
    setup_static_routes(app)
    # 配置静态资源模板
    setup_templates(app)
    # 启动服务
    # noinspection PyDeprecation
    srv = await _loop.create_server(app.make_handler(), '172.17.2.36', conf.server["port"])
    logger.info('http://172.17.2.36:'+str(conf.server["port"]))
    return srv


loop = asyncio.get_event_loop()
loop.run_until_complete(init(loop))
loop.run_forever()


# app['config'] = config
# web.run_app(app, host="0.0.0.0", port=8000)
