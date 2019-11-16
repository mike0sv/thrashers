to sun all the stuff, do this
1. run rmq with `docker-compose up -d`
2. go to src, install dependencies with pip install -r requirements.txt
3. run listener.py to collect data and send it to rmq
4. run draw_server.py to read data from rmq and simulate stuff