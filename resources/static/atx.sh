#!/system/bin/sh

case $1 in
    "")
    echo "start <ip>"
    echo "  demo:start x.x.x.x:8000"
    echo "stop"
    echo "  demo:stop"
    echo "restart <ip>"
    echo "  demo:restart x.x.x.x:8000"
    ;;
    "start")
        echo "atx-agent start..."
        #Start in log-free mode
        nohup /data/local/tmp/atx-agent server -t $2 >/dev/null 2>&1 &
        ;;
    "stop")
        echo "atx-agent stop..."
        nohup /data/local/tmp/atx-agent server -d --stop >/dev/null 2>&1 &
        ;;
    "restart")
        echo "atx-agent restart..."
        /data/local/tmp/atx-agent server -d --stop
        #Start in log-free mode
        nohup /data/local/tmp/atx-agent server -t $2 >/dev/null 2>&1 &
        ;;
esac