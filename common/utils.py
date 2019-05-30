#!/usr/local/bin/python
# coding:utf-8

"""
@author: Liubing
@software: PyCharm
@file: utils.py
@time: 2019-04-17 11:37
@describe:
"""

import socket


def get_host_ip():
    """
    查询本机ip地址
    :return: ip
    """
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    finally:
        s.close()

    return ip
