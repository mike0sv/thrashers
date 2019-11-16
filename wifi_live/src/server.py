import math
import time
from collections import defaultdict
from threading import Thread, Lock
from typing import List, Tuple, Dict

from flask import Flask, jsonify
from flask_caching import Cache
from flask_cors import CORS
from pyjackson import serialize

from listener import PikaCon


class Role:
    PASSIVE = 'passive'
    INFECTED = 'infected'
    CURER = 'curer'

    DEFAULT = PASSIVE


class Agent:
    MAX_HISTORY = 5
    FLOOR_MAPPING = {
        'Otaniemi>Väre>0': 0,
        'Otaniemi>Väre>1': 20,
        'Otaniemi>Väre>2': 40,
        'Otaniemi>Väre>3': 60,
    }

    def __init__(self, mac: str, coord: Tuple[float, float, int], role: str,
                 last_updated: int):
        self.last_updated = last_updated
        self.mac = mac
        self.coord = coord
        self.history: List[Tuple[float, float, int]] = []
        self.role = role

    @property
    def sector(self):
        if self.coord is None:
            return None
        x, y, floor = self.coord
        sx, sy = x // SECTOR_SIZE, y // SECTOR_SIZE
        return sy * SECTORS_ROW_LENGTH + sx + floor * FLOOR_SECTORS

    @classmethod
    def create(cls, notification):
        global HAVE_PATIENT_ZERO
        mac = notification['mac']
        agent = Agent(mac, None, Role.DEFAULT, None)
        if not HAVE_PATIENT_ZERO:
            HAVE_PATIENT_ZERO = True
            agent.role = Role.INFECTED
        agent.update(notification)
        return agent

    def update(self, notification):
        self.last_updated = notification['timestamp']
        coord = notification['x'], notification['y'], self.FLOOR_MAPPING[notification['floor']]
        self._update_coord(coord)

    def _update_coord(self, coord):
        if coord != self.coord:
            try:
                _sectors_cache[self.sector].remove(self.mac)
            except KeyError:
                pass

            self.coord = coord
            _sectors_cache[self.sector].add(self.mac)
            self.history.append(coord)
            self.history = self.history[-self.MAX_HISTORY:]


_agent_cache: Dict[str, Agent] = {}
_sectors_cache = defaultdict(set)
HAVE_PATIENT_ZERO = False
lock = Lock()


def notification_valid(notification):
    return notification['floor'] in Agent.FLOOR_MAPPING


def update_handler(notification):
    print(len(_agent_cache))
    if not notification_valid(notification):
        return
    mac = notification['mac']
    if mac not in _agent_cache:
        with lock:
            _agent_cache[mac] = Agent.create(notification)
    else:
        _agent_cache[mac].update(notification)


def update_thread():
    con = PikaCon()
    con.consume(update_handler)


def start_thread(target):
    t = Thread(target=target, daemon=True)
    t.start()


#  ------------------------------------------
SECTOR_SIZE = 30
SECTORS_ROW_LENGTH = 100
FLOOR_SECTORS = 100000
DIST_TH = 20
RECOLOR_TIMEOUT = 5


def _near_sectors(agent: Agent):
    center = agent.sector
    return [center - 1 - SECTORS_ROW_LENGTH,
            center - SECTORS_ROW_LENGTH,
            center - SECTORS_ROW_LENGTH + 1,
            center - 1,
            center,
            center + 1,
            center - 1 + SECTORS_ROW_LENGTH,
            center + SECTORS_ROW_LENGTH,
            center + 1 + SECTORS_ROW_LENGTH]


def objs_dist(coord1, coord2):
    x1, y1, floor1 = coord1
    x2, y2, floor2 = coord2
    if floor1 != floor2:
        return 9999
    return math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)


def recolor():
    to_infest = []
    for mac, agent in _agent_cache.items():
        if agent.role == Role.PASSIVE:
            continue
        elif agent.role == Role.INFECTED:
            for sec in _near_sectors(agent):
                for mac2 in _sectors_cache[sec]:
                    agent2 = _agent_cache[mac2]
                    if mac == mac2 or agent2.role == Role.INFECTED:
                        continue
                    if objs_dist(agent.coord, agent2.coord) < DIST_TH:
                        to_infest.append(mac2)

    for mac in to_infest:
        _agent_cache[mac].role = Role.INFECTED
        print(mac, 'INFECTED!!!!')


def recolor_thread():
    while True:
        recolor()
        time.sleep(RECOLOR_TIMEOUT)


app = Flask(__name__)
cache = Cache(config={'CACHE_TYPE': 'simple'})
CORS(app)
cache.init_app(app)


@app.route('/actors')
@cache.cached(timeout=.5)
def get_actors():
    with lock:
        return jsonify(serialize(_agent_cache, Dict[str, Agent]))


def main():
    start_thread(update_thread)
    app.run('0.0.0.0')


if __name__ == '__main__':
    main()
