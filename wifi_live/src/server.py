import math
import random
import sys
import threading
import time
import traceback
from collections import defaultdict
from functools import wraps
from threading import Thread, Lock
from typing import List, Tuple, Dict, Optional

from flask import Flask, jsonify, request
from flask_caching import Cache
from flask_cors import CORS
from pyjackson import serialize

from listener import PikaCon
from metrics import Reporter

_agent_cache: Dict[str, 'Agent'] = {}
_sectors_cache = defaultdict(set)
lock = Lock()
_treads: List[Thread] = []

SECTOR_SIZE = 30
SECTORS_ROW_LENGTH = 100
FLOOR_SECTORS = 100000
DIST_TH = 10
HAVE_PATIENT_ZERO = False
MAX_UPDATE_DISTANCE = 100
MAX_UPDATE_TIMEOUT = 300
CLEAR_TIMEOUT = 30 * 60
RECOLOR_TIMEOUT = .5
REPORT_DATA = True
if REPORT_DATA:
    reporter = Reporter()
else:
    reporter = None

INFECTION_START = time.time()
INFECTION_STARTED = False

app = Flask(__name__)
cache = Cache(config={'CACHE_TYPE': 'simple'})
CORS(app)
cache.init_app(app)


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

    def __init__(self, mac: str, coord: Optional[Tuple[float, float, int]], role: str,
                 last_updated: int):
        self.last_updated = last_updated
        self.mac = mac
        self.coord = coord
        self.history: List[Tuple[float, float, int]] = []
        self._role = role
        self.creation_time = last_updated
        self.infection_time = None

    def infect(self):
        global INFECTION_STARTED, INFECTION_START
        self.infection_time = time.time()
        self._role = Role.INFECTED
        if REPORT_DATA:
            reporter.report_infection(self)

        if not INFECTION_STARTED:
            INFECTION_STARTED = True
            INFECTION_START = time.time()

    def cure(self):
        self.creation_time = time.time()
        self.infection_time = None
        self._role = Role.PASSIVE

    @property
    def survived_for(self):
        if self.infection_time is None:
            return int(time.time() - self.creation_time)
        return int(self.infection_time - self.creation_time)

    @property
    def role(self):
        return self._role

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
        agent = Agent(mac, None, Role.DEFAULT, notification['timestamp'])
        agent.update(notification)
        if not HAVE_PATIENT_ZERO:
            HAVE_PATIENT_ZERO = True
            agent.infect()
        return agent

    def update(self, notification):
        self.last_updated = notification['timestamp']
        coord = notification['x'], notification['y'], self.FLOOR_MAPPING[notification['floor']]
        self._update_coord(coord)

    def _update_coord(self, coord):
        if coord != self.coord:
            if (self.coord is not None and
                    objs_dist(self.coord, coord) > MAX_UPDATE_DISTANCE and
                    time.time() - self.last_updated < MAX_UPDATE_TIMEOUT):
                return
            try:
                _sectors_cache[self.sector].remove(self.mac)
            except KeyError:
                pass

            self.coord = coord
            _sectors_cache[self.sector].add(self.mac)
            self.history.append(coord)
            self.history = self.history[-self.MAX_HISTORY:]


def notification_valid(notification):
    return notification['floor'] in Agent.FLOOR_MAPPING


def update_handler(notification):
    if not notification_valid(notification):
        return
    mac = notification['mac']
    is_new_agent = mac not in _agent_cache
    if is_new_agent:
        with lock:
            _agent_cache[mac] = Agent.create(notification)

    else:
        _agent_cache[mac].update(notification)
    if REPORT_DATA:
        reporter.report_event(_agent_cache[mac], is_new_agent)


def update_thread():
    con = PikaCon()
    con.consume(update_handler)


def clear_timed_out():
    with lock:
        to_remove = []
        for agent in _agent_cache.values():
            if time.time() - agent.last_updated > CLEAR_TIMEOUT:
                to_remove.append(agent.mac)

        for mac in to_remove:
            agent = _agent_cache[mac]
            _sectors_cache[agent.sector].remove(mac)
            del _agent_cache[mac]


def clear_thread():
    while True:
        try:
            clear_timed_out()
        except:
            traceback.print_exc()
        time.sleep(CLEAR_TIMEOUT / 2)


def start_thread(target):
    t = Thread(target=target, name=target.__name__, daemon=True)
    t.start()
    _treads.append(t)


#  ------------------------------------------


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


def timeit(f):
    @wraps(f)
    def inner(*args, **kwargs):
        start = time.time()
        r = f(*args, **kwargs)
        print(f.__name__, 'in', f'{time.time() - start:2f}')
        return r

    return inner


def recolor():
    to_infect = []
    with lock:
        if REPORT_DATA:
            reporter.report_all(_agent_cache.values())
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
                            to_infect.append(mac2)

    for mac in to_infect:
        _agent_cache[mac].infect()


def recolor_thread():
    while True:
        try:
            recolor()
        except:
            traceback.print_exc()
        time.sleep(RECOLOR_TIMEOUT)


@app.route('/actors')
@cache.cached(timeout=.5)
def get_actors():
    with lock:
        return jsonify(serialize(_agent_cache, Dict[str, Agent]))


@app.route('/infect')
def infect():
    mac = request.args.get('mac', None)
    floor = int(request.args.get('floor', -99))
    if mac is None:
        with lock:
            macs = [k for k, v in _agent_cache.items() if floor == -99 or v.coord[2] == floor]
            mac = random.choice(macs)

    _agent_cache[mac].infect()
    return mac


@app.route('/heal_all')
def heal_all():
    global INFECTION_STARTED
    with lock:
        for agent in _agent_cache.values():
            agent.cure()
    INFECTION_STARTED = False
    return 'ok'


@app.route('/distance')
def get_distance():
    return str(DIST_TH)


@app.route('/distance', methods=['POST'])
def set_distance():
    global DIST_TH
    DIST_TH = float(request.form.get('distance', DIST_TH))
    return 'ok'


@app.route('/threads')
def get_threads():
    return jsonify(
        {t.name: str(t) for t in threading.enumerate()}
    )


@app.route('/start_time')
def get_infection_start():
    return str(int(INFECTION_START)) if INFECTION_STARTED else '0'


def main():
    start_thread(update_thread)
    start_thread(recolor_thread)
    start_thread(clear_thread)
    if REPORT_DATA:
        start_thread(reporter.push_thread)
    app.run('0.0.0.0')


if __name__ == '__main__':
    main()
