import json

from src.listener import PikaCon


def main():
    con = PikaCon()

    def handler(obj):
        print(obj['id'])

    con.consume(handler)


if __name__ == '__main__':
    main()
