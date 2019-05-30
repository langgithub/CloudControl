# encoding: utf-8
"""
--------------------------------------
@describe 
@version: 1.0
@project: CloudControl
@file: websocket_server.py
@author: yuanlang
@time: 2019-03-17 09:40
---------------------------------------
"""
import os

import aiohttp
import json
import asyncio
import base64
import time
import aiohttp_jinja2
from io import BytesIO
from cryptography import fernet
from common.logger import logger
from common.utils import get_host_ip
from config import conf
from aiohttp import web
from aiohttp_session import setup
from aiohttp_session.cookie_storage import EncryptedCookieStorage
from service.impl.phone_service_impl import phone_service
from service.impl.device_service_impl import AndroidDevice
from service.impl.file_service_impl import file_service

route = web.RouteTableDef()
# 获取存储手机信息session
localhost = get_host_ip()
session = {}
loop = None
minitouch_list = []
minitouchs = []


@route.get("/")
async def index(request):
    """
    首页
    :param request:
    :return:
    """
    logger.info(request)
    return web.web_fileresponse.FileResponse(os.path.join(os.path.dirname(__file__), "templates/index.html"))


@route.get("/devices/{udid}/remote")
@aiohttp_jinja2.template('remote.html')
async def remote(request: web.Request):
    """
    远程控制一台
    :param request:
    :return:
    """
    udid = request.match_info.get("udid", "")
    logger.debug(str(request.url) + " >>>>>> " + udid)
    if udid != "":
        device = await phone_service.query_info_by_udid(udid)
        return {"IP": device["ip"], "Port": device["ip"], "Udid": udid,
                "deviceInfo": device, "device": json.dumps(device), "v": {}}
    else:
        # 参数请求错误,重定向到400
        raise web.HTTPBadRequest()


@route.post("/async")
@aiohttp_jinja2.template("device_synchronous.html")
async def async_list(request: web.Request):
    """
    云机同步
    :param request:
    :return:
    """
    form = await request.post()
    udids = form["devices"]
    udid_list = udids.split(",")
    logger.debug(str(request.url)+" >>>>>> "+str(udid_list))
    device, ip_list = None, []
    # 根据udid查询info
    for i in range(0, len(udid_list)):
        _device = await phone_service.query_info_by_udid(udid_list[i])
        if i == 0:
            device = _device
        # ip_list.append(_device)
        ip_list.append({"src": _device['ip'], "des": _device['ip'], "width": _device["display"]["width"],
                        "height": _device["display"]["height"], "port": _device['port'],"udid": _device['udid']})

    result = {'list': json.dumps(ip_list), 'IP': device['ip'], 'Port': device['port'],
              'Width': device["display"]["width"], 'Height': device["display"]["height"], 'Udid': device['udid'],
              'deviceInfo': {}, 'device': {}, 'v': '{{v.des}}'}
    return result


@route.get("/atxagent")
async def atxagent(request: web.Request):
    """
    控制手机 atx-agent
    :param request:
    :return:
    """
    method = request.query["method"]
    udid = request.query["udid"]
    device = await phone_service.query_info_by_udid(udid)
    # 判断手机是否安装了server服务
    if not device["is_server"]:
        # 如果没有安装则上传文件并启动
        async with aiohttp.ClientSession() as _session:
            url = f"http://127.0.0.1:{conf.server['port']}/upload"
            data = aiohttp.FormData()
            headers = {"Access-Control-Allow-Origin": udid}
            data.add_field(name='path', value="/data/local/tmp/")
            data.add_field(name='power', value="755")
            data.add_field(name='file',
                           value=open(os.path.join(os.path.dirname(__file__), "static/server"), "rb"),
                           filename='server',
                           content_type='application/octet-stream')
            data.add_field(name='file',
                           value=open(os.path.join(os.path.dirname(__file__), "static/atx.sh"), "rb"),
                           filename='atx.sh',
                           content_type='application/octet-stream')
            async with _session.post(url=url, headers=headers, data=data) as resp:
                if resp.status != 200:
                    return web.Response(text="服务安装失败", status=404)

            #更新 is_server 字段
            await phone_service.update_filed(identifier=udid, item={"is_server": True})

            # 启动服务
            url = f"http://localhost:{conf.server['port']}/shell"
            headers = {"Access-Control-Allow-Origin": udid}
            data = {
                "command": f"./data/local/tmp/server >/dev/null 2>&1 &"
            }
            async with _session.post(url, headers=headers, data=data) as resp:
                if resp.status != 200:
                    return web.Response(text="server服务启动失败", status=404)

    # atx-agent服务调度
    url = f"http://{device['ip']}:8001/api/v1.0/{method}"
    data = {
        "ip": f"{localhost}:{conf.server['port']}"
    }
    async with aiohttp.ClientSession() as _session:
        async with _session.post(url, data=data) as resp:
            if resp.status != 200:
                return web.Response(text=f"atx-agent[{method}]失败", status=404)
            else:
                return web.Response(text=f"atx-agent[{method}]成功")


