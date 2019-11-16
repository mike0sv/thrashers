import json
import time

from listener import PikaCon, transform


def main():
    con = PikaCon()

    with open('history.json', 'r') as f:
        data = json.load(f)
    for row in data:
        con.send(transform([row]))
        time.sleep(0.01)


if __name__ == '__main__':
    main()
