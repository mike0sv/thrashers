import contextlib
import json
import os
import time
from pprint import pprint

import pika
import requests

URL = 'http://13.48.149.61:8000/notifycache.json'
TIMEOUT = 0.05


@contextlib.contextmanager
def ssleep(timeout=TIMEOUT):
    start = time.time()
    yield
    to_sleep = timeout - (time.time() - start)
    if to_sleep > 0:
        time.sleep(to_sleep)


def transform(obj):
    n = obj['notifications'][0]
    loc = n['locationCoordinate']
    x, y, z = loc['x'], loc['y'], loc['z']
    geo = n['geoCoordinate']
    lat = geo['latitude']
    lon = geo['longitude']
    return {
        'id': n['eventId'],
        'mac': n['deviceId'],
        'timestamp': n['timestamp'] // 1000,
        'confidence': n['confidenceFactor'],
        'floor': n['locationMapHierarchy'],
        'x': x,
        'y': y,
        'lat': lat,
        'lon': lon
    }


def get_id(obj):
    return obj['notifications'][0]['eventId']


def get_objs():
    content = requests.get(URL).content
    try:
        return json.loads(b'[' + content[:-2] + b']')
    except json.decoder.JSONDecodeError:
        print('CORRUPTED', content)


def listen_loop(handler):
    last_id = None
    while True:
        with ssleep():
            objs = get_objs()
            if objs is None:
                continue
            for obj in objs:
                new_id = get_id(obj)
                if last_id == new_id:
                    continue

                last_id = new_id
                handler(obj)


def print_id_handler(obj):
    print(get_id(obj))


def print_data_handler(obj):
    pprint(transform(obj))


class PikaCon:
    HOST = os.environ.get('RMQ_HOST', 'localhost')
    PORT = int(os.environ.get('RMQ_PORT', '5672'))

    def __init__(self, host=HOST, port=PORT, exchange='', queue='hello'):
        self.connection = pika.BlockingConnection(pika.ConnectionParameters(host, port))
        self.channel = self.connection.channel()
        self.channel.queue_declare(queue=queue)
        self.exchange = exchange
        self.queue = queue

    def send(self, data):
        self.channel.basic_publish(exchange=self.exchange,
                                   routing_key=self.queue,
                                   body=json.dumps(data))

    def consume(self, handler):
        def callback(ch, method, properties, body):
            handler(json.loads(body))

        self.channel.basic_consume(
            queue=self.queue, on_message_callback=callback, auto_ack=True)

        self.channel.start_consuming()


def main():
    con = PikaCon()

    def handler(obj):
        print(get_id(obj))
        con.send(transform(obj))

    listen_loop(handler)


if __name__ == '__main__':
    main()
