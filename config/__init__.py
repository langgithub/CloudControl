# coding:utf8
"""
@author: xsren 
@contact: bestrenxs@gmail.com
@site: xsren.me

@version: 1.0
@file: __init__.py.py
@time: 25/12/2017 2:13 PM

"""
import os
import yaml
# from common.utils import check_env
from common.logger import logger


class YamlParser(object):
    """"""

    def __init__(self, fpath):
        with open(fpath,encoding='utf-8') as fh:
            self.attributes = yaml.load(fh)

    def __getattr__(self, name):
        val = self.get(name)
        if val is not None:
            return val
        else:
            return self.__dict__[name]

    def __setattr__(self, name, value):
        if name.isupper():
            self.attributes[name] = value
        else:
            self.__dict__[name] = value

    def get(self, key, default_value=None):
        return self.attributes.get(key, default_value)

    def set(self, key, value):
        self.attributes[key] = value

    def set_from_dict(self, attributes):
        for name, value in attributes.items():
            self.set(name, value)


# environment = check_env()
# if environment == "development":
#     conf_file = '/default_dev.yaml'
# elif environment == "production":
#     conf_file = '/default_pro.yaml'
# elif environment == "test":
#     conf_file = '/default_test.yaml'
# else:
#     raise Exception("不正确的environment")

conf_file = '/default_dev.yaml'
logger.info(f"加载配置文件:{os.path.dirname(__file__)+conf_file}")
conf = YamlParser(os.path.dirname(__file__)+conf_file)