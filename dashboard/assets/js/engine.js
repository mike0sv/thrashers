const IMG_SCALE = 0.46;
const IMG_SHIFT_X = 0;
const IMG_SHIFT_Y = 0;
const CANVAS_HEIGHT = 700;
const DISTANCE_THRESHOLD = 10;

var layerShift = 0;

const REFRESH_PERIOD = 10;
const PHASE_TIME = 1000;
const LAYER_PHASE_TIME = 500;
const POINTS_SIZE = 4;
const FADE_PHASE_SHARE = 0.1;
const FADE_SHIFT_MAX = 0.3;
const X = 0;
const Y = 1;
const Z = 2;
const COORD_SCALE = 1.63;

const textColor = '#F18021';
const purple = '#770578';
const blue = '#35E2DF';
const colors = {
    infected: '#F18021',
    passive: '#770578',
    curer: '#35E2DF'
};

var canvas = null;
var ctx = null;
var phase = 0;
var layerShiftPhase = 0;
var loading = false;

var macHover = null;

var floor = 20;
var targetFloor = null;
var floorScrollDirection = 0;
var stats = {
    0: {healthy: 0, infected: 0},
    20: {healthy: 0, infected: 0},
    40: {healthy: 0, infected: 0},
    60: {healthy: 0, infected: 0}
};

const FLOOR_MIN = 0;
const FLOOR_MAX = 60;
const FLOOR_STEP = 20;

const LAYER_CONF = {
    x: 850,
    y: 100,
    shift: 20,
    widthEdge: 20,
    widthCenter: 30,
    height: 10,
    arrowStart: -20,
    arrowEnd: -10
};

var background1 = null;

const API_URI = 'http://35.231.19.141:5000';
const ACTORS_URI = API_URI + '/actors';
const INFECT_URI = API_URI + '/infect';
const HEAL_URI = API_URI + '/heal_all';

var points = {};


function start() {
    setupCanvas();
    loadBackground();
}

window.onload = start;

function reload() {
    calcStats();
    draw();
    if (targetFloor !== null) {
        if (layerShiftPhase > 0.5) {
            floor = targetFloor;
        }
        if (layerShiftPhase <= 1) {
            layerShiftPhase += REFRESH_PERIOD / LAYER_PHASE_TIME;
            layerShift = floorScrollDirection * Math.sin(layerShiftPhase * Math.PI) * CANVAS_HEIGHT * (layerShiftPhase > 0.5 ? -1 : 1);
        } else {
            layerShiftPhase = 0;
            targetFloor = null;
            layerShiftPhase = 0;
        }
    }
    if (phase <= 1 && !loading) {
        phase += REFRESH_PERIOD / PHASE_TIME;
    } else if (!loading) {
        loading = true;
        loadNewPoints();
    }
}

function calcStats() {
    const newStats = {
        0: {healthy: 0, infected: 0},
        20: {healthy: 0, infected: 0},
        40: {healthy: 0, infected: 0},
        60: {healthy: 0, infected: 0}
    };

    for (let mac in points) {
        if (!points.hasOwnProperty(mac)) continue;
        const point = points[mac];
        if (point.role === 'passive') {
            newStats[point.coord[Z]].healthy++;
        } else {
            newStats[point.coord[Z]].infected++;
        }
    }
    stats = newStats;
}

function loadNewPoints() {
    try {
        $.getJSON({
            url: ACTORS_URI,
            success: nextPhase
        });
    } catch (e) {
        console.error('failed to access api', e);
    }
}

function nextPhase(apiPoints) {
    for (let mac in points) {
        if (!points.hasOwnProperty(mac)) continue;
        points[mac].state = 'standing';
        delete points[mac].prev;
    }

    for (let mac in apiPoints) {
        if (!apiPoints.hasOwnProperty(mac)) continue;
        const newPoint = apiPoints[mac];

        if (points.hasOwnProperty(mac)) {
            const oldPoint = points[mac];
            oldPoint['prev'] = oldPoint['coord'];
            oldPoint['coord'] = newPoint['coord'];
            if (oldPoint['role'] !== newPoint['role']) {
                console.log('CAPTURED');
                oldPoint.state = 'captured';
            } else {
                oldPoint.state = 'moving';
            }
            oldPoint['role'] = newPoint['role'];
            oldPoint['last_updated'] = newPoint['last_updated'];
        } else {
            newPoint.state = 'new';
            newPoint.fadeInDelay = Math.random() * Math.min(1 - FADE_PHASE_SHARE, FADE_SHIFT_MAX);
            points[mac] = newPoint;
        }
    }

    const macsToDelete = [];
    for (let mac in points) {
        if (!points.hasOwnProperty(mac)) continue;
        if (!apiPoints.hasOwnProperty(mac)) {
            console.log('FOUND MAC TO DELETE', mac);
            macsToDelete.push(mac);
        }
    }
    for (var mac in macsToDelete) {
        console.log('DELETING MAC', mac);
        delete points[mac];
    }
    loading = false;
    phase = 0;
}