@route.post("/shell")
async def shell(request: web.Request):
    """
    执行脚步,下发命令到选中手机
    :param request:
    :return:
    """
    udid = request.headers["Access-Control-Allow-Origin"]
    device = await phone_service.query_info_by_udid(udid)
    if udid != "":
        # 文件权限更改
        reader = await request.post()
        command = reader["command"]
        async with aiohttp.ClientSession() as _session:
            url = f"http://{device['ip']}:{device['port']}/shell"
            params = {
                "command": command
            }
            logger.debug(url + "  " + command)
            await _session.get(url=url, params=params)
        return web.Response(text='{} sized of {} successfully stored'
                                 ''.format(udid, 0))
    else:
        raise web.HTTPBadRequest()


@route.get("/devices/{query}/reserved")
async def reserved(request):
    """
    remote.html 中心跳检查
    :param request:
    :return:
    """
    logger.debug("ws reserved:" + str(request.url))
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    async for msg in ws:
        if msg.type == web.WSMsgType.text:
            await ws.send_str("Hello, {}".format(msg.data))
        elif msg.type == web.WSMsgType.binary:
            await ws.send_bytes(msg.data)
        elif msg.type == web.WSMsgType.close:
            break

    return ws


@route.get("/devices/{udid}/info")
async def query_info(request: web.Request):
    """
    获取单台的info信息
    :param request:
    :return:
    """
    udid = request.match_info.get("udid", "")
    logger.debug(str(request.url) + " >>>>>> " + udid)
    if udid != "":
        device = await phone_service.query_info_by_udid(udid)
        return web.json_response(text=json.dumps(device))
    else:
        # 参数请求错误,重定向到400
        raise web.HTTPBadRequest()


@route.get("/list")
async def async_list(request: web.Request):
    """
    手机列表查询
    :param request:
    :return:
    """
    logger.debug(request.url)
    device = await phone_service.query_device_list()
    return web.json_response(text=json.dumps(device))


@route.get("/feeds")
async def feeds(request: web.Request):
    logger.debug("ws feeds:" + str(request.url))
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    async for msg in ws:
        if msg.type == web.WSMsgType.text:
            # TODO: Queue存放变化的device
            result = {"error": False}
            await ws.send_str(json.dumps(result))
        elif msg.type == web.WSMsgType.binary:
            await ws.send_bytes(msg.data)
        elif msg.type == web.WSMsgType.close:
            break

    return ws


@route.post("/heartbeat")
async def heartbeat(request: web.Request):
    """
    心跳检测手机是否连接
    :param request: 心跳包
    :return:
    """
    global session
    global loop
    # 解析心跳包
    form = await request.post()
    logger.debug(str(request.url) + "\t>>>>>>\t identifier=" + form["identifier"])
    # 获取表单提交的identifier
    identifier = form["identifier"]
    remote_host = request.remote
    # 如果session中有identifier，判断ip是否一致
    phone_session = session[identifier] if identifier in session else None
    if phone_session is not None:
        if phone_session["remote_host"] != remote_host:
            # on_reconnected
            await phone_service.re_connected(identifier, remote_host)
        # 重置timer 倒计时
        t = time.time()
        session[identifier]["timer"] = t + 20
    # 如果没有，进入onconnected,阻塞
    else:
        # onconnected
        phone_seesion = get_phone_session(identifier, remote_host, time.time() + 20)
        session[identifier] = phone_seesion
        await phone_service.on_connected(identifier, remote_host)

        # run timer定时器
        async def consumer(_identifier, _session: dict):
            _phone_seesion = _session[_identifier]
            while True:
                await asyncio.sleep(1)
                _t = time.time()
                # logger.debug(str(_phone_seesion["timer"]) + ">>>>" + str(t))
                if _phone_seesion["timer"] < _t:
                    # offline_onconected()
                    _session.pop(_identifier)
                    return await phone_service.offline_connected(_identifier)

        asyncio.run_coroutine_threadsafe(consumer(identifier, session), loop)
        # loop.call_soon_threadsafe(consumer,identifier, session)
    return web.Response(text="hello kitty")


