### CloudControl 是一款手机群控监控web平台，是基于atx-server和weditor开源项目整合而来
[![GitHub stars](https://img.shields.io/badge/govendor-vendor-blue.svg)](https://github.com/langgithub/wechat_check_friend_by_contact)
[![Build Status](https://travis-ci.org/openatx/atx-server.svg?branch=master)](https://github.com/langgithub/CloudControl)
##### CloudControl的功能介绍
- 基于wifi无线方式管理手机
- 手机群控管理，批量操作
- 集成web端 terminal控制台，实时下发命令
- 集成文件上传功能
- 集成inspector，实时获取手机布局

### 视频展示
1. 基本功能
![image](https://github.com/langgithub/CloudControl/blob/master/qunkong01.gif)
2. 群控，批量点击与滑动
![image](https://github.com/langgithub/CloudControl/blob/master/qunkong02.gif)
3. 文件上传 群发
![image](https://github.com/langgithub/CloudControl/blob/master/qunkong03.gif)

### 运行环境
- mongodb
- python aiohttp

### 使用步骤
1. 建立 atxserver 数据库（monogodb）。无需建立表
2. python main.py 直接运行
3. python -m uiautomator2 init --server 服务器ip:端口 （维持心跳）
如： python -m uiautomator2 init --server 172.17.2.36:8000

### 遗留问题
云机同步卡顿严重 chrome端通讯承受太多通讯压力，后期可改为服务端的批量minitouch

### wiki
1. https://larryzhuo.github.io/2016/12/08/20161208/


手机群控：
1、前端群控卡 https://larryzhuo.github.io/2016/12/08/20161208/
    1）图片质量压缩一下
    2）画布
2、前端界面 
3、python版本
4、产品意见