function gotToFloor(floorRequest) {
    console.log('targetFloor', floorRequest);
    if (floorRequest === floor) {
        return;
    }
    targetFloor = floorRequest;
    floorScrollDirection = -(floor - targetFloor) / Math.abs(floor - targetFloor);
    console.log('floorScrollDirection', floorScrollDirection);
}

function draw() {
    // console.log('draw');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(background1, IMG_SHIFT_X, IMG_SHIFT_Y + layerShift, background1.width * IMG_SCALE, background1.height * IMG_SCALE);

    // console.log('drawing points', Object.keys(points).length , phase);
    for (let mac in points) {
        if (!points.hasOwnProperty(mac)) continue;
        drawPoint(points[mac]);
    }
    addTextInfo();
    drawLayers();
    addMacDialog();
}

function addMacDialog() {
    if (!macHover) return;

    const point = points[macHover];
    const x = point.coord[X];
    const y = point.coord[Y];
    const size = POINTS_SIZE;

    ctx.fillStyle = colors[point.role];
    ctx.fillRect(x * COORD_SCALE + 8, y * COORD_SCALE - 24 + layerShift, 100, 10);

    ctx.moveTo(x * COORD_SCALE + 8, y * COORD_SCALE - 24 + layerShift + 7);
    ctx.beginPath();
    ctx.lineTo(x * COORD_SCALE + size / 2, y * COORD_SCALE - size / 2 + layerShift);
    ctx.lineTo(x * COORD_SCALE + 12, y * COORD_SCALE - 24 + layerShift + 10);
    ctx.lineTo(x * COORD_SCALE + 8, y * COORD_SCALE - 24 + layerShift + 7);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#000";
    ctx.fillText(macHover, x * COORD_SCALE + 16, y * COORD_SCALE - 15 + layerShift);
}

function addTextInfo() {
    ctx.fillStyle = textColor;
    ctx.font = "Lato,sans-serif";
    ctx.fillText("Healthy people: " + stats[floor].healthy, 850, 50);
    ctx.fillStyle = purple;
    ctx.fillRect(835, 43, 7, 7);
    ctx.fillStyle = textColor;
    ctx.fillText("People infected: " + stats[floor].infected, 850, 70);
    ctx.fillRect(835, 63, 7, 7);
    // ctx.fillText("MAC: " + macHover, 850, 90);
}

function infect() {
    $.get(INFECT_URI + '?floor=' + floor, infected);
}

function infected(data) {
    console.log('data', data);
    points[data].role = 'infected';
}

function heal() {
    for (let mac in points) {
        if (!points.hasOwnProperty(mac)) continue;
        points[mac].state = 'passive';
    }
    $.get(HEAL_URI);
}


function drawPoint(point) {
    if (point.coord[Z] !== floor) return;

    var x, y, size;
    if (point.hasOwnProperty('prev')) {
        const shift = Math.sin(phase * Math.PI / 2);
        x = point.prev[X] + shift * (point.coord[X] - point.prev[X]);
        y = point.prev[Y] + shift * (point.coord[Y] - point.prev[Y]);

        if (point.state === 'captured') {
            if (phase > FADE_PHASE_SHARE) {
                fade_phase = 1;
            } else {
                fade_phase = phase * (1 - FADE_PHASE_SHARE);
            }
            size = fade_phase * POINTS_SIZE + Math.sin(fade_phase * Math.PI) * 8 * POINTS_SIZE;
        } else {
            size = POINTS_SIZE;
        }
    } else {
        x = point.coord[X];
        y = point.coord[Y];
        var fade_phase = null;
        if (point.state === 'new') {
            const delay = point.fadeInDelay;
            if (phase < delay) {
                fade_phase = 0;
            } else if (phase > FADE_PHASE_SHARE + delay) {
                fade_phase = 1;
            } else {
                fade_phase = phase * (1 - FADE_PHASE_SHARE - delay);
            }
        } else {
            fade_phase = 1;
        }
        size = fade_phase * POINTS_SIZE + Math.sin(fade_phase * Math.PI) * 2.5 * POINTS_SIZE;
    }

    ctx.fillStyle = colors[point['role']];
    ctx.fillRect(x * COORD_SCALE - size / 2, y * COORD_SCALE - size / 2 + layerShift, size, size);
}

function drawLayers() {
    // const fullLength = LAYER_CONF.widthCenter + LAYER_CONF.widthEdge * 2;
    var x = LAYER_CONF.x;
    var y = LAYER_CONF.y;
    for (let i = 4; i > 0; i--) {
        drawLayer(x, y, i);
        y += LAYER_CONF.shift;
    }
}

function getHealthyShare(floor) {
    const floorStats = stats[floor];
    if (floorStats.infected === 0) {
        return 0;
    }
    return floorStats.infected / (floorStats.infected + floorStats.healthy);
}

