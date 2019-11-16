var canvas = null;
var ctx = null;
const IMG_SCALE = 0.46;
const REFRESH_PERIOD = 10;
const PHASE_TIME = 1000;
var phase = 0;
var POINTS_SIZE = 7;
var limit_x = 800;
var limit_y = 600;
var FADE_PHASE_SHARE = 0.2;

var points = [
    {
        current: {
            x: 200, y: 100, role: 'a'
        },
        prev: {
            x: 100, y: 120, role: 'b'
        }
    }
];

function addPoint() {
    points.push({
        current: {
            x: Math.random() * limit_x,
            y: Math.random() * limit_y
        },
        prev: null
    })
}


function start() {
    setupCanvas();
    // createPoints();
    setInterval(reload, REFRESH_PERIOD);
}

window.onload = start;

function reload() {
    draw();
    if (phase <= 1) {
        phase += REFRESH_PERIOD / PHASE_TIME;
    } else {
        nextPhase();
    }
}

function nextPhase() {
    var newPoints = [];
    points.forEach(point => {
        newPoints.push({
            current: {
                x: Math.random() * limit_x,
                y: Math.random() * limit_y
            },
            prev: point.current
        });
    });
    points = newPoints;
    addPoint();
    phase = 0;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    points.forEach(point => {
        drawPoint(point);
    })
}

function drawPoint(point) {

    var x, y, size;
    if (point.prev !== null) {
        const shift = Math.sin(phase * Math.PI / 2);
        x = point.prev.x + shift * (point.current.x - point.prev.x);
        y = point.prev.y + shift * (point.current.y - point.prev.y);
        size = POINTS_SIZE;
    } else {
        x = point.current.x;
        y = point.current.y;
        fade_phase = phase > FADE_PHASE_SHARE ? 1 : phase * (1 - FADE_PHASE_SHARE);
        size = fade_phase * POINTS_SIZE + Math.sin(fade_phase * Math.PI) * 8 * POINTS_SIZE;
    }

    ctx.fillStyle = 'rgb(255, 165, 0, 30)';
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
}

function setupCanvas() {
    canvas = document.getElementById('floor1');
    ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return ctx;
}

