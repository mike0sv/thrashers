from threading import Thread, Lock
from typing import List, Tuple, Dict

from flask import Flask, jsonify
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
        'Otaniemi>Väre>0': 'vare_0',
        'Otaniemi>Väre>1': 'vare_1',
        'Otaniemi>Väre>2': 'vare_2',
        'Otaniemi>Väre>3': 'vare_3',
    }

    def __init__(self, mac: str, coord: Tuple[float, float], history: List[Tuple[float, float, str]], role: str,
                 last_updated: int, floor: str):
        self.floor = floor
        self.last_updated = last_updated
        self.mac = mac
        self.coord = coord
        self.history = history
        self.role = role

    @classmethod
    def create(cls, notification):
        mac = notification['mac']
        agent = Agent(mac, None, [], Role.DEFAULT, None, None)
        agent.update(notification)
        return agent

    def update(self, notification):
        self.last_updated = notification['timestamp']
        coord = notification['x'], notification['y']
        floor = self.FLOOR_MAPPING[notification['floor']]
        self.floor = floor
        if coord != self.coord:
            self.coord = coord
            self.history.append(coord + (floor,))
            self.history = self.history[-self.MAX_HISTORY:]


_agent_cache: Dict[str, Agent] = {}
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


app = Flask(__name__)


@app.route('/actors')
def get_actors():
    with lock:
        return jsonify(serialize(_agent_cache, Dict[str, Agent]))


def main():
    start_thread(update_thread)
    app.run('0.0.0.0')


if __name__ == '__main__':
    main()