function drawLayer(x, y, index) {
    const layerElevation = (index - 1) * FLOOR_STEP;
    const share = getHealthyShare(layerElevation);

    ctx.moveTo(x + LAYER_CONF.widthEdge, y);
    ctx.beginPath();
    ctx.lineTo(x + LAYER_CONF.widthEdge, y);
    ctx.lineTo(x + LAYER_CONF.widthEdge * 2 + LAYER_CONF.widthCenter, y);
    ctx.lineTo(x + LAYER_CONF.widthEdge + LAYER_CONF.widthCenter, y + LAYER_CONF.height);
    ctx.lineTo(x, y + LAYER_CONF.height);
    ctx.closePath();
    // ctx.fillStyle = textColor;
    // ctx.fill();
    ctx.strokeStyle = textColor;
    ctx.stroke();

    // console.log('share', share);
    if (share > 0) {
        const len = LAYER_CONF.widthEdge * 2 + LAYER_CONF.widthCenter;
        const rightBorder = len * share;

        ctx.moveTo(x, y + LAYER_CONF.height);
        ctx.beginPath();
        const x1 = Math.min(x + LAYER_CONF.widthEdge, x + rightBorder);
        const y1 = rightBorder > LAYER_CONF.widthEdge ? y : y + LAYER_CONF.height * (1 - rightBorder / LAYER_CONF.widthEdge);
        ctx.lineTo(x1, y1);

        if (rightBorder > LAYER_CONF.widthEdge) {
            ctx.lineTo(x + rightBorder, y);
        }
        if (rightBorder > LAYER_CONF.widthEdge + LAYER_CONF.widthCenter) {
            ctx.lineTo(x + rightBorder, y + LAYER_CONF.height * (1 - (rightBorder - LAYER_CONF.widthEdge - LAYER_CONF.widthCenter) / LAYER_CONF.widthEdge))
            ctx.lineTo(x + LAYER_CONF.widthEdge + LAYER_CONF.widthCenter, y + LAYER_CONF.height);
        }
        ctx.lineTo(x + rightBorder, y + LAYER_CONF.height);
        ctx.lineTo(x, y + LAYER_CONF.height);
        ctx.closePath();
        ctx.fillStyle = textColor;
        ctx.fill();
    }

    if (share > 0.5) {
        ctx.fillStyle = "#000";
    } else {
        ctx.fillStyle = textColor;
    }
    ctx.font = "Lato,sans-serif";
    ctx.fillText(index, x + LAYER_CONF.widthEdge + LAYER_CONF.widthCenter / 2 - 2, y + LAYER_CONF.height * 0.8);

    if (layerElevation === floor) {
        ctx.moveTo(x + LAYER_CONF.arrowStart, y);
        ctx.beginPath();
        ctx.lineTo(x + LAYER_CONF.arrowEnd, y + LAYER_CONF.height / 2);
        ctx.lineTo(x + LAYER_CONF.arrowStart, y + LAYER_CONF.height);
        ctx.lineTo(x + LAYER_CONF.arrowStart, y);
        ctx.closePath();
        ctx.strokeStyle = textColor;
        ctx.stroke();
    }
}

function loadBackground() {
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.imageSmoothingEnabled = false;

    background1 = new Image();
    background1.onload = function () {
        console.log('Background loaded');
        setInterval(reload, REFRESH_PERIOD);
    };
    background1.src = 'images/floor1.jpg';
}

function findClosestPoint(x, y) {
    x = x / COORD_SCALE;
    y = y / COORD_SCALE;
    var minDistance = DISTANCE_THRESHOLD;
    var minMac = null;
    var minPoint = null;
    Object.values(points).forEach(point => {
        if(point.coord[Z] !== floor) return;
        const distance = Math.sqrt((point.coord[X] - x) * (point.coord[X] - x) + (point.coord[Y] - y) * (point.coord[Y] - y));
        if (distance < minDistance) {
            minMac = point.mac;
            minPoint = point;
            minDistance = distance;
        }
    });
    macHover = minMac;
}

function setupCanvas() {
    canvas = document.getElementById('floor1');
    canvas.addEventListener("mouseup", function (e) {
        getMousePosition(canvas, e);
    });
    canvas.addEventListener("mousemove", function (e) {
        getMousePosition(canvas, e);
    });
    ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return ctx;
}

function getMousePosition(canvas, event) {
    let rect = canvas.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;
    findClosestPoint(x, y);
    handleMouse(x, y);
}

function handleMouse(xM, yM) {
    const x = LAYER_CONF.x;
    var y = LAYER_CONF.y;
    for (let i = FLOOR_MAX; i >= FLOOR_MIN; i -= FLOOR_STEP) {
        if (checkLayerClick(x, y, xM, yM)) {
            gotToFloor(i);
            return;
        }
        y += LAYER_CONF.shift;
    }
}

function checkLayerClick(x, y, xM, yM) {
    return xM > x && xM < x + LAYER_CONF.widthCenter + LAYER_CONF.widthEdge * 2
        && yM > y && yM < y + LAYER_CONF.height;
}