@route.post("/upload")
async def store_file_handler(request: web.Request):
    """
    文件上传
    :param request:
    :return:
    """
    reader = await request.multipart()
    udid: str = request.headers["Access-Control-Allow-Origin"]

    data = await reader.next()
    assert data.name == "path"
    path: str = await data.text()
    if path == "":
        path = "/data/local/tmp/"

    data = await reader.next()
    assert data.name == "power"
    power: str = await data.text()

    if udid != "":
        device = await phone_service.query_info_by_udid(udid)
        names = []
        # 转到其他手机端
        async with aiohttp.ClientSession() as _session:
            while True:
                try:
                    field = await reader.next()
                    assert field.name == "file"
                except Exception as e:
                    break
                name: str = field.filename
                names.append(name)

                data = aiohttp.FormData()
                data.add_field('file', field, filename=name, content_type='application/octet-stream')
                url = f"http://{device['ip']}:{device['port']}/upload{path.replace('_', '/')}"

                await _session.post(url=url, data=data)
                # 文件权限更改
                url = f"http://localhost:{conf.server['port']}/shell"
                headers = {
                    "Access-Control-Allow-Origin": udid
                }
                data = {
                    "command": f"chmod {power} {path}{name}"
                }
                await _session.post(url=url, data=data, headers=headers)

                # apk安装
                if name.endswith(".apk"):
                    data = {
                        "command": f"pm install {path}{name}"
                    }
                    await _session.post(url=url, data=data, headers=headers)

        return web.Response(text='upload {} successfully stored'
                                 ''.format(",".join(names), 0))
    else:
        raise web.HTTPBadRequest()


@route.get("/inspector/{udid}/screenshot")
async def inspector_screenshot(request: web.Request):
    """
    文档树结构screenshot快照
    :param request:
    :return:
    """
    udid = request.match_info.get("udid", "")
    logger.debug(str(request.url) + " >>>>>> " + udid)
    if udid != "":
        device = await phone_service.query_info_by_udid(udid)
        # 连接用uiautomator2连接atx-agent
        d = AndroidDevice(f"http://{device['ip']}:{device['port']}")
        buffer = BytesIO()
        d.screenshot().convert("RGB").save(buffer, format='JPEG')
        b64data = base64.b64encode(buffer.getvalue())
        response = {
            "type": "jpeg",
            "encoding": "base64",
            "data": b64data.decode('utf-8'),
        }
        return web.json_response(text=json.dumps(response))
    else:
        # 参数请求错误,重定向到400
        raise web.HTTPBadRequest()


@route.get("/inspector/{udid}/hierarchy")
async def inspector_hierarchy(request: web.Request):
    """
    文档树结构
    :param request:
    :return:
    """
    udid = request.match_info.get("udid", "")
    logger.debug(str(request.url) + " >>>>>> " + udid)
    if udid != "":
        device = await phone_service.query_info_by_udid(udid)
        # 连接用uiautomator2连接atx-agent
        d = AndroidDevice(f"http://{device['ip']}:{device['port']}")
        hierarchy = d.dump_hierarchy()
        logger.debug(hierarchy)
        return web.json_response(text=json.dumps(hierarchy))
    else:
        # 参数请求错误,重定向到400
        raise web.HTTPBadRequest()


@route.get("/installfile")
@aiohttp_jinja2.template("file.html")
async def installfile(request: web.Request):
    """
    apk安装
    :param request:
    :return:
    """
    logger.debug(request.url)
    return {}


