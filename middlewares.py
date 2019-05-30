# encoding: utf-8
"""
--------------------------------------
@describe 404  500 重定向中间件
@version: 1.0
@project: CloudControl
@file: middlewares.py
@author: yuanlang 
@time: 2019-03-25 15:40
---------------------------------------
"""
import aiohttp_jinja2
from aiohttp import web


async def handle_404(request):
    """
    404模板
    :param request: request请求
    :return: 返回404页面
    """
    return aiohttp_jinja2.render_template('404.html', request, {})


async def handle_500(request: web.Request):
    """
    500模板
    :param request: request请求
    :return: 返回404页面
    """
    return aiohttp_jinja2.render_template('500.html', request, {})


def create_error_middleware(overrides):
    """
    根据状态码返回对应模版
    :param overrides: 状态码与模版映射关系
    :return: response 响应
    """

    @web.middleware
    async def error_middleware(request, handler):

        try:
            response = await handler(request)

            override = overrides.get(response.status)
            if override:
                return await override(request)

            return response

        except web.HTTPException as ex:
            override = overrides.get(ex.status)
            if override:
                return await override(request)

            raise

    return error_middleware


def setup_middlewares(app):
    """
    配置全局重定向插件
    :param app:
    :return:
    """
    error_middleware = create_error_middleware({
        404: handle_404,
        500: handle_500
    })
    app.middlewares.append(error_middleware)