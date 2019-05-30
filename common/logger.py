"""
@author: xsren 
@contact: bestrenxs@gmail.com
@site: xsren.me

@version: 1.0
@file: logger.py
@time: 28/11/2017 3:43 PM

"""
import os
import logging
import logging.handlers


class ColoredFormatter(logging.Formatter):
    def __init__(self, fmt=None):
        logging.Formatter.__init__(self, fmt=fmt)

    def format(self, record):
        COLORS = {
            'Black': '0;30',
            'Red': '0;31',
            'Green': '0;32',
            'Brown': '0;33',
            'Blue': '0;34',
            'Purple': '0;35',
            'Cyan': '0;36',
            'Light_Gray': '0;37',

            'Dark_Gray': '1;30',
            'Light_Red': '1;31',
            'Light_Green': '1;32',
            'Yellow': '1;33',
            'Light_Blue': '1;34',
            'Light_Purple': '1;35',
            'Light_Cyan': '1;36',
            'White': '1;37',
        }
        COLOR_SEQ = "\033[%sm"
        RESET_SEQ = "\033[0m"

        message = logging.Formatter.format(self, record)

        if record.levelno == logging.DEBUG:
            message = COLOR_SEQ % COLORS['White'] + message + RESET_SEQ
        elif record.levelno == logging.INFO:
            message = COLOR_SEQ % COLORS['Green'] + message + RESET_SEQ
            pass
        elif record.levelno == logging.WARNING:
            message = COLOR_SEQ % COLORS['Brown'] + message + RESET_SEQ
        elif record.levelno == logging.ERROR:
            message = COLOR_SEQ % COLORS['Red'] + message + RESET_SEQ
        elif record.levelno == logging.CRITICAL:
            message = COLOR_SEQ % COLORS['Purple'] + message + RESET_SEQ
        return message


def get_logger(log_name="",
               log_path='/tmp/logs',
               single_log_file_size=1024 * 1024 * 1024,
               log_to_file=True,
               backup_count=0):
    """:return a logger"""

    if not os.path.exists(log_path):
        try:
            os.makedirs(log_path)
        except Exception as e:
            print(str(e))

    logger = logging.getLogger("{}".format(log_name))
    logger.setLevel(logging.INFO)

    if log_name and log_to_file:
        # file
        log_file = "{}/{}.log".format(log_path, log_name)
        fh = logging.handlers.RotatingFileHandler(log_file, maxBytes=single_log_file_size, backupCount=backup_count,
                                                  encoding="utf8")
        color_formatter = ColoredFormatter(
            fmt='%(asctime)s [%(levelname)s] %(filename)s %(funcName)s[line:%(lineno)d]: %(message)s')
        fh.setFormatter(color_formatter)
        fh.setLevel(logging.DEBUG)
        logger.addHandler(fh)

    # stdout
    sh = logging.StreamHandler()
    color_formatter = ColoredFormatter(
        fmt='%(asctime)s [%(levelname)s] %(filename)s %(funcName)s[line:%(lineno)d]: %(message)s')
    sh.setFormatter(color_formatter)
    sh.setLevel(logging.DEBUG)
    logger.addHandler(sh)

    return logger


logger = get_logger("app", os.path.dirname(os.path.dirname(__file__)) + '/log')