# /files?sort=&page=1&per_page=10
@route.get("/files")
async def files(request: web.Request):
    """
    apk安装
    :param request:
    :return:
    """
    logger.debug(request.url)

    sort = request.query.get("sort", "")
    page = int(request.query["page"])
    # per_page = int(request.query["per_page"])
    start = (page - 1) * 5
    end = start + 5
    _list = await file_service.query_install_file(0, start, 5, sort)
    total = await file_service.query_all_install_file()
    last_page = int(total / 5) + 1
    # logger.debug(str(page) + " ------- " + str(per_page) + ">>>>>> " + str(list))
    if page < last_page:
        next_page_url = "http://172.17.2.233:8000/files?page=" + str((page + 1))
        prev_page_url = "http://172.17.2.233:8000/files?page=" + str(page)
        if page > 1:
            prev_page_url = "http://172.17.2.233:8000/files?page=" + str((page - 1))
    else:
        next_page_url = "http://172.17.2.233:8000/files?page=" + str(page)
        prev_page_url = "http://172.17.2.233:8000/files?page=" + str((page - 1))

    result = {"total": total, "per_page": 5, "current_page": page, "last_page": last_page,
              "next_page_url": next_page_url, "prev_page_url": prev_page_url, "from": start, "to": end, "data": _list}
    # logger.debug(result)
    return web.json_response(text=json.dumps(result))


# /files?sort=&page=1&per_page=10
@route.get("/file/delete/{group}/{filename}")
async def files(request: web.Request):
    """
    apk安装
    :param request:
    :return:
    """
    logger.debug(request.url)
    group = int(request.match_info.get("group", ""))
    filename = request.match_info.get("filename", "")

    if id != "":
        await file_service.delect_install_file_by_id(group, filename)
        raise web.HTTPFound('/installfile')
    else:
        raise web.HTTPBadRequest()


@route.post("/upload_group/{path}")
async def upload_group(request: web.Request):
    """
    文件上传,批量上传到所在gourd组的手机
    :param request:
    :return:
    """
    path: str = request.match_info.get("path", "")
    logger.debug(path)
    reader = await request.multipart()
    field = await reader.next()
    name = field.filename
    # 上传文件到所在group组的手机
    # group = request.headers["Access-Control-Allow-Origin"]
    # /!\ Don't forget to validate your inputs /!\
    # reader.next() will `yield` the fields of your form

    _list = await phone_service.query_device_list_by_present()
    exception_ip = []
    async with aiohttp.ClientSession() as _session:
        for device in _list:
            # 转到其他手机端
            data = aiohttp.FormData()
            data.add_field('file',
                           field,
                           filename=name,
                           content_type='application/octet-stream')
            url = f"http://{device['ip']}:{device['port']}/upload/{path.replace('_', '/')}/"
            logger.debug("upload url>>>>>> " + url)
            try:
                # proxy="http://localhost:8888"
                async with _session.post(url=url, data=data, timeout=5) as resp:
                    content = await resp.read()
                    text = content.decode(encoding="utf-8")
                    logger.debug(text)
                # apk安装
                if name.endswith(".apk"):
                    url = f"http://localhost:{conf.server['port']}/shell"
                    headers = {
                        "Access-Control-Allow-Origin": device['udid']
                    }
                    data = {
                        "command": f"pm install /{path.replace('_', '/')}/{name}"
                    }
                    async with _session.post(url=url, data=data, headers=headers) as resp:
                        logger.debug(await resp.read())
            except Exception as e:
                logger.warn("Exception:" + str(e) + "   >>>>>> ip:" + device['ip'])
                exception_ip.append("Exception:" + str(e) + "   >>>>>> ip:" + device['ip'])

    current_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time()))
    file = {"group": 0, "filename": name, "filesize": 0, "upload_time": current_time, "who": "admin"}
    await file_service.save_install_file(file)
    result = {}
    if len(exception_ip) != 0:
        result["exception"] = "true"
        result["exception_data"] = exception_ip
    return web.json_response(text=json.dumps(result))


def get_phone_session(identifier, remote_host, timer):
    """
    heartbeat 方法中用到的用于生成session的
    :param identifier:
    :param remote_host:
    :param timer:
    :return:
    """
    phone_seesion = {"identifier": identifier, "remote_host": remote_host, "timer": timer, "timeout": "",
                     "heartbeat": ""}
    return phone_seesion


def setup_routes(_loop, app: web.Application):
    global loop
    loop = _loop
    # 应用静态资源
    app.router.add_routes(route)
    # setup_session
    # secret_key must be 32 url-safe base64-encoded bytes
    fernet_key = fernet.Fernet.generate_key()
    secret_key = base64.urlsafe_b64decode(fernet_key)
    setup(app, EncryptedCookieStorage(secret_key))
