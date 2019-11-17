import os
import time
import traceback
from queue import Queue, Empty
from typing import Iterable

from influxdb import InfluxDBClient
import urllib3
from influxdb.exceptions import InfluxDBClientError

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

DB_HOST = os.environ.get('DB_HOST', 'influx-28d1efec-mike0sv-3bf9.aivencloud.com')
DB_PORT = int(os.environ.get('DB_PORT', '20332'))
DB_USER = os.environ.get('DB_USER', 'reporter')
DB_PASSWORD = os.environ.get('DB_PASSWORD')
DB_DBNAME = 'defaultdb'
DB_TOTAL = 'total'


class Reporter:
    def __init__(self):
        self.client = InfluxDBClient(DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DBNAME, ssl=True)
        self.measurement = None
        self.renew_measurement()
        self.queue = Queue()

    def renew_measurement(self):
        self.measurement = f'run_{int(time.time())}'

    def push_thread(self):
        while True:
            points = []
            for _ in range(100):
                try:
                    points.extend(self.queue.get(timeout=0))
                except Empty:
                    break
            if len(points) > 0:
                try:
                    self.client.write_points(points, time_precision='s')
                except InfluxDBClientError as e:
                    traceback.print_exc()

            else:
                time.sleep(1)

    def _row(self, measurement, tags, fields, timestamp=None):
        timestamp = timestamp or int(time.time())
        return {
            "measurement": measurement,
            "tags": tags,
            "time": timestamp,
            "fields": fields
        }

    def report_all(self, agents: Iterable['Agent']):
        infected = sum(1 for a in agents if a.role == Role.INFECTED)
        not_infected = sum(1 for a in agents if a.role == Role.PASSIVE)
        if infected == 0 and not_infected == 0:
            not_infected = 1
        points = [
            self._row(DB_TOTAL, {"run": self.measurement}, {
                'infected': infected,
                'not_infected': not_infected,
                'infected_share': infected / (infected + not_infected)
            })
        ]
        self.queue.put(points)
        # self.client.write_points(points, time_precision='s')

    def report_event(self, agent: 'Agent', new=False):
        points = [
            self._row('events', {'mac': agent.mac, 'new': str(new)}, {'new': new}, agent.last_updated)
        ]
        self.queue.put(points)
        # self.client.write_points(points, time_precision='s')

    def report_infection(self, agent: 'Agent'):
        points = [
            self._row('infections', {'mac': agent.mac}, {'survived': agent.survived_for})
        ]
        self.queue.put(points)
        # self.client.write_points(points, time_precision='s')


from server import Agent, Role
