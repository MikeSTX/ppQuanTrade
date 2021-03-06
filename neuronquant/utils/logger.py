import logging

import os
import sys

#NOTE Database: http://pythonhosted.org/Logbook/api/ticketing.html#module-logbook.ticketing
from logbook import Logger
from logbook.queues import ZeroMQHandler
from logbook.more import ColorizingStreamHandlerMixin, ColorizedStderrHandler
from logbook import NestedSetup, FileHandler, Processor, StderrHandler, StreamHandler

from utils import get_ip


def inject_information(record):
    record.extra['ip'] = get_ip()

log_format = u'[{record.time:%Y-%m-%d %H:%M}] {record.channel} - {record.level_name}: {record.message} \t({record.extra[ip]})'

# a nested handler setup can be used to configure more complex setups
setup = NestedSetup([
    #StderrHandler(format_string=u'[{record.time:%Y-%m-%d %H:%M}] {record.channel} - {record.level_name}: {record.message} \t({record.extra[ip]})'),
    StreamHandler(sys.stdout, format_string=log_format),
    # then write messages that are at least warnings to to a logfile
    FileHandler(os.environ['QTRADE_LOG'], level='WARNING'),
    Processor(inject_information)
])

color_setup = NestedSetup([
    StreamHandler(sys.stdout, format_string=log_format),
    ColorizedStderrHandler(format_string=log_format, level='NOTICE'),
    Processor(inject_information)
])

remote_setup = NestedSetup([
    ZeroMQHandler('tcp://127.0.0.1:5540'),
    Processor(inject_information)
])

log = Logger('Trade Labo')


#TODO: reimplement fatal function with (colors ?) exit
'''---------------------------------------------------------------------------------------
Logger class
---------------------------------------------------------------------------------------'''


class LogSubsystem(object):
    ''' Trade logging version '''
    def __init__(self, name='default', lvl='debug', file_channel=False):
        if lvl == "debug":
            lvl = logging.DEBUG
        elif lvl == "info":
            lvl = logging.INFO
        elif lvl == 'error':
            lvl = logging.ERROR
        elif lvl == 'warning':
            lvl = logging.WARNING
        elif lvl == "critical":
            lvl = logging.CRITICAL
        else:
            print '[DEBUG] __LogSubSystem__ : Unsupported mode, setting default logger level: debug'
            lvl = logging.DEBUG
        if name == '':
            self.logger = logging.getLogger()
        else:
            self.logger = logging.getLogger(name)
        self.logger.setLevel(lvl)
        self.setup(lvl)

    def setup(self, lvl = logging.DEBUG):
        self.formatter = logging.Formatter('[%(levelname)s] %(name)s :  %(message)s')

        ch = logging.StreamHandler()
        ch.setLevel(lvl)
        ch.setFormatter(self.formatter)
        self.logger.addHandler(ch)

        print('[DEBUG] __LogSubSystem__ : Logging initialized.')

    def addFileHandler(self, lvl = logging.DEBUG, file_store = 'pyTrade.log'):
        fh = logging.FileHandler(file_store)
        fh.setLevel(lvl)
        fh.setFormatter(self.formatter)
        self.logger.addHandler(fh)
        print('[DEBUG] __LogSubSystem__ : Logging file handler initialized.')

    def getLog(self):
        return self.logger


'''---------------------------------------------------------------------------------------
Usage Exemple
---------------------------------------------------------------------------------------'''
'''
if __name__ == '__main__':
  logSys = LogSubSystem(__name__, "debug")
  #logSys.addFileHandler()
  log = logSys.getLog()

  # 'application' code
  log.debug('SQLite fork wrapper test')
'''
