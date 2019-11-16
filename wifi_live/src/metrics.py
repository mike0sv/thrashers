import os
import time
from typing import Iterable

from influxdb import InfluxDBClient
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

DB_HOST = os.environ.get('DB_HOST', 'influx-28d1efec-mike0sv-3bf9.aivencloud.com')
DB_PORT = int(os.environ.get('DB_PORT', '20332'))
DB_USER = os.environ.get('DB_USER', 'reporter')
DB_PASSWORD = os.environ.get('DB_PASSWORD')
DB_DBNAME = 'infection'
DB_TOTAL = 'total'


class Reporter:
    def __init__(self):
        self.client = InfluxDBClient(DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DBNAME, ssl=True)
        self.measurement = None
        self.renew_measurement()

    def renew_measurement(self):
        self.measurement = f'run_{int(time.time())}'

    def report(self, agents: Iterable['Agent']):
        infected = sum(1 for a in agents if a.role == Role.INFECTED)
        not_infected = sum(1 for a in agents if a.role == Role.PASSIVE)
        if infected == 0 and not_infected == 0:
            not_infected = 1
        points = [
                     {
                         "measurement": self.measurement,
                         "tags": {
                             "mac": a.mac,
                             "role": a.role
                         },
                         "time": a.last_updated,
                         "fields": {
                             'x': a.coord[0],
                             'y': a.coord[1],
                             'z': a.coord[2]
                         }
                     } for a in agents
                 ] + [
                     {
                         "measurement": DB_TOTAL,
                         "tags": {
                             "run": self.measurement
                         },
                         "time": int(time.time()),
                         "fields": {
                             'infected': infected,
                             'not_infected': not_infected,
                             'infected_share': infected / (infected + not_infected)
                         }
                     }
                 ]
        self.client.write_points(points, time_precision='s')


from server import Agent, Role
