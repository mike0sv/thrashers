import time
from collections import defaultdict
from threading import Thread, Lock

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation

from listener import PikaCon

fig, ax = plt.subplots(figsize=(10, 10))

# xdata, ydata = [], []
MAX_OBJS = 100
ln = [p for _ in range(MAX_OBJS) for p in plt.plot([], [], 'r-')]

BACKGROUND = plt.imread('vare_2.jpg')
FLOOR = 'Otaniemi>Väre>1'
CONFIDENCE_TH = 100
SCALE = 12


def init():
    # ax.set_xlim(0, 2 * np.pi)
    # ax.set_ylim(-1, 1)
    ax.imshow(BACKGROUND)
    return ln


class State:
    def __init__(self, timeout=30):
        self.objects = defaultdict(list)
        self.last_updated = dict()
        self.current_location = dict()
        self.lock = Lock()
        self.timeout = timeout

    def clean(self):
        with self.lock:
            to_del = []
            for mac, last in self.last_updated.items():
                if time.time() - last > self.timeout and mac in self.objects:
                    to_del.append(mac)

            for td in to_del:
                del self.objects[td]

    def start_update(self):
        def handler(obj):
            if obj['floor'] != FLOOR or obj['confidence'] > CONFIDENCE_TH:
                return
            print(obj['id'])
            with self.lock:
                mac = obj['mac']
                coords = obj['x'], obj['y']
                self.objects[mac].append(coords)
                self.objects[mac] = self.objects[mac][-3:]
                self.current_location[mac] = coords
                self.last_updated[mac] = time.time()

        def tread():
            con = PikaCon()
            con.consume(handler)

        t = Thread(target=tread, daemon=True)
        t.start()

        def cleaner():
            while True:
                self.clean()
                time.sleep(10)

        t2 = Thread(target=cleaner, daemon=True)
        t2.start()


state = State()
state.start_update()


def update(frame):
    global ln
    with state.lock:
        for p, coords in zip(ln, state.objects.values()):
            xdata = [x * SCALE for x, y in coords]
            ydata = [y * SCALE for x, y in coords]
            p.set_data(xdata, ydata)
    return ln
    # return plt.plot(xdata, ydata, 'r-'),
    # return plt.plot([frame, frame + 1000], [frame, frame + 1000], 'ro') + [ln]


def main():
    ani = FuncAnimation(fig, update, frames=100, init_func=init, blit=True, interval=10)
    plt.show()
    # while ani.event_source is not None:
    #     time.sleep(1)


if __name__ == '__main__':
    main()
