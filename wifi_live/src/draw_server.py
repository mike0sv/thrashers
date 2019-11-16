import math
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
red_points, = plt.plot([], [], 'ro', alpha=.7)
blue_points, = plt.plot([], [], 'bo', alpha=.7)

BACKGROUND = plt.imread('vare_2.jpg')
FLOOR = 'Otaniemi>Väre>1'
DIST_TH = 30
CONFIDENCE_TH = 50
SCALE = 12
HAVE_PATIENT_ZERO = False


def init():
    # ax.set_xlim(0, 2 * np.pi)
    # ax.set_ylim(-1, 1)
    ax.imshow(BACKGROUND)
    return ln + [red_points, blue_points]


SECTOR_SIZE = 30
SECTORS_ROW_LENGTH = 100


def obj_sector(xy):
    x, y = xy
    sx, sy = x // SECTOR_SIZE, y // SECTOR_SIZE
    return sy * SECTORS_ROW_LENGTH + sx


def _near_sectors(coords):
    center = obj_sector(coords)
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
    x1, y1 = coord1
    x2, y2 = coord2
    return math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)


class State:
    def __init__(self, timeout=30):
        self.objects = defaultdict(list)
        self.last_updated = dict()
        self.current_location = dict()
        self.current_state = dict()
        self.sectors = defaultdict(set)
        self.lock = Lock()
        self.timeout = timeout

    def update_object(self, obj):
        global HAVE_PATIENT_ZERO
        with self.lock:
            mac = obj['mac']
            coords = obj['x'], obj['y']

            self.objects[mac].append(coords)
            self.objects[mac] = self.objects[mac][-3:]

            if mac in self.current_location:
                old_coord = self.current_location[mac]
                self.sectors[obj_sector(old_coord)].remove(mac)
            self.sectors[obj_sector(coords)].add(mac)

            self.current_location[mac] = coords
            if mac not in self.current_state:
                if HAVE_PATIENT_ZERO:
                    self.current_state[mac] = 'red'
                else:
                    print(mac, 'IS PATIENT 0!!!!')
                    self.current_state[mac] = 'blue'
                    HAVE_PATIENT_ZERO = True
            self.last_updated[mac] = obj['timestamp']

    def recolor(self):
        with self.lock:
            to_infest = []
            for mac, color in self.current_state.items():
                if color == 'red':
                    continue

                obj_coord = self.current_location[mac]
                for sec in _near_sectors(obj_coord):
                    for mac2 in self.sectors[sec]:
                        if mac == mac2 or self.current_state[mac2] != 'red':
                            continue
                        if objs_dist(obj_coord, self.current_location[mac2]) < DIST_TH:
                            to_infest.append(mac2)

            for mac in to_infest:
                self.current_state[mac] = 'blue'
                print(mac, 'INFESTED!!!!')

    def clean(self):
        with self.lock:
            to_del = []
            for mac, last in self.last_updated.items():
                if time.time() - last > self.timeout and mac in self.objects:
                    to_del.append(mac)
                    print(mac, 'is stale for', time.time() - last - self.timeout)

            for td in to_del:
                del self.objects[td]

    def start_update(self):
        def handler(obj):
            if obj['floor'] != FLOOR or obj['confidence'] > CONFIDENCE_TH:
                print('skipped')
                return
            print(obj['id'], 'total', len(self.current_location))
            self.update_object(obj)

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

        def recolorer():
            while True:
                self.recolor()
                time.sleep(10)

        t3 = Thread(target=recolorer, daemon=True)
        t3.start()


state = State()
state.start_update()

COLOR_MAP = {
    'red': red_points,
    'blue': blue_points
}


def update(frame):
    global ln
    with state.lock:
        for p, coords in zip(ln, state.objects.values()):
            xdata = [x * SCALE for x, y in coords]
            ydata = [y * SCALE for x, y in coords]
            p.set_data(xdata, ydata)

        for color, plot in COLOR_MAP.items():
            xdata = [x * SCALE for mac, (x, y) in state.current_location.items() if state.current_state[mac] == color]
            ydata = [y * SCALE for mac, (x, y) in state.current_location.items() if state.current_state[mac] == color]
            plot.set_data(xdata, ydata)
    return ln + [red_points, blue_points]
    # return plt.plot(xdata, ydata, 'r-'),
    # return plt.plot([frame, frame + 1000], [frame, frame + 1000], 'ro') + [ln]


def main():
    ani = FuncAnimation(fig, update, frames=100, init_func=init, blit=True, interval=10)
    plt.show()
    # while ani.event_source is not None:
    #     time.sleep(1)


if __name__ == '__main__':
    main()
